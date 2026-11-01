import { STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFamily,
  CustomFontFamilyDraft,
  CustomFontLoadResult,
  CustomFontTransactionBeginResult,
  CustomFontTransactionMode
} from "../custom-font-types"
import type { SiteProfile } from "../definitions"
import {
  createCustomFontFileHash,
  isCustomFontFaceSignatureValid
} from "../utils/custom-font-format"
import { normalizeCustomFontFamily } from "../utils/custom-font-normalization"
import {
  CustomFontTransactionStore,
  clearCustomFontTransactionRecovery,
  deleteUnreferencedCustomFontFaceBlobs,
  deleteUnusedCustomFontFaceBlobs,
  readCustomFontFaceBytes,
  validateFamilyQuota
} from "../utils/custom-font-storage"
import { createCustomFontDeletionUpdate } from "../utils/custom-fonts"

type ManagerCallbacks = {
  readSettings: () => Promise<Record<string, unknown>>
  writeSettings: (settings: Record<string, unknown>) => Promise<unknown>
}

function getFamilies(settings: Record<string, unknown>): CustomFontFamily[] {
  const families = settings[STORAGE_KEYS.CUSTOM_FONT_LIST]
  return Array.isArray(families) ? (families as CustomFontFamily[]) : []
}

function normalizeDraft(family: CustomFontFamilyDraft): CustomFontFamily {
  const normalized = normalizeCustomFontFamily({ ...family, revision: 1 })
  if (!normalized) throw new Error("invalid-custom-font-family")
  return normalized
}

function hasDuplicateFamilyName(
  family: Pick<CustomFontFamily, "displayName" | "value">,
  families: CustomFontFamily[]
): boolean {
  return families.some(
    (item) =>
      item.value !== family.value &&
      item.displayName.localeCompare(family.displayName, undefined, {
        sensitivity: "accent"
      }) === 0
  )
}

function isPublishedFamily(
  family: CustomFontFamily,
  families: CustomFontFamily[]
): boolean {
  const published = families.find(
    (candidate) =>
      candidate.value === family.value && candidate.revision === family.revision
  )
  if (!published || published.faces.length !== family.faces.length) return false
  const publishedFaces = new Map(
    published.faces.map((face) => [face.id, face.fileHash])
  )
  return family.faces.every(
    (face) => publishedFaces.get(face.id) === face.fileHash
  )
}

function isPublishedLibrary(
  families: CustomFontFamily[],
  publishedFamilies: CustomFontFamily[]
): boolean {
  return (
    families.length === publishedFamilies.length &&
    families.every((family) => isPublishedFamily(family, publishedFamilies))
  )
}

function hasOwn(value: object, key: string): boolean {
  return Object.getOwnPropertyDescriptor(value, key) !== undefined
}

function settingsValuesAreEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) =>
        settingsValuesAreEqual(value, second[index])
      )
    )
  }
  if (
    !first ||
    !second ||
    typeof first !== "object" ||
    typeof second !== "object"
  ) {
    return false
  }

  const firstRecord = first as Record<string, unknown>
  const secondRecord = second as Record<string, unknown>
  const firstKeys = Object.keys(firstRecord)
  const secondKeys = Object.keys(secondRecord)
  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (key) =>
        hasOwn(secondRecord, key) &&
        settingsValuesAreEqual(firstRecord[key], secondRecord[key])
    )
  )
}

function isPublishedSettingsPayload(
  expectedSettings: Record<string, unknown>,
  publishedSettings: Record<string, unknown>
): boolean {
  return Object.entries(expectedSettings).every(
    ([key, value]) =>
      hasOwn(publishedSettings, key) &&
      settingsValuesAreEqual(value, publishedSettings[key])
  )
}

export class BackgroundCustomFontManager {
  private readonly transactions = new CustomFontTransactionStore()
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(private readonly callbacks: ManagerCallbacks) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  initialize(): Promise<void> {
    return this.enqueue(async () => {
      const families = getFamilies(await this.callbacks.readSettings())
      await this.transactions.finalizePublished(families)
      // Do not scan the complete local storage area during every MV3 worker
      // startup. A large base64 font library can otherwise be deserialized on
      // the critical startup path merely to discover abandoned staging keys.
      // Journal-backed expired transactions are still reclaimed here.
      await this.transactions.collectGarbage(Date.now())
    })
  }

  collectUnusedAfterCatalogReplacement(): Promise<void> {
    return this.enqueue(async () => {
      const families = getFamilies(await this.callbacks.readSettings())
      await this.transactions.finalizePublished(families)
      // Import/reset is an explicit whole-catalog replacement. Any quarantined
      // transaction metadata belongs to the replaced catalog and no longer
      // needs to keep otherwise unreferenced blobs alive.
      await clearCustomFontTransactionRecovery()
      await deleteUnusedCustomFontFaceBlobs(families)
    })
  }

