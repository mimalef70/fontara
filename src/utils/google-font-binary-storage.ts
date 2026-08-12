import type {
  GoogleFontBinaryCacheIndex,
  GoogleFontBinaryCacheStats,
  GoogleFontBinaryFamily,
  GoogleFontBinaryFamilyDraft,
  GoogleFontBinaryFamilyReference,
  GoogleFontBinaryPruneOptions,
  GoogleFontBinaryPruneResult,
  StoredGoogleFontBinaryBlob
} from "../google-font-binary-types"
import {
  GOOGLE_FONT_BINARY_SCHEMA_VERSION,
  GoogleFontBinaryError
} from "../google-font-binary-types"
import {
  base64ToBytes,
  bytesToBase64,
  createCustomFontFileHash,
  isSHA256Hash
} from "./custom-font-format"

export const GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX = "googleFontFace:"
export const GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX = "googleFontFamily:"
export const GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY =
  "__fontara_google_font_binary_index__"
const GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY =
  "__fontara_google_font_binary_catalog__"
const GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY =
  "__fontara_google_font_binary_cleanup__"
const LEGACY_GOOGLE_FONT_CSS_CACHE_STORAGE_KEY = "googleFontCssCache"

export const MAX_GOOGLE_FONT_BINARY_FILE_BYTES = 5 * 1024 * 1024
export const MAX_GOOGLE_FONT_BINARY_FAMILY_BYTES = 12 * 1024 * 1024
export const MAX_GOOGLE_FONT_BINARY_CACHE_BYTES = 24 * 1024 * 1024
export const MAX_GOOGLE_FONT_BINARY_FACES_PER_FAMILY = 64
export const MAX_GOOGLE_FONT_BINARY_FAMILIES = 16

type CatalogFamily = { latestRevision: number; revisions: number[] }
type CatalogAsset = { byteLength: number; refCount: number }
type StorageCatalog = {
  assets: Record<string, CatalogAsset>
  families: Record<string, CatalogFamily>
  schemaVersion: typeof GOOGLE_FONT_BINARY_SCHEMA_VERSION
  updatedAt: number
}

export type PublishGoogleFontBinaryFamilyOptions = {
  now?: number
  pinned?: boolean
}

export type ReadGoogleFontBinaryFamilyOptions = { touch?: boolean }

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SAFE_FACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const SAFE_DESCRIPTOR_PATTERN = /^[A-Za-z0-9.%\s-]{1,64}$/
let operationQueue: Promise<void> = Promise.resolve()

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation)
  operationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
}

function readStorage(
  keys: string | string[] | null
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (values) => {
      const error = getRuntimeError()
      if (error)
        reject(
          new GoogleFontBinaryError(
            "google-font-storage-read-failed",
            undefined,
            error
          )
        )
      else resolve(values)
    })
  })
}

function writeStorage(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = getRuntimeError()
      if (error)
        reject(
          new GoogleFontBinaryError(
            "google-font-storage-write-failed",
            undefined,
            error
          )
        )
      else resolve()
    })
  })
}

function removeStorage(keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = getRuntimeError()
      if (error)
        reject(
          new GoogleFontBinaryError(
            "google-font-storage-remove-failed",
            undefined,
            error
          )
        )
      else resolve()
    })
  })
}

async function publishMetadataWithCleanup(
  catalog: StorageCatalog,
  index: GoogleFontBinaryCacheIndex,
  cleanupKeys: string[]
): Promise<void> {
  const uniqueCleanupKeys = Array.from(new Set(cleanupKeys))
  await writeStorage({
    [GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]: catalog,
    [GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY]: uniqueCleanupKeys,
    [GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]: index
  })
  await removeStorage(uniqueCleanupKeys)
  await removeStorage([GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY])
}

function emptyIndex(now = 0): GoogleFontBinaryCacheIndex {
  return {
    families: {},
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION,
    totalBytes: 0,
    updatedAt: now
  }
}

function emptyCatalog(now = 0): StorageCatalog {
  return {
    assets: {},
    families: {},
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION,
    updatedAt: now
  }
}

