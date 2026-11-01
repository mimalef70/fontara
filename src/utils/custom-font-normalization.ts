import { normalizeCustomFontUnicodeRange } from "../config/font-unicode-range"
import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  LegacyCustomFontData
} from "../custom-font-types"
import {
  createCustomFontFaceId,
  createCustomFontFileHash,
  dataURLToCustomFontBytes,
  getLegacyCustomFontFormat,
  isCustomFontFaceSignatureValid,
  isValidCustomFontFaceMeta
} from "./custom-font-format"
import {
  isCustomFontDisplayNameValid,
  normalizeCustomFontFamilyKey,
  normalizeCustomFontFileName,
  normalizeCustomFontText
} from "./custom-font-name"
import { isSafeCustomFontValue } from "./font-data"

const MAX_CUSTOM_FONT_FACES_PER_FAMILY = 20

function normalizeFace(value: unknown): CustomFontFaceMeta | null {
  if (!isValidCustomFontFaceMeta(value)) return null

  return {
    id: value.id,
    fileHash: value.fileHash.toLowerCase(),
    fileName: normalizeCustomFontFileName(
      value.fileName,
      `font.${value.format}`
    ),
    format: value.format,
    byteLength: value.byteLength,
    weight: { ...value.weight },
    style: value.style,
    stretch: { ...value.stretch },
    axes: value.axes.map((axis) => ({ ...axis })),
    validation: value.validation
  }
}

export function normalizeCustomFontFamily(
  value: unknown
): CustomFontFamily | null {
  if (!value || typeof value !== "object") return null
  const family = value as Partial<CustomFontFamily>
  const displayName = normalizeCustomFontText(family.displayName)
  const sourceFamilyKey = normalizeCustomFontFamilyKey(family.sourceFamilyKey)
  if (
    !isSafeCustomFontValue(family.value) ||
    !isCustomFontDisplayNameValid(displayName) ||
    !sourceFamilyKey ||
    !Array.isArray(family.faces)
  ) {
    return null
  }

  const faces: CustomFontFaceMeta[] = []
  const faceIds = new Set<string>()
  for (const candidate of family.faces.slice(
    0,
    MAX_CUSTOM_FONT_FACES_PER_FAMILY
  )) {
    const face = normalizeFace(candidate)
    if (!face || faceIds.has(face.id)) continue
    faceIds.add(face.id)
    faces.push(face)
  }
  if (faces.length === 0) return null

  return {
    value: family.value,
    displayName,
    sourceFamilyKey,
    unicodeRange: normalizeCustomFontUnicodeRange(family.unicodeRange),
    revision:
      typeof family.revision === "number" &&
      Number.isInteger(family.revision) &&
      family.revision > 0
        ? family.revision
        : 1,
    faces
  }
}

export function isLegacyCustomFontData(
  value: unknown
): value is LegacyCustomFontData {
  if (!value || typeof value !== "object") return false
  const font = value as Partial<LegacyCustomFontData>
  return (
    isSafeCustomFontValue(font.value) &&
    typeof font.name === "string" &&
    font.name.trim().length > 0 &&
    typeof font.data === "string" &&
    typeof font.type === "string"
  )
}

export async function normalizeLegacyCustomFontFamily(
  value: LegacyCustomFontData
): Promise<CustomFontFamily | null> {
  const decodedBytes = dataURLToCustomFontBytes(value.data)
  const bytes = getLegacyCustomFontMigrationBytes(value)
  const detectedFormat = getLegacyCustomFontFormat(value)
  const format = detectedFormat ?? "ttf"

  const fileHash = await createCustomFontFileHash(bytes)
  const fileName = normalizeCustomFontFileName(
    value.originalFileName,
    `${normalizeCustomFontText(value.name)}.${format}`
  )
  const validation =
    decodedBytes &&
    detectedFormat &&
    isCustomFontFaceSignatureValid(detectedFormat, decodedBytes)
      ? "legacy-unverified"
      : "failed"

  return {
    value: value.value,
    displayName: normalizeCustomFontText(value.name),
    sourceFamilyKey: normalizeCustomFontFamilyKey(value.name),
    unicodeRange: normalizeCustomFontUnicodeRange(value.unicodeRange),
    revision: 1,
    faces: [
      {
        id: createCustomFontFaceId(fileHash),
        fileHash,
        fileName,
        format,
        byteLength: bytes.byteLength,
        weight: { min: 400, max: 400 },
        style: "normal",
        stretch: { min: 100, max: 100 },
        axes: [],
        validation
      }
    ]
  }
}

export function getLegacyCustomFontMigrationBytes(
  value: LegacyCustomFontData
): Uint8Array {
  const decodedBytes = dataURLToCustomFontBytes(value.data)
  if (decodedBytes && decodedBytes.byteLength > 0) return decodedBytes

  return new TextEncoder().encode(JSON.stringify(value))
}

export async function normalizeCustomFontFamilies(
  value: unknown
): Promise<CustomFontFamily[]> {
  if (!Array.isArray(value)) return []

  const normalized: CustomFontFamily[] = []
  const familyValues = new Set<string>()
  for (const candidate of value) {
    const family = isLegacyCustomFontData(candidate)
      ? await normalizeLegacyCustomFontFamily(candidate)
      : normalizeCustomFontFamily(candidate)
    if (!family || familyValues.has(family.value)) continue
    familyValues.add(family.value)
    normalized.push(family)
  }
  return normalized
}
