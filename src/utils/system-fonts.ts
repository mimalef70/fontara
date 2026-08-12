export type SystemFontData = {
  value: string
  name: string
  fontFamily: string
}

export type SystemFontLoadStatus = "unsupported" | "loading" | "ready" | "error"

export type SystemFontLoadState = {
  error: Error | null
  fonts: SystemFontData[]
  status: SystemFontLoadStatus
}

export type SystemFontLoadOptions = {
  forceRefresh?: boolean
  // Kept as a compatibility alias for callers from older extension builds.
  retry?: boolean
  timeoutMs?: number
}

const SYSTEM_FONT_VALUE_PREFIX = "system-font:"
const MAX_SYSTEM_FONT_FAMILY_LENGTH = 160
const MAX_SYSTEM_FONT_DISPLAY_NAME_LENGTH = 160
const SYSTEM_FONT_LIST_TIMEOUT_MS = 5_000
type ChromeWithFontSettings = typeof chrome & {
  fontSettings?: typeof chrome.fontSettings
}

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
}

function getFontSettingsAPI(): typeof chrome.fontSettings | null {
  if (typeof chrome === "undefined") return null

  return (chrome as ChromeWithFontSettings).fontSettings ?? null
}

function isChromiumBuild(): boolean {
  if (typeof __CHROMIUM_MV3__ !== "undefined") return __CHROMIUM_MV3__
  if (typeof __FIREFOX_MV3__ !== "undefined") return !__FIREFOX_MV3__

  // Unit tests and source-level consumers do not replace build constants.
  // Capability detection below remains authoritative in that environment.
  return true
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }

  return false
}

export function isSafeSystemFontFamily(
  fontFamily: unknown
): fontFamily is string {
  if (typeof fontFamily !== "string") return false

  const normalizedFontFamily = fontFamily.trim()
  return (
    normalizedFontFamily.length > 0 &&
    normalizedFontFamily.length <= MAX_SYSTEM_FONT_FAMILY_LENGTH &&
    !hasControlCharacter(normalizedFontFamily)
  )
}

export function createSystemFontValue(fontFamily: string): string | null {
  const normalizedFontFamily = fontFamily.trim()
  if (!isSafeSystemFontFamily(normalizedFontFamily)) return null

  try {
    return `${SYSTEM_FONT_VALUE_PREFIX}${encodeURIComponent(normalizedFontFamily)}`
  } catch {
    // encodeURIComponent rejects malformed lone UTF-16 surrogates.
    return null
  }
}

export function decodeSystemFontValue(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith(SYSTEM_FONT_VALUE_PREFIX)
  ) {
    return null
  }

  try {
    const fontFamily = decodeURIComponent(
      value.slice(SYSTEM_FONT_VALUE_PREFIX.length)
    )
    return isSafeSystemFontFamily(fontFamily) ? fontFamily.trim() : null
  } catch {
    return null
  }
}

export function isSystemFontValue(value: unknown): value is string {
  return decodeSystemFontValue(value) !== null
}

export function normalizeSystemFontFamilyKey(fontFamily: string): string {
  return fontFamily.normalize("NFKC").toLocaleLowerCase("en-US")
}

function isUnsafeDisplayNameCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) return false

  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    codePoint === 0x2060 ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  )
}

function sanitizeSystemFontDisplayName(
  displayName: unknown,
  fallback: string
): string {
  const sanitize = (value: string) =>
    Array.from(value, (character) =>
      isUnsafeDisplayNameCharacter(character) ? " " : character
    )
      .join("")
      .replace(/\s+/gu, " ")
      .trim()

  const sanitizedName = sanitize(
    typeof displayName === "string" ? displayName : fallback
  )
  const safeFallback = sanitize(fallback) || "System Font"

  return Array.from(sanitizedName || safeFallback)
    .slice(0, MAX_SYSTEM_FONT_DISPLAY_NAME_LENGTH)
    .join("")
    .trim()
}

export function normalizeSystemFontList(fonts: unknown): SystemFontData[] {
  if (!Array.isArray(fonts)) return []

  const fontsByFamily = new Map<string, SystemFontData>()

  for (const font of fonts) {
    if (typeof font !== "object" || font === null) continue

    const { displayName, fontId } = font as {
      displayName?: unknown
      fontId?: unknown
    }
    if (typeof fontId !== "string") continue

    const fontFamily = fontId.trim()
    const systemFont = createSystemFontData(fontFamily, displayName)
    if (!systemFont) continue

    const familyKey = normalizeSystemFontFamilyKey(fontFamily)
    if (!fontsByFamily.has(familyKey)) {
      fontsByFamily.set(familyKey, systemFont)
    }
  }

  return sortSystemFonts([...fontsByFamily.values()])
}

function createSystemFontData(
  fontFamily: string,
  displayName: unknown = fontFamily
): SystemFontData | null {
  const value = createSystemFontValue(fontFamily)
  if (!value) return null

  const normalizedFontFamily = fontFamily.trim()

  return {
    value,
    fontFamily: normalizedFontFamily,
    name: sanitizeSystemFontDisplayName(displayName, normalizedFontFamily)
  }
}