function familyStorageKey(key: string, revision: number): string {
  return `${GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX}${key}:${revision}`
}

function assetStorageKey(hash: string): string {
  return `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${hash}`
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function isSafeRemoteUrl(
  value: unknown,
  hostname: "fonts.googleapis.com" | "fonts.gstatic.com",
  pathname?: string
): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === hostname &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.hash === "" &&
      (pathname === undefined
        ? url.pathname.toLowerCase().endsWith(".woff2")
        : url.pathname === pathname)
    )
  } catch {
    return false
  }
}

function isValidWeight(value: unknown): value is string {
  if (typeof value !== "string" || !SAFE_DESCRIPTOR_PATTERN.test(value))
    return false
  const match = /^([1-9]\d{0,2}|1000)(?: ([1-9]\d{0,2}|1000))?$/.exec(value)
  return Boolean(match && Number(match[1]) <= Number(match[2] ?? match[1]))
}

function isValidStretch(value: unknown): value is string {
  if (typeof value !== "string" || !SAFE_DESCRIPTOR_PATTERN.test(value))
    return false
  if (
    /^(?:normal|condensed|expanded|extra-condensed|extra-expanded|semi-condensed|semi-expanded|ultra-condensed|ultra-expanded)$/.test(
      value
    )
  )
    return true
  const match = /^(\d+(?:\.\d+)?)%(?: (\d+(?:\.\d+)?)%)?$/.exec(value)
  if (!match) return false
  const start = Number(match[1])
  const end = Number(match[2] ?? match[1])
  return start > 0 && end <= 1_000 && start <= end
}

function isValidUnicodeRange(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== "string" || value.length > 16_384) return false
  const tokens = value.split(",").map((token) => token.trim())
  if (
    tokens.length === 0 ||
    tokens.length > 256 ||
    tokens.some((token) => !token)
  )
    return false
  return tokens.every((token) => {
    const wildcard = /^U\+([0-9A-F]{0,5})(\?{1,6})$/i.exec(token)
    if (wildcard) return wildcard[1].length + wildcard[2].length <= 6
    const range = /^U\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?$/i.exec(token)
    if (!range) return false
    const start = Number.parseInt(range[1], 16)
    const end = Number.parseInt(range[2] ?? range[1], 16)
    return start <= end && end <= 0x10ffff
  })
}

function isValidFamily(value: unknown): value is GoogleFontBinaryFamily {
  if (!isPlainRecord(value)) return false
  if (
    value.schemaVersion !== GOOGLE_FONT_BINARY_SCHEMA_VERSION ||
    !SHA256_PATTERN.test(String(value.key)) ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) <= 0 ||
    !isSHA256Hash(value.cssHash) ||
    typeof value.fontFamily !== "string" ||
    value.fontFamily.trim().length === 0 ||
    value.fontFamily.length > 120 ||
    hasControlCharacter(value.fontFamily) ||
    value.runtimeFamily !== `FontAraGoogle-${value.cssHash.slice(0, 24)}` ||
    !isSafeRemoteUrl(value.requestUrl, "fonts.googleapis.com", "/css2") ||
    !isFiniteTimestamp(value.createdAt) ||
    !isFiniteTimestamp(value.updatedAt) ||
    !isFiniteTimestamp(value.lastAccessedAt) ||
    typeof value.pinned !== "boolean" ||
    !Number.isInteger(value.totalBytes) ||
    Number(value.totalBytes) <= 0 ||
    Number(value.totalBytes) > MAX_GOOGLE_FONT_BINARY_FAMILY_BYTES ||
    !Array.isArray(value.faces) ||
    value.faces.length === 0 ||
    value.faces.length > MAX_GOOGLE_FONT_BINARY_FACES_PER_FAMILY
  )
    return false

  const faceIds = new Set<string>()
  const hashLengths = new Map<string, number>()
  for (const face of value.faces) {
    if (
      !isPlainRecord(face) ||
      typeof face.id !== "string" ||
      !SAFE_FACE_ID_PATTERN.test(face.id) ||
      faceIds.has(face.id) ||
      !isSHA256Hash(face.assetHash) ||
      !Number.isInteger(face.byteLength) ||
      Number(face.byteLength) <= 0 ||
      Number(face.byteLength) > MAX_GOOGLE_FONT_BINARY_FILE_BYTES ||
      !isSafeRemoteUrl(face.sourceUrl, "fonts.gstatic.com") ||
      (face.style !== "normal" &&
        face.style !== "italic" &&
        face.style !== "oblique") ||
      !isValidWeight(face.weight) ||
      !isValidStretch(face.stretch) ||
      !isValidUnicodeRange(face.unicodeRange)
    )
      return false
    faceIds.add(face.id)
    const previousLength = hashLengths.get(face.assetHash)
    if (previousLength !== undefined && previousLength !== face.byteLength)
      return false
    hashLengths.set(face.assetHash, Number(face.byteLength))
  }
  return (
    Array.from(hashLengths.values()).reduce((sum, size) => sum + size, 0) ===
    value.totalBytes
  )
}

