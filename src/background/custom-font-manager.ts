import { STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFamily,
  CustomFontFamilyDraft,
  CustomFontLoadResult,
  CustomFontTransactionBeginResult
} from "../custom-font-types"
import type { SiteProfile } from "../definitions"
import {
  createCustomFontFileHash,
  isCustomFontFaceSignatureValid
} from "../utils/custom-font-format"
import { normalizeCustomFontFamily } from "../utils/custom-font-normalization"
import {
  CustomFontTransactionStore,
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
      await this.transactions.collectGarbage()
      await deleteUnusedCustomFontFaceBlobs(
        getFamilies(await this.callbacks.readSettings())
      )
    })
  }

  begin(
    familyDraft: CustomFontFamilyDraft
  ): Promise<CustomFontTransactionBeginResult> {
    return this.enqueue(async () => {
      const family = normalizeDraft(familyDraft)
      const families = getFamilies(await this.callbacks.readSettings())
      if (hasDuplicateFamilyName(family, families)) {
        throw new Error("custom-font-family-name-duplicate")
      }
      return this.transactions.begin(family, families)
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
        await deleteUnusedCustomFontFaceBlobs(families)
        throw new Error("custom-font-family-name-duplicate")
      }
      const nextFamilies = families.some((item) => item.value === family.value)
        ? families.map((item) => (item.value === family.value ? family : item))
        : [...families, family]

      try {
        await this.callbacks.writeSettings({
          [STORAGE_KEYS.CUSTOM_FONT_LIST]: nextFamilies
        })
      } catch (error) {
        await deleteUnusedCustomFontFaceBlobs(families)
        throw error
      }
      await deleteUnusedCustomFontFaceBlobs(nextFamilies).catch(() => {})
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

        await this.callbacks.writeSettings({
          ...settings,
          [STORAGE_KEYS.CUSTOM_FONT_LIST]: committedFamilies
        })
      } catch (error) {
        await Promise.all(
          transactionIds.map((transactionId) =>
            this.transactions.abort(transactionId).catch(() => {})
          )
        )
        await deleteUnusedCustomFontFaceBlobs(originalFamilies)
        throw error
      }
      await deleteUnusedCustomFontFaceBlobs(committedFamilies).catch(() => {})
      return committedFamilies
    })
  }

  abort(transactionId: string): Promise<void> {
    return this.enqueue(() => this.transactions.abort(transactionId))
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
      await deleteUnusedCustomFontFaceBlobs(
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
