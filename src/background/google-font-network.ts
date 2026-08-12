import type { GoogleFontMetadata } from "../config/google-fonts"
import {
  createGoogleFontBinaryFamilyKey,
  createGoogleFontRuntimeFamily,
  GoogleFontBinaryError,
  type GoogleFontBinaryFace,
  type GoogleFontBinaryFaceStyle,
  type GoogleFontBinaryFamilyDraft,
  type GoogleFontBinaryRequest
} from "../google-font-binary-types"
import {
  buildGoogleFontsCSS2URLFromFamily,
  isSelectableGoogleFontFamily
} from "../utils/google-font-runtime"

export const MAX_GOOGLE_FONT_CSS_BYTES = 512 * 1024
export const MAX_GOOGLE_FONT_FACE_COUNT = 64
export const MAX_GOOGLE_FONT_ASSET_BYTES = 5 * 1024 * 1024
export const MAX_GOOGLE_FONT_FAMILY_BYTES = 12 * 1024 * 1024

const DEFAULT_CSS_TIMEOUT_MS = 8_000
const DEFAULT_FONT_TIMEOUT_MS = 15_000
const DEFAULT_FAMILY_TIMEOUT_MS = 60_000
const FONT_DOWNLOAD_CONCURRENCY = 4
const GOOGLE_FONTS_CSS2_ENDPOINT = "https://fonts.googleapis.com/css2"
const GOOGLE_FONT_ASSET_ORIGIN = "https://fonts.gstatic.com"
const GOOGLE_FONT_ASSET_CONTENT_TYPES = new Set([
  "application/font-woff2",
  "application/x-font-woff2",
  "font/woff2"
])
const GOOGLE_FONT_FACE_PROPERTIES = new Set([
  "font-display",
  "font-family",
  "font-stretch",
  "font-style",
  "font-weight",
  "src",
  "unicode-range"
])
const GOOGLE_FONT_VARIANT_PATTERN =
  /^(?:regular|italic|(?:100|200|300|400|500|600|700|800|900)(?:italic)?)$/
const FONT_STRETCH_KEYWORDS = new Set([
  "condensed",
  "expanded",
  "extra-condensed",
  "extra-expanded",
  "normal",
  "semi-condensed",
  "semi-expanded",
  "ultra-condensed",
  "ultra-expanded"
])

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type ParsedGoogleFontFace = {
  sourceUrl: string
  stretch: string
  style: GoogleFontBinaryFaceStyle
  unicodeRange: string | null
  weight: string
}

type DownloadedGoogleFontAsset = {
  bytes: Uint8Array
  hash: string
}

type DownloadedGoogleFontAssetReference = {
  byteLength: number
  hash: string
}

export type GoogleFontNetworkOptions = {
  cssTimeoutMs?: number
  familyTimeoutMs?: number
  fetch?: FetchImplementation
  fontTimeoutMs?: number
  requestUrl?: string
  signal?: AbortSignal
}

export type DownloadedGoogleFontFamily = {
  assets: Map<string, Uint8Array>
  family: GoogleFontBinaryFamilyDraft
}

function throwBinaryError(
  code: ConstructorParameters<typeof GoogleFontBinaryError>[0],
  details?: ConstructorParameters<typeof GoogleFontBinaryError>[1],
  cause?: unknown
): never {
  throw new GoogleFontBinaryError(code, details, cause)
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value < 0) {
    throwBinaryError("google-font-invalid-request", {
      timeoutMs: String(value)
    })
  }
  return value
}

function getRemainingTimeout(
  deadline: number,
  configuredTimeout: number
): number {
  const remaining = Math.floor(deadline - Date.now())
  if (remaining <= 0) {
    throwBinaryError("google-font-request-timeout", {
      stage: "family",
      timeoutMs: configuredTimeout
    })
  }
  return Math.min(configuredTimeout, remaining)
}

