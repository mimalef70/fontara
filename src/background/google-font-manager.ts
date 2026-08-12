import type { GoogleFontMetadata } from "../config/google-fonts"
import { STORAGE_KEYS } from "../config/storage"
import type { SiteProfile } from "../definitions"
import {
  createGoogleFontBinaryFamilyKey,
  type GoogleFontBinaryCacheStats,
  GoogleFontBinaryError,
  type GoogleFontBinaryFamily
} from "../google-font-binary-types"
import {
  clearGoogleFontBinaryCache,
  deleteGoogleFontBinaryFamily,
  getGoogleFontBinaryCacheStats,
  getLatestGoogleFontBinaryFamily,
  MAX_GOOGLE_FONT_BINARY_CACHE_BYTES,
  MAX_GOOGLE_FONT_BINARY_FAMILIES,
  pruneGoogleFontBinaryCache,
  publishGoogleFontBinaryFamily,
  readGoogleFontBinaryAsset,
  recoverGoogleFontBinaryCache
} from "../utils/google-font-binary-storage"
import { hasGoogleFontNetworkConsent } from "../utils/google-font-consent"
import {
  decodeGoogleFontValue,
  loadGoogleFontList
} from "../utils/google-fonts"
import { downloadGoogleFontFamilyDraft } from "./google-font-network"

export const GOOGLE_FONT_BINARY_STALE_TTL_MS = 30 * 24 * 60 * 60 * 1_000

export type BackgroundGoogleFontManagerErrorCode =
  | "google-font-manager-cache-cleared"
  | "google-font-manager-catalog-unavailable"
  | "google-font-manager-consent-required"
  | "google-font-manager-consent-unavailable"
  | "google-font-manager-feature-disabled"
  | "google-font-manager-selection-invalid"
  | "google-font-manager-selection-not-in-catalog"

export class BackgroundGoogleFontManagerError extends Error {
  readonly code: BackgroundGoogleFontManagerErrorCode

  constructor(
    code: BackgroundGoogleFontManagerErrorCode,
    options: { cause?: unknown } = {}
  ) {
    super(code)
    this.name = "BackgroundGoogleFontManagerError"
    this.code = code
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: options.cause
      })
    }
  }
}

export type BackgroundGoogleFontResolveOptions = {
  allowNetwork?: boolean
  /**
   * Receives the exact SWR task so an MV3 event listener can keep its event
   * alive. The resolved cache value is still returned immediately.
   */
  track?: (task: Promise<GoogleFontBinaryFamily>) => void
}

export type BackgroundGoogleFontPrepareOptions = {
  force?: boolean
}

type DownloadResult = Awaited<ReturnType<typeof downloadGoogleFontFamilyDraft>>

type BackgroundGoogleFontManagerDependencies = {
  clearCache: typeof clearGoogleFontBinaryCache
  createFamilyKey: typeof createGoogleFontBinaryFamilyKey
  deleteFamily: typeof deleteGoogleFontBinaryFamily
  download: typeof downloadGoogleFontFamilyDraft
  getLatest: typeof getLatestGoogleFontBinaryFamily
  getStats: typeof getGoogleFontBinaryCacheStats
  hasNetworkConsent: typeof hasGoogleFontNetworkConsent
  loadCatalog: typeof loadGoogleFontList
  now: () => number
  prune: typeof pruneGoogleFontBinaryCache
  publish: typeof publishGoogleFontBinaryFamily
  readAsset: typeof readGoogleFontBinaryAsset
  recover: typeof recoverGoogleFontBinaryCache
}

export type BackgroundGoogleFontManagerOptions = {
  readSettings: () => Promise<Record<string, unknown>>
  onFamilyReady?: (family: GoogleFontBinaryFamily) => void | Promise<void>
  /** Intended for deterministic unit tests, not normal extension wiring. */
  dependencies?: Partial<BackgroundGoogleFontManagerDependencies>
}

type InFlightPreparation = {
  completion: Promise<GoogleFontBinaryFamily>
  durable: Promise<GoogleFontBinaryFamily>
}

const DEFAULT_DEPENDENCIES: BackgroundGoogleFontManagerDependencies = {
  clearCache: clearGoogleFontBinaryCache,
  createFamilyKey: createGoogleFontBinaryFamilyKey,
  deleteFamily: deleteGoogleFontBinaryFamily,
  download: downloadGoogleFontFamilyDraft,
  getLatest: getLatestGoogleFontBinaryFamily,
  getStats: getGoogleFontBinaryCacheStats,
  hasNetworkConsent: hasGoogleFontNetworkConsent,
  loadCatalog: loadGoogleFontList,
  now: Date.now,
  prune: pruneGoogleFontBinaryCache,
  publish: publishGoogleFontBinaryFamily,
  readAsset: readGoogleFontBinaryAsset,
  recover: recoverGoogleFontBinaryCache
}

