import React, { useState } from "react"
import {
  getDisplaySitePattern,
  getSitePatternScope,
  getWebsiteSitePattern,
  inferSitePatternScopeFromInput,
  normalizeEnabledSiteList,
  normalizeSiteList,
  normalizeSitePattern,
  normalizeSitePatternForScope
} from "../../config/site-list"
import {
  normalizeSiteProfiles,
  removeSiteProfile,
  upsertSiteProfile
} from "../../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import { normalizeTextStrokeValue } from "../../config/text-stroke"
import type { CustomFontFamily } from "../../custom-font-types"
import type { SiteProfile } from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
import { decodeGoogleFontValue } from "../../utils/google-fonts"
import { fontaraConnector } from "../connect/connector"
import { useStorageValue } from "../hooks/use-storage"
import { useToast } from "../hooks/use-toast"
import { useI18n } from "../i18n"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getDisabledForInitialValue,
  getEnabledForInitialValue,
  getGoogleFontsEnabledInitialValue,
  getSiteProfilesInitialValue,
  getSystemFontsEnabledInitialValue,
  getTextStrokeInitialValue
} from "../storage-defaults"
import { useFontCatalogs } from "./use-font-catalogs"

type SiteProfileTargetOption = {
  iconUrl?: string
  id: string
  pattern: string
  subtitle?: string
  title: string
}

