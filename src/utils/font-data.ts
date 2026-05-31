export type SupportedFontFormat = "woff2" | "woff" | "opentype" | "truetype"

export const MAX_CUSTOM_FONT_FILE_SIZE_BYTES = 2 * 1024 * 1024
export const MAX_CUSTOM_FONT_DATA_URL_LENGTH = 3 * 1024 * 1024

const CUSTOM_FONT_VALUE_PATTERN = /^[A-Za-z0-9_-]{1,64}-Fontara$/
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

const FONT_FORMAT_BY_MIME_TYPE: Record<string, SupportedFontFormat> = {
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
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

const SUPPORTED_FONT_EXTENSIONS = new Set(["otf", "ttf", "woff", "woff2"])

export function getFontFileExtension(fileName: string): string {
  const extensionStart = fileName.lastIndexOf(".")
  return extensionStart === -1
    ? ""
    : fileName.slice(extensionStart + 1).toLowerCase()
}

export function isSupportedFontExtension(extension: string): boolean {
  return SUPPORTED_FONT_EXTENSIONS.has(extension.toLowerCase())
}

export function isSafeCustomFontValue(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_FONT_VALUE_PATTERN.test(value)
}

export function getFontDataURLFormat(
  dataURL: unknown
): SupportedFontFormat | null {
  if (typeof dataURL !== "string") return null
  if (
    dataURL.length === 0 ||
    dataURL.length > MAX_CUSTOM_FONT_DATA_URL_LENGTH
  ) {
    return null
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataURL)
  if (!match) return null

  const mimeType = match[1].toLowerCase()
  const base64Data = match[2]
  if (!BASE64_PATTERN.test(base64Data) || base64Data.length % 4 !== 0) {
    return null
  }

  return FONT_FORMAT_BY_MIME_TYPE[mimeType] ?? null
}

export function escapeCSSString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\A ")
    .replace(/\r/g, "\\D ")
    .replace(/\f/g, "\\C ")
}