function isCacheCorruption(error: unknown): boolean {
  return (
    error instanceof GoogleFontBinaryError &&
    error.code === "google-font-cache-corrupt"
  )
}

function familyNamesEqual(first: string, second: string): boolean {
  return (
    first.trim().normalize("NFKC").toLocaleLowerCase("en-US") ===
    second.trim().normalize("NFKC").toLocaleLowerCase("en-US")
  )
}

function getGoogleFontValues(settings: Record<string, unknown>): string[] {
  const values: unknown[] = [settings[STORAGE_KEYS.SELECTED_FONT]]
  const siteProfiles = settings[STORAGE_KEYS.SITE_PROFILES]
  if (Array.isArray(siteProfiles)) {
    for (const profile of siteProfiles) {
      if (profile && typeof profile === "object") {
        values.push((profile as Partial<SiteProfile>).font)
      }
    }
  }
  return values.filter(
    (value): value is string => decodeGoogleFontValue(value) !== null
  )
}

export class BackgroundGoogleFontManager {
  private readonly dependencies: BackgroundGoogleFontManagerDependencies
  private readonly inFlight = new Map<string, InFlightPreparation>()
  private readonly cacheReadTasks = new Set<
    Promise<GoogleFontBinaryFamily | null>
  >()
  private readonly verifiedFamilies = new Set<string>()
  private readonly verificationTasks = new Map<string, Promise<void>>()
  private networkAbortController = new AbortController()
  private networkPaused = false
  private clearing: Promise<void> | null = null
  private generation = 0

  constructor(private readonly options: BackgroundGoogleFontManagerOptions) {
    this.dependencies = {
      ...DEFAULT_DEPENDENCIES,
      ...options.dependencies
    }
  }

  async initialize(): Promise<void> {
    await this.clearing
    try {
      await this.dependencies.getStats()
    } catch (error) {
      if (!isCacheCorruption(error)) throw error
      await this.dependencies.recover()
    }

    const settings = await this.options.readSettings()
    if (
      settings[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] === true &&
      (await this.hasNetworkConsentSafely())
    ) {
      this.resumeNetwork()
    } else {
      this.cancelPendingNetwork()
    }
    const protectedFamilyKeys = await this.getProtectedFamilyKeys(settings)
    try {
      await this.dependencies.prune({ protectedFamilyKeys })
    } catch (error) {
      if (!isCacheCorruption(error)) throw error
      await this.dependencies.recover()
    }
  }

  async resolve(
    selectedValue: unknown,
    options: BackgroundGoogleFontResolveOptions = {}
  ): Promise<GoogleFontBinaryFamily | null> {
    const admissionGeneration = this.generation
    await this.clearing
    if (admissionGeneration !== this.generation) return null
    const settings = await this.options.readSettings()
    if (settings[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] !== true) return null

    const selectedFamily = decodeGoogleFontValue(selectedValue)
    if (!selectedFamily) return null
    const key = await this.dependencies.createFamilyKey(selectedFamily)
    const cached = await this.readLatestRecovering(key, admissionGeneration)
    let font: GoogleFontMetadata
    try {
      font = await this.resolveCatalogFont(selectedValue)
    } catch (error) {
      if (
        error instanceof BackgroundGoogleFontManagerError &&
        (error.code === "google-font-manager-selection-invalid" ||
          error.code === "google-font-manager-selection-not-in-catalog" ||
          error.code === "google-font-manager-catalog-unavailable")
      ) {
        return admissionGeneration === this.generation ? cached : null
      }
      throw error
    }
    const shouldRevalidate =
      !cached ||
      this.dependencies.now() - cached.updatedAt >=
        GOOGLE_FONT_BINARY_STALE_TTL_MS

    if (
      shouldRevalidate &&
      options.allowNetwork === true &&
      !this.networkPaused
    ) {
      const consentGeneration = this.generation
      const hasConsent = await this.hasNetworkConsentSafely()
      if (
        hasConsent &&
        !this.networkPaused &&
        admissionGeneration === this.generation &&
        consentGeneration === this.generation
      ) {
        const task = this.startNetworkPrepare(font, key, cached !== null)
        // Mark the rejection handled even when the caller intentionally uses
        // the immediate stale value without tracking background completion.
        void task.catch(() => undefined)
        options.track?.(task)
      }
    }

    return admissionGeneration === this.generation ? cached : null
  }

