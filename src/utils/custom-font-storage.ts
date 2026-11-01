import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  CustomFontTransactionMode
} from "../custom-font-types"
import {
  base64ToBytes,
  bytesToBase64,
  createCustomFontFileHash,
  isCustomFontFaceSignatureValid,
  isSHA256Hash
} from "./custom-font-format"
import { normalizeCustomFontFamily } from "./custom-font-normalization"

export const CUSTOM_FONT_FACE_STORAGE_PREFIX = "customFontFace:"
export const CUSTOM_FONT_RECOVERY_STORAGE_PREFIX = "customFontRecovery:"
export const CUSTOM_FONT_STAGING_STORAGE_PREFIX = "customFontStaging:"
export const CUSTOM_FONT_TRANSACTION_JOURNAL_KEY =
  "__fontara_custom_font_transaction_journal__"
export const CUSTOM_FONT_TRANSACTION_RECOVERY_KEY =
  "__fontara_custom_font_transaction_recovery__"
export const CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY =
  "__fontara_custom_font_storage_schema_version__"
export const CUSTOM_FONT_STORAGE_SCHEMA_VERSION = 2

export const MAX_CUSTOM_FONT_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_CUSTOM_FONT_FAMILY_SIZE_BYTES = 20 * 1024 * 1024
export const MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES = 50 * 1024 * 1024
export const MAX_CUSTOM_FONT_FACES_PER_FAMILY = 20
export const MAX_CUSTOM_FONT_FAMILIES = 64
export const MAX_CUSTOM_FONT_BATCH_FILES = 32
export const CUSTOM_FONT_TRANSACTION_TTL_MS = 30 * 60 * 1000
export const CUSTOM_FONT_PROMOTED_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CUSTOM_FONT_BASE64_LENGTH =
  Math.ceil(MAX_CUSTOM_FONT_FILE_SIZE_BYTES / 3) * 4 + 4

export type StoredCustomFontBlob = {
  encoding: "base64"
  byteLength: number
  format: CustomFontFaceMeta["format"]
  hash: string
  data: string
}

type TransactionEntry = {
  id: string
  createdAt: number
  expiresAt: number
  family: Omit<CustomFontFamily, "revision">
  receivedFaceIds: string[]
  phase?: "uploading" | "promoted"
  committedRevision?: number
  promotedAt?: number
}

type TransactionJournal = Record<string, TransactionEntry>

type TransactionRecovery = {
  entries: Record<string, unknown>
  updatedAt: number
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function normalizeTransactionEntry(
  transactionId: string,
  value: unknown
): TransactionEntry | null {
  if (!isPlainRecord(value) || value.id !== transactionId) return null
  if (
    !isFiniteTimestamp(value.createdAt) ||
    !isFiniteTimestamp(value.expiresAt) ||
    value.expiresAt < value.createdAt ||
    !isPlainRecord(value.family) ||
    !Array.isArray(value.family.faces) ||
    !Array.isArray(value.receivedFaceIds)
  ) {
    return null
  }

  const normalizedFamily = normalizeCustomFontFamily({
    ...value.family,
    revision: 1
  })
  if (
    !normalizedFamily ||
    normalizedFamily.faces.length !== value.family.faces.length
  ) {
    return null
  }
  const familyFaceIds = new Set(normalizedFamily.faces.map((face) => face.id))
  if (
    !value.receivedFaceIds.every(
      (faceId) => typeof faceId === "string" && familyFaceIds.has(faceId)
    )
  ) {
    return null
  }

  const phase = value.phase === undefined ? "uploading" : value.phase
  if (phase !== "uploading" && phase !== "promoted") return null
  if (
    phase === "promoted" &&
    (!Number.isInteger(value.committedRevision) ||
      Number(value.committedRevision) <= 0 ||
      !isFiniteTimestamp(value.promotedAt))
  ) {
    return null
  }

  const { revision: _revision, ...family } = normalizedFamily
  return {
    id: transactionId,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    family,
    receivedFaceIds: Array.from(new Set(value.receivedFaceIds as string[])),
    phase,
    ...(phase === "promoted"
      ? {
          committedRevision: value.committedRevision as number,
          promotedAt: value.promotedAt as number
        }
      : {})
  }
}

function getRecoveryEntries(value: unknown): Record<string, unknown> {
  if (!isPlainRecord(value) || !isPlainRecord(value.entries)) return {}
  return value.entries
}

function collectPotentialRecoveryHashes(
  value: unknown,
  hashes: Set<string>,
  depth = 0
): void {
  if (depth > 8 || value === null || value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPotentialRecoveryHashes(item, hashes, depth + 1)
    }
    return
  }
  if (!isPlainRecord(value)) return

  if (isSHA256Hash(value.fileHash)) hashes.add(value.fileHash.toLowerCase())
  for (const item of Object.values(value)) {
    collectPotentialRecoveryHashes(item, hashes, depth + 1)
  }
}