function normalizeRequest(
  request: GoogleFontBinaryRequest | GoogleFontMetadata
): {
  family: string
  requestUrl: string
} {
  if (!request || typeof request.family !== "string") {
    throwBinaryError("google-font-invalid-request")
  }
  const family = request.family.trim()
  const variants = request.variants ?? ["regular"]

  if (
    !isSelectableGoogleFontFamily(family) ||
    !Array.isArray(variants) ||
    variants.length === 0 ||
    variants.length > 32 ||
    !variants.every(
      (variant) =>
        typeof variant === "string" && GOOGLE_FONT_VARIANT_PATTERN.test(variant)
    )
  ) {
    throwBinaryError("google-font-invalid-request")
  }

  const requestUrl = buildGoogleFontsCSS2URLFromFamily(family, variants)
  const parsedUrl = new URL(requestUrl)
  if (
    parsedUrl.origin !== new URL(GOOGLE_FONTS_CSS2_ENDPOINT).origin ||
    parsedUrl.pathname !== "/css2" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.hash !== ""
  ) {
    throwBinaryError("google-font-invalid-request")
  }

  return { family, requestUrl }
}

function assertExactRequestUrl(
  suppliedRequestUrl: string | undefined,
  expectedRequestUrl: string
): string {
  if (suppliedRequestUrl === undefined) return expectedRequestUrl

  if (suppliedRequestUrl !== expectedRequestUrl) {
    throwBinaryError("google-font-invalid-request", {
      reason: "request-url-mismatch"
    })
  }

  return suppliedRequestUrl
}

function getContentType(response: Response): string {
  return (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
}

function assertDeclaredLength(
  response: Response,
  maxBytes: number,
  errorCode: "google-font-asset-too-large" | "google-font-css-too-large"
): void {
  const value = response.headers.get("content-length")
  if (value === null) return

  if (!/^\d+$/.test(value)) {
    throwBinaryError(
      errorCode === "google-font-css-too-large"
        ? "google-font-css-response-invalid"
        : "google-font-asset-response-invalid",
      { reason: "invalid-content-length" }
    )
  }

  const declaredLength = Number(value)
  if (!Number.isSafeInteger(declaredLength)) {
    throwBinaryError(
      errorCode === "google-font-css-too-large"
        ? "google-font-css-response-invalid"
        : "google-font-asset-response-invalid",
      { reason: "invalid-content-length" }
    )
  }
  if (declaredLength > maxBytes) {
    throwBinaryError(errorCode, { byteLength: declaredLength, maxBytes })
  }
}

async function readResponseBytes(
  response: Response,
  maxBytes: number,
  errorCode: "google-font-asset-too-large" | "google-font-css-too-large"
): Promise<Uint8Array> {
  assertDeclaredLength(response, maxBytes, errorCode)

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) {
      throwBinaryError(errorCode, { byteLength: bytes.byteLength, maxBytes })
    }
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break

      const chunk = result.value
      byteLength += chunk.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        throwBinaryError(errorCode, { byteLength, maxBytes })
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

async function fetchWithTimeout<T>(
  fetchImplementation: FetchImplementation,
  url: string,
  timeoutMs: number,
  stage: "asset" | "css",
  externalSignal: AbortSignal | undefined,
  consume: (response: Response) => Promise<T> | T
): Promise<T> {
  const abortController = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let didTimeOut = false
  let handleExternalAbort: (() => void) | undefined

  const cancellation = new Promise<never>((_resolve, reject) => {
    handleExternalAbort = () => {
      abortController.abort()
      reject(
        new GoogleFontBinaryError("google-font-network-failed", {
          reason: "request-cancelled",
          stage
        })
      )
    }
    if (externalSignal?.aborted) {
      handleExternalAbort()
      return
    }
    externalSignal?.addEventListener("abort", handleExternalAbort, {
      once: true
    })
  })

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      didTimeOut = true
      abortController.abort()
      reject(
        new GoogleFontBinaryError("google-font-request-timeout", {
          stage,
          timeoutMs
        })
      )
    }, timeoutMs)
  })

  try {
    const requestAndConsume = fetchImplementation(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: abortController.signal
    }).then(consume)
    return await Promise.race([requestAndConsume, timeout, cancellation])
  } catch (error) {
    if (error instanceof GoogleFontBinaryError) throw error
    if (didTimeOut || isAbortError(error)) {
      return throwBinaryError(
        "google-font-request-timeout",
        { stage, timeoutMs },
        error
      )
    }
    return throwBinaryError("google-font-network-failed", { stage }, error)
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    if (handleExternalAbort) {
      externalSignal?.removeEventListener("abort", handleExternalAbort)
    }
  }
}