  begin(
    familyDraft: CustomFontFamilyDraft,
    mode: CustomFontTransactionMode = "append"
  ): Promise<CustomFontTransactionBeginResult> {
    return this.enqueue(async () => {
      const family = normalizeDraft(familyDraft)
      const families = getFamilies(await this.callbacks.readSettings())
      const quotaFamilies = mode === "replace-library" ? [] : families
      if (hasDuplicateFamilyName(family, quotaFamilies)) {
        throw new Error("custom-font-family-name-duplicate")
      }
      // Replacement imports ignore the outgoing catalog, while the
      // transaction store still counts every live journal entry so a batch
      // cannot overbook family or byte quotas before its atomic commit.
      return this.transactions.begin(family, families, mode)
    })
  }

  validateLibrary(families: CustomFontFamily[]): Promise<void> {
    return this.enqueue(async () => {
      const validatedFamilies: CustomFontFamily[] = []
      const familyValues = new Set<string>()
      for (const family of families) {
        const normalized = normalizeCustomFontFamily(family)
        if (!normalized || familyValues.has(normalized.value)) {
          throw new Error("invalid-custom-font-library")
        }
        if (hasDuplicateFamilyName(normalized, validatedFamilies)) {
          throw new Error("custom-font-family-name-duplicate")
        }
        validateFamilyQuota(normalized, validatedFamilies)
        for (const face of normalized.faces) {
          const bytes = await readCustomFontFaceBytes(face.fileHash)
          if (
            !bytes ||
            bytes.byteLength !== face.byteLength ||
            (await createCustomFontFileHash(bytes)) !== face.fileHash ||
            (face.validation !== "failed" &&
              !isCustomFontFaceSignatureValid(face.format, bytes))
          ) {
            throw new Error("invalid-custom-font-library-face")
          }
        }
        familyValues.add(normalized.value)
        validatedFamilies.push(normalized)
      }
    })
  }

  putFace(
    transactionId: string,
    faceId: string,
    base64: string
  ): Promise<void> {
    return this.enqueue(() =>
      this.transactions.putFace(transactionId, faceId, base64)
    )
  }

  commit(transactionId: string): Promise<CustomFontFamily> {
    return this.enqueue(async () => {
      const settings = await this.callbacks.readSettings()
      const families = getFamilies(settings)
      const family = await this.transactions.commit(transactionId, families)
      if (hasDuplicateFamilyName(family, families)) {
        await this.transactions.abort(transactionId)
        await deleteUnreferencedCustomFontFaceBlobs(
          family.faces.map((face) => face.fileHash),
          families
        )
        throw new Error("custom-font-family-name-duplicate")
      }
      const nextFamilies = families.some((item) => item.value === family.value)
        ? families.map((item) => (item.value === family.value ? family : item))
        : [...families, family]

      let publishedFamilies = nextFamilies
      try {
        await this.callbacks.writeSettings({
          [STORAGE_KEYS.CUSTOM_FONT_LIST]: nextFamilies
        })
      } catch (error) {
        let recoveredFamilies: CustomFontFamily[] | null = null
        try {
          recoveredFamilies = getFamilies(await this.callbacks.readSettings())
        } catch {
          // The catalog state is unknown. Retain the promoted transaction so a
          // retry or the next startup can reconcile it without losing bytes.
          throw error
        }
        if (!isPublishedFamily(family, recoveredFamilies)) {
          await this.transactions.abort(transactionId).catch(() => null)
          await deleteUnreferencedCustomFontFaceBlobs(
            family.faces.map((face) => face.fileHash),
            families
          ).catch(() => {})
          throw error
        }
        publishedFamilies = recoveredFamilies
      }
      await this.transactions.finalize(transactionId).catch(() => {})
      const replacedFamily = families.find(
        (item) => item.value === family.value
      )
      if (replacedFamily) {
        await deleteUnreferencedCustomFontFaceBlobs(
          replacedFamily.faces.map((face) => face.fileHash),
          publishedFamilies
        ).catch(() => {})
      }
      return family
    })
  }

