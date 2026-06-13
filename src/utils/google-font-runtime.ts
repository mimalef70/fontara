import { normalizeFontFamilyName } from "./font-data"
import { getLocalValue, setLocalValue } from "./storage"

type GoogleFontCSSCacheEntry = {
  css: string
  createdAt: number
  requestUrl: string
  version: number
}

type GoogleFontCSSCache = Record<string, GoogleFontCSSCacheEntry>
export type GoogleFontFaceCSSLoadOptions = {
  allowNetwork?: boolean
}

const GOOGLE_FONT_VALUE_PREFIX = "google-font:"
const MAX_GOOGLE_FONT_FAMILY_LENGTH = 120
const GOOGLE_FONTS_CSS2_ENDPOINT = "https://fonts.googleapis.com/css2"
const GOOGLE_FONT_CSS_CACHE_STORAGE_KEY = "googleFontCssCache"
const GOOGLE_FONT_CSS_CACHE_VERSION = 1
const GOOGLE_FONT_CSS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30
const MAX_GOOGLE_FONT_CSS_CACHE_ENTRIES = 16
const GOOGLE_FONT_ALLOWED_URL_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"]
const GOOGLE_FONT_FACE_ALLOWED_PROPERTIES = new Set([
  "font-display",
  "font-family",
  "font-stretch",
  "font-style",
  "font-weight",
  "src",
  "unicode-range"
])

const googleFontCSSMemoryCache = new Map<string, string>()

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }

  return false
}

export function isSafeGoogleFontFamily(
  fontFamily: unknown
): fontFamily is string {
  if (typeof fontFamily !== "string") return false

  const normalizedFontFamily = fontFamily.trim()
  return (
    normalizedFontFamily.length > 0 &&
    normalizedFontFamily.length <= MAX_GOOGLE_FONT_FAMILY_LENGTH &&
    !hasControlCharacter(normalizedFontFamily)
  )
}

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getCacheKey(fontFamily: string): string {
  return fontFamily.trim().toLowerCase()
}

export function createGoogleFontValue(fontFamily: string): string {
  const normalizedFontFamily = fontFamily.trim()
  return `${GOOGLE_FONT_VALUE_PREFIX}${encodeURIComponent(
    normalizedFontFamily
  )}`
}

export function decodeGoogleFontValue(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith(GOOGLE_FONT_VALUE_PREFIX)
  ) {
    return null
  }

  try {
    const fontFamily = decodeURIComponent(
      value.slice(GOOGLE_FONT_VALUE_PREFIX.length)
    )
    return isSafeGoogleFontFamily(fontFamily) ? fontFamily.trim() : null
  } catch {
    return null
  }
}

export function isGoogleFontValue(value: unknown): value is string {
  return decodeGoogleFontValue(value) !== null
}

export function buildGoogleFontsCSS2URLFromFamily(fontFamily: string): string {
  const url = new URL(GOOGLE_FONTS_CSS2_ENDPOINT)
  url.searchParams.set("family", fontFamily)
  url.searchParams.set("display", "swap")

  return url.toString()
}

function stripCSSComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

