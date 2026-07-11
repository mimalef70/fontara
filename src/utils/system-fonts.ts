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

const SYSTEM_FONT_VALUE_PREFIX = "system-font:"
const MAX_SYSTEM_FONT_FAMILY_LENGTH = 160
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

  return `${SYSTEM_FONT_VALUE_PREFIX}${encodeURIComponent(normalizedFontFamily)}`
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

export function normalizeSystemFontList(
  fonts: chrome.fontSettings.FontName[]
): SystemFontData[] {
  const fontsByFamily = new Map<string, SystemFontData>()

  for (const font of fonts) {
    const fontFamily = font.fontId.trim()
    const systemFont = createSystemFontData(
      fontFamily,
      font.displayName?.trim()
    )
    if (!systemFont) continue

    fontsByFamily.set(fontFamily, systemFont)
  }

  return [...fontsByFamily.values()].sort((firstFont, secondFont) =>
    firstFont.name.localeCompare(secondFont.name, undefined, {
      sensitivity: "base"
    })
  )
}

function createSystemFontData(
  fontFamily: string,
  displayName = fontFamily
): SystemFontData | null {
  const value = createSystemFontValue(fontFamily)
  if (!value) return null

  return {
    value,
    fontFamily: fontFamily.trim(),
    name: displayName.trim() || fontFamily.trim()
  }
}

export function isSystemFontAccessSupported(): boolean {
  return (
    isChromiumBuild() && typeof getFontSettingsAPI()?.getFontList === "function"
  )
}

export function isSystemFontFeatureSupported(): boolean {
  // Content scripts do not receive the fontSettings namespace, but a known
  // system family can still be applied safely on Chromium. Enumeration and UI
  // activation continue to require isSystemFontAccessSupported().
  return isChromiumBuild()
}

let cachedLoadState: SystemFontLoadState | null = null
let pendingLoad: Promise<SystemFontLoadState> | null = null

function createUnsupportedState(): SystemFontLoadState {
  return {
    error: null,
    fonts: [],
    status: "unsupported"
  }
}

function readSystemFontList(): Promise<SystemFontData[]> {
  const fontSettings = getFontSettingsAPI()
  if (!isChromiumBuild() || typeof fontSettings?.getFontList !== "function") {
    return Promise.reject(new Error("system-fonts-unsupported"))
  }

  return new Promise((resolve, reject) => {
    fontSettings.getFontList((fonts) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve(normalizeSystemFontList(Array.isArray(fonts) ? fonts : []))
    })
  })
}

export function getSystemFontLoadState(): SystemFontLoadState {
  if (!isSystemFontAccessSupported()) return createUnsupportedState()

  return (
    cachedLoadState ?? {
      error: null,
      fonts: [],
      status: "loading"
    }
  )
}

export function loadSystemFonts(
  options: { retry?: boolean } = {}
): Promise<SystemFontLoadState> {
  if (!isSystemFontAccessSupported()) {
    cachedLoadState = createUnsupportedState()
    pendingLoad = null
    return Promise.resolve(cachedLoadState)
  }

  if (pendingLoad) return pendingLoad
  if (
    (cachedLoadState?.status === "ready" &&
      (!options.retry || cachedLoadState.fonts.length > 0)) ||
    (cachedLoadState?.status === "error" && !options.retry)
  ) {
    return Promise.resolve(cachedLoadState)
  }

  cachedLoadState = {
    error: null,
    fonts: cachedLoadState?.fonts ?? [],
    status: "loading"
  }
  pendingLoad = readSystemFontList()
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
        fonts: [],
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
  options: { retry?: boolean } = {}
): Promise<SystemFontData[]> {
  const state = await loadSystemFonts(options)
  if (state.status === "unsupported") return []
  if (state.status === "error") {
    throw state.error ?? new Error("system-fonts-unavailable")
  }

  return state.fonts
}

export function resetSystemFontLoaderForTesting(): void {
  cachedLoadState = null
  pendingLoad = null
}
