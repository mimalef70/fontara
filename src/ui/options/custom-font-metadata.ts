import * as fontkit from "fontkit"

import type { CustomFontAxis } from "../../custom-font-types"
import type { CustomFontExtractedMetadata } from "./custom-font-metadata-types"

type FontkitAxis = {
  min: number
  default: number
  max: number
}

type FontkitFont = {
  familyName?: string
  getName?: (key: string) => unknown
  subfamilyName?: string
  postscriptName?: string
  variationAxes?: Record<string, FontkitAxis>
  weight?: number
  width?: number
  italicAngle?: number
  [key: string]: unknown
}

const WIDTH_CLASS_TO_PERCENT = [
  100, 50, 62.5, 75, 87.5, 100, 112.5, 125, 150, 200
]

const MAX_FAMILY_NAME_LENGTH = 128
const MAX_SOURCE_FAMILY_KEY_LENGTH = 256

const LEGACY_FACE_SUFFIX_PATTERN =
  /[\s_-]+((?:extra|ultra)[\s_-]*black|(?:extra|ultra)[\s_-]*bold|(?:semi|demi)[\s_-]*bold|(?:extra|ultra)[\s_-]*light|bold[\s_-]*(?:italic|oblique)|(?:italic|oblique)|hairline|thin|light|book|regular|normal|medium|bold|black|heavy)$/i

const LEGACY_WEIGHT_BY_SUFFIX: Record<string, number> = {
  hairline: 100,
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  book: 400,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  bolditalic: 700,
  boldoblique: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
  extrablack: 950,
  ultrablack: 950
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function getOpenTypeTable(
  font: FontkitFont,
  name: string
): Record<string, unknown> {
  const value = font[name]
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function getAxes(font: FontkitFont): CustomFontAxis[] {
  return Object.entries(font.variationAxes ?? {})
    .filter(
      ([tag, axis]) =>
        tag.length === 4 &&
        axis &&
        Number.isFinite(axis.min) &&
        Number.isFinite(axis.default) &&
        Number.isFinite(axis.max) &&
        axis.min <= axis.default &&
        axis.default <= axis.max
    )
    .map(([tag, axis]) => ({
      tag,
      min: axis.min,
      default: axis.default,
      max: axis.max
    }))
}

function getAxis(axes: CustomFontAxis[], tag: string): CustomFontAxis | null {
  return axes.find((axis) => axis.tag === tag) ?? null
}

function createSourceFamilyKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en")
    .slice(0, MAX_SOURCE_FAMILY_KEY_LENGTH)
}

function normalizeOpenTypeName(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .split("")
        .filter((character) => {
          const codePoint = character.codePointAt(0) ?? 0
          return !(
            codePoint <= 0x1f ||
            (codePoint >= 0x7f && codePoint <= 0x9f) ||
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2066 && codePoint <= 0x2069)
          )
        })
        .join("")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxLength)
    : ""
}

function getPreferredName(font: FontkitFont, key: string): string {
  try {
    return normalizeOpenTypeName(font.getName?.(key), MAX_FAMILY_NAME_LENGTH)
  } catch {
    return ""
  }
}

function normalizeIdentityPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

