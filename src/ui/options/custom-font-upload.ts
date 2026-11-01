import type { CustomFontFaceMeta } from "../../custom-font-types"
import type { CustomFontExtractedMetadata } from "./custom-font-metadata-types"

export type SimpleCustomFontSlot = "regular" | "bold"

export type CustomFontMutationErrorKind =
  | "duplicate-name"
  | "family-limit"
  | "family-size-limit"
  | "invalid-data"
  | "library-limit"
  | "retryable"
  | "storage-unavailable"
  | "unknown"

export type SimpleCustomFontResolution =
  | {
      ok: true
      coversBold: boolean
      isVariable: boolean
      weight: { min: number; max: number }
    }
  | {
      ok: false
      reason: "unsupported-style" | "variable-weight-missing"
      requiredWeight?: number
    }

const REGULAR_WEIGHT = 400
const BOLD_WEIGHT = 700
const MIN_CSS_FONT_WEIGHT = 1
const MAX_CSS_FONT_WEIGHT = 1000

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return typeof error === "string" ? error : ""
}

export function classifyCustomFontMutationError(
  error: unknown
): CustomFontMutationErrorKind {
  const message = getErrorMessage(error)
  if (/custom-font-family-name-duplicate/i.test(message)) {
    return "duplicate-name"
  }
  if (/custom-font-library-family-limit/i.test(message)) {
    return "family-limit"
  }
  if (/custom-font-family-size-limit/i.test(message)) {
    return "family-size-limit"
  }
  if (
    /custom-font-(?:backup-)?library-size-limit|settings-backup-file-size-limit/i.test(
      message
    )
  ) {
    return "library-limit"
  }
  if (
    /custom-font-(?:family-transaction-active|transaction-(?:expired|incomplete|not-promoted))|(?:custom-font-manager|fontara-messenger)-not-ready/i.test(
      message
    )
  ) {
    return "retryable"
  }
  if (
    /extension context invalidated|context invalidated|receiving end does not exist|message port closed|(?:sync|local)-storage-unavailable|quota(?:_bytes)?|storage[^\n]*exceed|exceed[^\n]*storage/i.test(
      message
    )
  ) {
    return "storage-unavailable"
  }
  if (
    /^(?:invalid-|missing-|unsupported-)|custom-font-(?:backup-face-limit|family-face-limit|face-(?:not-in-transaction|size-limit)|import-batch-mismatch)/i.test(
      message
    )
  ) {
    return "invalid-data"
  }
  return "unknown"
}

export function getCustomFontLibraryByteLength(
  families: readonly {
    faces: readonly Pick<CustomFontFaceMeta, "byteLength" | "fileHash">[]
  }[],
  pendingFaces: readonly Pick<
    CustomFontFaceMeta,
    "byteLength" | "fileHash"
  >[] = []
): number {
  const bytesByHash = new Map<string, number>()
  for (const family of families) {
    for (const face of family.faces) {
      bytesByHash.set(face.fileHash, face.byteLength)
    }
  }
  for (const face of pendingFaces) {
    bytesByHash.set(face.fileHash, face.byteLength)
  }
  return Array.from(bytesByHash.values()).reduce(
    (total, byteLength) => total + byteLength,
    0
  )
}

function includesWeight(
  range: { min: number; max: number },
  weight: number
): boolean {
  return range.min <= weight && range.max >= weight
}

export function resolveSimpleCustomFontSlot(
  metadata: CustomFontExtractedMetadata | null,
  slot: SimpleCustomFontSlot
): SimpleCustomFontResolution {
  const requiredWeight = slot === "regular" ? REGULAR_WEIGHT : BOLD_WEIGHT
  if (!metadata) {
    return {
      ok: true,
      coversBold: false,
      isVariable: false,
      weight: { min: requiredWeight, max: requiredWeight }
    }
  }

  if (metadata.style !== "normal" || metadata.hasCombinedItalAxis) {
    return { ok: false, reason: "unsupported-style" }
  }

  const weightAxis = metadata.axes.find(
    (axis) => axis.tag === "wght" && axis.min < axis.max
  )
  if (weightAxis && !includesWeight(weightAxis, requiredWeight)) {
    return {
      ok: false,
      reason: "variable-weight-missing",
      requiredWeight
    }
  }

  if (weightAxis) {
    const cssWeightRange = {
      min: Math.max(MIN_CSS_FONT_WEIGHT, weightAxis.min),
      max: Math.min(MAX_CSS_FONT_WEIGHT, weightAxis.max)
    }
    return {
      ok: true,
      coversBold: slot === "regular" && includesWeight(weightAxis, BOLD_WEIGHT),
      isVariable: true,
      weight:
        slot === "regular"
          ? cssWeightRange
          : { min: BOLD_WEIGHT, max: BOLD_WEIGHT }
    }
  }

  return {
    ok: true,
    coversBold: false,
    isVariable: false,
    weight: { min: requiredWeight, max: requiredWeight }
  }
}