  commitBatch(
    transactionIds: string[],
    settings: Record<string, unknown>
  ): Promise<CustomFontFamily[]> {
    return this.enqueue(async () => {
      const currentSettings = await this.callbacks.readSettings()
      const originalFamilies = getFamilies(currentSettings)
      const expectedFamilies = getFamilies(settings)
      const committedFamilies: CustomFontFamily[] = []
      let settingsWriteAttempted = false
      let expectedSettingsPayload: Record<string, unknown> | null = null
      let publishedFamilies = committedFamilies

      try {
        for (const transactionId of transactionIds) {
          const family = await this.transactions.commit(
            transactionId,
            committedFamilies,
            originalFamilies
          )
          if (hasDuplicateFamilyName(family, committedFamilies)) {
            throw new Error("custom-font-family-name-duplicate")
          }
          committedFamilies.push(family)
        }

        const expectedValues = new Set(
          expectedFamilies.map((family) => family.value)
        )
        if (
          expectedFamilies.length !== committedFamilies.length ||
          committedFamilies.some((family) => !expectedValues.has(family.value))
        ) {
          throw new Error("custom-font-import-batch-mismatch")
        }

        expectedSettingsPayload = {
          ...settings,
          [STORAGE_KEYS.CUSTOM_FONT_LIST]: committedFamilies
        }
        settingsWriteAttempted = true
        await this.callbacks.writeSettings(expectedSettingsPayload)
      } catch (error) {
        if (settingsWriteAttempted && expectedSettingsPayload) {
          let recoveredSettings: Record<string, unknown>
          try {
            recoveredSettings = await this.callbacks.readSettings()
          } catch {
            // Durable state is unknown after a write attempt. Keep promoted
            // transactions intact so the import can be retried safely.
            throw error
          }

          const recoveredFamilies = getFamilies(recoveredSettings)
          if (
            isPublishedSettingsPayload(
              expectedSettingsPayload,
              recoveredSettings
            )
          ) {
            publishedFamilies = recoveredFamilies
          } else if (
            isPublishedLibrary(committedFamilies, recoveredFamilies) &&
            transactionIds.length > 0
          ) {
            // The font catalog crossed the durability boundary but another
            // imported setting did not. Do not finalize or abort: the promoted
            // blobs and journal are required for an idempotent retry.
            throw error
          } else {
            settingsWriteAttempted = false
          }
        }
        if (!settingsWriteAttempted) {
          // abort() updates the shared transaction journal with a
          // read-modify-write cycle. Keep these writes sequential so two
          // transactions cannot resurrect one another from stale snapshots.
          for (const transactionId of transactionIds) {
            await this.transactions.abort(transactionId).catch(() => {})
          }
          await deleteUnreferencedCustomFontFaceBlobs(
            committedFamilies.flatMap((family) =>
              family.faces.map((face) => face.fileHash)
            ),
            originalFamilies
          )
          throw error
        }
      }
      // finalize() has the same journal read-modify-write requirement as
      // abort(), so bulk finalization must also be serialized.
      for (const transactionId of transactionIds) {
        await this.transactions.finalize(transactionId).catch(() => {})
      }
      await deleteUnusedCustomFontFaceBlobs(publishedFamilies).catch(() => {})
      return committedFamilies
    })
  }

  abort(transactionId: string): Promise<void> {
    return this.enqueue(async () => {
      const aborted = await this.transactions.abort(transactionId)
      if (!aborted?.promoted) return
      const families = getFamilies(await this.callbacks.readSettings())
      await deleteUnreferencedCustomFontFaceBlobs(
        aborted.family.faces.map((face) => face.fileHash),
        families
      )
    })
  }

  delete(familyValue: string): Promise<void> {
    return this.enqueue(async () => {
      const settings = await this.callbacks.readSettings()
      const families = getFamilies(settings)
      if (!families.some((family) => family.value === familyValue)) return

      const update = createCustomFontDeletionUpdate(
        families,
        familyValue,
        settings[STORAGE_KEYS.SELECTED_FONT] as string | undefined,
        settings[STORAGE_KEYS.SITE_PROFILES] as SiteProfile[] | undefined
      )
      await this.callbacks.writeSettings(update)
      await deleteUnreferencedCustomFontFaceBlobs(
        families
          .find((family) => family.value === familyValue)
          ?.faces.map((face) => face.fileHash) ?? [],
        update[STORAGE_KEYS.CUSTOM_FONT_LIST] as CustomFontFamily[]
      )
    })
  }
}

function isLoadResult(value: unknown): value is CustomFontLoadResult {
  if (!value || typeof value !== "object") return false
  const result = value as Partial<CustomFontLoadResult>
  return (
    typeof result.familyValue === "string" &&
    typeof result.familyRevision === "number" &&
    Array.isArray(result.loadedFaceIds) &&
    result.loadedFaceIds.every((id) => typeof id === "string") &&
    Array.isArray(result.failedFaceIds) &&
    result.failedFaceIds.every((id) => typeof id === "string")
  )
}

let loadResultListenerRegistered = false

export function registerCustomFontLoadResultListener(): void {
  if (loadResultListenerRegistered) return
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object" ||
      message.type !== "fontara-cs-bg-custom-font-load-result" ||
      typeof sender.tab?.id !== "number" ||
      !isLoadResult(message.data)
    ) {
      return false
    }

    // Results deliberately remain in memory only. They are an acknowledgement
    // channel for tests/diagnostics and never contain file bytes or page URLs.
    sendResponse({ data: true })
    return false
  })
  loadResultListenerRegistered = true
}
