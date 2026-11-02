import { Settings } from "lucide-react"
import React, { useState } from "react"
import type { RtlSiteSettings } from "../../config/rtl-sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { CustomFontFamily } from "../../custom-font-types"
import type { WebsiteItem } from "../../definitions"
import { useExtensionData } from "../hooks/use-extension-data"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useDebouncedStorageValue, useStorageValue } from "../hooks/use-storage"
import { useToast } from "../hooks/use-toast"
import { useI18n } from "../i18n"
import {
  EMPTY_CUSTOM_FONT_LIST,
  EMPTY_WEBSITE_LIST,
  getContextMenusEnabledInitialValue,
  getDisabledForInitialValue,
  getEnabledByDefaultInitialValue,
  getEnabledForInitialValue,
  getGoogleFontsEnabledInitialValue,
  getPinnedWebsiteUrlsInitialValue,
  getRtlEnabledInitialValue,
  getRtlSiteSettingsInitialValue,
  getSyncSettingsInitialValue,
  getSystemFontsEnabledInitialValue,
  getTextStrokeInitialValue
} from "../storage-defaults"
import {
  getSettingsSectionFromHash,
  type SettingsSection,
  type SiteSettingsTab,
  settingsNavigation
} from "./options-navigation"

export function useOptionsState() {
  useSelectedUIFont()

  const {
    direction,
    formatNumber,
    formatVersion,
    language,
    preference,
    setPreference,
    t
  } = useI18n()

  const extensionData = useExtensionData()

  const currentTab = extensionData?.activeTab ?? null

  const [uiReady, setUiReady] = useState(false)

  const [extensionEnabled, setExtensionEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    DEFAULT_VALUES.EXTENSION_ENABLED
  )

  const [customFontList] = useStorageValue<CustomFontFamily[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )

  const [selectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_VALUES.SELECTED_FONT
  )

  const [systemFontsEnabled, setSystemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )

  const [googleFontsEnabled, setGoogleFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
    getGoogleFontsEnabledInitialValue
  )

  const [textStroke, setTextStroke, flushTextStroke] =
    useDebouncedStorageValue<number>(
      STORAGE_KEYS.TEXT_STROKE,
      getTextStrokeInitialValue
    )

  const [websiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
  )

  const [pinnedWebsiteUrls, setPinnedWebsiteUrls] = useStorageValue<string[]>(
    STORAGE_KEYS.PINNED_WEBSITE_URLS,
    getPinnedWebsiteUrlsInitialValue
  )

  const [enabledByDefault, setEnabledByDefault] = useStorageValue<boolean>(
    STORAGE_KEYS.ENABLED_BY_DEFAULT,
    getEnabledByDefaultInitialValue
  )

  const [enabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.ENABLED_FOR,
    getEnabledForInitialValue
  )

  const [disabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.DISABLED_FOR,
    getDisabledForInitialValue
  )

  const [rtlEnabled, setRtlEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.RTL_ENABLED,
    getRtlEnabledInitialValue
  )

  const [rtlSiteSettings, setRtlSiteSettings] =
    useStorageValue<RtlSiteSettings>(
      STORAGE_KEYS.RTL_SITE_SETTINGS,
      getRtlSiteSettingsInitialValue
    )

  const [syncSettings, setSyncSettings] = useStorageValue<boolean>(
    STORAGE_KEYS.SYNC_SETTINGS,
    getSyncSettingsInitialValue
  )

  const [contextMenusEnabled, setContextMenusEnabled] =
    useStorageValue<boolean>(
      STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
      getContextMenusEnabledInitialValue
    )

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    getSettingsSectionFromHash
  )

  const [siteSettingsTab, setSiteSettingsTab] =
    useState<SiteSettingsTab>("access")

  const activeNavigation = settingsNavigation.find(
    (item) => item.id === activeSection
  )

  const ActiveSectionIcon = activeNavigation?.icon ?? Settings

  const sidebarSide: "left" | "right" = direction === "rtl" ? "right" : "left"

  React.useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(getSettingsSectionFromHash())
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section)
    const nextHash = `#${section}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash)
    }
  }

  const { toast } = useToast()

  React.useEffect(() => {
    document.title = t("common.settings")
  }, [t])

  React.useEffect(() => {
    if (!extensionData) {
      setUiReady(false)
      return
    }

    const frame = requestAnimationFrame(() => setUiReady(true))
    return () => cancelAnimationFrame(frame)
  }, [extensionData])
  return {
    direction,
    formatNumber,
    formatVersion,
    language,
    preference,
    setPreference,
    t,
    currentTab,
    uiReady,
    extensionEnabled,
    setExtensionEnabled,
    customFontList,
    selectedFont,
    systemFontsEnabled,
    setSystemFontsEnabled,
    googleFontsEnabled,
    setGoogleFontsEnabled,
    textStroke,
    setTextStroke,
    flushTextStroke,
    websiteList,
    pinnedWebsiteUrls,
    setPinnedWebsiteUrls,
    enabledByDefault,
    setEnabledByDefault,
    enabledFor,
    disabledFor,
    rtlEnabled,
    setRtlEnabled,
    rtlSiteSettings,
    setRtlSiteSettings,
    syncSettings,
    setSyncSettings,
    contextMenusEnabled,
    setContextMenusEnabled,
    activeSection,
    siteSettingsTab,
    setSiteSettingsTab,
    activeNavigation,
    ActiveSectionIcon,
    sidebarSide,
    handleSectionChange,
    toast
  }
}

export type OptionsState = ReturnType<typeof useOptionsState>
