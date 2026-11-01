export const GOOGLE_FONT_BINARY_SCHEMA_VERSION = 1

export function normalizeGoogleFontBinaryFamilyKeyInput(
  fontFamily: string
): string {
  return fontFamily.trim().normalize("NFKC").toLocaleLowerCase("en-US")
}

export async function createGoogleFontBinaryFamilyKey(
  fontFamily: string
): Promise<string> {
  const bytes = new TextEncoder().encode(
    normalizeGoogleFontBinaryFamilyKeyInput(fontFamily)
  )
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

export function createGoogleFontRuntimeFamily(cssHash: string): string {
  return `FontAraGoogle-${cssHash.toLowerCase().slice(0, 24)}`
}

export type GoogleFontBinaryErrorCode =
  | "google-font-asset-invalid"
  | "google-font-asset-request-failed"
  | "google-font-asset-response-invalid"
  | "google-font-asset-too-large"
  | "google-font-asset-url-invalid"
  | "google-font-cache-corrupt"
  | "google-font-cache-family-limit"
  | "google-font-cache-size-limit"
  | "google-font-css-invalid"
  | "google-font-css-request-failed"
  | "google-font-css-response-invalid"
  | "google-font-css-too-large"
  | "google-font-face-count-limit"
  | "google-font-family-size-limit"
  | "google-font-invalid-request"
  | "google-font-network-failed"
  | "google-font-request-timeout"
  | "google-font-storage-read-failed"
  | "google-font-storage-remove-failed"
  | "google-font-storage-write-failed"
  | "google-font-transaction-expired"
  | "google-font-transaction-incomplete"

const RETRYABLE_GOOGLE_FONT_BINARY_ERRORS = new Set<GoogleFontBinaryErrorCode>([
  "google-font-asset-request-failed",
  "google-font-css-request-failed",
  "google-font-network-failed",
  "google-font-request-timeout",
  "google-font-storage-read-failed",
  "google-font-storage-remove-failed",
  "google-font-storage-write-failed"
])

export class GoogleFontBinaryError extends Error {
  readonly code: GoogleFontBinaryErrorCode
  readonly details?: Readonly<Record<string, string | number | boolean>>
  readonly retryable: boolean

  constructor(
    code: GoogleFontBinaryErrorCode,
    details?: Readonly<Record<string, string | number | boolean>>,
    cause?: unknown
  ) {
    super(code)
    this.name = "GoogleFontBinaryError"
    this.code = code
    this.details = details
    this.retryable = RETRYABLE_GOOGLE_FONT_BINARY_ERRORS.has(code)
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: cause
      })
    }
  }
}

export function isGoogleFontBinaryError(
  error: unknown
): error is GoogleFontBinaryError {
  return error instanceof GoogleFontBinaryError
}

export type GoogleFontBinaryFaceStyle = "italic" | "normal" | "oblique"

/** Metadata only. The corresponding bytes live under the content hash. */
export type GoogleFontBinaryFace = {
  assetHash: string
  byteLength: number
  id: string
  sourceUrl: string
  stretch: string
  style: GoogleFontBinaryFaceStyle
  unicodeRange: string | null
  weight: string
}

export type GoogleFontBinaryFamily = {
  createdAt: number
  cssHash: string
  faces: GoogleFontBinaryFace[]
  fontFamily: string
  key: string
  lastAccessedAt: number
  pinned: boolean
  requestUrl: string
  revision: number
  runtimeFamily: string
  schemaVersion: typeof GOOGLE_FONT_BINARY_SCHEMA_VERSION
  totalBytes: number
  updatedAt: number
}

export type GoogleFontBinaryFamilyDraft = Pick<
  GoogleFontBinaryFamily,
  | "cssHash"
  | "faces"
  | "fontFamily"
  | "key"
  | "requestUrl"
  | "runtimeFamily"
  | "totalBytes"
>

export type GoogleFontBinaryFamilyReference = Pick<
  GoogleFontBinaryFamily,
  "key" | "revision"
>

export type GoogleFontBinaryCacheIndex = {
  families: Record<string, GoogleFontBinaryFamily>
  schemaVersion: typeof GOOGLE_FONT_BINARY_SCHEMA_VERSION
  totalBytes: number
  updatedAt: number
}

export type StoredGoogleFontBinaryBlob = {
  byteLength: number
  data: string
  encoding: "base64"
  hash: string
  mimeType: "font/woff2"
  schemaVersion: typeof GOOGLE_FONT_BINARY_SCHEMA_VERSION
}

export type GoogleFontBinaryRequest = {
  family: string
  variants?: readonly string[]
}

export type GoogleFontBinaryLoadSource =
  | "fresh-cache"
  | "network"
  | "stale-cache"

export type GoogleFontBinaryLoadResult = {
  family: GoogleFontBinaryFamily
  revalidating: boolean
  source: GoogleFontBinaryLoadSource
}

export type GoogleFontBinaryPrepareOptions = {
  allowNetwork?: boolean
  cssTimeoutMs?: number
  fontTimeoutMs?: number
  pinnedFamilyKeys?: Iterable<string>
  staleWhileRevalidate?: boolean
}

export type GoogleFontBinaryPruneOptions = {
  maxFamilies?: number
  maxTotalBytes?: number
  protectedFamilyKeys?: Iterable<string>
}

export type GoogleFontBinaryPruneResult = {
  evictedFamilyKeys: string[]
  removedAssetHashes: string[]
  totalBytes: number
}

export type GoogleFontBinaryCacheStats = {
  familyCount: number
  pinnedFamilyCount: number
  totalBytes: number
}

export type GoogleFontBinaryPrepareResult = {
  faceCount: number
  fontFamily: string
  reference: GoogleFontBinaryFamilyReference
  totalBytes: number
}