function sortSystemFonts(fonts: SystemFontData[]): SystemFontData[] {
  return fonts.sort((firstFont, secondFont) => {
    const nameComparison = firstFont.name.localeCompare(
      secondFont.name,
      undefined,
      { sensitivity: "base" }
    )
    if (nameComparison !== 0) return nameComparison

    return firstFont.fontFamily.localeCompare(
      secondFont.fontFamily,
      undefined,
      {
        sensitivity: "base"
      }
    )
  })
}

const CSS_GENERIC_SYSTEM_FONT_DEFINITIONS = [
  ["serif", "Serif"],
  ["sans-serif", "Sans Serif"],
  ["monospace", "Monospace"],
  ["cursive", "Cursive"],
  ["fantasy", "Fantasy"],
  ["system-ui", "System UI"]
] as const

export function getCSSGenericSystemFonts(): SystemFontData[] {
  return sortSystemFonts(
    CSS_GENERIC_SYSTEM_FONT_DEFINITIONS.map(([fontFamily, displayName]) => {
      const font = createSystemFontData(fontFamily, displayName)
      if (!font) {
        throw new Error(`Invalid CSS generic system font: ${fontFamily}`)
      }
      return font
    })
  )
}

function mergeWithCSSGenericSystemFonts(
  installedFonts: SystemFontData[]
): SystemFontData[] {
  const fontsByFamily = new Map<string, SystemFontData>()

  for (const font of [...getCSSGenericSystemFonts(), ...installedFonts]) {
    const familyKey = normalizeSystemFontFamilyKey(font.fontFamily)
    if (!fontsByFamily.has(familyKey)) {
      fontsByFamily.set(familyKey, font)
    }
  }

  return sortSystemFonts([...fontsByFamily.values()])
}

export function isSystemFontAccessSupported(): boolean {
  return (
    isChromiumBuild() && typeof getFontSettingsAPI()?.getFontList === "function"
  )
}

export function isSystemFontFeatureSupported(): boolean {
  // CSS generic families work without privileged font enumeration. The
  // fontSettings API only improves the picker with locally installed names.
  return true
}

let cachedLoadState: SystemFontLoadState | null = null
let pendingLoad: Promise<SystemFontLoadState> | null = null

function createGenericReadyState(): SystemFontLoadState {
  return {
    error: null,
    fonts: getCSSGenericSystemFonts(),
    status: "ready"
  }
}

function readSystemFontList(timeoutMs: number): Promise<SystemFontData[]> {
  const fontSettings = getFontSettingsAPI()
  if (!isChromiumBuild() || typeof fontSettings?.getFontList !== "function") {
    return Promise.reject(new Error("system-fonts-unsupported"))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const settle = <Value>(callback: (value: Value) => void, value: Value) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback(value)
    }
    const timeout = setTimeout(
      () => settle(reject, new Error("system-fonts-timeout")),
      Math.max(0, timeoutMs)
    )

    try {
      fontSettings.getFontList((fonts) => {
        const error = getRuntimeError()
        if (error) {
          settle(reject, error)
          return
        }

        settle(
          resolve,
          mergeWithCSSGenericSystemFonts(normalizeSystemFontList(fonts))
        )
      })
    } catch (error) {
      settle(reject, error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export function getSystemFontLoadState(): SystemFontLoadState {
  if (!isSystemFontAccessSupported()) {
    return cachedLoadState ?? createGenericReadyState()
  }

  return (
    cachedLoadState ?? {
      error: null,
      fonts: getCSSGenericSystemFonts(),
      status: "loading"
    }
  )
}

export function loadSystemFonts(
  options: SystemFontLoadOptions = {}
): Promise<SystemFontLoadState> {
  if (!isSystemFontAccessSupported()) {
    cachedLoadState = createGenericReadyState()
    pendingLoad = null
    return Promise.resolve(cachedLoadState)
  }

  if (pendingLoad) return pendingLoad
  const forceRefresh = options.forceRefresh === true || options.retry === true
  if (cachedLoadState && !forceRefresh) {
    return Promise.resolve(cachedLoadState)
  }

  const lastKnownFonts =
    cachedLoadState?.fonts.length && cachedLoadState.fonts.length > 0
      ? cachedLoadState.fonts
      : getCSSGenericSystemFonts()
  cachedLoadState = {
    error: null,
    fonts: lastKnownFonts,
    status: "loading"
  }
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? (options.timeoutMs ?? SYSTEM_FONT_LIST_TIMEOUT_MS)
    : SYSTEM_FONT_LIST_TIMEOUT_MS
  pendingLoad = readSystemFontList(timeoutMs)
    .then((fonts) => {
      cachedLoadState = {
        error: null,
        fonts,
        status: "ready"
      }
      return cachedLoadState
    })
    .catch((error: unknown) => {
      cachedLoadState = {
        error: error instanceof Error ? error : new Error(String(error)),
        fonts: lastKnownFonts,
        status: "error"
      }
      return cachedLoadState
    })
    .finally(() => {
      pendingLoad = null
    })

  return pendingLoad
}

export async function getSystemFontList(
  options: SystemFontLoadOptions = {}
): Promise<SystemFontData[]> {
  const state = await loadSystemFonts(options)
  if (state.status === "unsupported") return []
  if (state.status === "error" && state.fonts.length === 0) {
    throw state.error ?? new Error("system-fonts-unavailable")
  }

  return state.fonts
}

export function resetSystemFontLoaderForTesting(): void {
  cachedLoadState = null
  pendingLoad = null
}
