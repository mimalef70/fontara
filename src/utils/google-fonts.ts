import type { GoogleFontMetadata } from "../config/google-fonts"
import {
  buildGoogleFontsCSS2URLFromFamily,
  createGoogleFontValue,
  decodeGoogleFontValue,
  type GoogleFontFaceCSSLoadOptions,
  isGoogleFontFeatureSupported,
  isSafeGoogleFontFamily,
  isSelectableGoogleFontFamily,
  loadGoogleFontFaceCSS as loadGoogleFontFaceCSSFromRuntime,
  resetGoogleFontRuntimeForTesting
} from "./google-font-runtime"

export {
  createGoogleFontValue,
  decodeGoogleFontValue,
  isGoogleFontFeatureSupported,
  isGoogleFontValue,
  sanitizeGoogleFontFaceCSS
} from "./google-font-runtime"

export type GoogleFontData = GoogleFontMetadata & {
  fontFamily: string
  name: string
  value: string
}

const GOOGLE_FONTS_CATALOG_PATH = "assets/data/google-fonts.json"

type GoogleFontsCatalogPayload = {
  fonts: GoogleFontMetadata[]
  source: string
}

let cachedGoogleFonts: GoogleFontData[] | null = null
let googleFontsLoadPromise: Promise<GoogleFontData[]> | null = null

export function isSelectableGoogleFont(font: GoogleFontMetadata): boolean {
  return isSelectableGoogleFontFamily(font.family)
}

function createGoogleFontData(font: GoogleFontMetadata): GoogleFontData {
  return {
    ...font,
    fontFamily: font.family,
    name: font.family,
    value: createGoogleFontValue(font.family)
  }
}

function isGoogleFontMetadata(value: unknown): value is GoogleFontMetadata {
  if (typeof value !== "object" || value === null) return false

  const font = value as Partial<GoogleFontMetadata>
  return (
    isSafeGoogleFontFamily(font.family) &&
    typeof font.category === "string" &&
    typeof font.fallback === "string" &&
    typeof font.recommended === "boolean" &&
    Array.isArray(font.subsets) &&
    Array.isArray(font.variants)
  )
}

function parseGoogleFontsCatalog(value: unknown): GoogleFontData[] {
  if (typeof value !== "object" || value === null) {
    throw new Error("google-fonts-catalog-invalid")
  }

  const payload = value as Partial<GoogleFontsCatalogPayload>
  if (
    payload.source !== "google-fonts-developer-api-v1" ||
    !Array.isArray(payload.fonts)
  ) {
    throw new Error("google-fonts-catalog-invalid")
  }

  const fonts = payload.fonts
    .filter(isGoogleFontMetadata)
    .filter(isSelectableGoogleFont)
    .map(createGoogleFontData)
  if (fonts.length === 0) {
    throw new Error("google-fonts-catalog-empty")
  }

  return fonts
}

function getCatalogURL(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(GOOGLE_FONTS_CATALOG_PATH)
  }

  return `/${GOOGLE_FONTS_CATALOG_PATH}`
}

export function loadGoogleFontList(): Promise<GoogleFontData[]> {
  if (cachedGoogleFonts) return Promise.resolve(cachedGoogleFonts)
  if (googleFontsLoadPromise) return googleFontsLoadPromise

  googleFontsLoadPromise = fetch(getCatalogURL(), {
    cache: "force-cache",
    credentials: "omit"
  })
    .then((response) => {
      if (!response.ok) throw new Error("google-fonts-catalog-load-failed")
      return response.json() as Promise<unknown>
    })
    .then(parseGoogleFontsCatalog)
    .then((fonts) => {
      cachedGoogleFonts = fonts
      return fonts
    })
    .finally(() => {
      googleFontsLoadPromise = null
    })

  return googleFontsLoadPromise
}

export function getGoogleFontByFamily(
  fontFamily: unknown
): GoogleFontMetadata | null {
  if (!isSafeGoogleFontFamily(fontFamily)) return null

  return (
    cachedGoogleFonts?.find(
      (font) => font.family.toLowerCase() === fontFamily.trim().toLowerCase()
    ) ?? null
  )
}

export function getGoogleFontByValue(
  value: unknown
): GoogleFontMetadata | null {
  const fontFamily = decodeGoogleFontValue(value)
  return fontFamily ? getGoogleFontByFamily(fontFamily) : null
}

export function getGoogleFontList(): GoogleFontData[] {
  return cachedGoogleFonts ?? []
}

export async function loadGoogleFontFaceCSS(
  selectedFont: unknown,
  options: GoogleFontFaceCSSLoadOptions = {}
): Promise<string | null> {
  if (!isGoogleFontFeatureSupported()) return null

  const fontFamily = decodeGoogleFontValue(selectedFont)
  if (!fontFamily) return null
  if (options.allowNetwork === false) {
    return loadGoogleFontFaceCSSFromRuntime(selectedFont, options)
  }

  try {
    const font =
      getGoogleFontByFamily(fontFamily) ??
      (await loadGoogleFontList()).find(
        (candidate) =>
          candidate.family.toLowerCase() === fontFamily.toLowerCase()
      ) ??
      null
    if (!font) return null

    return loadGoogleFontFaceCSSFromRuntime(selectedFont, {
      ...options,
      font
    })
  } catch {
    return loadGoogleFontFaceCSSFromRuntime(selectedFont, {
      ...options,
      allowNetwork: false
    })
  }
}

export function resetGoogleFontCatalogForTesting(): void {
  cachedGoogleFonts = null
  googleFontsLoadPromise = null
  resetGoogleFontRuntimeForTesting()
}

export function buildGoogleFontsCSS2URL(font: GoogleFontMetadata): string {
  return buildGoogleFontsCSS2URLFromFamily(font.family, font.variants)
}