  async prepare(
    selectedValue: unknown,
    options: BackgroundGoogleFontPrepareOptions = {}
  ): Promise<GoogleFontBinaryFamily> {
    const admissionGeneration = this.generation
    await this.clearing
    this.assertAdmissionGeneration(admissionGeneration)
    const settings = await this.options.readSettings()
    if (settings[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] !== true) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-feature-disabled"
      )
    }
    const font = await this.resolveCatalogFont(selectedValue)
    let hasConsent: boolean
    try {
      hasConsent = await this.dependencies.hasNetworkConsent()
    } catch (error) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-consent-unavailable",
        { cause: error }
      )
    }
    if (!hasConsent) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-consent-required"
      )
    }
    if (this.networkPaused) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-consent-required"
      )
    }

    const key = await this.dependencies.createFamilyKey(font.family)
    const cached = await this.readLatestRecovering(key, admissionGeneration)
    this.assertAdmissionGeneration(admissionGeneration)
    if (
      cached &&
      options.force !== true &&
      this.dependencies.now() - cached.updatedAt <
        GOOGLE_FONT_BINARY_STALE_TTL_MS
    ) {
      return cached
    }

    return this.startNetworkPrepare(font, key, cached !== null)
  }

  private assertAdmissionGeneration(generation: number): void {
    if (generation !== this.generation) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-cache-cleared"
      )
    }
  }

  async clear(): Promise<void> {
    if (this.clearing) return this.clearing
    const obsoleteTasks = Array.from(
      this.inFlight.values(),
      (task) => task.durable
    )
    this.abortPendingNetwork()
    const obsoleteCacheReads = Array.from(this.cacheReadTasks)
    this.verifiedFamilies.clear()
    this.verificationTasks.clear()
    const task = (async () => {
      // A task may already have crossed its final pre-publish generation check.
      // Let every old publication settle first, then clear as the last durable
      // operation so an in-flight response cannot resurrect cache bytes.
      await Promise.allSettled([...obsoleteTasks, ...obsoleteCacheReads])
      await this.dependencies.clearCache()
    })().finally(() => {
      if (this.clearing === task) this.clearing = null
    })
    this.clearing = task
    return task
  }

  cancelPendingNetwork(): void {
    this.networkPaused = true
    this.abortPendingNetwork()
  }

  private abortPendingNetwork(): void {
    this.generation += 1
    this.networkAbortController.abort()
    this.networkAbortController = new AbortController()
    this.inFlight.clear()
  }

  resumeNetwork(): void {
    this.networkPaused = false
  }

  getStats(): Promise<GoogleFontBinaryCacheStats> {
    return this.dependencies.getStats()
  }

  private async resolveCatalogFont(
    selectedValue: unknown
  ): Promise<GoogleFontMetadata> {
    const family = decodeGoogleFontValue(selectedValue)
    if (!family) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-selection-invalid"
      )
    }

    let catalog: GoogleFontMetadata[]
    try {
      catalog = await this.dependencies.loadCatalog()
    } catch (error) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-catalog-unavailable",
        { cause: error }
      )
    }
    const font = catalog.find((candidate) =>
      familyNamesEqual(candidate.family, family)
    )
    if (!font) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-selection-not-in-catalog"
      )
    }
    return font
  }

  private readLatestRecovering(
    key: string,
    expectedGeneration: number
  ): Promise<GoogleFontBinaryFamily | null> {
    const task = this.readLatestRecoveringAtGeneration(key, expectedGeneration)
    this.cacheReadTasks.add(task)
    const release = () => {
      this.cacheReadTasks.delete(task)
    }
    void task.then(release, release)
    return task
  }

  private async readLatestRecoveringAtGeneration(
    key: string,
    expectedGeneration: number
  ): Promise<GoogleFontBinaryFamily | null> {
    if (expectedGeneration !== this.generation) return null
    try {
      const family = await this.dependencies.getLatest(key, { touch: false })
      if (expectedGeneration !== this.generation) return null
      if (!family) return null
      await this.verifyFamilyAssets(family)
      return expectedGeneration === this.generation ? family : null
    } catch (error) {
      // Clear/pause invalidates every admitted read. A stale verifier must not
      // recover or delete a newer manifest published for the same family key.
      if (expectedGeneration !== this.generation) return null
      if (isCacheCorruption(error)) {
        await this.dependencies.recover()
        this.verifiedFamilies.clear()
        this.verificationTasks.clear()
        return null
      }
      if (
        error instanceof GoogleFontBinaryError &&
        error.code === "google-font-asset-invalid"
      ) {
        await this.dependencies.deleteFamily(key)
        this.forgetVerifiedFamily(key)
        return null
      }
      if (
        error instanceof GoogleFontBinaryError &&
        error.code === "google-font-transaction-incomplete"
      ) {
        await this.dependencies.deleteFamily(key)
        this.forgetVerifiedFamily(key)
        return null
      }
      throw error
    }
  }

  private verificationKey(family: GoogleFontBinaryFamily): string {
    return `${family.key}:${family.revision}`
  }

  private forgetVerifiedFamily(key: string): void {
    for (const verificationKey of this.verifiedFamilies) {
      if (verificationKey.startsWith(`${key}:`)) {
        this.verifiedFamilies.delete(verificationKey)
      }
    }
    for (const verificationKey of this.verificationTasks.keys()) {
      if (verificationKey.startsWith(`${key}:`)) {
        this.verificationTasks.delete(verificationKey)
      }
    }
  }

  private verifyFamilyAssets(family: GoogleFontBinaryFamily): Promise<void> {
    const verificationKey = this.verificationKey(family)
    if (this.verifiedFamilies.has(verificationKey)) return Promise.resolve()
    const existing = this.verificationTasks.get(verificationKey)
    if (existing) return existing

    const task = (async () => {
      const uniqueAssets = new Map(
        family.faces.map((face) => [face.assetHash, face.byteLength] as const)
      )
      for (const [hash, byteLength] of uniqueAssets) {
        const bytes = await this.dependencies.readAsset(hash, byteLength)
        if (!bytes) {
          throw new GoogleFontBinaryError(
            "google-font-transaction-incomplete",
            { assetHash: hash }
          )
        }
      }
      this.verifiedFamilies.add(verificationKey)
    })().finally(() => {
      if (this.verificationTasks.get(verificationKey) === task) {
        this.verificationTasks.delete(verificationKey)
      }
    })
    this.verificationTasks.set(verificationKey, task)
    return task
  }

  private async hasNetworkConsentSafely(): Promise<boolean> {
    try {
      return await this.dependencies.hasNetworkConsent()
    } catch {
      return false
    }
  }

  private startNetworkPrepare(
    font: GoogleFontMetadata,
    key: string,
    familyAlreadyCached: boolean
  ): Promise<GoogleFontBinaryFamily> {
    const existing = this.inFlight.get(key)
    if (existing) return existing.completion

    const generation = this.generation
    const signal = this.networkAbortController.signal
    const durable = this.downloadAndPublish(
      font,
      key,
      familyAlreadyCached,
      generation,
      signal
    )
    const completion = durable
      .then(async (family) => {
        try {
          await this.options.onFamilyReady?.(family)
        } catch {
          // Publication is durable; a failed content notification must not
          // turn a successful network transaction into a false failure.
        }
        if (generation !== this.generation) {
          throw new BackgroundGoogleFontManagerError(
            "google-font-manager-cache-cleared"
          )
        }
        return family
      })
      .finally(() => {
        if (this.inFlight.get(key)?.completion === completion) {
          this.inFlight.delete(key)
        }
      })
    this.inFlight.set(key, { completion, durable })
    return completion
  }

  private async downloadAndPublish(
    font: GoogleFontMetadata,
    key: string,
    familyAlreadyCached: boolean,
    generation: number,
    signal: AbortSignal
  ): Promise<GoogleFontBinaryFamily> {
    const downloaded: DownloadResult = await this.dependencies.download(font, {
      signal
    })
    if (downloaded.family.key !== key) {
      throw new GoogleFontBinaryError("google-font-invalid-request", {
        reason: "family-key-mismatch"
      })
    }
    if (generation !== this.generation) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-cache-cleared"
      )
    }

    const protectedFamilyKeys = await this.getProtectedFamilyKeys(
      await this.options.readSettings(),
      key
    )
    await this.dependencies.prune({
      maxFamilies: Math.max(
        0,
        MAX_GOOGLE_FONT_BINARY_FAMILIES - (familyAlreadyCached ? 0 : 1)
      ),
      maxTotalBytes: Math.max(
        0,
        MAX_GOOGLE_FONT_BINARY_CACHE_BYTES - downloaded.family.totalBytes
      ),
      protectedFamilyKeys
    })
    if (generation !== this.generation) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-cache-cleared"
      )
    }
    const family = await this.dependencies.publish(
      downloaded.family,
      downloaded.assets
    )
    this.verifiedFamilies.add(this.verificationKey(family))
    await this.dependencies.prune({ protectedFamilyKeys })
    if (generation !== this.generation) {
      throw new BackgroundGoogleFontManagerError(
        "google-font-manager-cache-cleared"
      )
    }

    return family
  }

  private async getProtectedFamilyKeys(
    settings: Record<string, unknown>,
    additionalKey?: string
  ): Promise<Set<string>> {
    const families = getGoogleFontValues(settings)
      .map(decodeGoogleFontValue)
      .filter((family): family is string => family !== null)
    const keys = await Promise.all(
      families.map((family) => this.dependencies.createFamilyKey(family))
    )
    if (additionalKey) keys.push(additionalKey)
    return new Set(keys)
  }
}
