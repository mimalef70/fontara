export const FONTARA_TEXT_UNICODE_RANGE =
  "U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200B-200F, U+202A-202F"

export const CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE = "custom"
export const DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET = "arabic-persian"

export type CustomFontUnicodeRangePresetId =
  | "all"
  | "arabic-persian"
  | "cjk"
  | "cyrillic"
  | "devanagari"
  | "greek"
  | "hebrew"
  | "latin"
  | "latin-arabic"
  | "thai"

export type CustomFontUnicodeRangePreset = {
  id: CustomFontUnicodeRangePresetId
  unicodeRange: string | null
}

export const CUSTOM_FONT_UNICODE_RANGE_PRESETS = [
  {
    id: "arabic-persian",
    unicodeRange: FONTARA_TEXT_UNICODE_RANGE
  },
  {
    id: "latin",
    unicodeRange: "U+0000-00FF, U+0100-024F, U+1E00-1EFF, U+2000-206F"
  },
  {
    id: "latin-arabic",
    unicodeRange: `${FONTARA_TEXT_UNICODE_RANGE}, U+0000-00FF, U+0100-024F, U+1E00-1EFF, U+2000-206F`
  },
  {
    id: "cyrillic",
    unicodeRange: "U+0400-052F, U+2DE0-2DFF, U+A640-A69F"
  },
  {
    id: "greek",
    unicodeRange: "U+0370-03FF, U+1F00-1FFF"
  },
  {
    id: "hebrew",
    unicodeRange: "U+0590-05FF, U+FB1D-FB4F"
  },
  {
    id: "devanagari",
    unicodeRange: "U+0900-097F, U+A8E0-A8FF"
  },
  {
    id: "thai",
    unicodeRange: "U+0E00-0E7F"
  },
  {
    id: "cjk",
    unicodeRange:
      "U+2E80-2EFF, U+3000-303F, U+3040-30FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF"
  },
  {
    id: "all",
    unicodeRange: null
  }
] satisfies CustomFontUnicodeRangePreset[]

const CUSTOM_FONT_UNICODE_RANGE_TOKEN_PATTERN =
  /^U\+([0-9A-F?]{1,6})(?:-([0-9A-F]{1,6}))?$/i
const MAX_CUSTOM_FONT_UNICODE_RANGE_TOKENS = 32
const MAX_UNICODE_CODE_POINT = 0x10ffff

function normalizeCodePoint(value: string): string {
  return value.toUpperCase().padStart(4, "0")
}

function parseCodePoint(value: string): number | null {
  const codePoint = Number.parseInt(value, 16)

  return Number.isFinite(codePoint) && codePoint <= MAX_UNICODE_CODE_POINT
    ? codePoint
    : null
}

function normalizeUnicodeRangeToken(value: string): string | null {
  const token = value.trim().toUpperCase()
  const match = CUSTOM_FONT_UNICODE_RANGE_TOKEN_PATTERN.exec(token)
  if (!match) return null

  const start = match[1]
  const end = match[2]

  if (start.includes("?")) {
    return end ? null : `U+${start}`
  }

  const startCodePoint = parseCodePoint(start)
  if (startCodePoint === null) return null

  if (!end) {
    return `U+${normalizeCodePoint(start)}`
  }

  const endCodePoint = parseCodePoint(end)
  if (endCodePoint === null || endCodePoint < startCodePoint) {
    return null
  }

  return `U+${normalizeCodePoint(start)}-${normalizeCodePoint(end)}`
}

export function getCustomFontUnicodeRangePreset(
  id: unknown
): CustomFontUnicodeRangePreset | null {
  return (
    CUSTOM_FONT_UNICODE_RANGE_PRESETS.find((preset) => preset.id === id) ?? null
  )
}

export function parseCustomFontUnicodeRangeInput(
  value: string
): string | null | undefined {
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)

  if (tokens.length === 0) return null
  if (tokens.length > MAX_CUSTOM_FONT_UNICODE_RANGE_TOKENS) return undefined

  const normalizedTokens: string[] = []
  const seenTokens = new Set<string>()

  for (const token of tokens) {
    const normalizedToken = normalizeUnicodeRangeToken(token)
    if (!normalizedToken) return undefined
    if (seenTokens.has(normalizedToken)) continue

    seenTokens.add(normalizedToken)
    normalizedTokens.push(normalizedToken)
  }

  return normalizedTokens.join(", ")
}

export function normalizeCustomFontUnicodeRange(
  value: unknown,
  fallback: string | null = FONTARA_TEXT_UNICODE_RANGE
): string | null {
  if (value === null) return null
  if (typeof value !== "string") return fallback

  const normalizedRange = parseCustomFontUnicodeRangeInput(value)

  return normalizedRange === undefined ? fallback : normalizedRange
}
