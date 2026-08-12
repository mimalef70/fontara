import { DEFAULT_FONTS } from "../config/fonts"
import { DEFAULT_VALUES } from "../config/storage"
import type { CustomFontFamily } from "../custom-font-types"
import {
  decodeGoogleFontValue,
  loadGoogleFontFaceCSS
} from "../utils/google-fonts"
import {
  decodeSystemFontValue,
  isSystemFontAccessSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey
} from "../utils/system-fonts"

export type FontaraResolvedFontSelection = {
  customFontFamilyRevision: number | null
  customFontFamilyValue: string | null
  fontName: string
  googleFontCSS: string | null
}

export type GoogleFontCSSLoadMode = "allow-network" | "cache-only"

export type FontaraFontSelectionOptions = {
  customFontList?: CustomFontFamily[] | null
  googleFontCSSLoadMode?: GoogleFontCSSLoadMode
  googleFontsEnabled?: boolean | null
  readCustomFontList?: () => Promise<CustomFontFamily[] | null | undefined>
  readGoogleFontsEnabled?: () => Promise<boolean | null | undefined>
  readSystemFontsEnabled?: () => Promise<boolean | null | undefined>
  systemFontsEnabled?: boolean | null
}

const BUNDLED_FONT_VALUES = new Set(DEFAULT_FONTS.map((font) => font.value))
const DEFAULT_FONT_SELECTION: FontaraResolvedFontSelection = {
  customFontFamilyRevision: null,
  customFontFamilyValue: null,
  fontName: DEFAULT_VALUES.SELECTED_FONT,
  googleFontCSS: null
}

function normalizeCustomFontList(value: unknown): CustomFontFamily[] {
  return Array.isArray(value) ? (value as CustomFontFamily[]) : []
}

async function resolveBooleanOption(
  value: boolean | null | undefined,
  readValue: (() => Promise<boolean | null | undefined>) | undefined
): Promise<boolean> {
  if (typeof value === "boolean") return value

  return (await readValue?.()) === true
}

async function resolveCustomFontList(
  options: FontaraFontSelectionOptions
): Promise<CustomFontFamily[]> {
  if (options.customFontList) {
    return normalizeCustomFontList(options.customFontList)
  }

  return normalizeCustomFontList(await options.readCustomFontList?.())
}

function createDefaultFontSelection(): FontaraResolvedFontSelection {
  return { ...DEFAULT_FONT_SELECTION }
}

function getSelectedCustomFont(
  customFontList: CustomFontFamily[],
  selectedFont: string
): CustomFontFamily | null {
  return customFontList.find((font) => font.value === selectedFont) ?? null
}

export function isBundledFontValue(value: string | undefined): boolean {
  return typeof value === "string" && BUNDLED_FONT_VALUES.has(value)
}

export async function resolveFontSelection(
  selectedFont: string | undefined,
  options: FontaraFontSelectionOptions = {}
): Promise<FontaraResolvedFontSelection> {
  if (!selectedFont) {
    return createDefaultFontSelection()
  }

  if (isBundledFontValue(selectedFont)) {
    return {
      customFontFamilyRevision: null,
      customFontFamilyValue: null,
      fontName: selectedFont,
      googleFontCSS: null
    }
  }

  const googleFontFamily = decodeGoogleFontValue(selectedFont)
  if (googleFontFamily) {
    const googleFontsEnabled = await resolveBooleanOption(
      options.googleFontsEnabled,
      options.readGoogleFontsEnabled
    )
    if (!googleFontsEnabled) return createDefaultFontSelection()

    const googleFontCSS = await loadGoogleFontFaceCSS(selectedFont, {
      allowNetwork: options.googleFontCSSLoadMode !== "cache-only"
    })
    return googleFontCSS
      ? {
          customFontFamilyRevision: null,
          customFontFamilyValue: null,
          fontName: googleFontFamily,
          googleFontCSS
        }
      : createDefaultFontSelection()
  }

  const systemFontFamily = decodeSystemFontValue(selectedFont)
  if (systemFontFamily) {
    const systemFontsEnabled = await resolveBooleanOption(
      options.systemFontsEnabled,
      options.readSystemFontsEnabled
    )

    if (!systemFontsEnabled) return createDefaultFontSelection()

    if (isSystemFontAccessSupported()) {
      const state = await loadSystemFonts()
      const selectedFamilyKey = normalizeSystemFontFamilyKey(systemFontFamily)
      const installed = state.fonts.some(
        (font) =>
          normalizeSystemFontFamilyKey(font.fontFamily) === selectedFamilyKey
      )
      if (state.status === "ready" && !installed) {
        return createDefaultFontSelection()
      }
    }

    return {
      customFontFamilyRevision: null,
      customFontFamilyValue: null,
      fontName: systemFontFamily,
      googleFontCSS: null
    }
  }

  const selectedCustomFont = getSelectedCustomFont(
    await resolveCustomFontList(options),
    selectedFont
  )
  if (!selectedCustomFont) {
    return createDefaultFontSelection()
  }

  return {
    customFontFamilyRevision: selectedCustomFont.revision,
    customFontFamilyValue: selectedCustomFont.value,
    fontName: selectedFont,
    googleFontCSS: null
  }
}
