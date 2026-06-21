import {
  AlignRight,
  Check,
  ChevronsUpDown,
  Cloud,
  Download,
  FileDown,
  FileText,
  FileUp,
  Globe2,
  HardDrive,
  Info,
  Keyboard,
  Languages,
  ListChecks,
  Menu,
  Pin,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  Upload
} from "lucide-react"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { version } from "../../../package.json"
import {
  CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE,
  CUSTOM_FONT_UNICODE_RANGE_PRESETS,
  type CustomFontUnicodeRangePresetId,
  DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET,
  getCustomFontUnicodeRangePreset,
  normalizeCustomFontUnicodeRange,
  parseCustomFontUnicodeRangeInput
} from "../../config/font-unicode-range"
import { DEFAULT_FONTS, type DefaultFont } from "../../config/fonts"
import {
  type SupportedUILanguage,
  UI_LANGUAGE_AUTO,
  type UILanguagePreference
} from "../../config/i18n"
import {
  isRtlSiteEnabled,
  normalizeRtlSiteSettings,
  RTL_SUPPORTED_SITES,
  type RtlSiteConfig,
  type RtlSiteSettings
} from "../../config/rtl-sites"
import {
  createSiteListPatternAddUpdate,
  createSitePathPatternFromUrl,
  createSitePatternFromUrl,
  createWebsiteSiteListToggleUpdate,
  getDisplaySitePattern,
  getMatchingSiteListPattern,
  getSitePatternScope,
  getWebsiteSitePattern,
  inferSitePatternScopeFromInput,
  isSiteListUrlEnabled,
  isURLMatched,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList,
  normalizeSitePattern,
  normalizeSitePatternForScope,
  removeSitePatternFromList,
  type SitePatternScope
} from "../../config/site-list"
import {
  isSiteProfileEnabled,
  normalizeSiteProfiles,
  removeSiteProfile,
  removeSiteProfileFontOverrides,
  upsertSiteProfile
} from "../../config/site-profiles"
import { normalizePinnedWebsiteUrls } from "../../config/sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import {
  normalizeTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
import type { FontData, SiteProfile, WebsiteItem } from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import { createCustomFontDeletionUpdate } from "../../utils/custom-fonts"
import {
  getFontDataURLFormat,
  getFontFileExtension,
  isFontFileSignatureSupported,
  isSupportedFontExtension,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  normalizeFontDataURL
} from "../../utils/font-data"
import {
  getGoogleFontByValue,
  getGoogleFontList,
  isGoogleFontValue
} from "../../utils/google-fonts"
import {
  createSettingsBackup,
  createSettingsBackupFileName,
  FONTARA_SETTINGS_STORAGE_KEYS,
  getSettingsBackupDefaults,
  parseSettingsBackupText
} from "../../utils/settings-backup"
import { getLocalValues } from "../../utils/storage"
import { normalizeStorageValues } from "../../utils/storage-normalization"
import {
  decodeSystemFontValue,
  getSystemFontList,
  isSystemFontAccessSupported,
  isSystemFontValue,
  type SystemFontData
} from "../../utils/system-fonts"
import ErrorBoundary from "../components/ErrorBoundary"
import { HotkeysSettings } from "../components/HotkeysSettings"
import { SiteModeBadge } from "../components/SiteModeBadge"
import { SiteScopeBadge } from "../components/SiteScopeBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "../components/ui/alert-dialog"
import { Button } from "../components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "../components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "../components/ui/popover"
import { Switch } from "../components/ui/Switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "../components/ui/sidebar"
import { ToastProvider } from "../components/ui/Toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table"
import { Toaster } from "../components/ui/toaster"
import { fontaraConnector } from "../connect/connector"
import {
  ExtensionDataProvider,
  useExtensionData
} from "../hooks/use-extension-data"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useStorageValue } from "../hooks/use-storage"
import { useToast } from "../hooks/use-toast"
import { I18nProvider, useI18n, waitForI18nBootstrap } from "../i18n"
import type { MessageKey } from "../i18n/messages"
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
  getSiteProfilesInitialValue,
  getSyncSettingsInitialValue,
  getSystemFontsEnabledInitialValue,
  getTextStrokeInitialValue
} from "../storage-defaults"

type SettingsSection =
  | "general"
  | "fonts"
  | "sites"
  | "rtl"
  | "hotkeys"
  | "advanced"

const settingsNavigation: Array<{
  id: SettingsSection
  labelKey: MessageKey
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "general", labelKey: "options.nav.general", icon: Settings },
  { id: "fonts", labelKey: "options.nav.fonts", icon: Type },
  { id: "sites", labelKey: "options.nav.sites", icon: ListChecks },
  { id: "rtl", labelKey: "options.nav.rtl", icon: AlignRight },
  { id: "hotkeys", labelKey: "options.nav.hotkeys", icon: Keyboard },
  { id: "advanced", labelKey: "options.nav.advanced", icon: SlidersHorizontal }
]

const sectionDescriptionKeys: Record<SettingsSection, MessageKey> = {
  general: "options.section.general.description",
  fonts: "options.section.fonts.description",
  sites: "options.section.sites.description",
  rtl: "options.section.rtl.description",
  hotkeys: "options.section.hotkeys.description",
  advanced: "options.section.advanced.description"
}