function validateTransactionReservations(
  family: Omit<CustomFontFamily, "revision">,
  existingFamilies: CustomFontFamily[],
  journal: TransactionJournal
): void {
  validateFamilyQuota(family, existingFamilies)
  const liveTransactions = Object.values(journal)
  if (
    liveTransactions.some(
      (transaction) => transaction.family.value === family.value
    )
  ) {
    throw new Error("custom-font-family-transaction-active")
  }

  const familyValues = new Set(existingFamilies.map((item) => item.value))
  for (const transaction of liveTransactions) {
    familyValues.add(transaction.family.value)
  }
  familyValues.add(family.value)
  if (familyValues.size > MAX_CUSTOM_FONT_FAMILIES) {
    throw new Error("custom-font-library-family-limit")
  }

  const reservedHashes = new Map<string, number>()
  for (const item of existingFamilies) {
    for (const face of item.faces) {
      reservedHashes.set(face.fileHash, face.byteLength)
    }
  }
  for (const transaction of liveTransactions) {
    for (const face of transaction.family.faces) {
      reservedHashes.set(face.fileHash, face.byteLength)
    }
  }
  for (const face of family.faces) {
    reservedHashes.set(face.fileHash, face.byteLength)
  }
  const reservedBytes = Array.from(reservedHashes.values()).reduce(
    (sum, byteLength) => sum + byteLength,
    0
  )
  if (reservedBytes > MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) {
    throw new Error("custom-font-library-size-limit")
  }
}

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
}

function getLocalValues(
  keys: string | string[] | null
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (values) => {
      const error = getRuntimeError()
      if (error) reject(error)
      else resolve(values)
    })
  })
}

function setLocalValues(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = getRuntimeError()
      if (error) reject(error)
      else resolve()
    })
  })
}

function removeLocalValues(keys: string | string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = getRuntimeError()
      if (error) reject(error)
      else resolve()
    })
  })
}

function getFaceStorageKey(fileHash: string): string {
  return `${CUSTOM_FONT_FACE_STORAGE_PREFIX}${fileHash}`
}

function getRecoveryStorageKey(fileHash: string): string {
  return `${CUSTOM_FONT_RECOVERY_STORAGE_PREFIX}${fileHash}`
}

function getStagingStorageKey(transactionId: string, faceId: string): string {
  return `${CUSTOM_FONT_STAGING_STORAGE_PREFIX}${transactionId}:${faceId}`
}

function getFamilyFileHashes(
  family: Pick<CustomFontFamily, "faces">
): string[] {
  return family.faces.map((face) => face.fileHash)
}

function getReferencedFileHashes(families: CustomFontFamily[]): Set<string> {
  return new Set(families.flatMap((family) => getFamilyFileHashes(family)))
}

function getJournalFileHashes(journal: TransactionJournal): Set<string> {
  return new Set(
    Object.values(journal).flatMap((transaction) =>
      getFamilyFileHashes(transaction.family)
    )
  )
}

function getBlobStorageKeys(fileHashes: Iterable<string>): string[] {
  return Array.from(fileHashes).flatMap((fileHash) => [
    getFaceStorageKey(fileHash),
    getRecoveryStorageKey(fileHash)
  ])
}

function isPublishedTransaction(
  transaction: TransactionEntry,
  families: CustomFontFamily[]
): boolean {
  if (
    transaction.phase !== "promoted" ||
    typeof transaction.committedRevision !== "number"
  ) {
    return false
  }
  const family = families.find(
    (candidate) =>
      candidate.value === transaction.family.value &&
      candidate.revision === transaction.committedRevision
  )
  if (!family || family.faces.length !== transaction.family.faces.length) {
    return false
  }
  const publishedFaces = new Map(
    family.faces.map((face) => [face.id, face.fileHash])
  )
  return transaction.family.faces.every(
    (face) => publishedFaces.get(face.id) === face.fileHash
  )
}