export function useSiteProfiles(active: boolean) {
  const { formatNumber, t } = useI18n()
  const { toast } = useToast()
  const [selectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_VALUES.SELECTED_FONT
  )
  const [customFontList] = useStorageValue<CustomFontFamily[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [siteProfiles, setSiteProfiles] = useStorageValue<SiteProfile[]>(
    STORAGE_KEYS.SITE_PROFILES,
    getSiteProfilesInitialValue
  )
  const [enabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.ENABLED_FOR,
    getEnabledForInitialValue
  )
  const [disabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.DISABLED_FOR,
    getDisabledForInitialValue
  )
  const [systemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )
  const [googleFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
    getGoogleFontsEnabledInitialValue
  )
  const [textStroke] = useStorageValue<number>(
    STORAGE_KEYS.TEXT_STROKE,
    getTextStrokeInitialValue
  )
  const defaultWebsiteList = DEFAULT_VALUES.WEBSITE_LIST
  const normalizedSiteProfiles = normalizeSiteProfiles(siteProfiles)
  const [siteProfilePatternInput, setSiteProfilePatternInput] = useState("")
  const [siteProfileTargetSearch, setSiteProfileTargetSearch] = useState("")
  const [siteProfileTargetOpen, setSiteProfileTargetOpen] = useState(false)
  const [siteProfileFontInput, setSiteProfileFontInput] = useState("")
  const [siteProfileFontPickerOpen, setSiteProfileFontPickerOpen] =
    useState(false)
  const [siteProfileGoogleFontStatus, setSiteProfileGoogleFontStatus] =
    useState<"error" | "idle" | "loading">("idle")
  const [siteProfileTextStroke, setSiteProfileTextStroke] = useState(
    DEFAULT_VALUES.TEXT_STROKE
  )
  const [siteProfileUsesGlobalStroke, setSiteProfileUsesGlobalStroke] =
    useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = React.useRef(false)
  const { siteFontOptionGroups, siteFontOptions, getSiteProfileFontLabel } =
    useFontCatalogs({
      selectedFont: siteProfileFontInput || selectedFont,
      customFontList,
      systemFontsEnabled,
      googleFontsEnabled,
      loadCatalogs: active && siteProfileFontPickerOpen
    })
  React.useEffect(() => {
    if (!active) setSiteProfileFontPickerOpen(false)
  }, [active])
  const selectedSiteProfilePattern = normalizeSitePattern(
    siteProfilePatternInput
  )
  const selectedSiteProfileScope = selectedSiteProfilePattern
    ? getSitePatternScope(selectedSiteProfilePattern)
    : null
  const siteProfileTargetSearchTerm = siteProfileTargetSearch
    .trim()
    .toLowerCase()
  const siteProfileTargetOptions = React.useMemo(() => {
    const options = new Map<string, SiteProfileTargetOption>()
    const addTargetOption = (option: SiteProfileTargetOption) => {
      const currentOption = options.get(option.pattern)

      if (!currentOption) {
        options.set(option.pattern, option)
        return
      }

      const currentPatternTitle = getDisplaySitePattern(currentOption.pattern)
      const nextPatternTitle = getDisplaySitePattern(option.pattern)
      options.set(option.pattern, {
        ...currentOption,
        iconUrl: currentOption.iconUrl ?? option.iconUrl,
        subtitle: currentOption.subtitle ?? option.subtitle,
        title:
          currentOption.title === currentPatternTitle &&
          option.title !== nextPatternTitle
            ? option.title
            : currentOption.title
      })
    }
    const addPatternTarget = (pattern: string, idPrefix: string) => {
      const normalizedPattern = normalizeSitePattern(pattern)

      if (!normalizedPattern) return

      addTargetOption({
        id: `${idPrefix}-${normalizedPattern}`,
        pattern: normalizedPattern,
        subtitle: getDisplaySitePattern(normalizedPattern),
        title: getDisplaySitePattern(normalizedPattern)
      })
    }

    for (const profile of normalizeSiteProfiles(siteProfiles)) {
      addPatternTarget(profile.pattern, "profile")
    }

    for (const pattern of normalizeSiteList([
      ...normalizeEnabledSiteList(enabledFor),
      ...normalizeSiteList(disabledFor)
    ])) {
      addPatternTarget(pattern, "rule")
    }

    for (const website of defaultWebsiteList) {
      const pattern = getWebsiteSitePattern(website)
      if (!pattern) continue

      addTargetOption({
        iconUrl: website.icon ? getExtensionAssetURL(website.icon) : undefined,
        id: `default-${website.url}`,
        pattern,
        subtitle: getDisplaySitePattern(pattern),
        title: website.siteName || getDisplaySitePattern(pattern)
      })
    }

    return [...options.values()]
  }, [disabledFor, enabledFor, siteProfiles])
  const selectedSiteProfileTarget = selectedSiteProfilePattern
    ? (siteProfileTargetOptions.find(
        (option) => option.pattern === selectedSiteProfilePattern
      ) ?? null)
    : null
  const siteProfileAddTargetScope = inferSitePatternScopeFromInput(
    siteProfileTargetSearch,
    "domain"
  )
  const siteProfileAddTargetPattern = normalizeSitePatternForScope(
    siteProfileTargetSearch,
    siteProfileAddTargetScope
  )
  const canAddSiteProfileTarget =
    Boolean(siteProfileTargetSearchTerm) &&
    Boolean(siteProfileAddTargetPattern) &&
    !siteProfileTargetOptions.some(
      (option) => option.pattern === siteProfileAddTargetPattern
    )
  const selectSiteProfileTarget = (pattern: string) => {
    const normalizedPattern = normalizeSitePattern(pattern)
    if (!normalizedPattern) return

    setSiteProfilePatternInput(normalizedPattern)
    setSiteProfileTargetOpen(false)
    setSiteProfileTargetSearch("")
  }

  const handleAddSiteProfileTarget = () => {
    if (siteProfileAddTargetPattern) {
      selectSiteProfileTarget(siteProfileAddTargetPattern)
    }
  }

  const resetSiteProfileForm = () => {
    setSiteProfilePatternInput("")
    setSiteProfileTargetSearch("")
    setSiteProfileTargetOpen(false)
    setSiteProfileFontInput("")
    setSiteProfileGoogleFontStatus("idle")
    setSiteProfileTextStroke(DEFAULT_VALUES.TEXT_STROKE)
    setSiteProfileUsesGlobalStroke(true)
  }

  const handleSaveSiteProfile = async () => {
    if (savingRef.current) return
    const pattern = selectedSiteProfilePattern

    if (!pattern) {
      toast({ title: t("options.toast.invalidSitePattern") })
      return
    }

    const keepsExistingFont = normalizedSiteProfiles.some(
      (profile) =>
        profile.pattern === pattern && profile.font === siteProfileFontInput
    )
    if (
      siteProfileFontInput &&
      !keepsExistingFont &&
      !siteFontOptions.some((font) => font.value === siteProfileFontInput)
    ) {
      toast({ title: t("options.toast.unavailableSiteProfileFont") })
      return
    }

    if (!siteProfileFontInput && siteProfileUsesGlobalStroke) {
      toast({ title: t("options.toast.emptySiteProfile") })
      return
    }

    savingRef.current = true
    setIsSaving(true)
    try {
      const googleFontFamily = decodeGoogleFontValue(siteProfileFontInput)
      if (googleFontFamily && !keepsExistingFont) {
        setSiteProfileGoogleFontStatus("loading")
        try {
          await fontaraConnector.prepareGoogleFont(siteProfileFontInput)
          setSiteProfileGoogleFontStatus("idle")
        } catch (error) {
          setSiteProfileGoogleFontStatus("error")
          toast({
            title: t("fontSelector.googleDownloadFailed"),
            ...(typeof __DEBUG__ !== "undefined" &&
            __DEBUG__ &&
            error instanceof Error
              ? { description: error.message }
              : {})
          })
          return
        }
      }

      const nextProfile: SiteProfile = {
        pattern,
        ...(siteProfileFontInput ? { font: siteProfileFontInput } : {}),
        ...(siteProfileUsesGlobalStroke
          ? {}
          : { textStroke: normalizeTextStrokeValue(siteProfileTextStroke) })
      }
      try {
        // A download can finish after another profile changed. Merge into the
        // latest hook snapshot rather than the one captured before the download.
        await setSiteProfiles((current) => {
          const existingProfile = current.find(
            (profile) => profile.pattern === pattern
          )
          return upsertSiteProfile(current, {
            ...nextProfile,
            ...(existingProfile?.enabled === false ? { enabled: false } : {})
          })
        })
        resetSiteProfileForm()
      } catch (error) {
        toast({
          title:
            error instanceof Error
              ? error.message
              : t("options.toast.siteSettingsError")
        })
      }
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const handleSiteProfileSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    void handleSaveSiteProfile()
  }

  const handleEditSiteProfile = (profile: SiteProfile) => {
    selectSiteProfileTarget(profile.pattern)
    setSiteProfileFontInput(profile.font ?? "")
    setSiteProfileTextStroke(profile.textStroke ?? textStroke)
    setSiteProfileUsesGlobalStroke(profile.textStroke === undefined)
  }

  const handleRemoveSiteProfile = async (pattern: string) => {
    try {
      await setSiteProfiles((current) => removeSiteProfile(current, pattern))
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleSiteProfileEnabledToggle = async (
    profile: SiteProfile,
    checked: boolean
  ) => {
    const nextProfile = {
      ...profile
    }

    if (checked) {
      delete nextProfile.enabled
    } else {
      nextProfile.enabled = false
    }

    try {
      await setSiteProfiles(
        upsertSiteProfile(normalizedSiteProfiles, nextProfile)
      )
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
  const formattedSiteProfileTextStroke = formatTextStrokeDisplay(
    siteProfileTextStroke
  )
  return {
    canAddSiteProfileTarget,
    formattedSiteProfileTextStroke,
    formatTextStrokeDisplay,
    handleAddSiteProfileTarget,
    handleEditSiteProfile,
    handleRemoveSiteProfile,
    handleSaveSiteProfile,
    handleSiteProfileEnabledToggle,
    handleSiteProfileSubmit,
    isSaving,
    normalizedSiteProfiles,
    resetSiteProfileForm,
    selectSiteProfileTarget,
    selectedSiteProfilePattern,
    selectedSiteProfileScope,
    selectedSiteProfileTarget,
    setSiteProfileFontInput,
    setSiteProfileFontPickerOpen,
    setSiteProfileGoogleFontStatus,
    setSiteProfileTargetOpen,
    setSiteProfileTargetSearch,
    setSiteProfileTextStroke,
    setSiteProfileUsesGlobalStroke,
    siteFontOptionGroups,
    siteFontOptions,
    getSiteProfileFontLabel,
    siteProfileAddTargetPattern,
    siteProfileFontInput,
    siteProfileFontPickerOpen,
    siteProfileGoogleFontStatus,
    siteProfileTargetOpen,
    siteProfileTargetOptions,
    siteProfileTargetSearch,
    siteProfileTextStroke,
    siteProfileUsesGlobalStroke
  }
}
