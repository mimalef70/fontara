import { GOOGLE_FONTS, type GoogleFontMetadata } from "../config/google-fonts"
import {
  buildGoogleFontsCSS2URLFromFamily,
  createGoogleFontValue,
  decodeGoogleFontValue,
  isSafeGoogleFontFamily
} from "./google-font-runtime"

export {
  createGoogleFontValue,
  decodeGoogleFontValue,
  isGoogleFontValue,
  loadGoogleFontFaceCSS,
  sanitizeGoogleFontFaceCSS
} from "./google-font-runtime"

export type GoogleFontData = GoogleFontMetadata & {
  fontFamily: string
  name: string
  value: string
}

const GOOGLE_FONT_FAMILIES = new Map(
  GOOGLE_FONTS.map((font) => [font.family.toLowerCase(), font])
)

function createGoogleFontData(font: GoogleFontMetadata): GoogleFontData {
  return {
    ...font,
    fontFamily: font.family,
    name: font.family,
    value: createGoogleFontValue(font.family)
  }
}

export function getGoogleFontByFamily(
  fontFamily: unknown
): GoogleFontMetadata | null {
  if (!isSafeGoogleFontFamily(fontFamily)) return null

  return GOOGLE_FONT_FAMILIES.get(fontFamily.trim().toLowerCase()) ?? null
}

export function getGoogleFontByValue(
  value: unknown
): GoogleFontMetadata | null {
  const fontFamily = decodeGoogleFontValue(value)
  return fontFamily ? getGoogleFontByFamily(fontFamily) : null
}

export function getGoogleFontList(): GoogleFontData[] {
  return GOOGLE_FONTS.map(createGoogleFontData)
}

export function buildGoogleFontsCSS2URL(font: GoogleFontMetadata): string {
  return buildGoogleFontsCSS2URLFromFamily(font.family)
}