function assertResponseFinalUrl(response: Response, expectedUrl: string): void {
  if (response.redirected || response.url !== expectedUrl) {
    throwBinaryError(
      expectedUrl.startsWith(GOOGLE_FONTS_CSS2_ENDPOINT)
        ? "google-font-css-response-invalid"
        : "google-font-asset-response-invalid",
      { reason: "unexpected-final-url" }
    )
  }
}

function stripCSSComments(css: string): string {
  let result = ""
  let offset = 0

  while (offset < css.length) {
    const commentStart = css.indexOf("/*", offset)
    if (commentStart === -1) return result + css.slice(offset)

    result += css.slice(offset, commentStart)
    const commentEnd = css.indexOf("*/", commentStart + 2)
    if (commentEnd === -1) {
      throwBinaryError("google-font-css-invalid", {
        reason: "unterminated-comment"
      })
    }
    offset = commentEnd + 2
  }

  return result
}

function decodeCSSString(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 2) return null

  const quote = trimmed[0]
  if (
    (quote !== '"' && quote !== "'") ||
    trimmed[trimmed.length - 1] !== quote
  ) {
    return null
  }

  const body = trimmed.slice(1, -1)
  let decoded = ""
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === "\n" || character === "\r" || character === "\f") {
      return null
    }
    if (character !== "\\") {
      decoded += character
      continue
    }

    index += 1
    if (index >= body.length) return null
    const escaped = body[index]
    if (/[0-9a-f]/i.test(escaped)) {
      let hex = escaped
      while (hex.length < 6 && /[0-9a-f]/i.test(body[index + 1] ?? "")) {
        index += 1
        hex += body[index]
      }
      if (/\s/.test(body[index + 1] ?? "")) index += 1

      const codePoint = Number.parseInt(hex, 16)
      if (codePoint === 0 || codePoint > 0x10ffff) return null
      decoded += String.fromCodePoint(codePoint)
      continue
    }
    decoded += escaped
  }

  return decoded
}

function parseGoogleFontAssetUrl(value: string): string {
  const match =
    /^url\(\s*(?:"([^"\\]*)"|'([^'\\]*)'|([^\s"'()\\]+))\s*\)\s+format\(\s*(?:"woff2"|'woff2'|woff2)\s*\)$/i.exec(
      value.trim()
    )
  const rawUrl = match?.[1] ?? match?.[2] ?? match?.[3]
  if (!rawUrl) {
    throwBinaryError("google-font-css-invalid", { reason: "invalid-src" })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch (error) {
    throwBinaryError(
      "google-font-asset-url-invalid",
      { reason: "malformed-url" },
      error
    )
  }

  if (
    parsedUrl.origin !== GOOGLE_FONT_ASSET_ORIGIN ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.port !== "" ||
    parsedUrl.hash !== "" ||
    !parsedUrl.pathname.endsWith(".woff2") ||
    parsedUrl.toString() !== rawUrl
  ) {
    throwBinaryError("google-font-asset-url-invalid")
  }

  return rawUrl
}

function parseStyle(value: string | undefined): GoogleFontBinaryFaceStyle {
  const style = (value ?? "normal").trim().toLowerCase()
  if (style === "normal" || style === "italic" || style === "oblique") {
    return style
  }
  throwBinaryError("google-font-css-invalid", { reason: "invalid-style" })
}

