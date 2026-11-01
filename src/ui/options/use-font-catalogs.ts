import React, { useState } from "react"
import { DEFAULT_FONTS, type DefaultFont } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import type { CustomFontFamily } from "../../custom-font-types"
import {
  decodeGoogleFontValue,
  type GoogleFontData,
  getGoogleFontByValue,
  isGoogleFontFeatureSupported,
  loadGoogleFontList
} from "../../utils/google-fonts"
import {
  decodeSystemFontValue,
  isSystemFontAccessSupported,
  isSystemFontFeatureSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey,
  type SystemFontData
} from "../../utils/system-fonts"
import { useI18n } from "../i18n"

type SiteFontOption = {
  label: string
  value: string
}

type SiteFontOptionGroup = {
  label: string
  options: SiteFontOption[]
}

function getDefaultFontLabel(
  font: DefaultFont,
  language: SupportedUILanguage
): string {
  return font.localizedName[language] || font.name
}

export function useFontCatalogs({
  selectedFont,
  customFontList,
  systemFontsEnabled,
  googleFontsEnabled,
  loadCatalogs = false
}: {
  selectedFont: string
  customFontList: CustomFontFamily[]
  systemFontsEnabled: boolean
  googleFontsEnabled: boolean
  loadCatalogs?: boolean
}) {
  const { language, t } = useI18n()
  const systemFontsSupported = isSystemFontFeatureSupported()
  const googleFontsSupported = isGoogleFontFeatureSupported()
  const [systemFontList, setSystemFontList] = useState<SystemFontData[]>([])
  const [systemFontListReady, setSystemFontListReady] = useState(false)
  const [googleFontList, setGoogleFontList] = useState<GoogleFontData[]>([])
  const [googleFontListReady, setGoogleFontListReady] = useState(false)
  React.useEffect(() => {
    let cancelled = false

    if (!systemFontsSupported || !systemFontsEnabled) {
      setSystemFontList([])
      setSystemFontListReady(false)
      return () => {
        cancelled = true
      }
    }

    const selectedSystemFont = decodeSystemFontValue(selectedFont)
    const needsSiteProfileFonts = loadCatalogs
    if (!selectedSystemFont && !needsSiteProfileFonts) {
      return () => {
        cancelled = true
      }
    }

    loadSystemFonts({ forceRefresh: needsSiteProfileFonts })
      .then((state) => {
        if (!cancelled) {
          setSystemFontList(state.fonts)
          setSystemFontListReady(state.status === "ready")
        }
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to load system fonts for site profiles.", error)
        }
        if (!cancelled) {
          setSystemFontList([])
          setSystemFontListReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadCatalogs, selectedFont, systemFontsEnabled, systemFontsSupported])

  React.useEffect(() => {
    let cancelled = false
    if (!googleFontsSupported || !googleFontsEnabled) {
      setGoogleFontList([])
      setGoogleFontListReady(false)
      return () => {
        cancelled = true
      }
    }

    const selectedGoogleFont = decodeGoogleFontValue(selectedFont)
    const needsSiteProfileFonts = loadCatalogs
    if (!selectedGoogleFont && !needsSiteProfileFonts) {
      return () => {
        cancelled = true
      }
    }

    void loadGoogleFontList()
      .then((fonts) => {
        if (!cancelled) {
          setGoogleFontList(fonts)
          setGoogleFontListReady(true)
        }
      })
      .catch((error) => {
        if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
          console.warn("Failed to load the Google Fonts catalog.", error)
        }
        if (!cancelled) {
          setGoogleFontList([])
          setGoogleFontListReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadCatalogs, googleFontsEnabled, googleFontsSupported, selectedFont])

  const siteFontOptionGroups = React.useMemo<SiteFontOptionGroup[]>(
    () => [
      {
        label: t("fontSelector.bundledGroup"),
        options: DEFAULT_FONTS.map((font) => ({
          label: getDefaultFontLabel(font, language),
          value: font.value
        }))
      },
      {
        label: t("fontSelector.customGroup"),
        options: customFontList.map((font) => ({
          label: font.displayName,
          value: font.value
        }))
      },
      {
        label: t("fontSelector.googleGroup"),
        options: googleFontList.map((font) => ({
          label: font.name,
          value: font.value
        }))
      },
      {
        label: t("fontSelector.systemGroup"),
        options: systemFontList.map((font) => ({
          label: font.name,
          value: font.value
        }))
      }
    ],
    [customFontList, googleFontList, language, systemFontList, t]
  )
  const siteFontOptions = React.useMemo(
    () => siteFontOptionGroups.flatMap((group) => group.options),
    [siteFontOptionGroups]
  )
  const fallbackFontLabel = getDefaultFontLabel(DEFAULT_FONTS[0], language)

  const getSiteProfileFontLabel = React.useCallback(
    (fontValue: string | undefined): string => {
      if (!fontValue) return t("options.siteProfiles.globalFont")

      const systemFont = decodeSystemFontValue(fontValue)
      if (systemFont) {
        if (!systemFontsEnabled) {
          return t("fontSelector.sourcePaused", {
            fallback: fallbackFontLabel,
            font: systemFont
          })
        }
        const selectedFamilyKey = normalizeSystemFontFamilyKey(systemFont)
        const available = systemFontList.some(
          (font) =>
            normalizeSystemFontFamilyKey(font.fontFamily) === selectedFamilyKey
        )
        return isSystemFontAccessSupported() &&
          systemFontListReady &&
          !available
          ? t("fontSelector.sourceUnavailable", {
              fallback: fallbackFontLabel,
              font: systemFont
            })
          : systemFont
      }

      const googleFontFamily = decodeGoogleFontValue(fontValue)
      if (googleFontFamily) {
        const googleFont = getGoogleFontByValue(fontValue)
        const label = googleFont?.family ?? googleFontFamily
        if (!googleFontsEnabled) {
          return t("fontSelector.sourcePaused", {
            fallback: fallbackFontLabel,
            font: label
          })
        }
        return googleFontListReady && !googleFont
          ? t("fontSelector.sourceUnavailable", {
              fallback: fallbackFontLabel,
              font: label
            })
          : label
      }

      const option = siteFontOptions.find((font) => font.value === fontValue)
      if (option) return option.label

      return fontValue
    },
    [
      fallbackFontLabel,
      googleFontListReady,
      googleFontsEnabled,
      siteFontOptions,
      systemFontList,
      systemFontListReady,
      systemFontsEnabled,
      t
    ]
  )
  return { siteFontOptionGroups, siteFontOptions, getSiteProfileFontLabel }
}
