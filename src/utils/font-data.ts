export type SupportedFontFormat = "woff2" | "woff" | "opentype" | "truetype"

export const MAX_CUSTOM_FONT_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_CUSTOM_FONT_DATA_URL_LENGTH = 7 * 1024 * 1024

const CUSTOM_FONT_VALUE_PATTERN = /^[A-Za-z0-9_-]{1,64}-Fontara$/
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

const FONT_FORMAT_BY_EXTENSION: Record<string, SupportedFontFormat> = {
  otf: "opentype",
  ttf: "truetype",
  woff: "woff",
  woff2: "woff2"
}

const FONT_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2"
}

const FONT_FORMAT_BY_MIME_TYPE: Record<string, SupportedFontFormat> = {
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "application/x-font-sfnt": "opentype",
  "application/x-font-truetype": "truetype",
  "application/vnd.ms-opentype": "opentype",
  "application/x-font-opentype": "opentype",
  "application/x-font-otf": "opentype",
  "application/x-font-ttf": "truetype",
  "application/x-font-woff": "woff",
  "application/x-font-woff2": "woff2",
  "font/otf": "opentype",
  "font/sfnt": "opentype",
  "font/ttf": "truetype",
  "font/woff": "woff",
  "font/woff2": "woff2"
}

const GENERIC_FONT_DATA_URL_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream"
])
const CSS_GENERIC_FONT_FAMILY_KEYWORDS = new Set([
  "cursive",
  "emoji",
  "fangsong",
  "fantasy",
  "math",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif"
])

const TRUETYPE_SIGNATURE = [0x00, 0x01, 0x00, 0x00]

type ParsedFontDataURL = {
  base64Data: string
  mimeType: string
}

export function getFontFileExtension(fileName: string): string {
  const extensionStart = fileName.lastIndexOf(".")
  return extensionStart === -1
    ? ""
    : fileName.slice(extensionStart + 1).toLowerCase()
}

export function isSupportedFontExtension(extension: string): boolean {
  return getFontFormatFromExtension(extension) !== null
}

export function isSafeCustomFontValue(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_FONT_VALUE_PATTERN.test(value)
}

export function getFontFormatFromExtension(
  extension: unknown
): SupportedFontFormat | null {
  if (typeof extension !== "string") return null

  return FONT_FORMAT_BY_EXTENSION[extension.toLowerCase()] ?? null
}

function parseFontDataURL(dataURL: unknown): ParsedFontDataURL | null {
  if (typeof dataURL !== "string") return null
  if (
    dataURL.length === 0 ||
    dataURL.length > MAX_CUSTOM_FONT_DATA_URL_LENGTH
  ) {
    return null
  }

  const match = /^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/i.exec(dataURL)
  if (!match) return null

  const mimeType = match[1].toLowerCase()
  const base64Data = match[2]
  if (!BASE64_PATTERN.test(base64Data) || base64Data.length % 4 !== 0) {
    return null
  }

  return {
    base64Data,
    mimeType
  }
}

export function getFontDataURLFormat(
  dataURL: unknown,
  fallbackExtension?: unknown
): SupportedFontFormat | null {
  const parsedDataURL = parseFontDataURL(dataURL)
  if (!parsedDataURL) return null

  const format = FONT_FORMAT_BY_MIME_TYPE[parsedDataURL.mimeType]
  if (format) return format

  if (GENERIC_FONT_DATA_URL_MIME_TYPES.has(parsedDataURL.mimeType)) {
    return getFontFormatFromExtension(fallbackExtension)
  }

  return null
}

export function normalizeFontDataURL(
  dataURL: unknown,
  extension: unknown
): string | null {
  const parsedDataURL = parseFontDataURL(dataURL)
  if (!parsedDataURL) return null

  const format = getFontDataURLFormat(dataURL, extension)
  if (!format) return null

  if (FONT_FORMAT_BY_MIME_TYPE[parsedDataURL.mimeType]) {
    return dataURL as string
  }

  const normalizedExtension =
    typeof extension === "string" ? extension.toLowerCase() : ""
  const mimeType = FONT_MIME_TYPE_BY_EXTENSION[normalizedExtension]
  if (!mimeType) return null

  return `data:${mimeType};base64,${parsedDataURL.base64Data}`
}

function hasByteSignature(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

function hasTextSignature(bytes: Uint8Array, signature: string): boolean {
  return signature
    .split("")
    .every((character, index) => bytes[index] === character.charCodeAt(0))
}

function hasTrueTypeSignature(bytes: Uint8Array): boolean {
  return (
    hasByteSignature(bytes, TRUETYPE_SIGNATURE) ||
    hasTextSignature(bytes, "true")
  )
}

export function isFontFileSignatureSupported(
  extension: unknown,
  bytes: Uint8Array
): boolean {
  const normalizedExtension =
    typeof extension === "string" ? extension.toLowerCase() : ""
  if (bytes.length < 4) return false

  switch (normalizedExtension) {
    case "woff2":
      return hasTextSignature(bytes, "wOF2")
    case "woff":
      return hasTextSignature(bytes, "wOFF")
    case "otf":
      return hasTextSignature(bytes, "OTTO") || hasTrueTypeSignature(bytes)
    case "ttf":
      return hasTrueTypeSignature(bytes)
    default:
      return false
  }
}

export function splitFontFamilies(fontFamily: string): string[] {
  const families: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  let escaped = false

  for (const character of fontFamily) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === "\\") {
      current += character
      escaped = true
      continue
    }

    if (quote) {
      current += character
      if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'") {
      current += character
      quote = character
      continue
    }

    if (character === ",") {
      families.push(current)
      current = ""
      continue
    }

    current += character
  }

  families.push(current)
  return families
}

export function normalizeFontFamilyName(fontFamily: string): string {
  return fontFamily.trim().replace(/^["']+|["']+$/g, "")
}

export function escapeCSSString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\A ")
    .replace(/\r/g, "\\D ")
    .replace(/\f/g, "\\C ")
}

export function isCSSGenericFontFamily(fontFamily: unknown): boolean {
  return (
    typeof fontFamily === "string" &&
    CSS_GENERIC_FONT_FAMILY_KEYWORDS.has(fontFamily.trim().toLowerCase())
  )
}

export function formatFontFamilyForCSS(fontFamily: string): string {
  const normalizedFontFamily = fontFamily.trim()
  if (isCSSGenericFontFamily(normalizedFontFamily)) {
    return normalizedFontFamily.toLowerCase()
  }

  return `"${escapeCSSString(normalizedFontFamily)}"`
}