function parseWeight(value: string | undefined): string {
  const weight = (value ?? "400").trim().toLowerCase()
  if (weight === "normal") return "400"
  if (weight === "bold") return "700"

  const match = /^(\d{1,4})(?:\s+(\d{1,4}))?$/.exec(weight)
  const start = Number(match?.[1])
  const end = Number(match?.[2] ?? match?.[1])
  if (
    !match ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end > 1000 ||
    start > end
  ) {
    throwBinaryError("google-font-css-invalid", { reason: "invalid-weight" })
  }
  return start === end ? String(start) : `${start} ${end}`
}

function parseStretch(value: string | undefined): string {
  const stretch = (value ?? "normal").trim().toLowerCase()
  if (FONT_STRETCH_KEYWORDS.has(stretch)) return stretch

  const match = /^(\d+(?:\.\d+)?)%(?:\s+(\d+(?:\.\d+)?)%)?$/.exec(stretch)
  const start = Number(match?.[1])
  const end = Number(match?.[2] ?? match?.[1])
  if (
    !match ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= 0 ||
    end > 1000 ||
    start > end
  ) {
    throwBinaryError("google-font-css-invalid", { reason: "invalid-stretch" })
  }
  return start === end ? `${start}%` : `${start}% ${end}%`
}

function parseUnicodeRange(value: string | undefined): string | null {
  if (value === undefined) return null
  if (value.length > 16_384) {
    throwBinaryError("google-font-css-invalid", {
      reason: "invalid-unicode-range"
    })
  }

  const tokens = value.split(",").map((token) => token.trim().toUpperCase())
  if (
    tokens.length === 0 ||
    tokens.length > 256 ||
    tokens.some((token) => !token)
  ) {
    throwBinaryError("google-font-css-invalid", {
      reason: "invalid-unicode-range"
    })
  }

  for (const token of tokens) {
    const wildcard = /^U\+([0-9A-F]{0,5})(\?{1,6})$/.exec(token)
    if (wildcard && wildcard[1].length + wildcard[2].length <= 6) continue

    const range = /^U\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?$/.exec(token)
    const start = Number.parseInt(range?.[1] ?? "", 16)
    const end = Number.parseInt(range?.[2] ?? range?.[1] ?? "", 16)
    if (
      !range ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      end > 0x10ffff
    ) {
      throwBinaryError("google-font-css-invalid", {
        reason: "invalid-unicode-range"
      })
    }
  }

  return tokens.join(", ")
}

function parseFontFaceBlock(
  body: string,
  expectedFamily: string
): ParsedGoogleFontFace {
  const declarations = new Map<string, string>()
  for (const declaration of body.split(";")) {
    if (!declaration.trim()) continue

    const separatorIndex = declaration.indexOf(":")
    if (separatorIndex <= 0) {
      throwBinaryError("google-font-css-invalid", {
        reason: "invalid-declaration"
      })
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const value = declaration.slice(separatorIndex + 1).trim()
    if (
      !GOOGLE_FONT_FACE_PROPERTIES.has(property) ||
      !value ||
      declarations.has(property) ||
      /[{}<>]/.test(value) ||
      /(?:@import|expression\s*\(|javascript:)/i.test(value)
    ) {
      throwBinaryError("google-font-css-invalid", {
        reason: "unsafe-declaration"
      })
    }
    declarations.set(property, value)
  }

  const parsedFamily = decodeCSSString(declarations.get("font-family") ?? "")
  if (parsedFamily !== expectedFamily) {
    throwBinaryError("google-font-css-invalid", {
      reason: "unexpected-family"
    })
  }

  const fontDisplay = declarations.get("font-display")
  if (
    fontDisplay !== undefined &&
    !/^(?:auto|block|fallback|optional|swap)$/i.test(fontDisplay.trim())
  ) {
    throwBinaryError("google-font-css-invalid", {
      reason: "invalid-display"
    })
  }

  const src = declarations.get("src")
  if (!src) {
    throwBinaryError("google-font-css-invalid", { reason: "missing-src" })
  }

  return {
    sourceUrl: parseGoogleFontAssetUrl(src),
    stretch: parseStretch(declarations.get("font-stretch")),
    style: parseStyle(declarations.get("font-style")),
    unicodeRange: parseUnicodeRange(declarations.get("unicode-range")),
    weight: parseWeight(declarations.get("font-weight"))
  }
}

export function parseGoogleFontFaceCSS(
  css: string,
  expectedFamily: string
): ParsedGoogleFontFace[] {
  if (!isSelectableGoogleFontFamily(expectedFamily)) {
    throwBinaryError("google-font-invalid-request")
  }

  const source = stripCSSComments(css)
  const faces: ParsedGoogleFontFace[] = []
  const blockPattern = /@font-face\s*{([^{}]*)}/giy
  let offset = 0

  while (offset < source.length) {
    while (/\s/.test(source[offset] ?? "")) offset += 1
    if (offset >= source.length) break

    blockPattern.lastIndex = offset
    const match = blockPattern.exec(source)
    if (!match) {
      throwBinaryError("google-font-css-invalid", {
        reason: "unexpected-css"
      })
    }

    faces.push(parseFontFaceBlock(match[1], expectedFamily))
    if (faces.length > MAX_GOOGLE_FONT_FACE_COUNT) {
      throwBinaryError("google-font-face-count-limit", {
        faceCount: faces.length,
        maxFaces: MAX_GOOGLE_FONT_FACE_COUNT
      })
    }
    offset = blockPattern.lastIndex
  }

  if (faces.length === 0) {
    throwBinaryError("google-font-css-invalid", { reason: "missing-faces" })
  }
  return faces
}

async function createSHA256Hash(bytes: Uint8Array): Promise<string> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

function hasWOFF2Signature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x77 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x32
  )
}

