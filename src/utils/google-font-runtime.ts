import type { GoogleFontMetadata } from "../config/google-fonts"
import { normalizeFontFamilyName } from "./font-data"
import { getLocalValue, setLocalValue } from "./storage"

type GoogleFontCSSCacheEntry = {
  css: string
  createdAt: number
  fontFamily: string
  requestUrl: string
  version: number
}

type GoogleFontCSSCache = Record<string, GoogleFontCSSCacheEntry>
export type GoogleFontFaceCSSLoadOptions = {
  allowNetwork?: boolean
  font?: GoogleFontMetadata
  timeoutMs?: number
}

const GOOGLE_FONT_VALUE_PREFIX = "google-font:"
const MAX_GOOGLE_FONT_FAMILY_LENGTH = 120
const GOOGLE_FONTS_CSS2_ENDPOINT = "https://fonts.googleapis.com/css2"
const GOOGLE_FONT_CSS_CACHE_STORAGE_KEY = "googleFontCssCache"
const GOOGLE_FONT_CSS_CACHE_VERSION = 2
const GOOGLE_FONT_CSS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30
const MAX_GOOGLE_FONT_CSS_CACHE_ENTRIES = 16
const MAX_GOOGLE_FONT_CSS_BYTES = 512 * 1024
const GOOGLE_FONT_CSS_FETCH_TIMEOUT_MS = 8_000
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
const NON_TEXT_GOOGLE_FONT_FAMILY_PATTERNS = [
  /^material icons(?:\b|$)/i,
  /^material symbols(?:\b|$)/i,
  /^libre barcode\b/i,
  /^noto (?:color )?emoji$/i,
  /^noto sans symbols(?: 2)?$/i,
  /^noto (?:music|znamenny musical notation)$/i
]

type GoogleFontCSSMemoryCacheEntry = Pick<
  GoogleFontCSSCacheEntry,
  "css" | "createdAt" | "requestUrl"
>

const googleFontCSSMemoryCache = new Map<
  string,
  GoogleFontCSSMemoryCacheEntry
>()
const googleFontCSSLoadPromises = new Map<string, Promise<string | null>>()
let googleFontCSSCacheWriteQueue: Promise<void> = Promise.resolve()

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