function isValidIndex(value: unknown): value is GoogleFontBinaryCacheIndex {
  return (
    isPlainRecord(value) &&
    value.schemaVersion === GOOGLE_FONT_BINARY_SCHEMA_VERSION &&
    isFiniteTimestamp(value.updatedAt) &&
    Number.isInteger(value.totalBytes) &&
    Number(value.totalBytes) >= 0 &&
    isPlainRecord(value.families) &&
    Object.entries(value.families).every(
      ([key, family]) => isValidFamily(family) && family.key === key
    )
  )
}

function isValidCatalog(value: unknown): value is StorageCatalog {
  if (
    !isPlainRecord(value) ||
    value.schemaVersion !== GOOGLE_FONT_BINARY_SCHEMA_VERSION ||
    !isFiniteTimestamp(value.updatedAt) ||
    !isPlainRecord(value.families) ||
    !isPlainRecord(value.assets)
  )
    return false
  return (
    Object.entries(value.families).every(
      ([key, family]) =>
        SHA256_PATTERN.test(key) &&
        isPlainRecord(family) &&
        Number.isInteger(family.latestRevision) &&
        Number(family.latestRevision) > 0 &&
        Array.isArray(family.revisions) &&
        family.revisions.length > 0 &&
        family.revisions.every(
          (revision) => Number.isInteger(revision) && Number(revision) > 0
        ) &&
        new Set(family.revisions).size === family.revisions.length &&
        family.revisions.includes(family.latestRevision)
    ) &&
    Object.entries(value.assets).every(
      ([hash, asset]) =>
        SHA256_PATTERN.test(hash) &&
        isPlainRecord(asset) &&
        Number.isInteger(asset.byteLength) &&
        Number(asset.byteLength) > 0 &&
        Number(asset.byteLength) <= MAX_GOOGLE_FONT_BINARY_FILE_BYTES &&
        Number.isInteger(asset.refCount) &&
        Number(asset.refCount) > 0
    )
  )
}

async function readMetadata(): Promise<{
  catalog: StorageCatalog
  index: GoogleFontBinaryCacheIndex
}> {
  const values = await readStorage([
    GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY,
    GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY,
    GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY
  ])
  const pendingCleanup = values[GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY]
  if (pendingCleanup !== undefined) {
    if (
      !Array.isArray(pendingCleanup) ||
      !pendingCleanup.every(
        (key) =>
          typeof key === "string" &&
          (key.startsWith(GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX) ||
            key.startsWith(GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX))
      )
    )
      throw new GoogleFontBinaryError("google-font-cache-corrupt")
    await removeStorage(Array.from(new Set(pendingCleanup)))
    await removeStorage([GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY])
  }
  const rawIndex = values[GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]
  const rawCatalog = values[GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]
  if (rawIndex === undefined && rawCatalog === undefined)
    return { catalog: emptyCatalog(), index: emptyIndex() }
  if (!isValidIndex(rawIndex) || !isValidCatalog(rawCatalog))
    throw new GoogleFontBinaryError("google-font-cache-corrupt")
  const indexKeys = Object.keys(rawIndex.families).sort()
  const catalogKeys = Object.keys(rawCatalog.families).sort()
  const catalogBytes = Object.values(rawCatalog.assets).reduce(
    (sum, asset) => sum + asset.byteLength,
    0
  )
  if (
    JSON.stringify(indexKeys) !== JSON.stringify(catalogKeys) ||
    rawIndex.totalBytes !== catalogBytes ||
    indexKeys.some(
      (key) =>
        rawIndex.families[key].revision !==
        rawCatalog.families[key].latestRevision
    )
  )
    throw new GoogleFontBinaryError("google-font-cache-corrupt")
  return { catalog: rawCatalog, index: rawIndex }
}