async function fetchCSS(
  requestUrl: string,
  timeoutMs: number,
  fetchImplementation: FetchImplementation,
  signal?: AbortSignal
): Promise<Uint8Array> {
  return fetchWithTimeout(
    fetchImplementation,
    requestUrl,
    timeoutMs,
    "css",
    signal,
    async (response) => {
      if (!response.ok) {
        throwBinaryError("google-font-css-request-failed", {
          status: response.status
        })
      }
      assertResponseFinalUrl(response, requestUrl)
      if (getContentType(response) !== "text/css") {
        throwBinaryError("google-font-css-response-invalid", {
          reason: "invalid-content-type"
        })
      }
      return readResponseBytes(
        response,
        MAX_GOOGLE_FONT_CSS_BYTES,
        "google-font-css-too-large"
      )
    }
  )
}

async function fetchAsset(
  sourceUrl: string,
  timeoutMs: number,
  fetchImplementation: FetchImplementation,
  signal?: AbortSignal
): Promise<DownloadedGoogleFontAsset> {
  const bytes = await fetchWithTimeout(
    fetchImplementation,
    sourceUrl,
    timeoutMs,
    "asset",
    signal,
    async (response) => {
      if (!response.ok) {
        throwBinaryError("google-font-asset-request-failed", {
          status: response.status
        })
      }
      assertResponseFinalUrl(response, sourceUrl)
      if (!GOOGLE_FONT_ASSET_CONTENT_TYPES.has(getContentType(response))) {
        throwBinaryError("google-font-asset-response-invalid", {
          reason: "invalid-content-type"
        })
      }
      return readResponseBytes(
        response,
        MAX_GOOGLE_FONT_ASSET_BYTES,
        "google-font-asset-too-large"
      )
    }
  )
  if (!hasWOFF2Signature(bytes)) {
    throwBinaryError("google-font-asset-invalid", {
      reason: "invalid-signature"
    })
  }

  return { bytes, hash: await createSHA256Hash(bytes) }
}

function decodeCSS(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch (error) {
    throwBinaryError(
      "google-font-css-invalid",
      { reason: "invalid-utf8" },
      error
    )
  }
}

async function createFaceId(face: ParsedGoogleFontFace): Promise<string> {
  const canonicalFace = JSON.stringify([
    face.sourceUrl,
    face.style,
    face.weight,
    face.stretch,
    face.unicodeRange
  ])
  const hash = await createSHA256Hash(new TextEncoder().encode(canonicalFace))
  return `google-${hash.slice(0, 32)}`
}

