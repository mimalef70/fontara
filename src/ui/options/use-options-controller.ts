import React from "react"
import {
  isRtlSiteEnabled,
  normalizeRtlSiteSettings,
  RTL_SUPPORTED_SITES,
  type RtlSiteConfig
} from "../../config/rtl-sites"
import { normalizeTextStrokeValue } from "../../config/text-stroke"
import { useCustomFontLibrary } from "./use-custom-font-library"
import { useFontCatalogs } from "./use-font-catalogs"
import { useFontSources } from "./use-font-sources"
import { useOptionsState } from "./use-options-state"
import { useSettingsBackup } from "./use-settings-backup"
import { useSiteAccess } from "./use-site-access"
import { useSiteProfiles } from "./use-site-profiles"

export function useOptionsController() {
  const state = useOptionsState()
  const library = useCustomFontLibrary(state)
  const backup = useSettingsBackup(state)
  const sources = useFontSources(state)
  const sites = useSiteAccess(state)
  const {
    rtlSiteSettings,
    rtlEnabled,
    activeSection,
    siteSettingsTab,
    selectedFont,
    customFontList,
    systemFontsEnabled,
    googleFontsEnabled,
    setRtlEnabled,
    toast,
    t,
    setExtensionEnabled,
    setTextStroke,
    formatNumber,
    textStroke,
    setRtlSiteSettings
  } = state
  const normalizedRtlSiteSettings = normalizeRtlSiteSettings(rtlSiteSettings)

  const activeRtlSiteCount =
    rtlEnabled === false
      ? 0
      : RTL_SUPPORTED_SITES.filter((site) =>
          isRtlSiteEnabled(normalizedRtlSiteSettings, site.id)
        ).length

  const { getSiteProfileFontLabel } = useFontCatalogs({
    selectedFont,
    customFontList,
    systemFontsEnabled,
    googleFontsEnabled
  })

  const siteProfilesController = useSiteProfiles(
    activeSection === "sites" && siteSettingsTab === "profiles"
  )

  const activeFontLabel = getSiteProfileFontLabel(selectedFont)

  const handleRtlGlobalToggle = async (checked: boolean) => {
    try {
      await setRtlEnabled(checked)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleExtensionToggle = async (checked: boolean) => {
    try {
      await setExtensionEnabled(checked)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.extensionError")
      })
    }
  }

  const handleTextStrokeChange = async (value: number) => {
    try {
      await setTextStroke(normalizeTextStrokeValue(value))
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const formatTextStrokeDisplay = React.useCallback(
    (value: number) =>
      `+${formatNumber(value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
        useGrouping: false
      })}`,
    [formatNumber]
  )

  const formattedTextStroke = formatTextStrokeDisplay(textStroke)

  const handleRtlSiteToggle = async (site: RtlSiteConfig, checked: boolean) => {
    try {
      await setRtlSiteSettings({
        ...normalizedRtlSiteSettings,
        [site.id]: checked
      })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }
  return {
    ...state,
    ...library,
    ...backup,
    ...sources,
    ...sites,
    normalizedRtlSiteSettings,
    activeRtlSiteCount,
    siteProfilesController,
    activeFontLabel,
    handleRtlGlobalToggle,
    handleExtensionToggle,
    handleTextStrokeChange,
    formattedTextStroke,
    handleRtlSiteToggle
  }
}

export type OptionsController = ReturnType<typeof useOptionsController>