function normalizeDraft(
  draft: GoogleFontBinaryFamilyDraft,
  revision: number,
  pinned: boolean,
  now: number,
  createdAt = now
): GoogleFontBinaryFamily {
  const family: GoogleFontBinaryFamily = {
    ...structuredClone(draft),
    createdAt,
    lastAccessedAt: now,
    pinned,
    revision,
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION,
    updatedAt: now
  }
  if (!isValidFamily(family))
    throw new GoogleFontBinaryError("google-font-invalid-request")
  return family
}

function validateDraftQuotas(draft: GoogleFontBinaryFamilyDraft): void {
  if (
    !draft ||
    !Array.isArray(draft.faces) ||
    draft.faces.length === 0 ||
    draft.faces.length > MAX_GOOGLE_FONT_BINARY_FACES_PER_FAMILY
  )
    throw new GoogleFontBinaryError("google-font-face-count-limit")
  if (
    draft.faces.some(
      (face) =>
        face.byteLength <= 0 ||
        face.byteLength > MAX_GOOGLE_FONT_BINARY_FILE_BYTES
    )
  )
    throw new GoogleFontBinaryError("google-font-asset-too-large")
  if (
    draft.totalBytes <= 0 ||
    draft.totalBytes > MAX_GOOGLE_FONT_BINARY_FAMILY_BYTES
  )
    throw new GoogleFontBinaryError("google-font-family-size-limit")
}

function isSamePublishedFamily(
  family: GoogleFontBinaryFamily,
  draft: GoogleFontBinaryFamilyDraft
): boolean {
  return (
    family.key === draft.key &&
    family.fontFamily === draft.fontFamily &&
    family.cssHash === draft.cssHash &&
    family.runtimeFamily === draft.runtimeFamily &&
    family.requestUrl === draft.requestUrl &&
    family.totalBytes === draft.totalBytes &&
    JSON.stringify(family.faces) === JSON.stringify(draft.faces)
  )
}

async function validateAssetBytes(
  hash: string,
  byteLength: number,
  bytes: Uint8Array
): Promise<void> {
  if (
    bytes.byteLength !== byteLength ||
    bytes.byteLength > MAX_GOOGLE_FONT_BINARY_FILE_BYTES ||
    bytes[0] !== 0x77 ||
    bytes[1] !== 0x4f ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x32 ||
    (await createCustomFontFileHash(bytes)) !== hash
  )
    throw new GoogleFontBinaryError("google-font-asset-invalid", {
      assetHash: hash
    })
}

function createStoredBlob(
  hash: string,
  bytes: Uint8Array
): StoredGoogleFontBinaryBlob {
  return {
    byteLength: bytes.byteLength,
    data: bytesToBase64(bytes),
    encoding: "base64",
    hash,
    mimeType: "font/woff2",
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION
  }
}

function parseStoredBlob(
  value: unknown,
  hash: string,
  expectedByteLength?: number
): Uint8Array | null {
  if (value === undefined) return null
  if (
    !isPlainRecord(value) ||
    value.schemaVersion !== GOOGLE_FONT_BINARY_SCHEMA_VERSION ||
    value.encoding !== "base64" ||
    value.mimeType !== "font/woff2" ||
    value.hash !== hash ||
    !Number.isInteger(value.byteLength) ||
    Number(value.byteLength) <= 0 ||
    Number(value.byteLength) > MAX_GOOGLE_FONT_BINARY_FILE_BYTES ||
    (expectedByteLength !== undefined &&
      value.byteLength !== expectedByteLength) ||
    typeof value.data !== "string"
  )
    throw new GoogleFontBinaryError("google-font-asset-invalid", {
      assetHash: hash
    })
  const bytes = base64ToBytes(value.data)
  if (!bytes || bytes.byteLength !== value.byteLength)
    throw new GoogleFontBinaryError("google-font-asset-invalid", {
      assetHash: hash
    })
  return bytes
}