function isStoredBlob(value: unknown): value is StoredCustomFontBlob {
  if (!value || typeof value !== "object") return false
  const blob = value as Partial<StoredCustomFontBlob>
  return (
    blob.encoding === "base64" &&
    typeof blob.data === "string" &&
    typeof blob.hash === "string" &&
    typeof blob.byteLength === "number" &&
    typeof blob.format === "string"
  )
}

async function readJournal(): Promise<TransactionJournal> {
  const values = await getLocalValues([
    CUSTOM_FONT_TRANSACTION_JOURNAL_KEY,
    CUSTOM_FONT_TRANSACTION_RECOVERY_KEY
  ])
  const rawJournal = values[CUSTOM_FONT_TRANSACTION_JOURNAL_KEY]
  if (rawJournal === undefined || rawJournal === null) return {}

  const journal: TransactionJournal = {}
  const rejectedEntries: Record<string, unknown> = {}
  if (isPlainRecord(rawJournal)) {
    for (const [transactionId, candidate] of Object.entries(rawJournal)) {
      const transaction = normalizeTransactionEntry(transactionId, candidate)
      if (transaction) journal[transactionId] = transaction
      else rejectedEntries[transactionId] = candidate
    }
  } else {
    rejectedEntries.__invalid_journal__ = rawJournal
  }

  if (Object.keys(rejectedEntries).length > 0) {
    const recovery: TransactionRecovery = {
      entries: {
        ...getRecoveryEntries(values[CUSTOM_FONT_TRANSACTION_RECOVERY_KEY]),
        ...rejectedEntries
      },
      updatedAt: Date.now()
    }
    // Quarantine and sanitize in one storage write. Keeping the invalid source
    // under a separate key makes startup self-healing without discarding
    // forward-version metadata or the file hashes needed to protect its blobs.
    await setLocalValues({
      [CUSTOM_FONT_TRANSACTION_JOURNAL_KEY]: journal,
      [CUSTOM_FONT_TRANSACTION_RECOVERY_KEY]: recovery
    })
  }

  return journal
}

async function readTransactionRecoveryHashes(): Promise<Set<string>> {
  const values = await getLocalValues(CUSTOM_FONT_TRANSACTION_RECOVERY_KEY)
  const hashes = new Set<string>()
  collectPotentialRecoveryHashes(
    getRecoveryEntries(values[CUSTOM_FONT_TRANSACTION_RECOVERY_KEY]),
    hashes
  )
  return hashes
}

export async function clearCustomFontTransactionRecovery(): Promise<void> {
  await removeLocalValues(CUSTOM_FONT_TRANSACTION_RECOVERY_KEY)
}

async function writeJournal(journal: TransactionJournal): Promise<void> {
  if (Object.keys(journal).length === 0) {
    await removeLocalValues(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY)
    return
  }
  await setLocalValues({ [CUSTOM_FONT_TRANSACTION_JOURNAL_KEY]: journal })
}

export async function readCustomFontFaceBytes(
  fileHash: string
): Promise<Uint8Array | null> {
  const key = getFaceStorageKey(fileHash)
  const recoveryKey = getRecoveryStorageKey(fileHash)
  const values = await getLocalValues([key, recoveryKey])
  const blob = values[key] ?? values[recoveryKey]
  if (!isStoredBlob(blob) || blob.hash !== fileHash) return null
  const bytes = base64ToBytes(blob.data)
  if (!bytes || bytes.byteLength !== blob.byteLength) return null
  return (await createCustomFontFileHash(bytes)) === fileHash ? bytes : null
}

export async function createCustomFontFaceBackupMap(
  families: CustomFontFamily[]
): Promise<Record<string, string>> {
  const backup: Record<string, string> = {}
  const bytesByHash = new Map<string, Uint8Array>()
  for (const family of families) {
    for (const face of family.faces) {
      const bytes =
        bytesByHash.get(face.fileHash) ??
        (await readCustomFontFaceBytes(face.fileHash))
      if (
        !bytes ||
        bytes.byteLength !== face.byteLength ||
        bytes.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES ||
        (face.validation !== "failed" &&
          !isCustomFontFaceSignatureValid(face.format, bytes))
      ) {
        throw new Error("missing-custom-font-face-blob")
      }
      if (!bytesByHash.has(face.fileHash)) {
        bytesByHash.set(face.fileHash, bytes)
        backup[face.fileHash] = bytesToBase64(bytes)
      }
    }
  }
  return backup
}