function unquoteCSSValue(value: string): string {
  return normalizeFontFamilyName(value.trim()).replace(/\\(["'])/g, "$1")
}

function isSafeGoogleFontURL(value: string): boolean {
  try {
    const url = new URL(unquoteCSSValue(value))
    return (
      url.protocol === "https:" &&
      url.hostname === "fonts.gstatic.com" &&
      GOOGLE_FONT_ALLOWED_URL_EXTENSIONS.some((extension) =>
        url.pathname.endsWith(extension)
      )
    )
  } catch {
    return false
  }
}

function isSafeCSSDeclarationValue(value: string): boolean {
  return (
    !/[<>{}]/.test(value) && !/@import|javascript:|expression\(/i.test(value)
  )
}

function extractGoogleFontURLs(value: string): string[] {
  const urls: string[] = []
  const urlPattern = /url\(\s*([^)]+?)\s*\)/gi
  let match = urlPattern.exec(value)

  while (match) {
    urls.push(match[1])
    match = urlPattern.exec(value)
  }

  return urls
}

function sanitizeFontFaceBlock(
  block: string,
  expectedFamily: string
): string | null {
  const bodyMatch = /^@font-face\s*{([\s\S]*)}$/i.exec(block.trim())
  if (!bodyMatch) return null

  const declarations: Array<{ property: string; value: string }> = []
  const fontFamilies: string[] = []
  const fontUrls: string[] = []

  for (const declaration of bodyMatch[1].split(";")) {
    const separatorIndex = declaration.indexOf(":")
    if (separatorIndex === -1) continue

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const value = declaration.slice(separatorIndex + 1).trim()
    if (
      !property ||
      !value ||
      !GOOGLE_FONT_FACE_ALLOWED_PROPERTIES.has(property) ||
      !isSafeCSSDeclarationValue(value)
    ) {
      return null
    }

    if (property === "font-family") {
      fontFamilies.push(unquoteCSSValue(value))
    }

    if (property === "src") {
      fontUrls.push(...extractGoogleFontURLs(value))
    }

    declarations.push({ property, value })
  }

  if (fontFamilies.length !== 1 || fontUrls.length === 0) return null
  if (
    fontFamilies[0].trim().toLowerCase() !== expectedFamily.trim().toLowerCase()
  ) {
    return null
  }
  if (!fontUrls.every(isSafeGoogleFontURL)) return null

  return [
    "@font-face {",
    ...declarations.map(({ property, value }) => `  ${property}: ${value};`),
    "}"
  ].join("\n")
}

export function sanitizeGoogleFontFaceCSS(
  css: string,
  expectedFamily: string
): string | null {
  const cssWithoutComments = stripCSSComments(css)
  const fontFaceBlocks = cssWithoutComments.match(/@font-face\s*{[^{}]*}/gi)
  if (!fontFaceBlocks || fontFaceBlocks.length === 0) return null

  const remainingCSS = cssWithoutComments
    .replace(/@font-face\s*{[^{}]*}/gi, "")
    .trim()
  if (remainingCSS.length > 0) return null

  const sanitizedBlocks = fontFaceBlocks.map((block) =>
    sanitizeFontFaceBlock(block, expectedFamily)
  )

  if (sanitizedBlocks.some((block) => block === null)) return null
  return sanitizedBlocks.join("\n\n")
}

function isFreshCacheEntry(
  entry: GoogleFontCSSCacheEntry | undefined,
  requestUrl: string,
  now: number
): entry is GoogleFontCSSCacheEntry {
  return (
    Boolean(entry) &&
    entry?.version === GOOGLE_FONT_CSS_CACHE_VERSION &&
    entry.requestUrl === requestUrl &&
    typeof entry.css === "string" &&
    entry.css.length > 0 &&
    now - entry.createdAt < GOOGLE_FONT_CSS_CACHE_TTL_MS
  )
}

async function readGoogleFontCSSCache(): Promise<GoogleFontCSSCache> {
  try {
    const cache = await getLocalValue<GoogleFontCSSCache>(
      GOOGLE_FONT_CSS_CACHE_STORAGE_KEY
    )
    return cache && typeof cache === "object" ? cache : {}
  } catch (error) {
    debugWarn("Failed to read Google Fonts cache.", error)
    return {}
  }
}

async function writeGoogleFontCSSCache(
  cacheKey: string,
  entry: GoogleFontCSSCacheEntry
): Promise<void> {
  try {
    const cache = await readGoogleFontCSSCache()
    const entries = Object.entries({
      ...cache,
      [cacheKey]: entry
    })
      .sort(([, firstEntry], [, secondEntry]) => {
        return secondEntry.createdAt - firstEntry.createdAt
      })
      .slice(0, MAX_GOOGLE_FONT_CSS_CACHE_ENTRIES)

    await setLocalValue(
      GOOGLE_FONT_CSS_CACHE_STORAGE_KEY,
      Object.fromEntries(entries)
    )
  } catch (error) {
    debugWarn("Failed to write Google Fonts cache.", error)
  }
}

async function fetchGoogleFontCSS(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "omit",
    referrerPolicy: "no-referrer"
  })

  if (!response.ok) {
    throw new Error(`Google Fonts request failed with ${response.status}`)
  }

  return response.text()
}

export async function loadGoogleFontFaceCSS(
  selectedFont: unknown,
  options: GoogleFontFaceCSSLoadOptions = {}
): Promise<string | null> {
  const fontFamily = decodeGoogleFontValue(selectedFont)
  if (!fontFamily) return null

  const allowNetwork = options.allowNetwork !== false
  const cacheKey = getCacheKey(fontFamily)
  const cachedInMemory = googleFontCSSMemoryCache.get(cacheKey)
  if (cachedInMemory) return cachedInMemory

  const requestUrl = buildGoogleFontsCSS2URLFromFamily(fontFamily)
  const now = Date.now()
  const storedCache = await readGoogleFontCSSCache()
  const storedEntry = storedCache[cacheKey]
  if (isFreshCacheEntry(storedEntry, requestUrl, now)) {
    googleFontCSSMemoryCache.set(cacheKey, storedEntry.css)
    return storedEntry.css
  }

  if (!allowNetwork) {
    return null
  }

  try {
    const rawCSS = await fetchGoogleFontCSS(requestUrl)
    const sanitizedCSS = sanitizeGoogleFontFaceCSS(rawCSS, fontFamily)
    if (!sanitizedCSS) return null

    googleFontCSSMemoryCache.set(cacheKey, sanitizedCSS)
    await writeGoogleFontCSSCache(cacheKey, {
      css: sanitizedCSS,
      createdAt: now,
      requestUrl,
      version: GOOGLE_FONT_CSS_CACHE_VERSION
    })
    return sanitizedCSS
  } catch (error) {
    debugWarn("Failed to load Google Font CSS.", error)
    return null
  }
}