export function deriveCustomFontFamilyIdentity({
  familyName,
  postscriptName,
  preferredFamilyName,
  style,
  weight,
  wwsFamilyName
}: {
  familyName: string
  postscriptName: string | null
  preferredFamilyName?: string | null
  style: "normal" | "italic" | "oblique"
  weight: number
  wwsFamilyName?: string | null
}): { familyGroupName: string; sourceFamilyKey: string } {
  const standardFamilyName = normalizeOpenTypeName(
    preferredFamilyName || wwsFamilyName,
    MAX_FAMILY_NAME_LENGTH
  )
  if (standardFamilyName) {
    return {
      familyGroupName: standardFamilyName,
      sourceFamilyKey: createSourceFamilyKey(standardFamilyName)
    }
  }

  const suffixMatch = familyName.match(LEGACY_FACE_SUFFIX_PATTERN)
  if (!suffixMatch || !postscriptName) {
    return {
      familyGroupName: familyName,
      sourceFamilyKey: createSourceFamilyKey(familyName)
    }
  }

  const suffix = suffixMatch[1]
  const normalizedSuffix = normalizeIdentityPart(suffix)
  const familyGroupName = familyName.slice(0, suffixMatch.index).trim()
  const expectedWeight = LEGACY_WEIGHT_BY_SUFFIX[normalizedSuffix]
  const isStyleSuffix = /italic|oblique/.test(normalizedSuffix)
  const styleMatches = !isStyleSuffix || style !== "normal"
  const weightMatches =
    expectedWeight === undefined || Math.abs(weight - expectedWeight) <= 50
  const postscriptMatches =
    normalizeIdentityPart(postscriptName) ===
    normalizeIdentityPart(`${familyGroupName}-${suffix}`)

  if (
    !familyGroupName ||
    !styleMatches ||
    !weightMatches ||
    !postscriptMatches
  ) {
    return {
      familyGroupName: familyName,
      sourceFamilyKey: createSourceFamilyKey(familyName)
    }
  }

  return {
    familyGroupName,
    sourceFamilyKey: createSourceFamilyKey(familyGroupName)
  }
}

function extractMetadata(font: FontkitFont): CustomFontExtractedMetadata {
  const familyName = normalizeOpenTypeName(
    font.familyName,
    MAX_FAMILY_NAME_LENGTH
  )
  if (!familyName) throw new Error("font-family-name-missing")
  const preferredSubfamilyName =
    getPreferredName(font, "preferredSubfamily") ||
    getPreferredName(font, "wwsSubfamilyName")
  const subfamilyName =
    preferredSubfamilyName ||
    normalizeOpenTypeName(font.subfamilyName, MAX_FAMILY_NAME_LENGTH) ||
    "Regular"
  const os2 = getOpenTypeTable(font, "OS/2")
  const axes = getAxes(font)
  const weightAxis = getAxis(axes, "wght")
  const widthAxis = getAxis(axes, "wdth")
  const slantAxis = getAxis(axes, "slnt")
  const italicAxis = getAxis(axes, "ital")
  const staticWeight = Math.min(
    1000,
    Math.max(
      1,
      Math.round(
        normalizeNumber(os2.usWeightClass, normalizeNumber(font.weight, 400))
      )
    )
  )
  const widthClass = Math.min(
    9,
    Math.max(
      1,
      Math.round(
        normalizeNumber(os2.usWidthClass, normalizeNumber(font.width, 5))
      )
    )
  )
  const staticStretch = WIDTH_CLASS_TO_PERCENT[widthClass] ?? 100
  const lowerSubfamily = subfamilyName.toLocaleLowerCase("en")
  const italic = /italic/.test(lowerSubfamily)
  const oblique = /oblique|slant/.test(lowerSubfamily)
  const style = italic
    ? "italic"
    : oblique || slantAxis || normalizeNumber(font.italicAngle, 0) !== 0
      ? "oblique"
      : "normal"
  const postscriptName =
    normalizeOpenTypeName(font.postscriptName, MAX_FAMILY_NAME_LENGTH) || null
  const familyIdentity = deriveCustomFontFamilyIdentity({
    familyName,
    postscriptName,
    preferredFamilyName: getPreferredName(font, "preferredFamily"),
    style,
    weight: staticWeight,
    wwsFamilyName: getPreferredName(font, "wwsFamilyName")
  })

  return {
    familyName,
    familyGroupName: familyIdentity.familyGroupName,
    sourceFamilyKey: familyIdentity.sourceFamilyKey,
    subfamilyName,
    postscriptName,
    weight: weightAxis
      ? { min: weightAxis.min, max: weightAxis.max }
      : { min: staticWeight, max: staticWeight },
    style,
    stretch: widthAxis
      ? { min: widthAxis.min, max: widthAxis.max }
      : { min: staticStretch, max: staticStretch },
    axes,
    hasCombinedItalAxis: Boolean(italicAxis && italicAxis.min < italicAxis.max)
  }
}

export function extractCustomFontMetadataFromBytes(
  bytes: Uint8Array
): CustomFontExtractedMetadata {
  return extractMetadata(fontkit.create(bytes) as FontkitFont)
}