export async function writeCustomFontFaceBytes(
  face: Pick<
    CustomFontFaceMeta,
    "fileHash" | "format" | "byteLength" | "validation"
  >,
  bytes: Uint8Array
): Promise<void> {
  const hash = await createCustomFontFileHash(bytes)
  const signatureIsValid = isCustomFontFaceSignatureValid(face.format, bytes)
  if (
    hash !== face.fileHash ||
    bytes.byteLength !== face.byteLength ||
    bytes.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES ||
    (!signatureIsValid && face.validation !== "failed")
  ) {
    throw new Error("invalid-custom-font-face")
  }

  const blob: StoredCustomFontBlob = {
    encoding: "base64",
    byteLength: bytes.byteLength,
    format: face.format,
    hash,
    data: bytesToBase64(bytes)
  }
  await setLocalValues({ [getFaceStorageKey(hash)]: blob })
}

export async function writeCustomFontRecoveryBytes(
  face: Pick<
    CustomFontFaceMeta,
    "fileHash" | "format" | "byteLength" | "validation"
  >,
  bytes: Uint8Array
): Promise<void> {
  const hash = await createCustomFontFileHash(bytes)
  if (
    face.validation !== "failed" ||
    hash !== face.fileHash ||
    bytes.byteLength !== face.byteLength
  ) {
    throw new Error("invalid-custom-font-recovery")
  }
  const blob: StoredCustomFontBlob = {
    encoding: "base64",
    byteLength: bytes.byteLength,
    format: face.format,
    hash,
    data: bytesToBase64(bytes)
  }
  await setLocalValues({ [getRecoveryStorageKey(hash)]: blob })
}

export async function deleteUnusedCustomFontFaceBlobs(
  families: CustomFontFamily[]
): Promise<void> {
  // readJournal may quarantine malformed entries. Read recovery only after
  // that write completes so cleanup cannot miss a newly protected hash.
  const journal = await readJournal()
  const [recoveryHashes, values] = await Promise.all([
    readTransactionRecoveryHashes(),
    getLocalValues(null)
  ])
  const referencedHashes = getReferencedFileHashes(families)
  for (const fileHash of getJournalFileHashes(journal)) {
    referencedHashes.add(fileHash)
  }
  for (const fileHash of recoveryHashes) referencedHashes.add(fileHash)
  const orphanKeys = Object.keys(values).filter(
    (key) =>
      (key.startsWith(CUSTOM_FONT_FACE_STORAGE_PREFIX) ||
        key.startsWith(CUSTOM_FONT_RECOVERY_STORAGE_PREFIX)) &&
      !referencedHashes.has(
        key.slice(
          key.startsWith(CUSTOM_FONT_FACE_STORAGE_PREFIX)
            ? CUSTOM_FONT_FACE_STORAGE_PREFIX.length
            : CUSTOM_FONT_RECOVERY_STORAGE_PREFIX.length
        )
      )
  )
  if (orphanKeys.length > 0) await removeLocalValues(orphanKeys)
}

/**
 * Deletes only blobs belonging to a known mutation. Unlike the broad orphan
 * collector this is safe to call after an explicit replace/delete even when a
 * settings normalizer has omitted unrelated catalog entries.
 */
export async function deleteUnreferencedCustomFontFaceBlobs(
  candidateFileHashes: Iterable<string>,
  referencedFamilies: CustomFontFamily[]
): Promise<void> {
  const journal = await readJournal()
  const recoveryHashes = await readTransactionRecoveryHashes()
  const protectedHashes = getReferencedFileHashes(referencedFamilies)
  for (const fileHash of getJournalFileHashes(journal)) {
    protectedHashes.add(fileHash)
  }
  for (const fileHash of recoveryHashes) protectedHashes.add(fileHash)
  const orphanHashes = new Set(
    Array.from(candidateFileHashes).filter(
      (fileHash) => !protectedHashes.has(fileHash)
    )
  )
  if (orphanHashes.size > 0) {
    await removeLocalValues(getBlobStorageKeys(orphanHashes))
  }
}

export type AbortedCustomFontTransaction = {
  family: Omit<CustomFontFamily, "revision">
  promoted: boolean
}