export async function downloadGoogleFontFamilyDraft(
  request: GoogleFontBinaryRequest | GoogleFontMetadata,
  options: GoogleFontNetworkOptions = {}
): Promise<DownloadedGoogleFontFamily> {
  const normalizedRequest = normalizeRequest(request)
  const requestUrl = assertExactRequestUrl(
    options.requestUrl,
    normalizedRequest.requestUrl
  )
  const cssTimeoutMs = normalizeTimeout(
    options.cssTimeoutMs,
    DEFAULT_CSS_TIMEOUT_MS
  )
  const fontTimeoutMs = normalizeTimeout(
    options.fontTimeoutMs,
    DEFAULT_FONT_TIMEOUT_MS
  )
  const familyTimeoutMs = normalizeTimeout(
    options.familyTimeoutMs,
    DEFAULT_FAMILY_TIMEOUT_MS
  )
  const familyDeadline = Date.now() + familyTimeoutMs
  const fetchImplementation = options.fetch ?? globalThis.fetch
  if (typeof fetchImplementation !== "function") {
    throwBinaryError("google-font-invalid-request", {
      reason: "fetch-unavailable"
    })
  }

  const cssBytes = await fetchCSS(
    requestUrl,
    getRemainingTimeout(familyDeadline, cssTimeoutMs),
    fetchImplementation,
    options.signal
  )
  const cssHash = await createSHA256Hash(cssBytes)
  const parsedFaces = parseGoogleFontFaceCSS(
    decodeCSS(cssBytes),
    normalizedRequest.family
  )

  const downloadedByUrl = new Map<string, DownloadedGoogleFontAssetReference>()
  const assets = new Map<string, Uint8Array>()
  let totalBytes = 0

  const sourceUrls = Array.from(
    new Set(parsedFaces.map((face) => face.sourceUrl))
  )
  let cursor = 0
  let fatalError: unknown = null
  async function worker(): Promise<void> {
    while (cursor < sourceUrls.length && !fatalError) {
      const sourceUrl = sourceUrls[cursor++]
      try {
        const asset = await fetchAsset(
          sourceUrl,
          getRemainingTimeout(familyDeadline, fontTimeoutMs),
          fetchImplementation,
          options.signal
        )
        if (fatalError) return
        downloadedByUrl.set(sourceUrl, {
          byteLength: asset.bytes.byteLength,
          hash: asset.hash
        })

        if (!assets.has(asset.hash)) {
          totalBytes += asset.bytes.byteLength
          if (totalBytes > MAX_GOOGLE_FONT_FAMILY_BYTES) {
            throwBinaryError("google-font-family-size-limit", {
              maxBytes: MAX_GOOGLE_FONT_FAMILY_BYTES,
              totalBytes
            })
          }
          assets.set(asset.hash, asset.bytes)
        }
      } catch (error) {
        fatalError = error
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(FONT_DOWNLOAD_CONCURRENCY, sourceUrls.length) },
      () => worker()
    )
  )
  if (fatalError) throw fatalError

  const faces: GoogleFontBinaryFace[] = []
  const faceIds = new Set<string>()
  for (const parsedFace of parsedFaces) {
    const asset = downloadedByUrl.get(parsedFace.sourceUrl)
    if (!asset) {
      throwBinaryError("google-font-asset-invalid", {
        reason: "missing-downloaded-asset"
      })
    }

    const id = await createFaceId(parsedFace)
    if (faceIds.has(id)) {
      throwBinaryError("google-font-css-invalid", {
        reason: "duplicate-face"
      })
    }
    faceIds.add(id)
    faces.push({
      ...parsedFace,
      assetHash: asset.hash,
      byteLength: asset.byteLength,
      id
    })
  }

  const key = await createGoogleFontBinaryFamilyKey(normalizedRequest.family)
  return {
    assets,
    family: {
      cssHash,
      faces,
      fontFamily: normalizedRequest.family,
      key,
      requestUrl,
      runtimeFamily: createGoogleFontRuntimeFamily(cssHash),
      totalBytes
    }
  }
}