function uniqueFamilyAssets(
  family: Pick<GoogleFontBinaryFamily, "faces">
): Map<string, number> {
  return new Map(
    family.faces.map((face) => [face.assetHash, face.byteLength] as const)
  )
}

export async function publishGoogleFontBinaryFamily(
  draft: GoogleFontBinaryFamilyDraft,
  assets: ReadonlyMap<string, Uint8Array>,
  options: PublishGoogleFontBinaryFamilyOptions = {}
): Promise<GoogleFontBinaryFamily> {
  return enqueue(async () => {
    validateDraftQuotas(draft)
    if (
      !assets ||
      typeof assets.size !== "number" ||
      typeof assets.get !== "function" ||
      typeof assets.keys !== "function"
    )
      throw new GoogleFontBinaryError("google-font-invalid-request")
    const now = options.now ?? Date.now()
    const { catalog, index } = await readMetadata()
    const latest = index.families[draft.key]
    const idempotent = latest && isSamePublishedFamily(latest, draft)
    const revision = idempotent ? latest.revision : (latest?.revision ?? 0) + 1
    const family = normalizeDraft(
      draft,
      revision,
      options.pinned ?? latest?.pinned ?? false,
      now,
      idempotent ? latest.createdAt : now
    )
    const requiredAssets = uniqueFamilyAssets(family)
    if (
      assets.size !== requiredAssets.size ||
      Array.from(assets.keys()).some((hash) => !requiredAssets.has(hash))
    )
      throw new GoogleFontBinaryError("google-font-transaction-incomplete")

    const blobs: Record<string, StoredGoogleFontBinaryBlob> = {}
    for (const [hash, byteLength] of requiredAssets) {
      const bytes = assets.get(hash)
      if (!bytes)
        throw new GoogleFontBinaryError("google-font-transaction-incomplete")
      await validateAssetBytes(hash, byteLength, bytes)
      blobs[assetStorageKey(hash)] = createStoredBlob(hash, bytes)
    }

    if (
      !idempotent &&
      !catalog.families[draft.key] &&
      Object.keys(catalog.families).length >= MAX_GOOGLE_FONT_BINARY_FAMILIES
    )
      throw new GoogleFontBinaryError("google-font-cache-family-limit")

    const nextCatalog = structuredClone(catalog)
    const nextIndex = structuredClone(index)
    if (!idempotent) {
      for (const [hash, byteLength] of requiredAssets) {
        const stored = nextCatalog.assets[hash]
        if (stored && stored.byteLength !== byteLength)
          throw new GoogleFontBinaryError("google-font-cache-corrupt")
        nextCatalog.assets[hash] = {
          byteLength,
          refCount: (stored?.refCount ?? 0) + 1
        }
      }
      const familyCatalog = nextCatalog.families[draft.key]
      nextCatalog.families[draft.key] = {
        latestRevision: revision,
        revisions: [...(familyCatalog?.revisions ?? []), revision]
      }
    }
    const totalBytes = Object.values(nextCatalog.assets).reduce(
      (sum, asset) => sum + asset.byteLength,
      0
    )
    if (totalBytes > MAX_GOOGLE_FONT_BINARY_CACHE_BYTES)
      throw new GoogleFontBinaryError("google-font-cache-size-limit")
    nextCatalog.updatedAt = now
    nextIndex.families[draft.key] = family
    nextIndex.totalBytes = totalBytes
    nextIndex.updatedAt = now

    await writeStorage({
      ...blobs,
      [familyStorageKey(draft.key, revision)]: family,
      [GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]: nextCatalog,
      [GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]: nextIndex
    })
    return family
  })
}

