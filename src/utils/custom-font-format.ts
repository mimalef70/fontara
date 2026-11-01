import type {
  CustomFontFaceMeta,
  CustomFontFormat,
  LegacyCustomFontData
} from "../custom-font-types"

import {
  getFontDataURLFormat,
  getFontFileExtension,
  isFontFileSignatureSupported,
  isSupportedFontExtension
} from "./font-data"

const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const CUSTOM_FONT_FACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const AXIS_TAG_PATTERN = /^[\x20-\x7e]{4}$/

export function isSHA256Hash(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value)
}

export function isSafeCustomFontFaceId(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_FONT_FACE_ID_PATTERN.test(value)
}

export function normalizeCustomFontFormat(
  value: unknown
): CustomFontFormat | null {
  if (typeof value !== "string") return null

  const format = value.toLowerCase()
  if (
    format === "ttf" ||
    format === "otf" ||
    format === "woff" ||
    format === "woff2"
  ) {
    return format
  }

  if (format === "truetype") return "ttf"
  if (format === "opentype") return "otf"
  return null
}

export function detectCustomFontFormat(
  fileName: string,
  bytes: Uint8Array
): CustomFontFormat | null {
  const extension = getFontFileExtension(fileName)
  if (
    !isSupportedFontExtension(extension) ||
    !isFontFileSignatureSupported(extension, bytes)
  ) {
    return null
  }

  return normalizeCustomFontFormat(extension)
}

export function isCustomFontFaceSignatureValid(
  format: CustomFontFormat,
  bytes: Uint8Array
): boolean {
  return isFontFileSignatureSupported(format, bytes)
}

export function dataURLToCustomFontBytes(dataURL: string): Uint8Array | null {
  const commaIndex = dataURL.indexOf(",")
  if (commaIndex < 0 || !/;base64$/i.test(dataURL.slice(0, commaIndex))) {
    return null
  }

  try {
    const binary = atob(dataURL.slice(commaIndex + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

export async function createCustomFontFileHash(
  bytes: Uint8Array
): Promise<string> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

function isFiniteRange(
  value: unknown,
  limits: { min: number; max: number }
): value is { min: number; max: number } {
  if (!value || typeof value !== "object") return false
  const range = value as Record<string, unknown>
  return (
    typeof range.min === "number" &&
    Number.isFinite(range.min) &&
    typeof range.max === "number" &&
    Number.isFinite(range.max) &&
    range.min >= limits.min &&
    range.max <= limits.max &&
    range.min <= range.max
  )
}

export function isValidCustomFontFaceMeta(
  value: unknown
): value is CustomFontFaceMeta {
  if (!value || typeof value !== "object") return false
  const face = value as Partial<CustomFontFaceMeta>
  const format = normalizeCustomFontFormat(face.format)

  return Boolean(
    isSafeCustomFontFaceId(face.id) &&
      isSHA256Hash(face.fileHash) &&
      typeof face.fileName === "string" &&
      face.fileName.trim() &&
      format &&
      Number.isInteger(face.byteLength) &&
      Number(face.byteLength) > 0 &&
      isFiniteRange(face.weight, { min: 1, max: 1000 }) &&
      (face.style === "normal" ||
        face.style === "italic" ||
        face.style === "oblique") &&
      isFiniteRange(face.stretch, { min: 25, max: 200 }) &&
      Array.isArray(face.axes) &&
      face.axes.every(
        (axis) =>
          axis &&
          typeof axis === "object" &&
          typeof axis.tag === "string" &&
          AXIS_TAG_PATTERN.test(axis.tag) &&
          typeof axis.min === "number" &&
          Number.isFinite(axis.min) &&
          typeof axis.default === "number" &&
          Number.isFinite(axis.default) &&
          typeof axis.max === "number" &&
          Number.isFinite(axis.max) &&
          axis.min <= axis.default &&
          axis.default <= axis.max
      ) &&
      (face.validation === "verified" ||
        face.validation === "legacy-unverified" ||
        face.validation === "failed")
  )
}

export function getLegacyCustomFontFormat(
  font: LegacyCustomFontData
): CustomFontFormat | null {
  const dataFormat = getFontDataURLFormat(font.data, font.type)
  return normalizeCustomFontFormat(dataFormat ?? font.type)
}

export function createCustomFontFaceId(fileHash: string): string {
  const randomSuffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2)
  return `${fileHash.slice(0, 16)}-${randomSuffix}`.slice(0, 128)
}
