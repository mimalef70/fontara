export type CustomFontFormat = "ttf" | "otf" | "woff" | "woff2"

export type CustomFontValidation = "verified" | "legacy-unverified" | "failed"

export type CustomFontAxis = {
  tag: string
  min: number
  default: number
  max: number
}

export type CustomFontFaceMeta = {
  id: string
  fileHash: string
  fileName: string
  format: CustomFontFormat
  byteLength: number
  weight: { min: number; max: number }
  style: "normal" | "italic" | "oblique"
  stretch: { min: number; max: number }
  axes: CustomFontAxis[]
  validation: CustomFontValidation
}

export type CustomFontFamily = {
  value: string
  displayName: string
  sourceFamilyKey: string
  unicodeRange: string | null
  revision: number
  faces: CustomFontFaceMeta[]
}

export type CustomFontFamilyDraft = Omit<CustomFontFamily, "revision">

export type LegacyCustomFontData = {
  value: string
  name: string
  data: string
  type: string
  fileHash?: string
  originalFileName?: string
  unicodeRange?: string | null
}

export type CustomFontTransactionBeginData = {
  clientMutationId: string
  family: CustomFontFamilyDraft
}

export type CustomFontTransactionPutFaceData = {
  clientMutationId: string
  transactionId: string
  faceId: string
  /** Raw file bytes encoded only for the private upload transaction. */
  base64: string
}

export type CustomFontTransactionIdData = {
  clientMutationId: string
  transactionId: string
}

export type CustomFontTransactionBatchCommitData = {
  clientMutationId: string
  settings: Record<string, unknown>
  transactionIds: string[]
}

export type CustomFontTransactionBeginResult = {
  transactionId: string
  expiresAt: number
}

export type CustomFontTransactionCommitResult = {
  family: CustomFontFamily
  revision: number
}

export type CustomFontLoadResult = {
  familyValue: string
  familyRevision: number
  loadedFaceIds: string[]
  failedFaceIds: string[]
}