async function readExactFamily(
  reference: GoogleFontBinaryFamilyReference
): Promise<GoogleFontBinaryFamily | null> {
  if (
    !SHA256_PATTERN.test(reference.key) ||
    !Number.isInteger(reference.revision) ||
    reference.revision <= 0
  )
    return null
  const key = familyStorageKey(reference.key, reference.revision)
  const family = (await readStorage(key))[key]
  if (family === undefined) return null
  if (
    !isValidFamily(family) ||
    family.key !== reference.key ||
    family.revision !== reference.revision
  )
    throw new GoogleFontBinaryError("google-font-cache-corrupt")
  return family
}

export async function readGoogleFontBinaryFamilyReference(
  reference: GoogleFontBinaryFamilyReference,
  options: ReadGoogleFontBinaryFamilyOptions = {}
): Promise<GoogleFontBinaryFamily | null> {
  return enqueue(async () => {
    const family = await readExactFamily(reference)
    if (!family || options.touch === false) return family
    const now = Date.now()
    const touched = { ...family, lastAccessedAt: now }
    const { catalog, index } = await readMetadata()
    catalog.updatedAt = now
    if (index.families[family.key]?.revision === family.revision) {
      index.families[family.key] = touched
      index.updatedAt = now
    }
    await writeStorage({
      [familyStorageKey(family.key, family.revision)]: touched,
      [GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]: catalog,
      [GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]: index
    })
    return touched
  })
}

export async function getLatestGoogleFontBinaryFamily(
  key: string,
  options: ReadGoogleFontBinaryFamilyOptions = {}
): Promise<GoogleFontBinaryFamily | null> {
  const { index } = await readMetadata()
  const family = index.families[key]
  return family
    ? readGoogleFontBinaryFamilyReference(family, options)
    : Promise.resolve(null)
}

export async function readGoogleFontBinaryAsset(
  hash: string,
  expectedByteLength?: number
): Promise<Uint8Array | null> {
  if (!SHA256_PATTERN.test(hash)) return null
  const key = assetStorageKey(hash)
  const bytes = parseStoredBlob(
    (await readStorage(key))[key],
    hash,
    expectedByteLength
  )
  if (!bytes) return null
  await validateAssetBytes(hash, expectedByteLength ?? bytes.byteLength, bytes)
  return bytes
}

export async function listGoogleFontBinaryFamilies(): Promise<
  GoogleFontBinaryFamily[]
> {
  const { index } = await readMetadata()
  return Object.values(index.families).sort(
    (first, second) => second.lastAccessedAt - first.lastAccessedAt
  )
}

export async function getGoogleFontBinaryCacheStats(): Promise<GoogleFontBinaryCacheStats> {
  const { catalog, index } = await readMetadata()
  return {
    familyCount: Object.keys(catalog.families).length,
    pinnedFamilyCount: Object.values(index.families).filter(
      (family) => family.pinned
    ).length,
    totalBytes: index.totalBytes
  }
}

export async function setGoogleFontBinaryFamilyPinned(
  reference: GoogleFontBinaryFamilyReference,
  pinned: boolean
): Promise<GoogleFontBinaryFamily | null> {
  return enqueue(async () => {
    const family = await readExactFamily(reference)
    if (!family) return null
    const updated = { ...family, pinned, updatedAt: Date.now() }
    const { catalog, index } = await readMetadata()
    if (index.families[family.key]?.revision === family.revision) {
      index.families[family.key] = updated
      index.updatedAt = updated.updatedAt
    }
    catalog.updatedAt = updated.updatedAt
    await writeStorage({
      [familyStorageKey(family.key, family.revision)]: updated,
      [GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]: catalog,
      [GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]: index
    })
    return updated
  })
}