export class CustomFontTransactionStore {
  async collectGarbage(
    now = Date.now(),
    scanForOrphanStaging = false
  ): Promise<void> {
    const journal = await readJournal()
    const values = scanForOrphanStaging ? await getLocalValues(null) : null
    const liveStagingKeys = new Set<string>()
    const expiredStagingKeys = new Set<string>()
    let changed = false

    for (const [transactionId, transaction] of Object.entries(journal)) {
      if (transaction.expiresAt <= now) {
        for (const face of transaction.family.faces) {
          expiredStagingKeys.add(getStagingStorageKey(transactionId, face.id))
        }
        delete journal[transactionId]
        changed = true
        continue
      }
      for (const faceId of transaction.receivedFaceIds) {
        liveStagingKeys.add(getStagingStorageKey(transactionId, faceId))
      }
    }

    const orphanStagingKeys = values
      ? Object.keys(values).filter(
          (key) =>
            key.startsWith(CUSTOM_FONT_STAGING_STORAGE_PREFIX) &&
            !liveStagingKeys.has(key)
        )
      : []
    for (const key of expiredStagingKeys) orphanStagingKeys.push(key)
    if (orphanStagingKeys.length > 0) await removeLocalValues(orphanStagingKeys)
    if (changed) await writeJournal(journal)
  }

  async finalizePublished(families: CustomFontFamily[]): Promise<void> {
    const journal = await readJournal()
    const stagingKeys: string[] = []
    let changed = false
    for (const [transactionId, transaction] of Object.entries(journal)) {
      if (!isPublishedTransaction(transaction, families)) continue
      delete journal[transactionId]
      changed = true
      stagingKeys.push(
        ...transaction.family.faces.map((face) =>
          getStagingStorageKey(transactionId, face.id)
        )
      )
    }
    if (!changed) return
    await writeJournal(journal)
    if (stagingKeys.length > 0) {
      await removeLocalValues(stagingKeys)
    }
  }

  async begin(
    family: Omit<CustomFontFamily, "revision">,
    existingFamilies: CustomFontFamily[],
    mode: CustomFontTransactionMode = "append",
    now = Date.now()
  ): Promise<{ transactionId: string; expiresAt: number }> {
    await this.finalizePublished(existingFamilies)
    await this.collectGarbage(now)
    const journal = await readJournal()
    validateTransactionReservations(
      family,
      mode === "replace-library" ? [] : existingFamilies,
      journal
    )
    const id = crypto.randomUUID()
    const expiresAt = now + CUSTOM_FONT_TRANSACTION_TTL_MS
    journal[id] = {
      id,
      createdAt: now,
      expiresAt,
      family,
      receivedFaceIds: [],
      phase: "uploading"
    }
    await writeJournal(journal)
    return { transactionId: id, expiresAt }
  }

  async putFace(
    transactionId: string,
    faceId: string,
    base64: string
  ): Promise<void> {
    if (base64.length > MAX_CUSTOM_FONT_BASE64_LENGTH) {
      throw new Error("invalid-custom-font-face-size")
    }
    const journal = await readJournal()
    const transaction = journal[transactionId]
    if (
      !transaction ||
      transaction.phase === "promoted" ||
      transaction.expiresAt <= Date.now()
    ) {
      throw new Error("custom-font-transaction-expired")
    }
    const face = transaction.family.faces.find((item) => item.id === faceId)
    if (!face) throw new Error("custom-font-face-not-in-transaction")

    const bytes = base64ToBytes(base64)
    if (!bytes || bytes.byteLength !== face.byteLength) {
      throw new Error("invalid-custom-font-face-size")
    }
    const fileHash = await createCustomFontFileHash(bytes)
    const signatureIsValid = isCustomFontFaceSignatureValid(face.format, bytes)
    if (
      fileHash !== face.fileHash ||
      bytes.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES ||
      (!signatureIsValid && face.validation !== "failed")
    ) {
      throw new Error("invalid-custom-font-face")
    }

    const blob: StoredCustomFontBlob = {
      encoding: "base64",
      byteLength: bytes.byteLength,
      format: face.format,
      hash: fileHash,
      data: base64
    }
    await setLocalValues({
      [getStagingStorageKey(transactionId, faceId)]: blob
    })
    if (!transaction.receivedFaceIds.includes(faceId)) {
      transaction.receivedFaceIds.push(faceId)
      await writeJournal(journal)
    }
  }

