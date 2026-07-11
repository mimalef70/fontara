const CUSTOM_FONT_NAME_MAX_LENGTH = 128
const CUSTOM_FONT_SOURCE_KEY_MAX_LENGTH = 256
const CUSTOM_FONT_FILE_NAME_MAX_LENGTH = 255

// Keep meaningful shaping characters such as ZWNJ/ZWJ, but remove controls
// that can make a stored name invisible or visually reorder surrounding UI.
function truncateByCodePoint(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("")
}

function isUnsafeInvisibleCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    codePoint === 0x200b ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  )
}

export function normalizeCustomFontText(
  value: unknown,
  maxLength = CUSTOM_FONT_NAME_MAX_LENGTH
): string {
  if (typeof value !== "string" || maxLength <= 0) return ""

  const visibleValue = Array.from(value.normalize("NFKC"))
    .filter((character) => !isUnsafeInvisibleCharacter(character))
    .join("")

  return truncateByCodePoint(
    visibleValue.trim().replace(/\s+/gu, " "),
    maxLength
  )
}

export function normalizeCustomFontFamilyKey(value: unknown): string {
  return normalizeCustomFontText(
    value,
    CUSTOM_FONT_SOURCE_KEY_MAX_LENGTH
  ).toLocaleLowerCase("en")
}

export function normalizeCustomFontFileName(
  value: unknown,
  fallback: string
): string {
  return (
    normalizeCustomFontText(value, CUSTOM_FONT_FILE_NAME_MAX_LENGTH) ||
    normalizeCustomFontText(fallback, CUSTOM_FONT_FILE_NAME_MAX_LENGTH) ||
    "font"
  )
}
