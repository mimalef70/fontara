import type { CustomFontFaceMeta, CustomFontFamily } from "../custom-font-types"
import {
  base64ToBytes,
  bytesToBase64,
  createCustomFontFileHash,
  isCustomFontFaceSignatureValid
} from "./custom-font-format"

export const CUSTOM_FONT_FACE_STORAGE_PREFIX = "customFontFace:"
export const CUSTOM_FONT_RECOVERY_STORAGE_PREFIX = "customFontRecovery:"
export const CUSTOM_FONT_STAGING_STORAGE_PREFIX = "customFontStaging:"
export const CUSTOM_FONT_TRANSACTION_JOURNAL_KEY =
  "__fontara_custom_font_transaction_journal__"
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
}

type TransactionJournal = Record<string, TransactionEntry>

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
  const values = await getLocalValues(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY)
  const journal = values[CUSTOM_FONT_TRANSACTION_JOURNAL_KEY]
  return journal && typeof journal === "object"
    ? (journal as TransactionJournal)
    : {}
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
  for (const family of families) {
    for (const face of family.faces) {
      const bytes = await readCustomFontFaceBytes(face.fileHash)
      if (
        !bytes ||
        bytes.byteLength !== face.byteLength ||
        bytes.byteLength > MAX_CUSTOM_FONT_FILE_SIZE_BYTES ||
        (face.validation !== "failed" &&
          !isCustomFontFaceSignatureValid(face.format, bytes))
      ) {
        throw new Error("missing-custom-font-face-blob")
      }
      backup[face.id] = bytesToBase64(bytes)
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
  const referencedHashes = new Set(
    families.flatMap((family) => family.faces.map((face) => face.fileHash))
  )
  const values = await getLocalValues(null)
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

export class CustomFontTransactionStore {
  async collectGarbage(now = Date.now()): Promise<void> {
    const [journal, values] = await Promise.all([
      readJournal(),
      getLocalValues(null)
    ])
    const liveStagingKeys = new Set<string>()
    let changed = false

    for (const [transactionId, transaction] of Object.entries(journal)) {
      if (transaction.expiresAt <= now) {
        delete journal[transactionId]
        changed = true
        continue
      }
      for (const faceId of transaction.receivedFaceIds) {
        liveStagingKeys.add(getStagingStorageKey(transactionId, faceId))
      }
    }

    const orphanStagingKeys = Object.keys(values).filter(
      (key) =>
        key.startsWith(CUSTOM_FONT_STAGING_STORAGE_PREFIX) &&
        !liveStagingKeys.has(key)
    )
    if (orphanStagingKeys.length > 0) await removeLocalValues(orphanStagingKeys)
    if (changed) await writeJournal(journal)
  }

  async begin(
    family: Omit<CustomFontFamily, "revision">,
    existingFamilies: CustomFontFamily[],
    now = Date.now()
  ): Promise<{ transactionId: string; expiresAt: number }> {
    await this.collectGarbage(now)
    const journal = await readJournal()
    validateTransactionReservations(family, existingFamilies, journal)
    const id = crypto.randomUUID()
    const expiresAt = now + CUSTOM_FONT_TRANSACTION_TTL_MS
    journal[id] = {
      id,
      createdAt: now,
      expiresAt,
      family,
      receivedFaceIds: []
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
    if (!transaction || transaction.expiresAt <= Date.now()) {
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
    if (!transaction || transaction.expiresAt <= Date.now()) {
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
    await setLocalValues(committedBlobs)
    delete journal[transactionId]
    await Promise.all([removeLocalValues(stagingKeys), writeJournal(journal)])
    return family
  }

  async abort(transactionId: string): Promise<void> {
    const journal = await readJournal()
    const transaction = journal[transactionId]
    if (!transaction) return
    delete journal[transactionId]
    const stagingKeys = transaction.receivedFaceIds.map((faceId) =>
      getStagingStorageKey(transactionId, faceId)
    )
    await Promise.all([
      stagingKeys.length > 0
        ? removeLocalValues(stagingKeys)
        : Promise.resolve(),
      writeJournal(journal)
    ])
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
