export type SystemFontData = {
  value: string
  name: string
  fontFamily: string
}

const SYSTEM_FONT_VALUE_PREFIX = "system-font:"
const MAX_SYSTEM_FONT_FAMILY_LENGTH = 160
const GENERIC_SYSTEM_FONT_FAMILIES = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui"
]

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

export function getGenericSystemFontList(): SystemFontData[] {
  return GENERIC_SYSTEM_FONT_FAMILIES.map((fontFamily) =>
    createSystemFontData(fontFamily)
  ).filter((font): font is SystemFontData => font !== null)
}

export function isSystemFontAccessSupported(): boolean {
  return typeof chrome !== "undefined"
}

export function getSystemFontList(): Promise<SystemFontData[]> {
  const fontSettings = getFontSettingsAPI()
  if (!fontSettings) {
    return Promise.resolve(getGenericSystemFontList())
  }

  return new Promise((resolve) => {
    fontSettings.getFontList((fonts) => {
      if (getRuntimeError()) {
        resolve([])
        return
      }

      resolve(normalizeSystemFontList(fonts))
    })
  })
}
