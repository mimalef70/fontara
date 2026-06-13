import { DEFAULT_FONTS } from "../config/fonts"
import { DEFAULT_VALUES } from "../config/storage"
import type { FontData } from "../definitions"
import {
  decodeGoogleFontValue,
  loadGoogleFontFaceCSS
} from "../utils/google-font-runtime"
import { decodeSystemFontValue } from "../utils/system-fonts"
import { createCustomFontFaces } from "./custom-font-face"

export type FontaraResolvedFontSelection = {
  customFontCSS: string
  fontName: string
  googleFontCSS: string | null
}

export type GoogleFontCSSLoadMode = "allow-network" | "cache-only"

export type FontaraFontSelectionOptions = {
  customFontList?: FontData[] | null
  googleFontCSSLoadMode?: GoogleFontCSSLoadMode
  googleFontsEnabled?: boolean | null
  readCustomFontList?: () => Promise<FontData[] | null | undefined>
  readGoogleFontsEnabled?: () => Promise<boolean | null | undefined>
  readSystemFontsEnabled?: () => Promise<boolean | null | undefined>
  systemFontsEnabled?: boolean | null
}

const BUNDLED_FONT_VALUES = new Set(DEFAULT_FONTS.map((font) => font.value))
const DEFAULT_FONT_SELECTION: FontaraResolvedFontSelection = {
  customFontCSS: "",
  fontName: DEFAULT_VALUES.SELECTED_FONT,
  googleFontCSS: null
}

function normalizeCustomFontList(value: unknown): FontData[] {
  return Array.isArray(value) ? (value as FontData[]) : []
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
): Promise<FontData[]> {
  if (options.customFontList) {
    return normalizeCustomFontList(options.customFontList)
  }

  return normalizeCustomFontList(await options.readCustomFontList?.())
}

function createDefaultFontSelection(): FontaraResolvedFontSelection {
  return { ...DEFAULT_FONT_SELECTION }
}

function getSelectedCustomFonts(
  customFontList: FontData[],
  selectedFont: string
): FontData[] {
  return customFontList.filter((font) => font.value === selectedFont)
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
      customFontCSS: "",
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

    return googleFontsEnabled
      ? {
          customFontCSS: "",
          fontName: googleFontFamily,
          googleFontCSS: await loadGoogleFontFaceCSS(selectedFont, {
            allowNetwork: options.googleFontCSSLoadMode !== "cache-only"
          })
        }
      : createDefaultFontSelection()
  }

  const systemFontFamily = decodeSystemFontValue(selectedFont)
  if (systemFontFamily) {
    const systemFontsEnabled = await resolveBooleanOption(
      options.systemFontsEnabled,
      options.readSystemFontsEnabled
    )

    return systemFontsEnabled
      ? {
          customFontCSS: "",
          fontName: systemFontFamily,
          googleFontCSS: null
        }
      : createDefaultFontSelection()
  }

  const selectedCustomFonts = getSelectedCustomFonts(
    await resolveCustomFontList(options),
    selectedFont
  )
  if (selectedCustomFonts.length === 0) {
    return createDefaultFontSelection()
  }

  return {
    customFontCSS: createCustomFontFaces(selectedCustomFonts),
    fontName: selectedFont,
    googleFontCSS: null
  }
}
