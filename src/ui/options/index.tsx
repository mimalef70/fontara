import {
  AlignRight,
  ArrowUpRight,
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
  LibraryBig,
  ListChecks,
  LockKeyhole,
  Menu,
  Pin,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload
} from "lucide-react"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { version } from "../../../package.json"
import {
  CUSTOM_FONT_UNICODE_RANGE_PRESETS,
  type CustomFontUnicodeRangePresetId,
  DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET,
  getCustomFontUnicodeRangePreset,
  normalizeCustomFontUnicodeRange
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
import type {
  CustomFontFaceMeta,
  CustomFontFamily
} from "../../custom-font-types"
import type {
  FontaraGoogleFontCacheStats,
  SiteProfile,
  WebsiteItem
} from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import {
  base64ToBytes,
  bytesToBase64,
  createCustomFontFaceId,
  createCustomFontFileHash,
  normalizeCustomFontFormat
} from "../../utils/custom-font-format"
import {
  CUSTOM_FONT_NAME_MAX_LENGTH,
  isCustomFontDisplayNameValid,
  normalizeCustomFontFamilyKey,
  normalizeCustomFontFileName,
  normalizeCustomFontText
} from "../../utils/custom-font-name"
import {
  createCustomFontFaceBackupMap,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES,
  readCustomFontFaceBytes
} from "../../utils/custom-font-storage"
import {
  getFontFileExtension,
  isFontFileSignatureSupported,
  isSupportedFontExtension
} from "../../utils/font-data"
import {
  getGoogleFontDataConsentState,
  requestGoogleFontNetworkConsent
} from "../../utils/google-font-consent"
import {
  decodeGoogleFontValue,
  type GoogleFontData,
  getGoogleFontByValue,
  isGoogleFontFeatureSupported,
  loadGoogleFontList
} from "../../utils/google-fonts"
import {
  createSettingsBackup,
  createSettingsBackupFileName,
  FONTARA_SETTINGS_STORAGE_KEYS,
  getSettingsBackupDefaults,
  MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES,
  parseSettingsBackupText,
  prepareSettingsBackupImport
} from "../../utils/settings-backup"
import { getLocalValues } from "../../utils/storage"
import { normalizeStorageValues } from "../../utils/storage-normalization"
import {
  decodeSystemFontValue,
  isSystemFontAccessSupported,
  isSystemFontFeatureSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey,
  type SystemFontData
} from "../../utils/system-fonts"
import ErrorBoundary from "../components/ErrorBoundary"
import FontSelector from "../components/FontSelector"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/ui/card"
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
import { Progress } from "../components/ui/progress"
import { Switch } from "../components/ui/Switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  SidebarTrigger,
  useSidebar
} from "../components/ui/sidebar"
import { Skeleton } from "../components/ui/skeleton"
import { ToastProvider } from "../components/ui/Toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Toaster } from "../components/ui/toaster"
import { fontaraConnector } from "../connect/connector"
import {
  ExtensionDataProvider,
  useExtensionData
} from "../hooks/use-extension-data"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useDebouncedStorageValue, useStorageValue } from "../hooks/use-storage"
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
import {
  extractCustomFontMetadata,
  validateCustomFontWithNativeFontFace
} from "./custom-font-metadata-client"
import {
  type CustomFontMutationErrorKind,
  classifyCustomFontMutationError,
  getCustomFontLibraryByteLength,
  resolveSimpleCustomFontSlot,
  type SimpleCustomFontSlot
} from "./custom-font-upload"

type SettingsSection =
  | "general"
  | "fonts"
  | "sites"
  | "rtl"
  | "hotkeys"
  | "advanced"

type SiteSettingsTab = "access" | "profiles" | "optimized"

const GLOBAL_SITE_PROFILE_FONT_VALUE = "__fontara_global_font__"

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

const OPTIONS_LOADING_CARD_IDS = ["fonts", "sites", "styles", "rtl"]

function OverviewMetric({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone: "blue" | "cyan" | "indigo" | "violet"
  value: string
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  } as const

  return (
    <Card className="fontara-metric-card border-0 shadow-none">
      <CardContent className="flex items-center gap-3 p-0">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            tones[tone]
          )}>
          <Icon aria-hidden="true" className="size-[1.125rem]" />
        </span>
        <span className="min-w-0">
          <strong className="block text-xl font-extrabold leading-none tracking-tight text-slate-950">
            {value}
          </strong>
          <span className="mt-1 block truncate text-xs font-medium text-slate-500">
            {label}
          </span>
        </span>
      </CardContent>
    </Card>
  )
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
  | "custom"

type SimpleCustomFontUnicodeRangePreset = Extract<
  CustomFontUnicodeRangePresetId,
  "all" | "arabic-persian" | "latin-arabic"
>

type CustomFontHealthState = {
  signature: string
  status: "checking" | "error" | "ready"
}

const SIMPLE_CUSTOM_FONT_UNICODE_RANGE_PRESETS = [
  "arabic-persian",
  "latin-arabic",
  "all"
] as const satisfies readonly SimpleCustomFontUnicodeRangePreset[]

function getCustomFontHealthSignature(font: CustomFontFamily): string {
  return `${font.revision}:${font.faces
    .map((face) => `${face.id}:${face.fileHash}`)
    .join("|")}`
}

type PreparedCustomFontFile = {
  bytes: ArrayBuffer
  coversBold: boolean
  face: CustomFontFaceMeta
  isVariable: boolean
  slot: SimpleCustomFontSlot
}

type CustomFontSelectionFeedback = {
  slot: SimpleCustomFontSlot
  title: string
}

class UserFacingCustomFontError extends Error {}

const CUSTOM_FONT_UPLOAD_ERROR_KEYS = {
  "duplicate-name": "options.toast.duplicateFontName",
  "family-limit": "options.toast.customFontFamilyLimit",
  "family-size-limit": "options.toast.customFontFamilyTooLarge",
  "invalid-data": "options.toast.fontProcessingError",
  "library-limit": "options.toast.customFontLibraryFull",
  retryable: "options.toast.customFontUploadRetry",
  "storage-unavailable": "options.toast.customFontStorageUnavailable",
  unknown: "options.toast.customFontUploadError"
} as const satisfies Record<CustomFontMutationErrorKind, MessageKey>

function getSettingsImportErrorDescriptionKey(error: unknown): MessageKey {
  const kind = classifyCustomFontMutationError(error)
  if (kind === "family-limit") {
    return "options.toast.settingsImportTooManyFonts"
  }
  if (kind === "family-size-limit") {
    return "options.toast.settingsImportFontFamilyTooLarge"
  }
  if (kind === "library-limit") {
    return "options.toast.settingsImportFontLibraryTooLarge"
  }
  if (kind === "retryable") {
    return "options.toast.settingsImportRetry"
  }
  if (kind === "storage-unavailable") {
    return "options.toast.settingsImportStorageUnavailable"
  }
  if (kind === "duplicate-name" || kind === "invalid-data") {
    return "options.toast.settingsImportInvalid"
  }
  return "options.toast.settingsImportUnknown"
}