export function deleteGoogleFontBinaryFamily(key: string): Promise<void> {
  return enqueue(async () => {
    if (!SHA256_PATTERN.test(key)) return
    const { catalog, index } = await readMetadata()
    const deletedFamily = catalog.families[key]
    if (!deletedFamily) return

    const manifestKeys = Object.entries(catalog.families).flatMap(
      ([familyKey, family]) =>
        family.revisions.map((revision) =>
          familyStorageKey(familyKey, revision)
        )
    )
    const values =
      manifestKeys.length > 0 ? await readStorage(manifestKeys) : {}
    const retainedAssets = new Map<
      string,
      { byteLength: number; refCount: number }
    >()
    for (const [familyKey, family] of Object.entries(catalog.families)) {
      for (const revision of family.revisions) {
        const manifest = values[familyStorageKey(familyKey, revision)]
        if (!isValidFamily(manifest))
          throw new GoogleFontBinaryError("google-font-cache-corrupt")
        if (familyKey === key) continue
        for (const [hash, byteLength] of uniqueFamilyAssets(manifest)) {
          const current = retainedAssets.get(hash)
          if (current && current.byteLength !== byteLength)
            throw new GoogleFontBinaryError("google-font-cache-corrupt")
          retainedAssets.set(hash, {
            byteLength,
            refCount: (current?.refCount ?? 0) + 1
          })
        }
      }
    }

    const now = Date.now()
    const nextCatalog = structuredClone(catalog)
    const nextIndex = structuredClone(index)
    delete nextCatalog.families[key]
    delete nextIndex.families[key]
    nextCatalog.assets = Object.fromEntries(retainedAssets)
    nextCatalog.updatedAt = now
    nextIndex.totalBytes = Array.from(retainedAssets.values()).reduce(
      (sum, asset) => sum + asset.byteLength,
      0
    )
    nextIndex.updatedAt = now

    const removedAssetHashes = Object.keys(catalog.assets).filter(
      (hash) => !retainedAssets.has(hash)
    )
    await publishMetadataWithCleanup(nextCatalog, nextIndex, [
      ...deletedFamily.revisions.map((revision) =>
        familyStorageKey(key, revision)
      ),
      ...removedAssetHashes.map(assetStorageKey)
    ])
  })
}