function getSettingsSectionFromHash(): SettingsSection {
  const hashSection = window.location.hash.replace(/^#/, "")
  return settingsNavigation.some((item) => item.id === hashSection)
    ? (hashSection as SettingsSection)
    : "general"
}

const languageOptions: Array<{
  descriptionKey: MessageKey
  labelKey: MessageKey
  value: UILanguagePreference
}> = [
  {
    value: UI_LANGUAGE_AUTO,
    labelKey: "language.auto",
    descriptionKey: "language.autoDescription"
  },
  {
    value: "fa",
    labelKey: "language.fa",
    descriptionKey: "language.faDescription"
  },
  {
    value: "en",
    labelKey: "language.en",
    descriptionKey: "language.enDescription"
  },
  {
    value: "ar",
    labelKey: "language.ar",
    descriptionKey: "language.arDescription"
  }
]

const sitePatternScopeOptions: Array<{
  labelKey: MessageKey
  value: SitePatternScope
}> = [
  { value: "domain", labelKey: "options.siteList.scopeDomain" },
  { value: "path", labelKey: "options.siteList.scopePath" },
  { value: "custom", labelKey: "options.siteList.scopeCustom" },
  { value: "regex", labelKey: "options.siteList.scopeRegex" }
]

const sitePatternPlaceholderKeys = {
  custom: "options.siteList.wildcardPlaceholder",
  domain: "options.siteList.placeholder",
  path: "options.siteList.pathPlaceholder",
  regex: "options.siteList.regexPlaceholder"
} satisfies Record<SitePatternScope, MessageKey>

type SiteFontOption = {
  label: string
  value: string
}

type SiteFontOptionGroup = {
  label: string
  options: SiteFontOption[]
}

type SiteProfileTargetOption = {
  iconUrl?: string
  id: string
  pattern: string
  subtitle?: string
  title: string
}

type CustomFontUnicodeRangeSelectValue =
  | CustomFontUnicodeRangePresetId
  | typeof CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE

const unicodeRangeLabelKeys = {
  all: "options.addFont.unicodeRangePreset.all",
  "arabic-persian": "options.addFont.unicodeRangePreset.arabicPersian",
  cjk: "options.addFont.unicodeRangePreset.cjk",
  custom: "options.addFont.unicodeRangePreset.custom",
  cyrillic: "options.addFont.unicodeRangePreset.cyrillic",
  devanagari: "options.addFont.unicodeRangePreset.devanagari",
  greek: "options.addFont.unicodeRangePreset.greek",
  hebrew: "options.addFont.unicodeRangePreset.hebrew",
  latin: "options.addFont.unicodeRangePreset.latin",
  "latin-arabic": "options.addFont.unicodeRangePreset.latinArabic",
  thai: "options.addFont.unicodeRangePreset.thai"
} satisfies Record<CustomFontUnicodeRangeSelectValue, MessageKey>

function getLanguageLabelKey(language: SupportedUILanguage): MessageKey {
  switch (language) {
    case "fa":
      return "language.fa"
    case "ar":
      return "language.ar"
    case "en":
      return "language.en"
  }
}

function formatBytes(
  bytes: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  kilobyteUnit: string,
  megabyteUnit: string
): string {
  if (bytes <= 0) return `${formatNumber(0)} ${kilobyteUnit}`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${formatNumber(kilobytes, {
      maximumFractionDigits: 1
    })} ${kilobyteUnit}`
  }

  return `${formatNumber(kilobytes / 1024, {
    maximumFractionDigits: 1
  })} ${megabyteUnit}`
}

function getDefaultFontLabel(
  font: DefaultFont,
  language: SupportedUILanguage
): string {
  return font.localizedName[language] || font.name
}

const CONTEXT_MENU_PERMISSION = "contextMenus"

function isFirefoxBrowser(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox")
}

function requestContextMenusPermission(): Promise<boolean> {
  if (isFirefoxBrowser() || !chrome.permissions?.request) {
    return Promise.resolve(true)
  }

  return new Promise((resolve, reject) => {
    chrome.permissions.request(
      { permissions: [CONTEXT_MENU_PERMISSION] },
      (hasPermission) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(hasPermission)
      }
    )
  })
}

function downloadTextFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function readTextFile(file: File): Promise<string> {
  return file.text()
}

function createCustomCssProbeUrl(
  website: WebsiteItem,
  normalizedPattern: string
): string {
  if (getSitePatternScope(normalizedPattern) === "regex") return website.url

  const slashIndex = normalizedPattern.indexOf("/")
  if (slashIndex < 0) return website.url

  const path = normalizedPattern
    .slice(slashIndex + 1)
    .split("/")
    .map((part) => (part === "*" ? "__fontara__" : part.replace(/\*/g, "")))
    .filter(Boolean)
    .join("/")

  if (!path) return website.url

  try {
    const url = new URL(website.url)
    url.pathname = `/${path}`
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return website.url
  }
}

function OptionsPage() {
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
  const currentTab = useExtensionData()?.activeTab ?? null

  const [customFontList, setCustomFontList] = useStorageValue<FontData[]>(
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
  const [textStroke, setTextStroke] = useStorageValue<number>(
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
  const [siteProfiles, setSiteProfiles] = useStorageValue<SiteProfile[]>(
    STORAGE_KEYS.SITE_PROFILES,
    getSiteProfilesInitialValue
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
  const activeNavigation = settingsNavigation.find(
    (item) => item.id === activeSection
  )
  const ActiveSectionIcon = activeNavigation?.icon ?? Settings
  const sidebarSide = direction === "rtl" ? "right" : "left"

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

  const fontUtils = {
    generateFileHash: async (fileBytes: Uint8Array) => {
      const buffer = new ArrayBuffer(fileBytes.byteLength)
      new Uint8Array(buffer).set(fileBytes)
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    },
    isFileContentDuplicate: (fileHash: string) => {
      return customFontList.some(
        (customFont) => customFont.fileHash === fileHash
      )
    },
    convertToBase64: (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve(reader.result)
          } else {
            reject(new Error(t("options.toast.fontProcessingError")))
          }
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    }
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const settingsImportInputRef = React.useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBackupBusy, setIsBackupBusy] = useState(false)
  const [isImportWarningVisible, setIsImportWarningVisible] = useState(false)
  const [isResetWarningVisible, setIsResetWarningVisible] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileHash, setSelectedFileHash] = useState("")
  const [fontName, setFontName] = useState("")
  const [fontUnicodeRangePreset, setFontUnicodeRangePreset] =
    useState<CustomFontUnicodeRangeSelectValue>(
      DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET
    )
  const [customFontUnicodeRange, setCustomFontUnicodeRange] = useState("")
  const [sitePatternScope, setSitePatternScope] =
    useState<SitePatternScope>("domain")
  const [sitePatternInput, setSitePatternInput] = useState("")
  const [siteProfilePatternInput, setSiteProfilePatternInput] = useState("")
  const [siteProfileTargetSearch, setSiteProfileTargetSearch] = useState("")
  const [siteProfileTargetOpen, setSiteProfileTargetOpen] = useState(false)
  const [siteProfileFontInput, setSiteProfileFontInput] = useState("")
  const [siteProfileTextStroke, setSiteProfileTextStroke] = useState(
    DEFAULT_VALUES.TEXT_STROKE
  )
  const [siteProfileUsesGlobalStroke, setSiteProfileUsesGlobalStroke] =
    useState(true)
  const [systemFontList, setSystemFontList] = useState<SystemFontData[]>([])
  const systemFontsSupported = isSystemFontAccessSupported()
  const { toast } = useToast()

  React.useEffect(() => {
    document.title = t("common.settings")
  }, [t])

  React.useEffect(() => {
    let cancelled = false

    if (!systemFontsSupported || !systemFontsEnabled) {
      setSystemFontList([])
      return () => {
        cancelled = true
      }
    }

    getSystemFontList()
      .then((fonts) => {
        if (!cancelled) {
          setSystemFontList(fonts)
        }
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to load system fonts for site profiles.", error)
        }
        if (!cancelled) {
          setSystemFontList([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [systemFontsEnabled, systemFontsSupported])

  const resetSelectedFile = () => {
    setSelectedFile(null)
    setSelectedFileHash("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const resetCustomFontForm = () => {
    resetSelectedFile()
    setFontName("")
    setFontUnicodeRangePreset(DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET)
    setCustomFontUnicodeRange("")
  }

  const resolveSelectedFontUnicodeRange = (): string | null | undefined => {
    if (fontUnicodeRangePreset === CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE) {
      const normalizedRange = parseCustomFontUnicodeRangeInput(
        customFontUnicodeRange
      )

      return normalizedRange || undefined
    }

    return getCustomFontUnicodeRangePreset(fontUnicodeRangePreset)?.unicodeRange
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = getFontFileExtension(file.name)

    if (!isSupportedFontExtension(extension)) {
      toast({
        title: t("options.toast.invalidExtension")
      })
      resetSelectedFile()
      return
    }

    if (file.size > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
      toast({ title: t("options.toast.fileTooLarge") })
      resetSelectedFile()
      return
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer())
    if (!isFontFileSignatureSupported(extension, fileBytes)) {
      toast({ title: t("options.toast.invalidSignature") })
      resetSelectedFile()
      return
    }

    const fileHash = await fontUtils.generateFileHash(fileBytes)
    const isDuplicate = fontUtils.isFileContentDuplicate(fileHash)

    if (isDuplicate) {
      toast({ title: t("options.toast.duplicateFile") })
      resetSelectedFile()
      return
    }

    setSelectedFile(file)
    setSelectedFileHash(fileHash)
  }

  const handleSaveFont = async () => {
    const normalizedFontName = fontName.trim()
    const unicodeRange = resolveSelectedFontUnicodeRange()

    if (!selectedFile || !normalizedFontName) {
      toast({ title: t("options.toast.emptyFields") })
      return
    }

    if (unicodeRange === undefined) {
      toast({ title: t("options.toast.invalidUnicodeRange") })
      return
    }

    setIsLoading(true)

    try {
      const isDuplicateName = customFontList.some((font) => {
        return (
          (font.name.toLowerCase().trim() || "") ===
          normalizedFontName.toLowerCase()
        )
      })

      if (isDuplicateName) {
        throw new Error(t("options.toast.duplicateFontName"))
      }

      const fileHash =
        selectedFileHash ||
        (await fontUtils.generateFileHash(
          new Uint8Array(await selectedFile.arrayBuffer())
        ))
      if (fontUtils.isFileContentDuplicate(fileHash)) {
        throw new Error(t("options.toast.duplicateFile"))
      }

      const base64Data = await fontUtils.convertToBase64(selectedFile)
      const extension = getFontFileExtension(selectedFile.name)
      const normalizedDataURL = normalizeFontDataURL(base64Data, extension)
      if (!normalizedDataURL || !getFontDataURLFormat(normalizedDataURL)) {
        throw new Error(t("options.toast.invalidFontFile"))
      }

      const suffix = "-Fontara"
      let value: string

      do {
        const chars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        let prefix = ""
        for (let i = 0; i < 6; i++) {
          prefix += chars[Math.floor(Math.random() * chars.length)]
        }
        value = prefix + suffix
      } while (customFontList.some((font) => font.value === value))

      const fontData: FontData = {
        value: value,
        name: normalizedFontName,
        data: normalizedDataURL,
        fileHash: fileHash,
        type: extension,
        originalFileName: selectedFile.name,
        unicodeRange
      }

      const updatedFonts = [...customFontList, fontData]
      await setCustomFontList(updatedFonts)

      toast({ title: t("options.toast.fontAdded") })

      resetCustomFontForm()
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.fontProcessingError")
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFont = async (fontValue: string) => {
    try {
      const storageUpdate = createCustomFontDeletionUpdate(
        customFontList,
        fontValue,
        selectedFont,
        siteProfiles
      )
      await fontaraConnector.changeSettings(storageUpdate)
      toast({ title: t("options.toast.fontDeleted") })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.fontDeleteError")
      })
    }
  }

  const handleExportSettings = async () => {
    setIsBackupBusy(true)

    try {
      const settings = await normalizeStorageValues(
        await getLocalValues(getSettingsBackupDefaults())
      )
      const backup = createSettingsBackup(settings, {
        extensionVersion: version
      })
      downloadTextFile(
        createSettingsBackupFileName(),
        JSON.stringify(backup, null, 2)
      )
      toast({
        title: t("options.toast.settingsExported"),
        description: t("options.toast.settingsExportedDescription", {
          count: formatNumber(FONTARA_SETTINGS_STORAGE_KEYS.length)
        })
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to export FontAra settings.", error)
      }
      toast({ title: t("options.toast.settingsExportError") })
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handleChooseSettingsImportFile = () => {
    settingsImportInputRef.current?.click()
  }

  const handleSettingsImportFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    setIsBackupBusy(true)

    try {
      const parsedBackup = parseSettingsBackupText(await readTextFile(file))
      const importedSettings = await fontaraConnector.importSettings(
        parsedBackup.settings
      )
      setIsImportWarningVisible(false)
      toast({
        title: t("options.toast.settingsImported"),
        description: t("options.toast.settingsImportedDescription", {
          count: formatNumber(importedSettings.importedKeyCount)
        })
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to import FontAra settings.", error)
      }
      toast({
        title: t("options.toast.settingsImportError"),
        description: t("options.toast.settingsImportInvalid")
      })
    } finally {
      setIsBackupBusy(false)
      input.value = ""
    }
  }

  const handleResetSettings = async () => {
    setIsBackupBusy(true)

    try {
      await fontaraConnector.resetSettings()
      setIsImportWarningVisible(false)
      setIsResetWarningVisible(false)
      toast({ title: t("options.toast.settingsReset") })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to reset FontAra settings.", error)
      }
      toast({ title: t("options.toast.settingsResetError") })
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handleSyncSettingsToggle = async (checked: boolean) => {
    try {
      await setSyncSettings(checked)
      toast({
        title: checked
          ? t("options.toast.syncEnabled")
          : t("options.toast.syncDisabled")
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update FontAra sync settings.", error)
      }
      toast({ title: t("options.toast.syncError") })
    }
  }

  const handleContextMenusToggle = async (checked: boolean) => {
    try {
      if (checked && !(await requestContextMenusPermission())) {
        toast({ title: t("options.toast.contextMenusPermissionDenied") })
        return
      }

      await setContextMenusEnabled(checked)
      toast({
        title: checked
          ? t("options.toast.contextMenusEnabled")
          : t("options.toast.contextMenusDisabled")
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update FontAra context menu setting.", error)
      }
      toast({ title: t("options.toast.contextMenusError") })
    }
  }

  const defaultWebsiteList = DEFAULT_VALUES.WEBSITE_LIST
  const normalizedPinnedWebsiteUrls = normalizePinnedWebsiteUrls(
    pinnedWebsiteUrls,
    []
  )
  const pinnedWebsiteUrlSet = new Set(normalizedPinnedWebsiteUrls)
  const normalizedEnabledByDefault = normalizeEnabledByDefault(enabledByDefault)
  const normalizedEnabledFor = normalizeEnabledSiteList(enabledFor)
  const normalizedDisabledFor = normalizeSiteList(disabledFor)
  const siteListSettings = {
    disabledFor: normalizedDisabledFor,
    enabledByDefault: normalizedEnabledByDefault,
    enabledFor: normalizedEnabledFor
  }
  const normalizedSiteProfiles = normalizeSiteProfiles(siteProfiles)
  const managedSiteList = normalizedEnabledByDefault
    ? normalizedDisabledFor
    : normalizedEnabledFor
  const trimmedSitePatternInput = sitePatternInput.trim()
  const normalizedSitePatternInput = normalizeSitePatternForScope(
    sitePatternInput,
    sitePatternScope
  )
  const hasSitePatternInput = trimmedSitePatternInput.length > 0
  const currentTabDomainPattern = currentTab?.url
    ? createSitePatternFromUrl(currentTab.url)
    : null
  const currentTabPathPattern = currentTab?.url
    ? createSitePathPatternFromUrl(currentTab.url)
    : null
  const currentTabHasPathPattern =
    Boolean(currentTabPathPattern) &&
    Boolean(currentTabDomainPattern) &&
    currentTabPathPattern !== currentTabDomainPattern
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
  const activeWebsiteCount = defaultWebsiteList.filter((website) =>
    isSiteListUrlEnabled(website.url, siteListSettings)
  ).length
  const cssOnlyWebsiteCount = defaultWebsiteList.filter(
    (website) => website.customCss === true
  ).length
  const normalizedRtlSiteSettings = normalizeRtlSiteSettings(rtlSiteSettings)
  const activeRtlSiteCount =
    rtlEnabled === false
      ? 0
      : RTL_SUPPORTED_SITES.filter((site) =>
          isRtlSiteEnabled(normalizedRtlSiteSettings, site.id)
        ).length

  const fontStorageBytes = customFontList.reduce((total, font) => {
    return total + new Blob([font.data]).size
  }, 0)
  const googleFontList = React.useMemo(
    () => (googleFontsEnabled ? getGoogleFontList() : []),
    [googleFontsEnabled]
  )
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
          label: font.name,
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

  const getSiteProfileFontLabel = React.useCallback(
    (fontValue: string | undefined): string => {
      if (!fontValue) return t("options.siteProfiles.globalFont")

      const option = siteFontOptions.find((font) => font.value === fontValue)
      if (option) return option.label

      const systemFont = decodeSystemFontValue(fontValue)
      if (systemFont) return systemFont

      const googleFont = getGoogleFontByValue(fontValue)
      if (googleFont) return googleFont.family

      return fontValue
    },
    [siteFontOptions, t]
  )
  const getCustomFontUnicodeRangeLabel = React.useCallback(
    (unicodeRange: string | null | undefined): string => {
      const normalizedRange = normalizeCustomFontUnicodeRange(unicodeRange)
      const matchingPreset = CUSTOM_FONT_UNICODE_RANGE_PRESETS.find(
        (preset) => preset.unicodeRange === normalizedRange
      )

      if (matchingPreset) {
        return t(unicodeRangeLabelKeys[matchingPreset.id])
      }

      return t("options.savedFonts.unicodeRangeCustom")
    },
    [t]
  )

  const handleWebsiteToggle = async (website: WebsiteItem) => {
    const currentWebsiteList =
      websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
    const active = isWebsiteActive(website)
    const existingWebsiteIndex = currentWebsiteList.findIndex(
      (item) => item.url === website.url
    )
    const updatedWebsiteList =
      existingWebsiteIndex === -1
        ? [...currentWebsiteList, { ...website, isActive: !active }]
        : currentWebsiteList.map((item, index) =>
            index === existingWebsiteIndex
              ? { ...item, isActive: !active }
              : item
          )
    const siteListUpdate = createWebsiteSiteListToggleUpdate(
      website,
      siteListSettings,
      !active
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
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

  const handleWebsitePinToggle = async (website: WebsiteItem) => {
    try {
      await setPinnedWebsiteUrls((currentPinnedUrls) => {
        const nextPinnedUrlSet = new Set(
          normalizePinnedWebsiteUrls(currentPinnedUrls, [])
        )

        if (nextPinnedUrlSet.has(website.url)) {
          nextPinnedUrlSet.delete(website.url)
        } else {
          nextPinnedUrlSet.add(website.url)
        }

        return defaultWebsiteList
          .map((defaultWebsite) => defaultWebsite.url)
          .filter((url) => nextPinnedUrlSet.has(url))
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

  const isWebsiteActive = (website: WebsiteItem) => {
    return isSiteListUrlEnabled(website.url, siteListSettings)
  }

  const isWebsitePinned = (website: WebsiteItem) => {
    return pinnedWebsiteUrlSet.has(website.url)
  }

  const getWebsiteCardPattern = (website: WebsiteItem) => {
    const enabledPattern = getMatchingSiteListPattern(
      website.url,
      normalizedEnabledFor
    )
    if (enabledPattern) return enabledPattern

    const disabledPattern = getMatchingSiteListPattern(
      website.url,
      normalizedDisabledFor
    )
    return disabledPattern ?? getWebsiteSitePattern(website)
  }

  const getWebsiteCardTitle = (
    website: WebsiteItem,
    pattern: string | null
  ) => {
    return website.siteName || getDisplaySitePattern(pattern ?? website.url)
  }

  const hasCustomCssForSitePattern = (pattern: string) => {
    const normalizedPattern = normalizeSitePattern(pattern)
    if (!normalizedPattern) return false

    return defaultWebsiteList.some((website) => {
      if (website.customCss !== true) return false

      return (
        isURLMatched(website.url, normalizedPattern) ||
        isURLMatched(
          createCustomCssProbeUrl(website, normalizedPattern),
          normalizedPattern
        )
      )
    })
  }

  const handleSiteListModeChange = async (nextEnabledByDefault: boolean) => {
    try {
      await setEnabledByDefault(nextEnabledByDefault)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleAddSitePattern = async () => {
    const pattern = normalizedSitePatternInput

    if (!pattern) {
      toast({ title: t("options.toast.invalidSitePattern") })
      return
    }

    const siteListUpdate = createSiteListPatternAddUpdate(
      pattern,
      siteListSettings
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor
      })
      setSitePatternInput("")
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleRemoveSitePattern = async (pattern: string) => {
    const listKey = normalizedEnabledByDefault
      ? STORAGE_KEYS.DISABLED_FOR
      : STORAGE_KEYS.ENABLED_FOR
    const updatedList = removeSitePatternFromList(managedSiteList, pattern)

    try {
      await fontaraConnector.changeSettings({ [listKey]: updatedList })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleSitePatternSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    void handleAddSitePattern()
  }

  const handleSitePatternInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value
    setSitePatternInput(nextValue)
    setSitePatternScope(
      inferSitePatternScopeFromInput(nextValue, sitePatternScope)
    )
  }

  const fillSitePatternFromCurrentTab = (scope: SitePatternScope) => {
    if (!currentTab?.url) return

    const pattern =
      scope === "path"
        ? createSitePathPatternFromUrl(currentTab.url)
        : createSitePatternFromUrl(currentTab.url)

    if (!pattern) return

    setSitePatternScope(scope)
    setSitePatternInput(
      scope === "path" ? getDisplaySitePattern(pattern) : pattern
    )
  }

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
    setSiteProfileTextStroke(DEFAULT_VALUES.TEXT_STROKE)
    setSiteProfileUsesGlobalStroke(true)
  }

  const handleSaveSiteProfile = async () => {
    const pattern = selectedSiteProfilePattern

    if (!pattern) {
      toast({ title: t("options.toast.invalidSitePattern") })
      return
    }

    if (
      siteProfileFontInput &&
      !siteFontOptions.some((font) => font.value === siteProfileFontInput)
    ) {
      toast({ title: t("options.toast.unavailableSiteProfileFont") })
      return
    }

    if (!siteProfileFontInput && siteProfileUsesGlobalStroke) {
      toast({ title: t("options.toast.emptySiteProfile") })
      return
    }

    const existingProfile = normalizedSiteProfiles.find(
      (profile) => profile.pattern === pattern
    )
    const nextProfile: SiteProfile = {
      pattern,
      ...(existingProfile?.enabled === false ? { enabled: false } : {}),
      ...(siteProfileFontInput ? { font: siteProfileFontInput } : {}),
      ...(siteProfileUsesGlobalStroke
        ? {}
        : { textStroke: normalizeTextStrokeValue(siteProfileTextStroke) })
    }
    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.SITE_PROFILES]: upsertSiteProfile(
          normalizedSiteProfiles,
          nextProfile
        )
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
      await setSiteProfiles(removeSiteProfile(normalizedSiteProfiles, pattern))
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

  const handleSystemFontsToggle = async (checked: boolean) => {
    try {
      if (!checked) {
        await fontaraConnector.changeSettings({
          [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false,
          [STORAGE_KEYS.SITE_PROFILES]: removeSiteProfileFontOverrides(
            normalizedSiteProfiles,
            isSystemFontValue
          ),
          ...(isSystemFontValue(selectedFont)
            ? { [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT }
            : {})
        })
        return
      }

      if (!isSystemFontAccessSupported()) {
        toast({ title: t("options.toast.systemFontsUnsupported") })
        return
      }

      const fonts = await getSystemFontList()
      if (fonts.length === 0) {
        toast({ title: t("options.toast.systemFontsUnsupported") })
        return
      }

      await setSystemFontsEnabled(true)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleGoogleFontsToggle = async (checked: boolean) => {
    try {
      if (!checked) {
        await fontaraConnector.changeSettings({
          [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: false,
          [STORAGE_KEYS.SITE_PROFILES]: removeSiteProfileFontOverrides(
            normalizedSiteProfiles,
            isGoogleFontValue
          ),
          ...(isGoogleFontValue(selectedFont)
            ? { [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT }
            : {})
        })
        return
      }

      await setGoogleFontsEnabled(true)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
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
  const formattedSiteProfileTextStroke = formatTextStrokeDisplay(
    siteProfileTextStroke
  )
  const renderSiteProfileTargetItem = (option: SiteProfileTargetOption) => {
    const selected = selectedSiteProfilePattern === option.pattern
    const scope = getSitePatternScope(option.pattern)
    const hasCustomCss = hasCustomCssForSitePattern(option.pattern)

    return (
      <CommandItem
        key={option.id}
        value={`${option.title} ${option.subtitle ?? ""} ${option.pattern}`}
        data-testid={`fontara-site-profile-target-${option.id}`}
        className="min-h-11 cursor-pointer gap-3 px-2"
        onSelect={() => selectSiteProfileTarget(option.pattern)}>
        {option.iconUrl ? (
          <img
            alt=""
            src={option.iconUrl}
            className="size-7 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#f1f5f9] text-[#64748b]">
            <Globe2 className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <bdi
            className="block truncate text-sm font-bold text-[#111827]"
            dir="ltr"
            title={option.title}>
            {option.title}
          </bdi>
          {option.subtitle && (
            <span className="mt-0.5 block truncate text-xs text-[#64748b]">
              {option.subtitle}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <SiteScopeBadge scope={scope} />
          {hasCustomCss && <SiteModeBadge customCss />}
          {selected && <Check className="size-4 text-[#2374ff]" />}
        </span>
      </CommandItem>
    )
  }

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

  return (
    <ToastProvider>
      <div
        className="font-estedad fontara-options-page"
        dir={direction}
        lang={language}>
        <SidebarProvider>
          <Sidebar collapsible="icon" dir={direction} side={sidebarSide}>
            <SidebarHeader className="px-4 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex min-h-11 items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white shadow-[inset_0_0_0_1px_#e6edf5] group-data-[collapsible=icon]:size-8">
                  <img
                    alt=""
                    src={getExtensionAssetURL("assets/icon-active-32.png")}
                    className="size-7 shrink-0"
                  />
                </span>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <h1 className="truncate text-base font-bold text-[#111827]">
                    {t("common.appName")}
                  </h1>
                  <p className="text-xs text-[#64748b]">
                    {t("common.settings")}
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-2 py-3">
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-3">
                  {t("options.sidebar.sections")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {settingsNavigation.map((item) => {
                      const Icon = item.icon

                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={activeSection === item.id}
                            data-testid={`fontara-options-nav-${item.id}`}
                            tooltip={t(item.labelKey)}
                            onClick={() => handleSectionChange(item.id)}>
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate group-data-[collapsible=icon]:hidden">
                              {t(item.labelKey)}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-4 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex h-8 items-center gap-3 rounded-md bg-white px-3 text-xs text-[#667085] shadow-[inset_0_0_0_1px_#e6edf5] group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
                <Info className="size-4 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {t("common.version", { version: formatVersion(version) })}
                </span>
              </div>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset>
            <header className="fontara-options-header sticky top-0 z-10 flex h-[4.5rem] items-center gap-3 px-5 backdrop-blur sm:px-7">
              <SidebarTrigger className="size-9 shrink-0 rounded-md text-[#475467] hover:bg-[#eef4ff] hover:text-[#2374ff]" />
              <div className="fontara-icon-tile hidden sm:flex">
                <ActiveSectionIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#111827]">
                  {activeNavigation
                    ? t(activeNavigation.labelKey)
                    : t("common.settings")}
                </h2>
                <p className="truncate text-xs text-[#667085]">
                  {t(sectionDescriptionKeys[activeSection])}
                </p>
              </div>
            </header>

            <div className="fontara-options-content mx-auto w-full max-w-6xl space-y-5 p-5 sm:p-6 lg:p-7">
              {activeSection === "general" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <section className="fontara-panel flex items-center gap-3 p-4">
                      <div className="fontara-icon-tile">
                        <Type className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-2xl font-bold leading-none text-[#111827]">
                          {formatNumber(customFontList.length)}
                        </div>
                        <div className="mt-1 truncate text-sm text-[#667085]">
                          {t("options.status.customFonts")}
                        </div>
                      </div>
                    </section>

                    <section className="fontara-panel flex items-center gap-3 p-4">
                      <div className="fontara-icon-tile">
                        <Globe2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-2xl font-bold leading-none text-[#111827]">
                          {formatNumber(activeWebsiteCount)}
                        </div>
                        <div className="mt-1 truncate text-sm text-[#667085]">
                          {t("options.status.activeSites")}
                        </div>
                      </div>
                    </section>

                    <section className="fontara-panel flex items-center gap-3 p-4">
                      <div className="fontara-icon-tile">
                        <ListChecks className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-2xl font-bold leading-none text-[#111827]">
                          {formatNumber(cssOnlyWebsiteCount)}
                        </div>
                        <div className="mt-1 truncate text-sm text-[#667085]">
                          {t("options.status.cssOnly")}
                        </div>
                      </div>
                    </section>

                    <section className="fontara-panel flex items-center gap-3 p-4">
                      <div className="fontara-icon-tile">
                        <AlignRight className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-2xl font-bold leading-none text-[#111827]">
                          {formatNumber(activeRtlSiteCount)}
                        </div>
                        <div className="mt-1 truncate text-sm text-[#667085]">
                          {t("options.status.rtlSites")}
                        </div>
                      </div>
                    </section>
                  </div>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("language.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("language.subtitle")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <Languages className="size-5" />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {languageOptions.map((option) => {
                        const active = preference === option.value
                        const description =
                          option.value === UI_LANGUAGE_AUTO
                            ? `${t(option.descriptionKey)} ${t(
                                "language.resolved",
                                {
                                  language: t(getLanguageLabelKey(language))
                                }
                              )}`
                            : t(option.descriptionKey)

                        return (
                          <button
                            key={option.value}
                            type="button"
                            dir={direction}
                            aria-pressed={active}
                            onClick={() => void setPreference(option.value)}
                            className={cn(
                              "fontara-choice flex min-h-20 items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                              active && "border-[#b9d4ff]"
                            )}>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#111827]">
                                {t(option.labelKey)}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[#64748b]">
                                {description}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border",
                                active
                                  ? "border-[#2374ff] bg-[#2374ff] text-white"
                                  : "border-[#dbe3ef] text-transparent"
                              )}>
                              <Check className="size-4" />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "fonts" && (
                <div className="space-y-6">
                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div
                        data-active={systemFontsSupported && systemFontsEnabled}
                        className={cn(
                          "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-md border p-4 transition",
                          !systemFontsSupported && "opacity-75"
                        )}>
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="fontara-icon-tile">
                            <HardDrive className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[#111827]">
                              {t("options.systemFonts.title")}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-[#64748b]">
                              {t("options.systemFonts.description")}
                            </p>
                            <p className="mt-2 text-xs text-[#64748b]">
                              {!systemFontsSupported
                                ? t("options.systemFonts.unsupported")
                                : systemFontsEnabled
                                  ? t("options.systemFonts.enabled")
                                  : t("options.systemFonts.disabled")}
                            </p>
                          </div>
                        </div>
                        <Switch
                          dir="ltr"
                          checked={systemFontsSupported && systemFontsEnabled}
                          disabled={!systemFontsSupported}
                          onCheckedChange={(checked) =>
                            void handleSystemFontsToggle(checked)
                          }
                          aria-label={t("options.systemFonts.title")}
                        />
                      </div>

                      <div
                        data-active={googleFontsEnabled}
                        className={cn(
                          "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-md border p-4 transition"
                        )}>
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="fontara-icon-tile">
                            <Cloud className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[#111827]">
                              {t("options.googleFonts.title")}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-[#64748b]">
                              {t("options.googleFonts.description")}
                            </p>
                            <p className="mt-2 text-xs text-[#64748b]">
                              {googleFontsEnabled
                                ? t("options.googleFonts.enabled")
                                : t("options.googleFonts.disabled")}
                            </p>
                          </div>
                        </div>
                        <Switch
                          dir="ltr"
                          checked={googleFontsEnabled}
                          onCheckedChange={(checked) =>
                            void handleGoogleFontsToggle(checked)
                          }
                          aria-label={t("options.googleFonts.title")}
                        />
                      </div>

                      <div
                        data-active={textStroke > 0}
                        className={cn(
                          "fontara-choice flex min-h-36 flex-col gap-4 rounded-md border p-4 transition"
                        )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="fontara-icon-tile">
                              <Type className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-[#111827]">
                                {t("options.textStroke.title")}
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-[#64748b]">
                                {t("options.textStroke.description")}
                              </p>
                              <p className="mt-2 text-xs text-[#64748b]">
                                {textStroke > 0
                                  ? t("options.textStroke.enabled")
                                  : t("options.textStroke.disabled")}
                              </p>
                            </div>
                          </div>
                          <bdi className="shrink-0 rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#2374ff]">
                            {formattedTextStroke}
                          </bdi>
                        </div>

                        <div dir="ltr" className="space-y-2">
                          <input
                            type="range"
                            min={TEXT_STROKE_MIN}
                            max={TEXT_STROKE_MAX}
                            step={TEXT_STROKE_STEP}
                            value={textStroke}
                            onChange={(event) =>
                              void handleTextStrokeChange(
                                Number(event.currentTarget.value)
                              )
                            }
                            aria-label={t("options.textStroke.title")}
                            className="h-2 w-full cursor-pointer accent-[#2374ff]"
                          />
                          <div className="flex items-center justify-between text-[10px] font-semibold text-[#94a3b8]">
                            <span>
                              {formatNumber(TEXT_STROKE_MIN, {
                                maximumFractionDigits: 1,
                                minimumFractionDigits: 1,
                                useGrouping: false
                              })}
                            </span>
                            <span>
                              {formatNumber(TEXT_STROKE_MAX, {
                                maximumFractionDigits: 1,
                                minimumFractionDigits: 1,
                                useGrouping: false
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748b]">
                            {t("options.textStroke.value", {
                              value: formattedTextStroke
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleTextStrokeChange(0)}
                          className="h-9 rounded-md border border-[#dbe3ef] bg-white px-3 text-xs font-semibold text-[#64748b] transition hover:border-[#bfdbfe] hover:text-[#2374ff]"
                          disabled={textStroke <= TEXT_STROKE_MIN}>
                          {t("options.textStroke.reset")}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50 px-4 py-3">
                      <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <p className="text-xs leading-5 text-amber-800">
                        {t("options.googleFonts.privacyNotice")}
                      </p>
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <section className="fontara-panel p-4 sm:p-5">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">
                            {t("options.addFont.title")}
                          </h3>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {t("options.addFont.subtitle")}
                          </p>
                        </div>
                        <div className="fontara-icon-tile">
                          <Upload className="size-5" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor="custom-font-file"
                            className="mb-2 block text-sm font-medium text-[#334155]">
                            {t("options.addFont.fileLabel")}
                          </label>
                          <input
                            id="custom-font-file"
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileChange}
                            accept=".ttf,.woff,.woff2,.otf"
                            className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 py-2 text-sm text-[#334155] file:ms-3 file:rounded-md file:border-0 file:bg-[#edf3fd] file:px-3 file:py-1.5 file:text-[#2374ff]"
                            disabled={isLoading}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="custom-font-name"
                            className="mb-2 block text-sm font-medium text-[#334155]">
                            {t("options.addFont.nameLabel")}
                          </label>
                          <input
                            id="custom-font-name"
                            type="text"
                            value={fontName}
                            onChange={(event) =>
                              setFontName(event.target.value)
                            }
                            placeholder={t("options.addFont.namePlaceholder")}
                            className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
                            disabled={isLoading}
                            dir="auto"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="custom-font-unicode-range"
                            className="mb-2 block text-sm font-medium text-[#334155]">
                            {t("options.addFont.unicodeRangeLabel")}
                          </label>
                          <Select
                            dir={direction}
                            disabled={isLoading}
                            value={fontUnicodeRangePreset}
                            onValueChange={(value) =>
                              setFontUnicodeRangePreset(
                                value as CustomFontUnicodeRangeSelectValue
                              )
                            }>
                            <SelectTrigger
                              id="custom-font-unicode-range"
                              className="h-11 border-[#dbe3ef] bg-white text-sm text-[#111827] focus:ring-2 focus:ring-[#2374ff]/15">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir={direction}>
                              {CUSTOM_FONT_UNICODE_RANGE_PRESETS.map(
                                (preset) => (
                                  <SelectItem key={preset.id} value={preset.id}>
                                    {t(unicodeRangeLabelKeys[preset.id])}
                                  </SelectItem>
                                )
                              )}
                              <SelectItem
                                value={CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE}>
                                {t(
                                  unicodeRangeLabelKeys[
                                    CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE
                                  ]
                                )}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {fontUnicodeRangePreset ===
                          CUSTOM_FONT_UNICODE_RANGE_CUSTOM_VALUE && (
                          <div>
                            <label
                              htmlFor="custom-font-unicode-range-value"
                              className="mb-2 block text-sm font-medium text-[#334155]">
                              {t("options.addFont.unicodeRangeCustomLabel")}
                            </label>
                            <input
                              id="custom-font-unicode-range-value"
                              type="text"
                              value={customFontUnicodeRange}
                              onChange={(event) =>
                                setCustomFontUnicodeRange(event.target.value)
                              }
                              placeholder={t(
                                "options.addFont.unicodeRangeCustomPlaceholder"
                              )}
                              className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
                              disabled={isLoading}
                              dir="ltr"
                            />
                          </div>
                        )}

                        <Button
                          type="button"
                          onClick={handleSaveFont}
                          className="h-11 w-full bg-[#2374ff] text-white hover:bg-[#1f66df]"
                          disabled={isLoading}>
                          <Upload className="size-4" />
                          {isLoading
                            ? t("options.addFont.loading")
                            : t("options.addFont.button")}
                        </Button>
                      </div>
                    </section>

                    <section className="fontara-panel p-4 sm:p-5">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">
                            {t("options.savedFonts.title")}
                          </h3>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {t("options.customFonts.count", {
                              count: formatNumber(customFontList.length),
                              size: formatBytes(
                                fontStorageBytes,
                                formatNumber,
                                t("unit.kb"),
                                t("unit.mb")
                              )
                            })}
                          </p>
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-md bg-[#f8fafc] text-[#64748b]">
                          <FileText className="size-5" />
                        </div>
                      </div>

                      {customFontList.length > 0 ? (
                        <div className="space-y-3">
                          {customFontList.map((font: FontData) => (
                            <div
                              key={font.value}
                              className="flex items-center justify-between gap-3 rounded-md border border-[#e5e7eb] px-3 py-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#111827]">
                                  {font.name}
                                </div>
                                {font.originalFileName && (
                                  <div
                                    className="mt-1 truncate text-xs text-[#64748b]"
                                    dir="ltr">
                                    {font.originalFileName}
                                  </div>
                                )}
                                <div className="mt-1 truncate text-xs text-[#64748b]">
                                  {t("options.savedFonts.unicodeRange", {
                                    range: getCustomFontUnicodeRangeLabel(
                                      font.unicodeRange
                                    )
                                  })}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleDeleteFont(font.value)}
                                disabled={isLoading}>
                                <Trash2 className="size-4" />
                                {t("common.delete")}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-dashed border-[#dbe3ef] text-sm text-[#64748b]">
                          {t("options.emptyFonts")}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {activeSection === "sites" && (
                <div className="space-y-6">
                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.siteList.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {normalizedEnabledByDefault
                            ? t("options.siteList.excludeDescription")
                            : t("options.siteList.includeDescription")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <ListChecks className="size-5" />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="space-y-3">
                        <button
                          type="button"
                          aria-pressed={!normalizedEnabledByDefault}
                          data-testid="fontara-site-list-include-mode"
                          onClick={() => void handleSiteListModeChange(false)}
                          className={cn(
                            "fontara-choice flex w-full items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                            !normalizedEnabledByDefault && "border-[#b9d4ff]"
                          )}>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#111827]">
                              {t("options.siteList.includeMode")}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#64748b]">
                              {t("options.siteList.includeModeDescription")}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border",
                              !normalizedEnabledByDefault
                                ? "border-[#2374ff] bg-[#2374ff] text-white"
                                : "border-[#dbe3ef] text-transparent"
                            )}>
                            <Check className="size-4" />
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-pressed={normalizedEnabledByDefault}
                          data-testid="fontara-site-list-exclude-mode"
                          onClick={() => void handleSiteListModeChange(true)}
                          className={cn(
                            "fontara-choice flex w-full items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                            normalizedEnabledByDefault && "border-[#b9d4ff]"
                          )}>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#111827]">
                              {t("options.siteList.excludeMode")}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#64748b]">
                              {t("options.siteList.excludeModeDescription")}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border",
                              normalizedEnabledByDefault
                                ? "border-[#2374ff] bg-[#2374ff] text-white"
                                : "border-[#dbe3ef] text-transparent"
                            )}>
                            <Check className="size-4" />
                          </span>
                        </button>
                      </div>

                      <div className="fontara-soft-panel p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-bold text-[#111827]">
                            {normalizedEnabledByDefault
                              ? t("options.siteList.disabledListTitle")
                              : t("options.siteList.enabledListTitle")}
                          </h4>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {t("options.siteList.patternHelp")}
                          </p>
                        </div>

                        <form
                          className="mb-4"
                          onSubmit={handleSitePatternSubmit}>
                          <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem]">
                            <Select
                              value={sitePatternScope}
                              onValueChange={(value) =>
                                setSitePatternScope(value as SitePatternScope)
                              }>
                              <SelectTrigger
                                className="h-10 rounded-md border-[#dbe3ef] text-sm"
                                aria-label={t("options.siteList.scopeLabel")}
                                data-testid="fontara-site-list-scope">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {sitePatternScopeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}>
                                    {t(option.labelKey)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <input
                              type="text"
                              value={sitePatternInput}
                              data-testid="fontara-site-list-pattern-input"
                              onChange={handleSitePatternInputChange}
                              placeholder={t(
                                sitePatternPlaceholderKeys[sitePatternScope]
                              )}
                              dir="ltr"
                              className="h-10 min-w-0 rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
                            />
                            <Button
                              type="submit"
                              size="icon"
                              className="h-10 w-10 shrink-0 bg-[#2374ff] text-white hover:bg-[#1f66df]"
                              data-testid="fontara-site-list-add"
                              aria-label={t("options.siteList.add")}>
                              <Plus className="size-4" />
                            </Button>
                          </div>
                          {currentTab?.isSupported && currentTab.url && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {currentTabDomainPattern && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-[#dbe3ef] text-xs"
                                  onClick={() =>
                                    fillSitePatternFromCurrentTab("domain")
                                  }>
                                  {t("options.siteList.useCurrentDomain")}
                                </Button>
                              )}
                              {currentTabHasPathPattern && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-[#dbe3ef] text-xs"
                                  onClick={() =>
                                    fillSitePatternFromCurrentTab("path")
                                  }>
                                  {t("options.siteList.useCurrentPath")}
                                </Button>
                              )}
                            </div>
                          )}
                        </form>
                        {hasSitePatternInput && (
                          <div
                            className={cn(
                              "mb-4 rounded-md border px-3 py-2 text-xs",
                              normalizedSitePatternInput
                                ? "border-[#bfdbfe] bg-[#f8fbff] text-[#1e3a8a]"
                                : "border-red-200 bg-red-50 text-red-700"
                            )}
                            aria-live="polite">
                            {normalizedSitePatternInput ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0">
                                  {normalizedEnabledByDefault
                                    ? t("options.siteList.previewExclude")
                                    : t("options.siteList.previewInclude")}
                                </span>
                                <bdi
                                  className="min-w-0 truncate font-semibold"
                                  dir="ltr">
                                  {getDisplaySitePattern(
                                    normalizedSitePatternInput
                                  )}
                                </bdi>
                                <SiteScopeBadge
                                  scope={getSitePatternScope(
                                    normalizedSitePatternInput
                                  )}
                                />
                                {hasCustomCssForSitePattern(
                                  normalizedSitePatternInput
                                ) && <SiteModeBadge customCss />}
                              </div>
                            ) : (
                              t("options.siteList.previewInvalid")
                            )}
                          </div>
                        )}

                        {managedSiteList.length > 0 ? (
                          <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
                            {managedSiteList.map((pattern) => {
                              const hasCustomCss =
                                hasCustomCssForSitePattern(pattern)

                              return (
                                <div
                                  key={pattern}
                                  data-testid={`fontara-site-list-row-${pattern}`}
                                  className="flex items-center justify-between gap-2 rounded-md border border-[#e8eef6] bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_70%)]">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <bdi className="min-w-0 truncate text-sm font-semibold text-[#111827]">
                                      {getDisplaySitePattern(pattern)}
                                    </bdi>
                                    <SiteScopeBadge
                                      scope={getSitePatternScope(pattern)}
                                    />
                                    {hasCustomCss && (
                                      <SiteModeBadge customCss />
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                                    data-testid={`fontara-site-list-remove-${pattern}`}
                                    aria-label={t("options.siteList.remove", {
                                      site: pattern
                                    })}
                                    onClick={() =>
                                      void handleRemoveSitePattern(pattern)
                                    }>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-[#dbe3ef] px-4 text-center text-sm text-[#64748b]">
                            {normalizedEnabledByDefault
                              ? t("options.siteList.emptyDisabled")
                              : t("options.siteList.emptyEnabled")}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.siteProfiles.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("options.siteProfiles.description")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <Settings className="size-5" />
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <form
                        className="fontara-soft-panel space-y-4 p-4"
                        onSubmit={handleSiteProfileSubmit}>
                        <div className="space-y-2">
                          <label
                            htmlFor="site-profile-target"
                            className="block text-sm font-medium text-[#334155]">
                            {t("options.siteProfiles.targetLabel")}
                          </label>
                          <Popover
                            open={siteProfileTargetOpen}
                            onOpenChange={setSiteProfileTargetOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="site-profile-target"
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={siteProfileTargetOpen}
                                data-testid="fontara-site-profile-target-trigger"
                                className="h-auto min-h-11 w-full justify-between border-[#dbe3ef] bg-white px-3 py-2 text-start hover:bg-white">
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  {selectedSiteProfileTarget?.iconUrl && (
                                    <img
                                      alt=""
                                      src={selectedSiteProfileTarget.iconUrl}
                                      className="size-6 shrink-0 rounded object-contain"
                                    />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <bdi
                                      className={cn(
                                        "block truncate text-sm font-bold",
                                        selectedSiteProfilePattern
                                          ? "text-[#111827]"
                                          : "text-[#94a3b8]"
                                      )}
                                      dir="ltr">
                                      {selectedSiteProfilePattern
                                        ? getDisplaySitePattern(
                                            selectedSiteProfilePattern
                                          )
                                        : t(
                                            "options.siteProfiles.targetPlaceholder"
                                          )}
                                    </bdi>
                                    {selectedSiteProfileTarget?.title &&
                                      selectedSiteProfileTarget.title !==
                                        getDisplaySitePattern(
                                          selectedSiteProfilePattern ?? ""
                                        ) && (
                                        <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                                          {selectedSiteProfileTarget.title}
                                        </span>
                                      )}
                                  </span>
                                  {selectedSiteProfileScope && (
                                    <SiteScopeBadge
                                      scope={selectedSiteProfileScope}
                                    />
                                  )}
                                </span>
                                <ChevronsUpDown className="ms-2 size-4 shrink-0 text-[#94a3b8]" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-(--radix-popover-trigger-width) p-0">
                              <Command>
                                <CommandInput
                                  value={siteProfileTargetSearch}
                                  data-testid="fontara-site-profile-target-search"
                                  onValueChange={setSiteProfileTargetSearch}
                                  placeholder={t(
                                    "options.siteProfiles.targetSearchPlaceholder"
                                  )}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {t("options.siteProfiles.noTargets")}
                                  </CommandEmpty>
                                  {canAddSiteProfileTarget &&
                                    siteProfileAddTargetPattern && (
                                      <CommandGroup>
                                        <CommandItem
                                          value={siteProfileAddTargetPattern}
                                          data-testid="fontara-site-profile-target-add"
                                          className="min-h-11 cursor-pointer gap-3 px-2"
                                          onSelect={handleAddSiteProfileTarget}>
                                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
                                            <Plus className="size-4" />
                                          </span>
                                          <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-bold text-[#111827]">
                                              {t(
                                                "options.siteProfiles.addTarget",
                                                {
                                                  site: getDisplaySitePattern(
                                                    siteProfileAddTargetPattern
                                                  )
                                                }
                                              )}
                                            </span>
                                            <bdi
                                              className="mt-0.5 block truncate text-xs text-[#64748b]"
                                              dir="ltr">
                                              {siteProfileAddTargetPattern}
                                            </bdi>
                                          </span>
                                          <SiteScopeBadge
                                            scope={getSitePatternScope(
                                              siteProfileAddTargetPattern
                                            )}
                                          />
                                        </CommandItem>
                                      </CommandGroup>
                                    )}
                                  <CommandGroup>
                                    {siteProfileTargetOptions.map(
                                      renderSiteProfileTargetItem
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div>
                          <label
                            htmlFor="site-profile-font"
                            className="mb-2 block text-sm font-medium text-[#334155]">
                            {t("options.siteProfiles.fontLabel")}
                          </label>
                          <select
                            id="site-profile-font"
                            value={siteProfileFontInput}
                            data-testid="fontara-site-profile-font-select"
                            onChange={(event) =>
                              setSiteProfileFontInput(event.target.value)
                            }
                            className="h-10 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15">
                            <option value="">
                              {t("options.siteProfiles.globalFont")}
                            </option>
                            {siteFontOptionGroups.map((group) =>
                              group.options.length > 0 ? (
                                <optgroup key={group.label} label={group.label}>
                                  {group.options.map((font) => (
                                    <option key={font.value} value={font.value}>
                                      {font.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null
                            )}
                          </select>
                        </div>

                        <div className="space-y-3 rounded-md border border-[#eef2f7] bg-[#f8fafc] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <label
                                htmlFor="site-profile-stroke-toggle"
                                className="text-sm font-medium text-[#334155]">
                                {t("options.siteProfiles.strokeLabel")}
                              </label>
                              <p className="mt-1 text-xs text-[#64748b]">
                                {siteProfileUsesGlobalStroke
                                  ? t("options.siteProfiles.globalStroke")
                                  : t("options.siteProfiles.customStroke", {
                                      value: formattedSiteProfileTextStroke
                                    })}
                              </p>
                            </div>
                            <Switch
                              id="site-profile-stroke-toggle"
                              dir="ltr"
                              checked={!siteProfileUsesGlobalStroke}
                              data-testid="fontara-site-profile-stroke-toggle"
                              onCheckedChange={(checked) =>
                                setSiteProfileUsesGlobalStroke(!checked)
                              }
                              aria-label={t("options.siteProfiles.strokeLabel")}
                            />
                          </div>

                          <div
                            dir="ltr"
                            className={cn(
                              "space-y-2 transition",
                              siteProfileUsesGlobalStroke && "opacity-50"
                            )}>
                            <input
                              type="range"
                              min={TEXT_STROKE_MIN}
                              max={TEXT_STROKE_MAX}
                              step={TEXT_STROKE_STEP}
                              value={siteProfileTextStroke}
                              data-testid="fontara-site-profile-stroke-range"
                              disabled={siteProfileUsesGlobalStroke}
                              onChange={(event) =>
                                setSiteProfileTextStroke(
                                  normalizeTextStrokeValue(
                                    Number(event.currentTarget.value)
                                  )
                                )
                              }
                              aria-label={t("options.siteProfiles.strokeLabel")}
                              className="h-2 w-full cursor-pointer accent-[#2374ff] disabled:cursor-not-allowed"
                            />
                            <div className="flex items-center justify-between text-[10px] font-semibold text-[#94a3b8]">
                              <span>
                                {formatNumber(TEXT_STROKE_MIN, {
                                  maximumFractionDigits: 1,
                                  minimumFractionDigits: 1,
                                  useGrouping: false
                                })}
                              </span>
                              <span>
                                {formatNumber(TEXT_STROKE_MAX, {
                                  maximumFractionDigits: 1,
                                  minimumFractionDigits: 1,
                                  useGrouping: false
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            data-testid="fontara-site-profile-save"
                            className="h-10 bg-[#2374ff] text-white hover:bg-[#1f66df]">
                            <Check className="size-4" />
                            {t("options.siteProfiles.save")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={resetSiteProfileForm}>
                            {t("options.siteProfiles.reset")}
                          </Button>
                        </div>
                      </form>

                      <div className="fontara-soft-panel p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-bold text-[#111827]">
                            {t("options.siteProfiles.savedTitle")}
                          </h4>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {t("options.siteProfiles.savedDescription", {
                              count: formatNumber(normalizedSiteProfiles.length)
                            })}
                          </p>
                        </div>

                        {normalizedSiteProfiles.length > 0 ? (
                          <div className="max-h-80 space-y-2 overflow-y-auto pe-1">
                            {normalizedSiteProfiles.map((profile) => {
                              const hasCustomCss = hasCustomCssForSitePattern(
                                profile.pattern
                              )
                              const profileEnabled =
                                isSiteProfileEnabled(profile)

                              return (
                                <div
                                  key={profile.pattern}
                                  data-testid={`fontara-site-profile-row-${profile.pattern}`}
                                  className={cn(
                                    "rounded-md border px-3 py-3 transition",
                                    profileEnabled
                                      ? "border-[#eef2f7] bg-[#f8fafc]"
                                      : "border-slate-200 bg-slate-50 opacity-75"
                                  )}>
                                  <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <bdi
                                        className={cn(
                                          "min-w-0 truncate text-sm font-bold",
                                          profileEnabled
                                            ? "text-[#111827]"
                                            : "text-[#64748b]"
                                        )}>
                                        {getDisplaySitePattern(profile.pattern)}
                                      </bdi>
                                      <span
                                        className={cn(
                                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                          profileEnabled
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-slate-200 bg-white text-slate-500"
                                        )}>
                                        {profileEnabled
                                          ? t("options.siteProfiles.active")
                                          : t("options.siteProfiles.inactive")}
                                      </span>
                                      {hasCustomCss && (
                                        <SiteModeBadge customCss />
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <Switch
                                        dir="ltr"
                                        checked={profileEnabled}
                                        data-testid={`fontara-site-profile-enabled-${profile.pattern}`}
                                        onCheckedChange={(checked) =>
                                          void handleSiteProfileEnabledToggle(
                                            profile,
                                            checked
                                          )
                                        }
                                        aria-label={t(
                                          "options.siteProfiles.applyProfile",
                                          {
                                            site: profile.pattern
                                          }
                                        )}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-[#64748b] hover:bg-[#eaf2ff] hover:text-[#2374ff]"
                                        aria-label={t(
                                          "options.siteProfiles.edit",
                                          {
                                            site: profile.pattern
                                          }
                                        )}
                                        onClick={() =>
                                          handleEditSiteProfile(profile)
                                        }>
                                        <Settings className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                                        data-testid={`fontara-site-profile-remove-${profile.pattern}`}
                                        aria-label={t(
                                          "options.siteProfiles.remove",
                                          {
                                            site: profile.pattern
                                          }
                                        )}
                                        onClick={() =>
                                          void handleRemoveSiteProfile(
                                            profile.pattern
                                          )
                                        }>
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 text-xs text-[#64748b] sm:grid-cols-2">
                                    <div className="rounded-md bg-white px-3 py-2">
                                      <span className="font-semibold text-[#334155]">
                                        {t("options.siteProfiles.fontValue")}
                                      </span>{" "}
                                      <span dir="auto">
                                        {getSiteProfileFontLabel(profile.font)}
                                      </span>
                                    </div>
                                    <div className="rounded-md bg-white px-3 py-2">
                                      <span className="font-semibold text-[#334155]">
                                        {t("options.siteProfiles.strokeValue")}
                                      </span>{" "}
                                      <bdi>
                                        {profile.textStroke === undefined
                                          ? t(
                                              "options.siteProfiles.globalStroke"
                                            )
                                          : formatTextStrokeDisplay(
                                              profile.textStroke
                                            )}
                                      </bdi>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-[#dbe3ef] px-4 text-center text-sm text-[#64748b]">
                            {t("options.siteProfiles.empty")}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.sites.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("options.sites.count", {
                            active: formatNumber(activeWebsiteCount),
                            total: formatNumber(defaultWebsiteList.length)
                          })}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <Globe2 className="size-5" />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-md border border-[#e5edf6] bg-white">
                      <Table className="min-w-[760px]">
                        <TableHeader className="bg-[#f8fbff]">
                          <TableRow className="hover:bg-[#f8fbff]">
                            <TableHead className="w-[28%] ps-4 text-start text-xs font-bold text-[#64748b]">
                              {t("options.sites.column.site")}
                            </TableHead>
                            <TableHead className="w-[28%] text-start text-xs font-bold text-[#64748b]">
                              {t("options.sites.column.pattern")}
                            </TableHead>
                            <TableHead className="w-[22%] text-start text-xs font-bold text-[#64748b]">
                              {t("options.sites.column.mode")}
                            </TableHead>
                            <TableHead className="w-[11%] text-center text-xs font-bold text-[#64748b]">
                              {t("options.sites.column.popup")}
                            </TableHead>
                            <TableHead className="w-[11%] pe-4 text-end text-xs font-bold text-[#64748b]">
                              {t("options.sites.column.enabled")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {defaultWebsiteList.map((website) => {
                            const active = isWebsiteActive(website)
                            const pinned = isWebsitePinned(website)
                            const websitePattern =
                              getWebsiteCardPattern(website)
                            const websitePatternLabel = websitePattern
                              ? getDisplaySitePattern(websitePattern)
                              : null
                            const websiteTitle = getWebsiteCardTitle(
                              website,
                              websitePattern
                            )

                            return (
                              <TableRow
                                key={website.url}
                                className={cn(
                                  "h-[4.25rem] hover:bg-[#f8fbff]",
                                  !active && "bg-[#fbfdff] opacity-75"
                                )}>
                                <TableCell className="ps-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    {website.icon && (
                                      <img
                                        alt=""
                                        src={getExtensionAssetURL(website.icon)}
                                        className={cn(
                                          "size-8 rounded-md object-contain",
                                          !active && "grayscale"
                                        )}
                                      />
                                    )}
                                    <div
                                      className="min-w-0 truncate text-sm font-semibold text-[#111827]"
                                      title={websiteTitle}>
                                      {websiteTitle}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {websitePatternLabel ? (
                                    <bdi
                                      className="block max-w-[13rem] truncate text-xs text-[#64748b]"
                                      dir="ltr"
                                      title={websitePatternLabel}>
                                      {websitePatternLabel}
                                    </bdi>
                                  ) : (
                                    <span className="text-xs text-[#94a3b8]">
                                      -
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <SiteModeBadge
                                      customCss={website.customCss === true}
                                    />
                                    {websitePattern && (
                                      <SiteScopeBadge
                                        scope={getSitePatternScope(
                                          websitePattern
                                        )}
                                      />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "mx-auto h-8 w-8 text-[#94a3b8] hover:bg-[#eaf2ff] hover:text-[#2374ff]",
                                      pinned &&
                                        "bg-[#eaf2ff] text-[#2374ff] hover:bg-[#dbeafe]"
                                    )}
                                    aria-pressed={pinned}
                                    aria-label={t(
                                      pinned
                                        ? "options.sites.unpinFromPopup"
                                        : "options.sites.pinToPopup",
                                      {
                                        site: websiteTitle
                                      }
                                    )}
                                    onClick={() =>
                                      void handleWebsitePinToggle(website)
                                    }>
                                    <Pin
                                      className={cn(
                                        "size-4",
                                        pinned && "fill-current"
                                      )}
                                    />
                                  </Button>
                                </TableCell>
                                <TableCell className="pe-4 text-end">
                                  <Switch
                                    checked={active}
                                    onCheckedChange={() =>
                                      void handleWebsiteToggle(website)
                                    }
                                    aria-label={t("options.siteToggleAria", {
                                      site: websiteTitle
                                    })}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "rtl" && (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.rtl.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("options.rtl.subtitle")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <AlignRight className="size-5" />
                      </div>
                    </div>

                    <div
                      data-active={rtlEnabled}
                      className={cn(
                        "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
                      )}>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#111827]">
                          {t("options.rtl.globalTitle")}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {t("options.rtl.globalDescription")}
                        </p>
                      </div>
                      <Switch
                        dir="ltr"
                        checked={rtlEnabled}
                        onCheckedChange={(checked) =>
                          void handleRtlGlobalToggle(checked)
                        }
                        aria-label={t("options.rtl.globalTitle")}
                      />
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.rtl.supportedSitesTitle")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("options.rtl.supportedSitesDescription", {
                            active: formatNumber(activeRtlSiteCount),
                            total: formatNumber(RTL_SUPPORTED_SITES.length)
                          })}
                        </p>
                      </div>
                      {!rtlEnabled && (
                        <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs text-[#64748b]">
                          {t("options.rtl.globallyDisabled")}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {RTL_SUPPORTED_SITES.map((site) => {
                        const siteEnabled = isRtlSiteEnabled(
                          normalizedRtlSiteSettings,
                          site.id
                        )
                        const active = rtlEnabled !== false && siteEnabled

                        return (
                          <div
                            key={site.id}
                            className={cn(
                              "flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition",
                              active
                                ? "border-[#d7e7ff] bg-white shadow-[inset_0_0_0_1px_rgb(35_116_255_/_8%)]"
                                : "border-[#e8eef6] bg-[#fbfdff] opacity-80"
                            )}>
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                alt=""
                                src={getExtensionAssetURL(site.icon)}
                                className={cn(
                                  "size-7 rounded-md object-contain",
                                  !active && "grayscale"
                                )}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#111827]">
                                  {site.siteName}
                                </div>
                                <div className="truncate text-xs text-[#64748b]">
                                  {rtlEnabled === false
                                    ? t("options.rtl.globallyDisabled")
                                    : siteEnabled
                                      ? t("options.rtl.siteEnabled")
                                      : t("options.rtl.siteDisabled")}
                                </div>
                              </div>
                            </div>
                            <Switch
                              dir="ltr"
                              checked={siteEnabled}
                              disabled={rtlEnabled === false}
                              onCheckedChange={(checked) =>
                                void handleRtlSiteToggle(site, checked)
                              }
                              aria-label={t("options.rtl.siteToggleAria", {
                                site: site.siteName
                              })}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "hotkeys" && <HotkeysSettings />}

              {activeSection === "advanced" && (
                <div className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-2">
                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.sync.title")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {syncSettings
                            ? t("options.sync.enabledDescription")
                            : t("options.sync.disabledDescription")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <Cloud className="size-5" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div
                        data-active={syncSettings}
                        className={cn(
                          "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
                        )}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#111827]">
                            {t("options.sync.toggleLabel")}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#64748b]">
                            {t("options.sync.toggleDescription")}
                          </p>
                        </div>
                        <Switch
                          dir="ltr"
                          checked={syncSettings}
                          onCheckedChange={(checked) =>
                            void handleSyncSettingsToggle(checked)
                          }
                          aria-label={t("options.sync.toggleAria")}
                          data-testid="fontara-sync-settings-toggle"
                        />
                      </div>

                      <div className="flex items-start gap-3 rounded-md border border-[#e1ecff] bg-[#fbfdff] px-4 py-3">
                        <Info className="mt-0.5 size-4 shrink-0 text-[#2374ff]" />
                        <p className="text-xs leading-5 text-[#334155]">
                          {t("options.sync.customFontsExcluded")}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.contextMenus.title")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {contextMenusEnabled
                            ? t("options.contextMenus.enabledDescription")
                            : t("options.contextMenus.disabledDescription")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <Menu className="size-5" />
                      </div>
                    </div>

                    <div
                      data-active={contextMenusEnabled}
                      className={cn(
                        "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
                      )}>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#111827]">
                          {t("options.contextMenus.toggleLabel")}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {t("options.contextMenus.toggleDescription")}
                        </p>
                      </div>
                      <Switch
                        dir="ltr"
                        checked={contextMenusEnabled}
                        onCheckedChange={(checked) =>
                          void handleContextMenusToggle(checked)
                        }
                        aria-label={t("options.contextMenus.toggleAria")}
                        data-testid="fontara-context-menus-toggle"
                      />
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <input
                      ref={settingsImportInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      data-testid="fontara-settings-import-input"
                      onChange={handleSettingsImportFileChange}
                    />
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.backup.importTitle")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {t("options.backup.importDescription")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <FileUp className="size-5" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsImportWarningVisible(true)}
                        disabled={isBackupBusy}
                        data-testid="fontara-settings-import-open"
                        className="h-11">
                        <FileUp className="size-4" />
                        {t("options.backup.importButton")}
                      </Button>

                      {isImportWarningVisible && (
                        <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-4">
                          <h4 className="text-sm font-bold text-[#92400e]">
                            {t("options.backup.importWarningTitle")}
                          </h4>
                          <p className="mt-2 text-xs leading-5 text-[#92400e]">
                            {t("options.backup.importWarningDescription")}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleChooseSettingsImportFile}
                              disabled={isBackupBusy}
                              data-testid="fontara-settings-import-choose"
                              className="h-10 bg-[#2374ff] text-white hover:bg-[#1f66df]">
                              <Upload className="size-4" />
                              {t("options.backup.chooseFileButton")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsImportWarningVisible(false)}
                              disabled={isBackupBusy}
                              className="h-10">
                              {t("options.backup.cancelButton")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.backup.exportTitle")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">
                          {t("options.backup.exportDescription")}
                        </p>
                      </div>
                      <div className="fontara-icon-tile">
                        <FileDown className="size-5" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3 rounded-md border border-[#e1ecff] bg-[#fbfdff] px-4 py-3">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2374ff]" />
                        <p className="text-xs leading-5 text-[#334155]">
                          {t("options.backup.exportNote")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleExportSettings()}
                        disabled={isBackupBusy}
                        data-testid="fontara-settings-export"
                        className="h-11 bg-[#2374ff] text-white hover:bg-[#1f66df]">
                        <Download className="size-4" />
                        {t("options.backup.exportButton")}
                      </Button>
                    </div>
                  </section>

                  <section className="fontara-panel p-4 sm:p-5 lg:col-span-2">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                          <RotateCcw className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#111827]">
                            {t("options.backup.resetTitle")}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-[#64748b]">
                            {t("options.backup.resetDescription")}
                          </p>
                        </div>
                      </div>

                      <AlertDialog
                        open={isResetWarningVisible}
                        onOpenChange={setIsResetWarningVisible}>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isBackupBusy}
                            data-testid="fontara-settings-reset-open"
                            className="h-11 shrink-0 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700">
                            <RotateCcw className="size-4" />
                            {t("options.backup.resetButton")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir={direction}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("options.backup.resetWarningTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("options.backup.resetWarningDescription")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isBackupBusy}>
                              {t("options.backup.cancelButton")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void handleResetSettings()}
                              disabled={isBackupBusy}
                              data-testid="fontara-settings-reset-confirm"
                              className="bg-red-600 text-white hover:bg-red-700">
                              <RotateCcw className="size-4" />
                              {t("options.backup.resetConfirmButton")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </div>
    </ToastProvider>
  )
}

function LocalizedOptionsRoot() {
  const { direction, t } = useI18n()

  return (
    <ErrorBoundary
      title={t("options.errorTitle")}
      description={t("error.description")}
      reloadLabel={t("error.reload")}
      direction={direction}>
      <OptionsPage />
    </ErrorBoundary>
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("FontAra options root element was not found.")
}
const optionsRootElement = rootElement

async function mountOptions(): Promise<void> {
  await waitForI18nBootstrap()
  createRoot(optionsRootElement).render(
    <ExtensionDataProvider>
      <I18nProvider>
        <LocalizedOptionsRoot />
      </I18nProvider>
    </ExtensionDataProvider>
  )
}

void mountOptions()