function CustomFontUploadSlot({
  badge,
  description,
  disabled,
  inputRef,
  label,
  onChange,
  onClear,
  preparedFont,
  readySummary,
  removeLabel,
  selectLabel,
  slot
}: {
  badge: string
  description: string
  disabled: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  preparedFont: PreparedCustomFontFile | null
  readySummary: string
  removeLabel: string
  selectLabel: string
  slot: SimpleCustomFontSlot
}) {
  const inputId = `custom-font-${slot}-file`

  return (
    <div
      data-testid={`fontara-custom-font-${slot}-slot`}
      aria-disabled={disabled}
      className={cn(
        "group flex min-h-32 flex-col rounded-2xl border p-3.5 text-start transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20",
        preparedFont
          ? "border-emerald-200 bg-emerald-50/70 shadow-sm"
          : "border-dashed border-blue-200 bg-gradient-to-b from-blue-50/80 to-white hover:border-blue-400 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-60"
      )}>
      <div className="flex items-start gap-2">
        <label
          htmlFor={inputId}
          className={cn(
            "min-w-0 flex-1 cursor-pointer",
            disabled && "cursor-not-allowed"
          )}>
          <span className="min-w-0">
            <strong className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
              {preparedFont && (
                <Check
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-emerald-700"
                />
              )}
              {label}
            </strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              {description}
            </span>
          </span>
        </label>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
            {badge}
          </span>
          {preparedFont && (
            <button
              type="button"
              data-testid={`fontara-custom-font-${slot}-remove`}
              onClick={onClear}
              aria-label={removeLabel}
              disabled={disabled}
              className="flex size-7 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          )}
        </span>
      </div>

      <label
        htmlFor={inputId}
        className={cn(
          "mt-auto block cursor-pointer pt-3",
          disabled && "cursor-not-allowed"
        )}>
        {preparedFont ? (
          <span
            data-testid={`fontara-custom-font-${slot}-ready`}
            role="status"
            className="block min-w-0 rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
            <bdi
              dir="auto"
              title={preparedFont.face.fileName}
              className="block truncate text-xs font-bold text-slate-800">
              {preparedFont.face.fileName}
            </bdi>
            <span className="mt-1 block text-[0.6875rem] font-semibold text-emerald-700">
              {readySummary}
            </span>
          </span>
        ) : (
          <span className="text-xs font-bold text-blue-700">{selectLabel}</span>
        )}
      </label>

      <input
        id={inputId}
        data-testid={`fontara-custom-font-${slot}-file`}
        ref={inputRef}
        type="file"
        onChange={onChange}
        accept=".ttf,.woff,.woff2,.otf"
        className="sr-only"
        disabled={disabled}
      />
    </div>
  )
}

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

function requestContextMenusPermission(): Promise<boolean> {
  if (!chrome.permissions?.request) {
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

function removeContextMenusPermission(): Promise<boolean> {
  if (!chrome.permissions?.remove) return Promise.resolve(true)

  return new Promise((resolve, reject) => {
    chrome.permissions.remove(
      { permissions: [CONTEXT_MENU_PERMISSION] },
      (removed) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(removed)
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

function OptionsLoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 md:grid-cols-4">
        {OPTIONS_LOADING_CARD_IDS.map((id) => (
          <Skeleton key={id} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

function SettingsNavigation({
  activeSection,
  onSectionChange
}: {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}) {
  const { t } = useI18n()
  const { isMobile, setOpenMobile } = useSidebar()
  const buttonRefs = React.useRef(new Map<SettingsSection, HTMLButtonElement>())

  const selectSection = (section: SettingsSection, closeMobile: boolean) => {
    onSectionChange(section)
    if (closeMobile && isMobile) {
      setOpenMobile(false)
    }
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null

    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % settingsNavigation.length
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + settingsNavigation.length) % settingsNavigation.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = settingsNavigation.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextSection = settingsNavigation[nextIndex].id
    selectSection(nextSection, true)
    buttonRefs.current.get(nextSection)?.focus()
  }

  return (
    <SidebarContent
      role="navigation"
      aria-label={t("options.sidebar.navigation")}
      className="px-3 py-4">
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="mb-2 px-3 text-[0.6875rem] font-bold tracking-wide text-slate-400">
          {t("options.sidebar.sections")}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu
            role="tablist"
            aria-orientation="vertical"
            className="gap-1.5">
            {settingsNavigation.map((item, index) => {
              const Icon = item.icon
              const active = activeSection === item.id

              return (
                <SidebarMenuItem key={item.id} role="presentation">
                  <SidebarMenuButton
                    ref={(node) => {
                      if (node) {
                        buttonRefs.current.set(item.id, node)
                      } else {
                        buttonRefs.current.delete(item.id)
                      }
                    }}
                    role="tab"
                    id={`fontara-options-tab-${item.id}`}
                    aria-controls="fontara-options-panel"
                    aria-current={active ? "page" : undefined}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    isActive={active}
                    className="fontara-nav-button"
                    data-testid={`fontara-options-nav-${item.id}`}
                    tooltip={t(item.labelKey)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    onClick={() => selectSection(item.id, true)}>
                    <span className="fontara-nav-icon">
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                    </span>
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
  )
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
  const [siteSettingsTab, setSiteSettingsTab] =
    useState<SiteSettingsTab>("access")
  const activeNavigation = settingsNavigation.find(
    (item) => item.id === activeSection
  )
  const ActiveSectionIcon = activeNavigation?.icon ?? Settings
  const sidebarSide = direction === "rtl" ? "right" : "left"
  const [googleFontList, setGoogleFontList] = useState<GoogleFontData[]>([])
  const [googleFontListReady, setGoogleFontListReady] = useState(false)

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

  const regularFontInputRef = React.useRef<HTMLInputElement>(null)
  const boldFontInputRef = React.useRef<HTMLInputElement>(null)
  const settingsImportInputRef = React.useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBackupBusy, setIsBackupBusy] = useState(false)
  const [isImportWarningVisible, setIsImportWarningVisible] = useState(false)
  const [isResetWarningVisible, setIsResetWarningVisible] = useState(false)
  const [preparedRegularFont, setPreparedRegularFont] =
    useState<PreparedCustomFontFile | null>(null)
  const [preparedBoldFont, setPreparedBoldFont] =
    useState<PreparedCustomFontFile | null>(null)
  const [fontUnicodeRangePreset, setFontUnicodeRangePreset] =
    useState<SimpleCustomFontUnicodeRangePreset>(
      DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET
    )
  const [isFontCoverageSelectOpen, setIsFontCoverageSelectOpen] =
    useState(false)
  const [customFontHealth, setCustomFontHealth] = useState<
    Record<string, CustomFontHealthState>
  >({})
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(
    null
  )
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "error" | "ready"
  >("idle")
  const [customFontSelectionFeedback, setCustomFontSelectionFeedback] =
    useState<CustomFontSelectionFeedback | null>(null)
  const preparedFontFiles = [preparedRegularFont, preparedBoldFont].filter(
    (font): font is PreparedCustomFontFile => Boolean(font)
  )
  const regularCoversBold = preparedRegularFont?.coversBold ?? false
  const [fontName, setFontName] = useState("")
  const normalizedFontName = normalizeCustomFontText(fontName)
  const hasValidFontName = isCustomFontDisplayNameValid(normalizedFontName)
  const [sitePatternScope, setSitePatternScope] =
    useState<SitePatternScope>("domain")
  const [sitePatternInput, setSitePatternInput] = useState("")
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
  const [systemFontList, setSystemFontList] = useState<SystemFontData[]>([])
  const [systemFontListReady, setSystemFontListReady] = useState(false)
  const [googleFontConsentState, setGoogleFontConsentState] = useState<
    "checking" | "granted" | "not-granted" | "unsupported"
  >("checking")
  const [googleFontsToggleBusy, setGoogleFontsToggleBusy] = useState(false)
  const [googleFontCacheBusy, setGoogleFontCacheBusy] = useState(false)
  const [googleFontCacheStats, setGoogleFontCacheStats] =
    useState<FontaraGoogleFontCacheStats | null>(null)
  const systemFontsSupported = isSystemFontFeatureSupported()
  const googleFontsSupported = isGoogleFontFeatureSupported()
  const googleFontsAvailable =
    googleFontsSupported && googleFontConsentState !== "unsupported"
  const googleFontsActive =
    googleFontsAvailable &&
    googleFontConsentState === "granted" &&
    googleFontsEnabled
  const { toast } = useToast()

  const getCustomFontUploadErrorMessage = (error: unknown): string => {
    if (error instanceof UserFacingCustomFontError) return error.message
    return t(
      CUSTOM_FONT_UPLOAD_ERROR_KEYS[classifyCustomFontMutationError(error)]
    )
  }

  React.useEffect(() => {
    document.title = t("common.settings")
  }, [t])

  React.useEffect(() => {
    let cancelled = false

    if (!googleFontsSupported) {
      setGoogleFontConsentState("unsupported")
      return () => {
        cancelled = true
      }
    }

    void getGoogleFontDataConsentState()
      .then((state) => {
        if (!cancelled) setGoogleFontConsentState(state)
      })
      .catch(() => {
        if (!cancelled) setGoogleFontConsentState("not-granted")
      })

    return () => {
      cancelled = true
    }
  }, [googleFontsSupported])

  React.useEffect(() => {
    let cancelled = false
    if (!googleFontsSupported || activeSection !== "fonts") return

    void fontaraConnector
      .getGoogleFontCacheStats()
      .then((stats) => {
        if (!cancelled) setGoogleFontCacheStats(stats)
      })
      .catch((error) => {
        if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
          console.warn("Failed to read Google Fonts cache stats.", error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeSection, googleFontsSupported])

  React.useEffect(() => {
    if (!extensionData) {
      setUiReady(false)
      return
    }

    const frame = requestAnimationFrame(() => setUiReady(true))
    return () => cancelAnimationFrame(frame)
  }, [extensionData])

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
    const needsSiteProfileFonts =
      activeSection === "sites" &&
      siteSettingsTab === "profiles" &&
      siteProfileFontPickerOpen
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
  }, [
    activeSection,
    siteProfileFontPickerOpen,
    siteSettingsTab,
    selectedFont,
    systemFontsEnabled,
    systemFontsSupported
  ])

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
    const needsSiteProfileFonts =
      activeSection === "sites" &&
      siteSettingsTab === "profiles" &&
      siteProfileFontPickerOpen
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
  }, [
    activeSection,
    googleFontsEnabled,
    googleFontsSupported,
    siteProfileFontPickerOpen,
    siteSettingsTab,
    selectedFont
  ])

  React.useEffect(() => {
    if (activeSection !== "sites" || siteSettingsTab !== "profiles") {
      setSiteProfileFontPickerOpen(false)
    }
  }, [activeSection, siteSettingsTab])

  const clearPreparedFontSlot = (slot: SimpleCustomFontSlot) => {
    if (slot === "regular") {
      setPreparedRegularFont(null)
      if (regularFontInputRef.current) regularFontInputRef.current.value = ""
      return
    }

    setPreparedBoldFont(null)
    if (boldFontInputRef.current) boldFontInputRef.current.value = ""
  }

  const handleClearPreparedFontSlot = (slot: SimpleCustomFontSlot) => {
    clearPreparedFontSlot(slot)
    setCustomFontSelectionFeedback((feedback) =>
      feedback?.slot === slot ? null : feedback
    )
  }

  const resetSelectedFiles = (options: { keepFeedback?: boolean } = {}) => {
    clearPreparedFontSlot("regular")
    clearPreparedFontSlot("bold")
    if (!options.keepFeedback) setCustomFontSelectionFeedback(null)
  }

  const resetCustomFontForm = () => {
    resetSelectedFiles()
    setFontName("")
    setFontUnicodeRangePreset(DEFAULT_CUSTOM_FONT_UNICODE_RANGE_PRESET)
  }

  React.useEffect(() => {
    let cancelled = false
    let registeredFaces: FontFace[] = []
    const previewUnicodeRange = getCustomFontUnicodeRangePreset(
      fontUnicodeRangePreset
    )?.unicodeRange
    const files = [preparedRegularFont, preparedBoldFont].filter(
      (font): font is PreparedCustomFontFile => Boolean(font)
    )

    setPreviewFontFamily(null)
    setPreviewStatus(files.length > 0 ? "loading" : "idle")
    if (files.length === 0) return

    if (
      typeof FontFace !== "function" ||
      typeof document.fonts?.add !== "function"
    ) {
      setPreviewStatus("error")
      return
    }

    const family = `FontaraUploadPreview-${crypto.randomUUID()}`
    const pendingFaces = files.map(
      (file) =>
        new FontFace(family, file.bytes.slice(0), {
          display: "block",
          style: "normal",
          unicodeRange: previewUnicodeRange ?? undefined,
          weight:
            file.face.weight.min === file.face.weight.max
              ? String(file.face.weight.min)
              : `${file.face.weight.min} ${file.face.weight.max}`
        })
    )

    void Promise.all(pendingFaces.map((face) => face.load()))
      .then((loadedFaces) => {
        if (cancelled) return
        registeredFaces = loadedFaces
        for (const face of loadedFaces) document.fonts.add(face)
        setPreviewFontFamily(family)
        setPreviewStatus("ready")
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to render the custom font preview.", error)
        }
        if (!cancelled) setPreviewStatus("error")
      })

    return () => {
      cancelled = true
      for (const face of registeredFaces) document.fonts.delete(face)
    }
  }, [fontUnicodeRangePreset, preparedBoldFont, preparedRegularFont])

  const handleFontSlotChange = async (
    slot: SimpleCustomFontSlot,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget
    const file = event.target.files?.[0]
    if (!file) return
    setCustomFontSelectionFeedback(null)
    setIsLoading(true)

    try {
      if (slot === "bold" && regularCoversBold) {
        throw new UserFacingCustomFontError(
          t("options.toast.boldCoveredByVariable")
        )
      }
      if (/\.(?:ttc|otc)$/i.test(file.name)) {
        throw new UserFacingCustomFontError(
          t("options.toast.fontCollectionUnsupported")
        )
      }
      const extension = getFontFileExtension(file.name)
      const format = normalizeCustomFontFormat(extension)
      if (!format || !isSupportedFontExtension(extension)) {
        throw new UserFacingCustomFontError(t("options.toast.invalidExtension"))
      }
      if (file.size > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
        throw new UserFacingCustomFontError(t("options.toast.fileTooLarge"))
      }

      const bytes = await file.arrayBuffer()
      const byteView = new Uint8Array(bytes)
      if (!isFontFileSignatureSupported(extension, byteView)) {
        throw new UserFacingCustomFontError(t("options.toast.invalidSignature"))
      }
      const fileHash = await createCustomFontFileHash(byteView)
      const storedHashes = new Set(
        customFontList.flatMap((family) =>
          family.faces.map((face) => face.fileHash)
        )
      )
      const otherFont =
        slot === "regular" ? preparedBoldFont : preparedRegularFont
      if (storedHashes.has(fileHash) || otherFont?.face.fileHash === fileHash) {
        throw new UserFacingCustomFontError(t("options.toast.duplicateFile"))
      }

      await validateCustomFontWithNativeFontFace(bytes.slice(0), format)
      const metadata = await extractCustomFontMetadata(
        file.name,
        bytes.slice(0)
      ).catch((error) => {
        if (__DEBUG__) {
          console.warn(
            "Custom font metadata was unavailable; using the selected slot.",
            error
          )
        }
        return null
      })
      const resolution = resolveSimpleCustomFontSlot(metadata, slot)
      if (!resolution.ok) {
        if (resolution.reason === "unsupported-style") {
          throw new UserFacingCustomFontError(
            t("options.toast.simpleFontStyleUnsupported")
          )
        }
        throw new UserFacingCustomFontError(
          t("options.toast.variableWeightMissing", {
            weight: formatNumber(resolution.requiredWeight ?? 400)
          })
        )
      }

      const prepared: PreparedCustomFontFile = {
        bytes,
        coversBold: resolution.coversBold,
        isVariable: resolution.isVariable,
        slot,
        face: {
          id: createCustomFontFaceId(fileHash),
          fileHash,
          fileName: normalizeCustomFontFileName(file.name, `font.${format}`),
          format,
          byteLength: bytes.byteLength,
          weight: resolution.weight,
          style: "normal",
          stretch: { min: 100, max: 100 },
          axes: metadata?.axes ?? [],
          validation: "verified"
        }
      }

      if (slot === "regular") {
        setPreparedRegularFont(prepared)
        if (resolution.coversBold && preparedBoldFont) {
          clearPreparedFontSlot("bold")
          toast({ title: t("options.toast.variableReplacedBold") })
        }
      } else {
        setPreparedBoldFont(prepared)
      }
    } catch (error) {
      if (__DEBUG__ && !(error instanceof UserFacingCustomFontError)) {
        console.warn("Failed to process a custom font file.", error)
      }
      const feedback = {
        slot,
        title:
          error instanceof UserFacingCustomFontError
            ? error.message
            : t("options.toast.fontProcessingError")
      }
      input.value = ""
      setCustomFontSelectionFeedback(feedback)
      toast({
        title: feedback.title
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveFont = async () => {
    if (!preparedRegularFont || !hasValidFontName) {
      toast({ title: t("options.toast.emptyFields") })
      return
    }

    setIsLoading(true)

    try {
      const isDuplicateName = customFontList.some(
        (font) =>
          font.displayName.toLocaleLowerCase() ===
          normalizedFontName.toLocaleLowerCase()
      )

      if (isDuplicateName) {
        throw new UserFacingCustomFontError(
          t("options.toast.duplicateFontName")
        )
      }

      const prospectiveLibraryBytes = getCustomFontLibraryByteLength(
        customFontList,
        preparedFontFiles.map((file) => file.face)
      )
      if (prospectiveLibraryBytes > MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) {
        throw new UserFacingCustomFontError(
          t("options.toast.customFontLibraryFull")
        )
      }

      let value = `f${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}-Fontara`
      while (customFontList.some((font) => font.value === value)) {
        value = `f${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}-Fontara`
      }
      const family = {
        value,
        displayName: normalizedFontName,
        sourceFamilyKey: normalizeCustomFontFamilyKey(normalizedFontName),
        unicodeRange:
          getCustomFontUnicodeRangePreset(fontUnicodeRangePreset)
            ?.unicodeRange ?? null,
        faces: preparedFontFiles.map((file) => file.face)
      }

      let transactionId: string | null = null
      try {
        const transaction =
          await fontaraConnector.beginCustomFontTransaction(family)
        transactionId = transaction.transactionId
        for (const file of preparedFontFiles) {
          await fontaraConnector.putCustomFontFace(
            transactionId,
            file.face.id,
            bytesToBase64(new Uint8Array(file.bytes))
          )
        }
        await fontaraConnector.commitCustomFontTransaction(transactionId)
      } catch (error) {
        if (transactionId) {
          await fontaraConnector
            .abortCustomFontTransaction(transactionId)
            .catch(() => {})
        }
        throw error
      }

      toast({
        title: t("options.toast.fontAdded"),
        description: t("options.toast.fontAddedSelectFromPopup")
      })

      resetCustomFontForm()
    } catch (error) {
      toast({
        title: getCustomFontUploadErrorMessage(error)
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFont = async (fontValue: string) => {
    try {
      await fontaraConnector.deleteCustomFont(fontValue)
      toast({ title: t("options.toast.fontDeleted") })
    } catch (_error) {
      toast({
        title: t("options.toast.fontDeleteError")
      })
    }
  }

  const handleCheckCustomFont = async (font: CustomFontFamily) => {
    const signature = getCustomFontHealthSignature(font)
    setCustomFontHealth((current) => ({
      ...current,
      [font.value]: { signature, status: "checking" }
    }))

    try {
      if (font.faces.length === 0) {
        throw new Error("custom-font-family-has-no-faces")
      }

      for (const face of font.faces) {
        if (face.validation === "failed") {
          throw new Error("custom-font-face-validation-failed")
        }
        const bytes = await readCustomFontFaceBytes(face.fileHash)
        if (!bytes || bytes.byteLength !== face.byteLength) {
          throw new Error("missing-custom-font-face-blob")
        }
        const bytesCopy = bytes.slice().buffer as ArrayBuffer
        await validateCustomFontWithNativeFontFace(bytesCopy, face.format)
      }

      setCustomFontHealth((current) => ({
        ...current,
        [font.value]: { signature, status: "ready" }
      }))
      toast({ title: t("options.customFonts.healthReady") })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to verify a saved custom font family.", error)
      }
      setCustomFontHealth((current) => ({
        ...current,
        [font.value]: { signature, status: "error" }
      }))
      toast({
        title: t("options.customFonts.healthError"),
        description: t("options.customFonts.healthErrorDescription")
      })
    }
  }

  const handleExportSettings = async () => {
    setIsBackupBusy(true)

    try {
      const settings = await normalizeStorageValues(
        await getLocalValues(getSettingsBackupDefaults())
      )
      const customFontFaces = await createCustomFontFaceBackupMap(
        settings[STORAGE_KEYS.CUSTOM_FONT_LIST] as CustomFontFamily[]
      )
      const backup = createSettingsBackup(settings, {
        extensionVersion: version,
        customFontFaces
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
    if (file.size > MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES) {
      input.value = ""
      toast({
        title: t("options.toast.settingsImportError"),
        description: t("options.toast.settingsImportFileTooLarge")
      })
      return
    }

    setIsBackupBusy(true)
    try {
      const parsedBackup = parseSettingsBackupText(await readTextFile(file))
      const preparedImport = await prepareSettingsBackupImport(parsedBackup)
      const replacesCustomFonts =
        Object.getOwnPropertyDescriptor(
          parsedBackup.settings,
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ) !== undefined
      const transactionIds: string[] = []
      try {
        if (!replacesCustomFonts) {
          const importedSettings = await fontaraConnector.importSettings(
            preparedImport.settings
          )
          setIsImportWarningVisible(false)
          toast({
            title: t("options.toast.settingsImported"),
            description: t("options.toast.settingsImportedDescription", {
              count: formatNumber(importedSettings.importedKeyCount)
            })
          })
          return
        }

        for (const preparedFamily of preparedImport.customFontFamilies) {
          const transaction = await fontaraConnector.beginCustomFontTransaction(
            preparedFamily.family,
            "replace-library"
          )
          transactionIds.push(transaction.transactionId)
          for (const face of preparedFamily.family.faces) {
            const bytes = base64ToBytes(preparedFamily.faceData[face.id])
            if (!bytes) throw new Error("invalid-custom-font-backup-face")
            if (face.validation !== "failed") {
              try {
                await validateCustomFontWithNativeFontFace(
                  bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength
                  ) as ArrayBuffer,
                  face.format
                )
              } catch {
                throw new Error("invalid-custom-font-backup-face")
              }
            }
            await fontaraConnector.putCustomFontFace(
              transaction.transactionId,
              face.id,
              preparedFamily.faceData[face.id]
            )
          }
        }

        const importedSettings = await fontaraConnector.importCustomFontBatch(
          transactionIds,
          preparedImport.settings
        )
        setIsImportWarningVisible(false)
        toast({
          title: t("options.toast.settingsImported"),
          description: t("options.toast.settingsImportedDescription", {
            count: formatNumber(importedSettings.importedKeyCount)
          })
        })
      } catch (error) {
        await Promise.all(
          transactionIds.map((transactionId) =>
            fontaraConnector
              .abortCustomFontTransaction(transactionId)
              .catch(() => {})
          )
        )
        throw error
      }
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to import FontAra settings.", error)
      }
      toast({
        title: t("options.toast.settingsImportError"),
        description: t(getSettingsImportErrorDescriptionKey(error))
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
      if (!checked) {
        await removeContextMenusPermission()
      }
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

  const fontStorageBytes = new Map(
    customFontList.flatMap((family) =>
      family.faces.map((face) => [face.fileHash, face.byteLength] as const)
    )
  )
  const customFontStorageBytes = Array.from(fontStorageBytes.values()).reduce(
    (total, bytes) => total + bytes,
    0
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
  const activeFontLabel = getSiteProfileFontLabel(selectedFont)
  const customFontStoragePercent = Math.min(
    100,
    (customFontStorageBytes / MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) * 100
  )
  const customFontStorageLimit = formatBytes(
    MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES,
    formatNumber,
    t("unit.kb"),
    t("unit.mb")
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
  const getCustomFontFaceSummary = React.useCallback(
    (faces: CustomFontFaceMeta[]): string => {
      const staticNormalWeights = Array.from(
        new Set(
          faces
            .filter(
              (face) =>
                face.style === "normal" && face.weight.min === face.weight.max
            )
            .map((face) => face.weight.min)
        )
      ).sort((a, b) => a - b)
      if (staticNormalWeights.length > 2) {
        return `${formatNumber(staticNormalWeights[0])}–${formatNumber(
          staticNormalWeights[staticNormalWeights.length - 1]
        )}`
      }

      const roles = new Set<string>()
      for (const face of faces) {
        if (face.style === "italic") {
          roles.add(t("options.customFonts.face.italic"))
        } else if (face.style === "oblique") {
          roles.add(t("options.customFonts.face.oblique"))
        } else if (face.weight.min !== face.weight.max) {
          roles.add(t("options.customFonts.face.variable"))
        } else if (face.weight.min >= 600) {
          roles.add(t("options.customFonts.face.bold"))
        } else {
          roles.add(t("options.customFonts.face.regular"))
        }
      }
      return Array.from(roles).join(" / ")
    },
    [formatNumber, t]
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
    setSiteProfileGoogleFontStatus("idle")
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

    const googleFontFamily = decodeGoogleFontValue(siteProfileFontInput)
    if (googleFontFamily) {
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

  const handleSystemFontsToggle = async (checked: boolean) => {
    try {
      if (!checked) {
        await setSystemFontsEnabled(false)
        return
      }

      if (!isSystemFontFeatureSupported()) {
        toast({ title: t("options.toast.systemFontsUnsupported") })
        return
      }

      await setSystemFontsEnabled(true)
      const state = await loadSystemFonts({ forceRefresh: true })
      if (state.status === "error") {
        toast({ title: t("options.toast.systemFontsError") })
      }
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
    if (googleFontsToggleBusy) return
    setGoogleFontsToggleBusy(true)

    try {
      if (!checked) {
        await setGoogleFontsEnabled(false)
        return
      }

      if (!isGoogleFontFeatureSupported()) {
        setGoogleFontConsentState("unsupported")
        toast({ title: t("options.toast.googleFontsUnsupported") })
        return
      }

      if (
        googleFontConsentState === "checking" ||
        googleFontConsentState === "unsupported"
      ) {
        toast({ title: t("options.toast.googleFontsUnsupported") })
        return
      }

      // Start the permission request synchronously from the switch gesture.
      // Firefox can reject requests made after an earlier awaited operation.
      const granted = await requestGoogleFontNetworkConsent()
      if (!granted) {
        toast({ title: t("options.toast.googleFontsConsentDenied") })
        return
      }
      setGoogleFontConsentState("granted")

      await setGoogleFontsEnabled(true)
    } catch (error) {
      toast({
        title: t("options.toast.googleFontsConsentError"),
        ...(typeof __DEBUG__ !== "undefined" &&
        __DEBUG__ &&
        error instanceof Error
          ? { description: error.message }
          : {})
      })
    } finally {
      setGoogleFontsToggleBusy(false)
    }
  }

  const handleClearGoogleFontCache = async () => {
    if (googleFontCacheBusy) return
    setGoogleFontCacheBusy(true)

    try {
      const stats = await fontaraConnector.clearGoogleFontCache()
      setGoogleFontCacheStats(stats)
      toast({ title: t("options.googleFonts.cacheCleared") })
    } catch (error) {
      toast({
        title: t("options.googleFonts.cacheClearError"),
        ...(typeof __DEBUG__ !== "undefined" &&
        __DEBUG__ &&
        error instanceof Error
          ? { description: error.message }
          : {})
      })
    } finally {
      setGoogleFontCacheBusy(false)
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
        <SidebarProvider
          style={
            {
              "--sidebar-width": "17.25rem",
              "--sidebar-width-icon": "4.25rem"
            } as React.CSSProperties
          }>
          <Sidebar
            collapsible="icon"
            dir={direction}
            side={sidebarSide}
            mobileTitle={t("options.sidebar.mobileTitle")}
            mobileDescription={t("options.sidebar.mobileDescription")}>
            <SidebarHeader className="border-b border-slate-200/80 px-4 py-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex min-h-12 items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_10px_24px_rgb(37_99_235_/_24%)] group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-xl">
                  <img
                    alt=""
                    src={getExtensionAssetURL("assets/icon-128.png")}
                    className="size-8 shrink-0 group-data-[collapsible=icon]:size-7"
                  />
                </span>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950">
                    {t("common.appName")}
                  </h1>
                  <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-500">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        extensionEnabled ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    {extensionEnabled
                      ? t("options.overview.extensionOn")
                      : t("options.overview.extensionOff")}
                  </div>
                </div>
              </div>
            </SidebarHeader>

            <SettingsNavigation
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />

            <SidebarFooter className="border-t border-slate-200/80 px-4 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-100/80 px-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200/70 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate font-semibold text-slate-700">
                    {t("options.overview.privacyTitle")}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.625rem] text-slate-500">
                    {t("common.version", { version: formatVersion(version) })}
                  </span>
                </span>
              </div>
            </SidebarFooter>
            <SidebarRail
              aria-label={t("options.sidebar.toggle")}
              title={t("options.sidebar.toggle")}
            />
          </Sidebar>

          <SidebarInset>
            <header className="fontara-options-header sticky top-0 z-20 flex min-h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
                <SidebarTrigger
                  type="button"
                  label={t("options.sidebar.toggle")}
                  className="size-10 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-blue-700"
                />
                <div className="fontara-icon-tile hidden sm:flex">
                  <ActiveSectionIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                    {activeNavigation
                      ? t(activeNavigation.labelKey)
                      : t("common.settings")}
                  </h2>
                  <p className="hidden truncate text-xs text-slate-500 sm:block">
                    {t(sectionDescriptionKeys[activeSection])}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 ps-3 pe-2 shadow-sm">
                  <span className="hidden text-xs font-bold text-slate-700 sm:inline">
                    {extensionEnabled
                      ? t("options.overview.extensionOn")
                      : t("options.overview.extensionOff")}
                  </span>
                  <Switch
                    dir="ltr"
                    checked={extensionEnabled}
                    disabled={!uiReady}
                    onCheckedChange={(checked) =>
                      void handleExtensionToggle(checked)
                    }
                    aria-label={t("options.extension.toggleLabel")}
                  />
                </div>
              </div>
            </header>

            <div
              id="fontara-options-panel"
              role="tabpanel"
              aria-busy={!uiReady}
              aria-labelledby={`fontara-options-tab-${activeSection}`}
              className="fontara-options-content mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
              {!uiReady && <OptionsLoadingState label={t("common.loading")} />}
              <div aria-hidden={!uiReady} className={cn(!uiReady && "hidden")}>
                {activeSection === "general" && (
                  <div className="space-y-5">
                    <Card className="fontara-hero-card overflow-hidden border-0">
                      <CardContent className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-center lg:p-8">
                        <div className="relative z-10 max-w-2xl">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                              extensionEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            )}>
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                extensionEnabled
                                  ? "bg-emerald-500"
                                  : "bg-slate-400"
                              )}
                            />
                            {extensionEnabled
                              ? t("options.overview.extensionOn")
                              : t("options.overview.extensionOff")}
                          </span>
                          <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
                            {t("options.overview.heroTitle")}
                          </h3>
                          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                            {t("options.overview.heroDescription")}
                          </p>
                          <div className="mt-6 flex flex-wrap gap-2.5">
                            <Button
                              type="button"
                              onClick={() => handleSectionChange("fonts")}
                              className="h-10 rounded-xl bg-blue-600 px-4 text-white shadow-[0_8px_20px_rgb(37_99_235_/_20%)] hover:bg-blue-700">
                              <Type className="size-4" />
                              {t("options.overview.manageFonts")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleSectionChange("sites")}
                              className="h-10 rounded-xl border-slate-200 bg-white/80 px-4 text-slate-700 hover:bg-white hover:text-blue-700">
                              <Globe2 className="size-4" />
                              {t("options.overview.manageSites")}
                            </Button>
                          </div>
                        </div>

                        <div className="relative z-10 rounded-2xl border border-white/80 bg-white/88 p-4 shadow-[0_20px_50px_rgb(15_23_42_/_10%)] backdrop-blur">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-500">
                                {t("options.overview.activeFont")}
                              </p>
                              <p className="mt-1 truncate text-base font-extrabold text-slate-950">
                                {activeFontLabel}
                              </p>
                            </div>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                              <Sparkles className="size-[1.125rem]" />
                            </span>
                          </div>
                          <FontSelector />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="fontara-metrics-shell border-0">
                      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
                        <OverviewMetric
                          icon={Type}
                          label={t("options.status.customFonts")}
                          tone="blue"
                          value={formatNumber(customFontList.length)}
                        />
                        <OverviewMetric
                          icon={Globe2}
                          label={t("options.status.activeSites")}
                          tone="cyan"
                          value={formatNumber(activeWebsiteCount)}
                        />
                        <OverviewMetric
                          icon={ListChecks}
                          label={t("options.status.cssOnly")}
                          tone="indigo"
                          value={formatNumber(cssOnlyWebsiteCount)}
                        />
                        <OverviewMetric
                          icon={AlignRight}
                          label={t("options.status.rtlSites")}
                          tone="violet"
                          value={formatNumber(activeRtlSiteCount)}
                        />
                      </CardContent>
                    </Card>

                    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
                      <Card className="fontara-settings-card border-0">
                        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-4">
                          <div>
                            <CardTitle>{t("language.title")}</CardTitle>
                            <CardDescription className="mt-1.5">
                              {t("language.subtitle")}
                            </CardDescription>
                          </div>
                          <span className="fontara-icon-tile">
                            <Languages className="size-5" />
                          </span>
                        </CardHeader>
                        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
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
                                  "fontara-choice flex min-h-24 items-start justify-between gap-3 rounded-xl border p-4 text-start transition",
                                  active && "border-blue-300 bg-blue-50/40"
                                )}>
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-slate-900">
                                    {t(option.labelKey)}
                                  </div>
                                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                    {description}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                                    active
                                      ? "border-blue-600 bg-blue-600 text-white"
                                      : "border-slate-300 bg-white text-transparent"
                                  )}>
                                  <Check className="size-4" />
                                </span>
                              </button>
                            )
                          })}
                        </CardContent>
                      </Card>

                      <Card className="fontara-privacy-card overflow-hidden border-0">
                        <CardHeader>
                          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <LockKeyhole className="size-5" />
                          </span>
                          <CardTitle>
                            {t("options.overview.privacyTitle")}
                          </CardTitle>
                          <CardDescription className="mt-2 leading-6">
                            {t("options.overview.privacyDescription")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleSectionChange("advanced")}
                            className="h-9 rounded-lg px-0 text-blue-700 hover:bg-transparent hover:text-blue-800">
                            {t("options.nav.advanced")}
                            <ArrowUpRight className="size-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {activeSection === "fonts" && (
                  <div className="space-y-5">
                    <Card className="fontara-settings-card border-0">
                      <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-center">
                        <div className="flex items-start gap-3">
                          <span className="fontara-icon-tile">
                            <Sparkles className="size-5" />
                          </span>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-950">
                              {t("options.fonts.globalTitle")}
                            </h3>
                            <p className="mt-1.5 text-xs leading-6 text-slate-500">
                              {t("options.fonts.globalDescription")}
                            </p>
                            <p className="mt-2 text-sm font-bold text-blue-700">
                              {activeFontLabel}
                            </p>
                          </div>
                        </div>
                        <FontSelector />
                      </CardContent>
                    </Card>

                    <section className="fontara-panel p-4 sm:p-5">
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-950">
                            {t("options.fonts.sourcesTitle")}
                          </h3>
                          <p className="mt-1.5 max-w-2xl text-xs leading-6 text-slate-500">
                            {t("options.fonts.sourcesDescription")}
                          </p>
                        </div>
                        <span className="fontara-icon-tile">
                          <LibraryBig className="size-5" />
                        </span>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div
                          data-active={
                            systemFontsSupported && systemFontsEnabled
                          }
                          className={cn(
                            "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-xl border p-4 transition",
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
                          data-active={googleFontsActive}
                          className={cn(
                            "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-xl border p-4 transition",
                            !googleFontsAvailable && "opacity-75"
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
                                {!googleFontsSupported
                                  ? t("options.googleFonts.unsupported")
                                  : googleFontConsentState === "unsupported"
                                    ? t(
                                        "options.googleFonts.consentUnsupported"
                                      )
                                    : googleFontsActive
                                      ? t("options.googleFonts.enabled")
                                      : t("options.googleFonts.disabled")}
                              </p>
                            </div>
                          </div>
                          <Switch
                            dir="ltr"
                            checked={googleFontsActive}
                            disabled={
                              !googleFontsAvailable ||
                              googleFontConsentState === "checking" ||
                              googleFontsToggleBusy
                            }
                            onCheckedChange={(checked) =>
                              void handleGoogleFontsToggle(checked)
                            }
                            aria-label={t("options.googleFonts.title")}
                          />
                        </div>

                        <div
                          data-active={textStroke > 0}
                          className={cn(
                            "fontara-choice flex min-h-36 flex-col gap-4 rounded-xl border p-4 transition"
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
                            <bdi className="shrink-0 rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#175cd3]">
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
                              onBlur={() => void flushTextStroke()}
                              onPointerUp={() => void flushTextStroke()}
                              aria-label={t("options.textStroke.title")}
                              className="h-2 w-full cursor-pointer accent-[#2374ff]"
                            />
                            <div className="flex items-center justify-between text-[10px] font-semibold text-[#64748b]">
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
                            className="h-9 rounded-md border border-[#dbe3ef] bg-white px-3 text-xs font-semibold text-[#64748b] transition hover:border-[#bfdbfe] hover:text-[#175cd3]"
                            disabled={textStroke <= TEXT_STROKE_MIN}>
                            {t("options.textStroke.reset")}
                          </button>
                        </div>
                      </div>
                      {googleFontsSupported && (
                        <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50 px-4 py-3">
                          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-5 text-amber-800">
                              {t("options.googleFonts.privacyNotice")}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              {googleFontCacheStats && (
                                <span className="text-[11px] text-amber-700">
                                  {t("options.googleFonts.cacheUsage", {
                                    count: formatNumber(
                                      googleFontCacheStats.familyCount
                                    ),
                                    size: formatBytes(
                                      googleFontCacheStats.totalBytes,
                                      formatNumber,
                                      t("unit.kb"),
                                      t("unit.mb")
                                    )
                                  })}
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 border-amber-200 bg-white px-3 text-xs text-amber-800 hover:bg-amber-100"
                                disabled={googleFontCacheBusy}
                                onClick={() =>
                                  void handleClearGoogleFontCache()
                                }>
                                {googleFontCacheBusy
                                  ? t("options.googleFonts.clearingCache")
                                  : t("options.googleFonts.clearCache")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <section
                        data-testid="fontara-custom-font-form"
                        className="fontara-panel p-4 sm:p-5">
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
                              htmlFor="custom-font-name"
                              className="mb-2 block text-sm font-medium text-[#334155]">
                              {t("options.addFont.nameLabel")}
                            </label>
                            <input
                              id="custom-font-name"
                              data-testid="fontara-custom-font-name"
                              type="text"
                              value={fontName}
                              maxLength={CUSTOM_FONT_NAME_MAX_LENGTH}
                              onChange={(event) =>
                                setFontName(event.target.value)
                              }
                              placeholder={t("options.addFont.namePlaceholder")}
                              aria-describedby="custom-font-name-description"
                              aria-invalid={
                                fontName.length > 0 && !hasValidFontName
                              }
                              className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15 aria-invalid:border-red-400 aria-invalid:ring-red-500/15"
                              disabled={isLoading}
                              dir="auto"
                            />
                            <p
                              id="custom-font-name-description"
                              className={cn(
                                "mt-1.5 text-xs leading-5",
                                fontName.length > 0 && !hasValidFontName
                                  ? "font-semibold text-red-700"
                                  : "text-[#64748b]"
                              )}>
                              {fontName.length > 0 && !hasValidFontName
                                ? t("options.addFont.nameInvalid")
                                : t("options.addFont.nameDescription")}
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor="custom-font-unicode-range"
                              className="mb-2 block text-sm font-medium text-[#334155]">
                              {t("options.addFont.coverageLabel")}
                            </label>
                            <Select
                              dir={direction}
                              open={isFontCoverageSelectOpen}
                              onOpenChange={setIsFontCoverageSelectOpen}
                              value={fontUnicodeRangePreset}
                              onValueChange={(value) => {
                                setFontUnicodeRangePreset(
                                  value as SimpleCustomFontUnicodeRangePreset
                                )
                                setIsFontCoverageSelectOpen(false)
                              }}
                              disabled={isLoading}>
                              <SelectTrigger
                                id="custom-font-unicode-range"
                                data-testid="fontara-custom-font-coverage"
                                aria-describedby="custom-font-unicode-range-description"
                                className="h-11 w-full border-[#dbe3ef] bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              {isFontCoverageSelectOpen && (
                                <SelectContent dir={direction}>
                                  {SIMPLE_CUSTOM_FONT_UNICODE_RANGE_PRESETS.map(
                                    (preset) => (
                                      <SelectItem
                                        key={preset}
                                        value={preset}
                                        data-testid={`fontara-custom-font-coverage-${preset}`}>
                                        {t(unicodeRangeLabelKeys[preset])}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              )}
                            </Select>
                            <p
                              id="custom-font-unicode-range-description"
                              className="mt-1.5 text-xs leading-5 text-[#64748b]">
                              {t("options.addFont.coverageDescription")}
                            </p>
                          </div>

                          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-5 text-blue-900">
                            <span className="flex items-start gap-2.5">
                              <Info
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-blue-600"
                              />
                              <span>{t("options.addFont.variableHint")}</span>
                            </span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <CustomFontUploadSlot
                              slot="regular"
                              inputRef={regularFontInputRef}
                              label={t("options.addFont.regularLabel")}
                              badge={t("options.addFont.required")}
                              description={t(
                                "options.addFont.regularDescription"
                              )}
                              selectLabel={t("options.addFont.selectFile")}
                              removeLabel={t("options.addFont.removeFile", {
                                role: t("options.addFont.regularLabel")
                              })}
                              preparedFont={preparedRegularFont}
                              readySummary={
                                preparedRegularFont?.isVariable
                                  ? t("options.addFont.variableReady", {
                                      max: formatNumber(
                                        preparedRegularFont.face.weight.max
                                      ),
                                      min: formatNumber(
                                        preparedRegularFont.face.weight.min
                                      )
                                    })
                                  : t("options.addFont.regularReady")
                              }
                              disabled={isLoading}
                              onClear={() =>
                                handleClearPreparedFontSlot("regular")
                              }
                              onChange={(event) =>
                                void handleFontSlotChange("regular", event)
                              }
                            />
                            <CustomFontUploadSlot
                              slot="bold"
                              inputRef={boldFontInputRef}
                              label={t("options.addFont.boldLabel")}
                              badge={t("options.addFont.optional")}
                              description={
                                regularCoversBold
                                  ? t("options.addFont.boldCovered")
                                  : t("options.addFont.boldDescription")
                              }
                              selectLabel={t("options.addFont.selectFile")}
                              removeLabel={t("options.addFont.removeFile", {
                                role: t("options.addFont.boldLabel")
                              })}
                              preparedFont={preparedBoldFont}
                              readySummary={
                                preparedBoldFont?.isVariable
                                  ? t("options.addFont.boldVariableReady")
                                  : t("options.addFont.boldReady")
                              }
                              disabled={isLoading || regularCoversBold}
                              onClear={() =>
                                handleClearPreparedFontSlot("bold")
                              }
                              onChange={(event) =>
                                void handleFontSlotChange("bold", event)
                              }
                            />
                          </div>

                          {customFontSelectionFeedback && (
                            <div
                              role="alert"
                              data-testid={`fontara-custom-font-${customFontSelectionFeedback.slot}-error`}
                              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-start">
                              <Info className="mt-0.5 size-4 shrink-0 text-red-600" />
                              <p className="min-w-0 text-xs font-bold text-red-900">
                                {customFontSelectionFeedback.title}
                              </p>
                            </div>
                          )}

                          {preparedRegularFont && (
                            <div
                              data-testid="fontara-custom-font-preview"
                              aria-live="polite"
                              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-xs font-extrabold text-slate-900">
                                    {t("options.addFont.previewTitle")}
                                  </h4>
                                  <p className="mt-1 text-[0.6875rem] leading-5 text-slate-500">
                                    {t("options.addFont.previewDescription")}
                                  </p>
                                </div>
                                {previewStatus === "loading" && (
                                  <span className="shrink-0 text-[0.6875rem] font-bold text-blue-700">
                                    {t("options.addFont.previewLoading")}
                                  </span>
                                )}
                              </div>

                              {previewStatus === "error" ? (
                                <p
                                  role="status"
                                  className="mt-3 text-xs font-bold text-red-700">
                                  {t("options.addFont.previewError")}
                                </p>
                              ) : (
                                <div
                                  className={cn(
                                    "mt-3 space-y-2 rounded-lg bg-white px-3 py-3 ring-1 ring-inset ring-slate-200 transition-opacity",
                                    previewStatus !== "ready" && "opacity-45"
                                  )}
                                  style={{
                                    fontFamily: previewFontFamily ?? undefined
                                  }}>
                                  <div>
                                    <span className="mb-1 block font-sans text-[0.625rem] font-bold text-slate-500">
                                      {t("options.addFont.regularLabel")}
                                    </span>
                                    <p
                                      dir="rtl"
                                      lang="fa"
                                      className="text-base leading-7 text-slate-900">
                                      {t("fontSelector.previewText")}
                                    </p>
                                    <p
                                      dir="ltr"
                                      lang="en"
                                      className="text-sm leading-6 text-slate-800">
                                      {t("fontSelector.previewTextLatin")}
                                    </p>
                                  </div>
                                  {(preparedBoldFont || regularCoversBold) && (
                                    <div className="border-t border-slate-100 pt-2">
                                      <span className="mb-1 block font-sans text-[0.625rem] font-bold text-slate-500">
                                        {t("options.addFont.boldLabel")}
                                      </span>
                                      <p
                                        dir="rtl"
                                        lang="fa"
                                        className="text-base font-bold leading-7 text-slate-900">
                                        {t("fontSelector.previewText")}
                                      </p>
                                      <p
                                        dir="ltr"
                                        lang="en"
                                        className="text-sm font-bold leading-6 text-slate-800">
                                        {t("fontSelector.previewTextLatin")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            type="button"
                            data-testid="fontara-custom-font-add"
                            onClick={handleSaveFont}
                            className="h-11 w-full bg-[#2374ff] text-white hover:bg-[#1f66df]"
                            disabled={
                              isLoading ||
                              !preparedRegularFont ||
                              !hasValidFontName
                            }>
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
                                  customFontStorageBytes,
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

                        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-blue-950">
                          <HardDrive
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-blue-700"
                          />
                          <div className="min-w-0">
                            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-extrabold text-blue-800 ring-1 ring-inset ring-blue-200">
                              {t("options.customFonts.localOnlyBadge")}
                            </span>
                            <p className="mt-1.5 text-xs leading-5 text-blue-900">
                              {t("options.customFonts.localOnlyDescription")}
                            </p>
                          </div>
                        </div>

                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-600">
                            <span className="font-semibold">
                              {t("options.customFonts.storageUsage", {
                                used: formatBytes(
                                  customFontStorageBytes,
                                  formatNumber,
                                  t("unit.kb"),
                                  t("unit.mb")
                                ),
                                limit: customFontStorageLimit
                              })}
                            </span>
                            <span className="shrink-0 font-bold text-slate-800">
                              {formatNumber(customFontStoragePercent / 100, {
                                style: "percent",
                                maximumFractionDigits: 0
                              })}
                            </span>
                          </div>
                          <Progress
                            dir={direction}
                            value={customFontStoragePercent}
                            aria-label={t("options.customFonts.storageUsage", {
                              used: formatBytes(
                                customFontStorageBytes,
                                formatNumber,
                                t("unit.kb"),
                                t("unit.mb")
                              ),
                              limit: customFontStorageLimit
                            })}
                            className="h-1.5 bg-slate-200"
                          />
                        </div>

                        {customFontList.length > 0 ? (
                          <div className="space-y-3">
                            {customFontList.map((font) => {
                              const recordedHealth =
                                customFontHealth[font.value]
                              const health =
                                recordedHealth?.signature ===
                                getCustomFontHealthSignature(font)
                                  ? recordedHealth.status
                                  : null

                              return (
                                <div
                                  key={font.value}
                                  data-testid={`fontara-custom-font-family-${font.value}`}
                                  className="flex flex-col gap-3 rounded-md border border-[#e5e7eb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <bdi
                                      dir="auto"
                                      title={font.displayName}
                                      className="block truncate text-sm font-semibold text-[#111827]">
                                      {font.displayName}
                                    </bdi>
                                    <div className="mt-1 truncate text-xs text-[#64748b]">
                                      {t("options.customFonts.familySummary", {
                                        count: formatNumber(font.faces.length),
                                        styles: getCustomFontFaceSummary(
                                          font.faces
                                        )
                                      })}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-[#64748b]">
                                      {t("options.savedFonts.unicodeRange", {
                                        range: getCustomFontUnicodeRangeLabel(
                                          font.unicodeRange
                                        )
                                      })}
                                    </div>
                                    {health && (
                                      <div
                                        role="status"
                                        data-testid={`fontara-custom-font-health-status-${font.value}`}
                                        className={cn(
                                          "mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-bold",
                                          health === "ready" &&
                                            "bg-emerald-50 text-emerald-700",
                                          health === "error" &&
                                            "bg-red-50 text-red-700",
                                          health === "checking" &&
                                            "bg-blue-50 text-blue-700"
                                        )}>
                                        {health === "ready"
                                          ? t("options.customFonts.healthReady")
                                          : health === "error"
                                            ? t(
                                                "options.customFonts.healthError"
                                              )
                                            : t(
                                                "options.customFonts.healthChecking"
                                              )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      data-testid={`fontara-custom-font-health-${font.value}`}
                                      onClick={() =>
                                        void handleCheckCustomFont(font)
                                      }
                                      disabled={
                                        isLoading || health === "checking"
                                      }
                                      className="border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-800">
                                      {health === "error" ? (
                                        <RotateCcw className="size-4" />
                                      ) : (
                                        <ShieldCheck className="size-4" />
                                      )}
                                      {health === "checking"
                                        ? t(
                                            "options.customFonts.healthChecking"
                                          )
                                        : health === "error"
                                          ? t("options.customFonts.healthRetry")
                                          : t(
                                              "options.customFonts.healthCheck"
                                            )}
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          data-testid={`fontara-custom-font-delete-${font.value}`}
                                          className="shrink-0 border-red-100 text-red-700 hover:bg-red-50 hover:text-red-800"
                                          disabled={isLoading}>
                                          <Trash2 className="size-4" />
                                          {t("common.delete")}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent dir={direction}>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            {t(
                                              "options.customFonts.deleteTitle"
                                            )}
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t(
                                              "options.customFonts.deleteDescription",
                                              {
                                                font: font.displayName
                                              }
                                            )}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            {t("options.backup.cancelButton")}
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            data-testid={`fontara-custom-font-delete-confirm-${font.value}`}
                                            onClick={() =>
                                              void handleDeleteFont(font.value)
                                            }>
                                            {t("common.delete")}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              )
                            })}
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
                  <Tabs
                    dir={direction}
                    value={siteSettingsTab}
                    onValueChange={(value) =>
                      setSiteSettingsTab(value as SiteSettingsTab)
                    }
                    className="space-y-5">
                    <TabsList className="fontara-subnav grid h-auto w-full grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                      <TabsTrigger
                        value="access"
                        data-testid="fontara-sites-tab-access"
                        className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
                        <ListChecks className="size-4" />
                        {t("options.sites.accessTab")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="profiles"
                        data-testid="fontara-sites-tab-profiles"
                        className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
                        <Settings className="size-4" />
                        {t("options.sites.profilesTab")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="optimized"
                        data-testid="fontara-sites-tab-optimized"
                        className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
                        <Sparkles className="size-4" />
                        {t("options.sites.optimizedTab")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="access" className="mt-0">
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
                              onClick={() =>
                                void handleSiteListModeChange(false)
                              }
                              className={cn(
                                "fontara-choice flex w-full items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                                !normalizedEnabledByDefault &&
                                  "border-[#b9d4ff]"
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
                              onClick={() =>
                                void handleSiteListModeChange(true)
                              }
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
                                    setSitePatternScope(
                                      value as SitePatternScope
                                    )
                                  }>
                                  <SelectTrigger
                                    className="h-10 rounded-md border-[#dbe3ef] text-sm"
                                    aria-label={t(
                                      "options.siteList.scopeLabel"
                                    )}
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
                              <div className="space-y-2">
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
                                        aria-label={t(
                                          "options.siteList.remove",
                                          {
                                            site: pattern
                                          }
                                        )}
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
                    </TabsContent>

                    <TabsContent value="profiles" className="mt-0">
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
                                          src={
                                            selectedSiteProfileTarget.iconUrl
                                          }
                                          className="size-6 shrink-0 rounded object-contain"
                                        />
                                      )}
                                      <span className="min-w-0 flex-1">
                                        <bdi
                                          className={cn(
                                            "block truncate text-sm font-bold",
                                            selectedSiteProfilePattern
                                              ? "text-[#111827]"
                                              : "text-[#64748b]"
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
                                    <ChevronsUpDown className="ms-2 size-4 shrink-0 text-[#64748b]" />
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
                                              value={
                                                siteProfileAddTargetPattern
                                              }
                                              data-testid="fontara-site-profile-target-add"
                                              className="min-h-11 cursor-pointer gap-3 px-2"
                                              onSelect={
                                                handleAddSiteProfileTarget
                                              }>
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
                              <Select
                                dir={direction}
                                disabled={
                                  siteProfileGoogleFontStatus === "loading"
                                }
                                open={siteProfileFontPickerOpen}
                                value={
                                  siteProfileFontInput ||
                                  GLOBAL_SITE_PROFILE_FONT_VALUE
                                }
                                onOpenChange={setSiteProfileFontPickerOpen}
                                onValueChange={(value) => {
                                  setSiteProfileGoogleFontStatus("idle")
                                  setSiteProfileFontInput(
                                    value === GLOBAL_SITE_PROFILE_FONT_VALUE
                                      ? ""
                                      : value
                                  )
                                }}>
                                <SelectTrigger
                                  id="site-profile-font"
                                  data-testid="fontara-site-profile-font-select"
                                  className="h-10 border-[#dbe3ef] bg-white text-[#111827] shadow-none focus:ring-[#2374ff]/20">
                                  <SelectValue>
                                    {getSiteProfileFontLabel(
                                      siteProfileFontInput
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent
                                  dir={direction}
                                  className="max-h-80 border-[#dbe3ef] shadow-xl">
                                  <SelectItem
                                    value={GLOBAL_SITE_PROFILE_FONT_VALUE}
                                    data-testid="fontara-site-profile-font-option-global">
                                    {t("options.siteProfiles.globalFont")}
                                  </SelectItem>
                                  {siteFontOptionGroups.map((group) =>
                                    group.options.length > 0 ? (
                                      <SelectGroup key={group.label}>
                                        <SelectLabel className="text-xs text-slate-500">
                                          {group.label}
                                        </SelectLabel>
                                        {group.options.map((font) => (
                                          <SelectItem
                                            key={font.value}
                                            value={font.value}
                                            data-testid={`fontara-site-profile-font-option-${font.value}`}>
                                            {font.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    ) : null
                                  )}
                                </SelectContent>
                              </Select>
                              {siteProfileGoogleFontStatus !== "idle" && (
                                <div
                                  aria-live="polite"
                                  className={cn(
                                    "mt-2 flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs",
                                    siteProfileGoogleFontStatus === "error"
                                      ? "border-red-100 bg-red-50 text-red-700"
                                      : "border-blue-100 bg-blue-50 text-blue-700"
                                  )}>
                                  <span>
                                    {siteProfileGoogleFontStatus === "loading"
                                      ? t("fontSelector.googleDownloading", {
                                          font:
                                            decodeGoogleFontValue(
                                              siteProfileFontInput
                                            ) ?? ""
                                        })
                                      : t("fontSelector.googleDownloadFailed")}
                                  </span>
                                  {siteProfileGoogleFontStatus === "error" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 shrink-0 px-2 text-[11px]"
                                      onClick={() =>
                                        void handleSaveSiteProfile()
                                      }>
                                      {t("fontSelector.googleRetry")}
                                    </Button>
                                  )}
                                </div>
                              )}
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
                                  aria-label={t(
                                    "options.siteProfiles.strokeLabel"
                                  )}
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
                                  aria-label={t(
                                    "options.siteProfiles.strokeLabel"
                                  )}
                                  className="h-2 w-full cursor-pointer accent-[#2374ff] disabled:cursor-not-allowed"
                                />
                                <div className="flex items-center justify-between text-[10px] font-semibold text-[#64748b]">
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
                                disabled={
                                  siteProfileGoogleFontStatus === "loading"
                                }
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
                                  count: formatNumber(
                                    normalizedSiteProfiles.length
                                  )
                                })}
                              </p>
                            </div>

                            {normalizedSiteProfiles.length > 0 ? (
                              <div className="space-y-2">
                                {normalizedSiteProfiles.map((profile) => {
                                  const hasCustomCss =
                                    hasCustomCssForSitePattern(profile.pattern)
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
                                            {getDisplaySitePattern(
                                              profile.pattern
                                            )}
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
                                              : t(
                                                  "options.siteProfiles.inactive"
                                                )}
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
                                            {t(
                                              "options.siteProfiles.fontValue"
                                            )}
                                          </span>{" "}
                                          <span dir="auto">
                                            {getSiteProfileFontLabel(
                                              profile.font
                                            )}
                                          </span>
                                        </div>
                                        <div className="rounded-md bg-white px-3 py-2">
                                          <span className="font-semibold text-[#334155]">
                                            {t(
                                              "options.siteProfiles.strokeValue"
                                            )}
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
                    </TabsContent>

                    <TabsContent value="optimized" className="mt-0">
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
                                            src={getExtensionAssetURL(
                                              website.icon
                                            )}
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
                                        <span className="text-xs text-[#64748b]">
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
                                          "mx-auto h-8 w-8 text-[#64748b] hover:bg-[#eaf2ff] hover:text-[#175cd3]",
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
                                        aria-label={t(
                                          "options.siteToggleAria",
                                          {
                                            site: websiteTitle
                                          }
                                        )}
                                      />
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </section>
                    </TabsContent>
                  </Tabs>
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
                              {t("options.backup.importWarningDescription", {
                                count: formatNumber(customFontList.length)
                              })}
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
                                {t("options.backup.resetWarningDescription", {
                                  count: formatNumber(customFontList.length)
                                })}
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