export async function pruneGoogleFontBinaryCache(
  options: GoogleFontBinaryPruneOptions = {}
): Promise<GoogleFontBinaryPruneResult> {
  return enqueue(async () => {
    const maxFamilies = Math.max(
      0,
      options.maxFamilies ?? MAX_GOOGLE_FONT_BINARY_FAMILIES
    )
    const maxTotalBytes = Math.max(
      0,
      options.maxTotalBytes ?? MAX_GOOGLE_FONT_BINARY_CACHE_BYTES
    )
    const protectedKeys = new Set(options.protectedFamilyKeys ?? [])
    const { catalog, index } = await readMetadata()
    const manifestKeys = Object.entries(catalog.families).flatMap(
      ([key, family]) =>
        family.revisions.map((revision) => familyStorageKey(key, revision))
    )
    const values =
      manifestKeys.length > 0 ? await readStorage(manifestKeys) : {}
    const manifests = new Map<string, GoogleFontBinaryFamily>()
    for (const key of manifestKeys) {
      const manifest = values[key]
      if (!isValidFamily(manifest))
        throw new GoogleFontBinaryError("google-font-cache-corrupt")
      manifests.set(key, manifest)
    }

    const removeKeys = new Set<string>()
    const evictedFamilyKeys: string[] = []
    const retainedFamilyKeys = new Set(Object.keys(catalog.families))
    const familyIsPinned = (key: string): boolean =>
      catalog.families[key].revisions.some(
        (revision) =>
          manifests.get(familyStorageKey(key, revision))?.pinned === true
      )
    const candidates = Object.keys(catalog.families)
      .filter((key) => !protectedKeys.has(key) && !familyIsPinned(key))
      .sort(
        (first, second) =>
          (index.families[first]?.lastAccessedAt ?? 0) -
          (index.families[second]?.lastAccessedAt ?? 0)
      )
    const removeFamily = (key: string): void => {
      retainedFamilyKeys.delete(key)
      evictedFamilyKeys.push(key)
      for (const revision of catalog.families[key].revisions)
        removeKeys.add(familyStorageKey(key, revision))
    }
    for (const key of candidates) {
      if (retainedFamilyKeys.size <= maxFamilies) break
      removeFamily(key)
    }

    const collectAssets = (): Map<
      string,
      { byteLength: number; refs: number }
    > => {
      const assets = new Map<string, { byteLength: number; refs: number }>()
      for (const [storageKey, manifest] of manifests) {
        if (removeKeys.has(storageKey)) continue
        for (const [hash, byteLength] of uniqueFamilyAssets(manifest)) {
          const current = assets.get(hash)
          assets.set(hash, {
            byteLength,
            refs: (current?.refs ?? 0) + 1
          })
        }
      }
      return assets
    }
    let assets = collectAssets()
    let totalBytes = Array.from(assets.values()).reduce(
      (sum, asset) => sum + asset.byteLength,
      0
    )
    const oldRevisionCandidates = Array.from(manifests.entries())
      .filter(
        ([, manifest]) =>
          manifest.revision !== catalog.families[manifest.key].latestRevision &&
          !manifest.pinned &&
          !protectedKeys.has(manifest.key) &&
          retainedFamilyKeys.has(manifest.key)
      )
      .sort(
        ([, first], [, second]) => first.lastAccessedAt - second.lastAccessedAt
      )
    for (const [storageKey] of oldRevisionCandidates) {
      if (totalBytes <= maxTotalBytes) break
      removeKeys.add(storageKey)
      assets = collectAssets()
      totalBytes = Array.from(assets.values()).reduce(
        (sum, asset) => sum + asset.byteLength,
        0
      )
    }
    for (const key of candidates) {
      if (totalBytes <= maxTotalBytes) break
      if (!retainedFamilyKeys.has(key)) continue
      removeFamily(key)
      assets = collectAssets()
      totalBytes = Array.from(assets.values()).reduce(
        (sum, asset) => sum + asset.byteLength,
        0
      )
    }

    const now = Date.now()
    const nextCatalog = emptyCatalog(now)
    const nextIndex = emptyIndex(now)
    for (const key of retainedFamilyKeys) {
      nextCatalog.families[key] = {
        latestRevision: catalog.families[key].latestRevision,
        revisions: catalog.families[key].revisions.filter(
          (revision) => !removeKeys.has(familyStorageKey(key, revision))
        )
      }
      if (index.families[key]) nextIndex.families[key] = index.families[key]
    }
    for (const [hash, asset] of assets)
      nextCatalog.assets[hash] = {
        byteLength: asset.byteLength,
        refCount: asset.refs
      }
    nextIndex.totalBytes = totalBytes
    const removedAssetHashes = Object.keys(catalog.assets).filter(
      (hash) => !assets.has(hash)
    )

    await publishMetadataWithCleanup(nextCatalog, nextIndex, [
      ...removeKeys,
      ...removedAssetHashes.map(assetStorageKey)
    ])
    return { evictedFamilyKeys, removedAssetHashes, totalBytes }
  })
}

export async function clearGoogleFontBinaryCache(): Promise<void> {
  return enqueue(async () => {
    // Explicit user deletion is the one safe place for a whole-storage scan.
    // Recovery deliberately preserves unknown/future-schema blobs, so relying
    // only on the current catalog here could leave orphaned downloaded fonts.
    const values = await readStorage(null)
    const binaryKeys = Object.keys(values).filter(
      (key) =>
        key.startsWith(GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX) ||
        key.startsWith(GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX) ||
        key === LEGACY_GOOGLE_FONT_CSS_CACHE_STORAGE_KEY
    )
    const now = Date.now()
    await publishMetadataWithCleanup(
      emptyCatalog(now),
      emptyIndex(now),
      binaryKeys
    )
  })
}

/**
 * Replaces only corrupt derived metadata. Unknown blobs and immutable family
 * manifests are deliberately retained because discovering them would require
 * a whole-storage read and could destroy data from a newer schema.
 */
export function recoverGoogleFontBinaryCache(): Promise<void> {
  return enqueue(async () => {
    const now = Date.now()
    await writeStorage({
      [GOOGLE_FONT_BINARY_CATALOG_STORAGE_KEY]: emptyCatalog(now),
      [GOOGLE_FONT_BINARY_INDEX_STORAGE_KEY]: emptyIndex(now)
    })
    await removeStorage([GOOGLE_FONT_BINARY_CLEANUP_STORAGE_KEY])
  })
}

export function resetGoogleFontBinaryStorageForTesting(): void {
  operationQueue = Promise.resolve()
}
