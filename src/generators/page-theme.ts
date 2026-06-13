import { getCustomCSSForSite } from "../config/site-fixes"
import {
  type FontaraRtlActivationState,
  type FontaraSiteActivationState,
  resolveFontaraSiteConfig
} from "../config/site-manager"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type {
  FontaraApplyMode,
  FontaraFontThemeCommandData,
  FontaraPageThemeCommandData,
  FontaraRtlThemeCommandData,
  FontData
} from "../definitions"
import { getFontFaceCSS } from "./font-face"
import {
  type GoogleFontCSSLoadMode,
  resolveFontSelection
} from "./font-selection"
import { createTextStrokeCSS, getTextStrokeConfig } from "./text-stroke"

export type FontaraPageThemeDataOptions = {
  googleFontCSSLoadMode?: GoogleFontCSSLoadMode
}

const INACTIVE_FONT_THEME: FontaraFontThemeCommandData = {
  active: false,
  applyMode: "full",
  customCSS: null,
  customFontCSS: "",
  fontFaceCSS: "",
  fontName: DEFAULT_VALUES.SELECTED_FONT,
  googleFontCSS: null,
  textStrokeCSS: ""
}

function getSetting<T>(
  settings: Record<string, unknown>,
  key: string,
  fallback: T
): T {
  const value = settings[key]
  return value === undefined ? fallback : (value as T)
}

function getCustomFontList(settings: Record<string, unknown>): FontData[] {
  const value = settings[STORAGE_KEYS.CUSTOM_FONT_LIST]
  return Array.isArray(value)
    ? (value as FontData[])
    : DEFAULT_VALUES.CUSTOM_FONT_LIST
}

async function createFontThemeData(
  settings: Record<string, unknown>,
  activationState: FontaraSiteActivationState,
  applyMode: FontaraApplyMode,
  options: FontaraPageThemeDataOptions = {}
): Promise<FontaraFontThemeCommandData> {
  if (!activationState.active) {
    return {
      ...INACTIVE_FONT_THEME,
      applyMode
    }
  }

  const selectedFont =
    activationState.siteProfile?.font ??
    getSetting(
      settings,
      STORAGE_KEYS.SELECTED_FONT,
      DEFAULT_VALUES.SELECTED_FONT
    )
  const selectedFontState = await resolveFontSelection(selectedFont, {
    customFontList: getCustomFontList(settings),
    googleFontCSSLoadMode: options.googleFontCSSLoadMode,
    googleFontsEnabled: getSetting(
      settings,
      STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
      DEFAULT_VALUES.GOOGLE_FONTS_ENABLED
    ),
    systemFontsEnabled: getSetting(
      settings,
      STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
      DEFAULT_VALUES.SYSTEM_FONTS_ENABLED
    )
  })
  const customCSS = getCustomCSSForSite(activationState)
  const textStrokeCSS = createTextStrokeCSS(
    getTextStrokeConfig(
      settings[STORAGE_KEYS.TEXT_STROKE],
      activationState.matchingWebsite,
      activationState.siteProfile
    )
  )

  return {
    active: true,
    applyMode,
    customCSS,
    customFontCSS: selectedFontState.customFontCSS,
    fontFaceCSS: getFontFaceCSS(),
    fontName: selectedFontState.fontName,
    googleFontCSS: selectedFontState.googleFontCSS,
    textStrokeCSS
  }
}

function createRtlThemeData(
  activationState: FontaraRtlActivationState
): FontaraRtlThemeCommandData {
  return {
    active: activationState.active,
    siteId:
      activationState.active && activationState.matchingSite
        ? activationState.matchingSite.id
        : null
  }
}

export async function createFontaraPageThemeData(
  currentUrl: string,
  settings: Record<string, unknown>,
  applyMode: FontaraApplyMode = "full",
  options: FontaraPageThemeDataOptions = {}
): Promise<FontaraPageThemeCommandData> {
  const siteConfig = resolveFontaraSiteConfig(currentUrl, settings)

  const [font, rtl] = await Promise.all([
    createFontThemeData(settings, siteConfig.font, applyMode, options),
    Promise.resolve(createRtlThemeData(siteConfig.rtl))
  ])

  return {
    font,
    rtl
  }
}