  async commit(
    transactionId: string,
    existingFamilies: CustomFontFamily[],
    revisionFamilies: CustomFontFamily[] = existingFamilies
  ): Promise<CustomFontFamily> {
    const journal = await readJournal()
    const transaction = journal[transactionId]
    if (!transaction) {
      throw new Error("custom-font-transaction-expired")
    }
    if (
      transaction.phase === "promoted" &&
      typeof transaction.committedRevision === "number"
    ) {
      return {
        ...transaction.family,
        revision: transaction.committedRevision
      }
    }
    if (transaction.expiresAt <= Date.now()) {
      throw new Error("custom-font-transaction-expired")
    }
    validateFamilyQuota(transaction.family, existingFamilies)
    if (
      transaction.receivedFaceIds.length !== transaction.family.faces.length ||
      transaction.family.faces.some(
        (face) => !transaction.receivedFaceIds.includes(face.id)
      )
    ) {
      throw new Error("custom-font-transaction-incomplete")
    }

    const stagingKeys = transaction.family.faces.map((face) =>
      getStagingStorageKey(transactionId, face.id)
    )
    const staged = await getLocalValues(stagingKeys)
    const committedBlobs: Record<string, StoredCustomFontBlob> = {}
    for (const [index, face] of transaction.family.faces.entries()) {
      const blob = staged[stagingKeys[index]]
      if (!isStoredBlob(blob) || blob.hash !== face.fileHash) {
        throw new Error("custom-font-transaction-incomplete")
      }
      committedBlobs[getFaceStorageKey(face.fileHash)] = blob
    }

    const family: CustomFontFamily = {
      ...transaction.family,
      revision:
        (revisionFamilies.find(
          (item) => item.value === transaction.family.value
        )?.revision ?? 0) + 1
    }
    const promotedAt = Date.now()
    transaction.phase = "promoted"
    transaction.committedRevision = family.revision
    transaction.promotedAt = promotedAt
    transaction.expiresAt = Math.max(
      transaction.expiresAt,
      promotedAt + CUSTOM_FONT_PROMOTED_TRANSACTION_TTL_MS
    )

    // Persist the promoted blobs and their recovery journal in one storage
    // operation. The journal is deliberately retained until the catalog write
    // succeeds, so a service-worker restart cannot turn these blobs into
    // collectible orphans in the commit window.
    await setLocalValues({
      ...committedBlobs,
      [CUSTOM_FONT_TRANSACTION_JOURNAL_KEY]: journal
    })
    return family
  }

  async finalize(transactionId: string): Promise<void> {
    const journal = await readJournal()
    const transaction = journal[transactionId]
    if (!transaction) return
    if (transaction.phase !== "promoted") {
      throw new Error("custom-font-transaction-not-promoted")
    }
    delete journal[transactionId]
    await writeJournal(journal)
    await removeLocalValues(
      transaction.family.faces.map((face) =>
        getStagingStorageKey(transactionId, face.id)
      )
    )
  }

  async abort(
    transactionId: string
  ): Promise<AbortedCustomFontTransaction | null> {
    const journal = await readJournal()
    const transaction = journal[transactionId]
    if (!transaction) return null
    delete journal[transactionId]
    const stagingKeys = transaction.family.faces.map((face) =>
      getStagingStorageKey(transactionId, face.id)
    )
    await writeJournal(journal)
    if (stagingKeys.length > 0) await removeLocalValues(stagingKeys)
    return {
      family: transaction.family,
      promoted: transaction.phase === "promoted"
    }
  }
}

export function validateFamilyQuota(
  family: Omit<CustomFontFamily, "revision"> | CustomFontFamily,
  existingFamilies: CustomFontFamily[]
): void {
  if (
    family.faces.length === 0 ||
    family.faces.length > MAX_CUSTOM_FONT_FACES_PER_FAMILY ||
    family.faces.length > MAX_CUSTOM_FONT_BATCH_FILES
  ) {
    throw new Error("custom-font-family-face-limit")
  }
  if (
    family.faces.some(
      (face) =>
        face.byteLength <= 0 ||
        face.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES
    )
  ) {
    throw new Error("custom-font-face-size-limit")
  }
  const familyBytes = family.faces.reduce(
    (sum, face) => sum + face.byteLength,
    0
  )
  if (familyBytes > MAX_CUSTOM_FONT_FAMILY_SIZE_BYTES) {
    throw new Error("custom-font-family-size-limit")
  }
  const replacing = existingFamilies.find((item) => item.value === family.value)
  if (!replacing && existingFamilies.length >= MAX_CUSTOM_FONT_FAMILIES) {
    throw new Error("custom-font-library-family-limit")
  }

  const hashes = new Map<string, number>()
  for (const item of existingFamilies) {
    if (item.value === family.value) continue
    for (const face of item.faces) hashes.set(face.fileHash, face.byteLength)
  }
  for (const face of family.faces) hashes.set(face.fileHash, face.byteLength)
  const libraryBytes = Array.from(hashes.values()).reduce(
    (sum, size) => sum + size,
    0
  )
  if (libraryBytes > MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) {
    throw new Error("custom-font-library-size-limit")
  }
}