export function isSelectableGoogleFontFamily(
  fontFamily: unknown
): fontFamily is string {
  return (
    isSafeGoogleFontFamily(fontFamily) &&
    !NON_TEXT_GOOGLE_FONT_FAMILY_PATTERNS.some((pattern) =>
      pattern.test(fontFamily.trim())
    )
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

export function isGoogleFontFeatureSupported(): boolean {
  if (
    typeof __CHROMIUM_MV3__ !== "undefined" ||
    typeof __FIREFOX_MV3__ !== "undefined"
  ) {
    return (
      (typeof __CHROMIUM_MV3__ !== "undefined" && __CHROMIUM_MV3__) ||
      (typeof __FIREFOX_MV3__ !== "undefined" && __FIREFOX_MV3__)
    )
  }

  return true
}

export function isGoogleFontCSSLoadingSupported(): boolean {
  if (typeof __CHROMIUM_MV3__ !== "undefined") return __CHROMIUM_MV3__
  // Unit/library contexts without a build target retain the legacy helper for
  // backward-compatible cache parsing. Production selection never calls it.
  return typeof __FIREFOX_MV3__ === "undefined"
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
  return isSelectableGoogleFontFamily(decodeGoogleFontValue(value))
}

type GoogleFontVariant = {
  italic: 0 | 1
  weight: number
}

function parseGoogleFontVariant(variant: string): GoogleFontVariant | null {
  if (variant === "regular") return { italic: 0, weight: 400 }
  if (variant === "italic") return { italic: 1, weight: 400 }

  const match = /^(100|200|300|400|500|600|700|800|900)(italic)?$/.exec(variant)
  if (!match) return null

  return {
    italic: match[2] ? 1 : 0,
    weight: Number(match[1])
  }
}

function buildGoogleFontFamilyRequest(
  fontFamily: string,
  variants: readonly string[]
): string {
  const availableVariants = variants
    .map(parseGoogleFontVariant)
    .filter((variant): variant is GoogleFontVariant => variant !== null)
    .filter(
      (variant, index, values) =>
        values.findIndex(
          (candidate) =>
            candidate.italic === variant.italic &&
            candidate.weight === variant.weight
        ) === index
    )
    .sort(
      (first, second) =>
        first.italic - second.italic || first.weight - second.weight
    )

  const parsedVariants: GoogleFontVariant[] = []
  for (const italic of [0, 1] as const) {
    const styleVariants = availableVariants.filter(
      (variant) => variant.italic === italic
    )
    if (styleVariants.length === 0) continue

    const regular = [...styleVariants].sort(
      (first, second) =>
        Math.abs(first.weight - 400) - Math.abs(second.weight - 400) ||
        first.weight - second.weight
    )[0]
    parsedVariants.push(regular)

    const bold = styleVariants.find((variant) => variant.weight === 700)
    if (bold && bold.weight !== regular.weight) {
      parsedVariants.push(bold)
    }
  }

  parsedVariants.sort(
    (first, second) =>
      first.italic - second.italic || first.weight - second.weight
  )

  if (
    parsedVariants.length === 0 ||
    (parsedVariants.length === 1 &&
      parsedVariants[0].italic === 0 &&
      parsedVariants[0].weight === 400)
  ) {
    return fontFamily
  }

  if (parsedVariants.some((variant) => variant.italic === 1)) {
    const tuples = parsedVariants
      .map((variant) => `${variant.italic},${variant.weight}`)
      .join(";")
    return `${fontFamily}:ital,wght@${tuples}`
  }

  const weights = parsedVariants.map((variant) => variant.weight).join(";")
  return `${fontFamily}:wght@${weights}`
}

export function buildGoogleFontsCSS2URLFromFamily(
  fontFamily: string,
  variants: readonly string[] = ["regular"]
): string {
  const url = new URL(GOOGLE_FONTS_CSS2_ENDPOINT)
  url.searchParams.set(
    "family",
    buildGoogleFontFamilyRequest(fontFamily, variants)
  )
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

function normalizeCacheEntry(
  entry: GoogleFontCSSCacheEntry | undefined,
  expectedFamily: string
): GoogleFontCSSCacheEntry | null {
  const legacyEntry = entry as
    | (Partial<GoogleFontCSSCacheEntry> & { version?: number })
    | undefined
  if (
    !legacyEntry ||
    (legacyEntry.version !== 1 &&
      legacyEntry.version !== GOOGLE_FONT_CSS_CACHE_VERSION) ||
    typeof legacyEntry.createdAt !== "number" ||
    !Number.isFinite(legacyEntry.createdAt) ||
    typeof legacyEntry.requestUrl !== "string" ||
    legacyEntry.requestUrl.length === 0 ||
    (legacyEntry.version === GOOGLE_FONT_CSS_CACHE_VERSION &&
      (typeof legacyEntry.fontFamily !== "string" ||
        legacyEntry.fontFamily.trim().toLowerCase() !==
          expectedFamily.toLowerCase())) ||
    typeof legacyEntry.css !== "string" ||
    legacyEntry.css.length === 0
  ) {
    return null
  }

  const css = sanitizeGoogleFontFaceCSS(legacyEntry.css, expectedFamily)
  return css
    ? {
        css,
        createdAt: legacyEntry.createdAt,
        fontFamily: expectedFamily,
        requestUrl: legacyEntry.requestUrl,
        version: GOOGLE_FONT_CSS_CACHE_VERSION
      }
    : null
}

function isFreshCacheEntry(
  entry: Pick<GoogleFontCSSCacheEntry, "createdAt" | "requestUrl">,
  requestUrl: string,
  now: number
): boolean {
  const age = now - entry.createdAt
  return (
    entry.requestUrl === requestUrl &&
    age >= 0 &&
    age < GOOGLE_FONT_CSS_CACHE_TTL_MS
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

async function performGoogleFontCSSCacheWrite(
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

function writeGoogleFontCSSCache(
  cacheKey: string,
  entry: GoogleFontCSSCacheEntry
): Promise<void> {
  const write = googleFontCSSCacheWriteQueue.then(() =>
    performGoogleFontCSSCacheWrite(cacheKey, entry)
  )
  googleFontCSSCacheWriteQueue = write.catch(() => undefined)
  return write
}

async function fetchGoogleFontCSS(
  url: string,
  timeoutMs: number
): Promise<string> {
  const abortController = new AbortController()
  const timeout = setTimeout(
    () => abortController.abort(),
    Math.max(0, timeoutMs)
  )

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: abortController.signal
    })

    if (!response.ok) {
      throw new Error(`Google Fonts request failed with ${response.status}`)
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !/^text\/css(?:\s*;|$)/i.test(contentType)) {
      throw new Error("Google Fonts returned a non-CSS response")
    }

    const contentLength = response.headers.get("content-length")
    const declaredLength = contentLength === null ? 0 : Number(contentLength)
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_GOOGLE_FONT_CSS_BYTES
    ) {
      throw new Error("Google Fonts CSS response is too large")
    }

    const css = await response.text()
    if (new TextEncoder().encode(css).byteLength > MAX_GOOGLE_FONT_CSS_BYTES) {
      throw new Error("Google Fonts CSS response is too large")
    }

    return css
  } finally {
    clearTimeout(timeout)
  }
}

function getRequestUrl(
  fontFamily: string,
  font: GoogleFontMetadata | undefined
): string {
  return buildGoogleFontsCSS2URLFromFamily(fontFamily, font?.variants)
}

async function fetchAndCacheGoogleFontCSS(
  cacheKey: string,
  fontFamily: string,
  requestUrl: string,
  timeoutMs: number
): Promise<string | null> {
  try {
    const rawCSS = await fetchGoogleFontCSS(requestUrl, timeoutMs)
    const sanitizedCSS = sanitizeGoogleFontFaceCSS(rawCSS, fontFamily)
    if (!sanitizedCSS) return null

    const entry: GoogleFontCSSCacheEntry = {
      css: sanitizedCSS,
      createdAt: Date.now(),
      fontFamily,
      requestUrl,
      version: GOOGLE_FONT_CSS_CACHE_VERSION
    }
    googleFontCSSMemoryCache.set(cacheKey, entry)
    await writeGoogleFontCSSCache(cacheKey, entry)
    return sanitizedCSS
  } catch (error) {
    debugWarn("Failed to load Google Font CSS.", error)
    return null
  }
}

function loadGoogleFontCSSFromNetwork(
  cacheKey: string,
  fontFamily: string,
  requestUrl: string,
  timeoutMs: number
): Promise<string | null> {
  const pendingLoad = googleFontCSSLoadPromises.get(requestUrl)
  if (pendingLoad) return pendingLoad

  const load = fetchAndCacheGoogleFontCSS(
    cacheKey,
    fontFamily,
    requestUrl,
    timeoutMs
  ).finally(() => {
    if (googleFontCSSLoadPromises.get(requestUrl) === load) {
      googleFontCSSLoadPromises.delete(requestUrl)
    }
  })
  googleFontCSSLoadPromises.set(requestUrl, load)

  return load
}

export async function loadGoogleFontFaceCSS(
  selectedFont: unknown,
  options: GoogleFontFaceCSSLoadOptions = {}
): Promise<string | null> {
  if (!isGoogleFontCSSLoadingSupported()) return null

  const fontFamily = decodeGoogleFontValue(selectedFont)
  if (!fontFamily) return null

  const allowNetwork = options.allowNetwork !== false
  const cacheKey = getCacheKey(fontFamily)
  const requestUrl = getRequestUrl(fontFamily, options.font)
  const now = Date.now()
  let staleCSS: string | null = null

  const cachedInMemory = googleFontCSSMemoryCache.get(cacheKey)
  if (cachedInMemory) {
    if (isFreshCacheEntry(cachedInMemory, requestUrl, now)) {
      return cachedInMemory.css
    }
    staleCSS = cachedInMemory.css
  }

  const storedCache = await readGoogleFontCSSCache()
  const storedEntry = normalizeCacheEntry(storedCache[cacheKey], fontFamily)
  if (storedEntry) {
    if (isFreshCacheEntry(storedEntry, requestUrl, now)) {
      googleFontCSSMemoryCache.set(cacheKey, storedEntry)
      return storedEntry.css
    }
    if (!cachedInMemory || storedEntry.createdAt > cachedInMemory.createdAt) {
      staleCSS = storedEntry.css
      googleFontCSSMemoryCache.set(cacheKey, storedEntry)
    }
  }

  if (!allowNetwork) {
    return staleCSS
  }

  const networkLoad = loadGoogleFontCSSFromNetwork(
    cacheKey,
    fontFamily,
    requestUrl,
    options.timeoutMs ?? GOOGLE_FONT_CSS_FETCH_TIMEOUT_MS
  )
  if (staleCSS) {
    void networkLoad
    return staleCSS
  }

  return networkLoad
}

export function resetGoogleFontRuntimeForTesting(): void {
  googleFontCSSMemoryCache.clear()
  googleFontCSSLoadPromises.clear()
  googleFontCSSCacheWriteQueue = Promise.resolve()
}
