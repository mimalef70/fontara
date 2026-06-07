import {
  AlignRight,
  Check,
  FileText,
  Globe2,
  HardDrive,
  Info,
  Languages,
  ListChecks,
  Settings,
  Trash2,
  Type,
  Upload
} from "lucide-react"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { version } from "../../../package.json"
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
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { FontData, WebsiteItem } from "../../definitions"
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
import { getLocalValue, setLocalValues } from "../../utils/storage"
import {
  getSystemFontList,
  isSystemFontAccessSupported,
  isSystemFontValue
} from "../../utils/system-fonts"
import ErrorBoundary from "../components/ErrorBoundary"
import { Button } from "../components/ui/button"
import { Switch } from "../components/ui/Switch"
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
import { Toaster } from "../components/ui/toaster"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useStorageValue } from "../hooks/use-storage"
import { useToast } from "../hooks/use-toast"
import { I18nProvider, useI18n, waitForI18nBootstrap } from "../i18n"
import type { MessageKey } from "../i18n/messages"
import {
  EMPTY_CUSTOM_FONT_LIST,
  EMPTY_WEBSITE_LIST,
  getRtlEnabledInitialValue,
  getRtlSiteSettingsInitialValue,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"

type SettingsSection = "fonts" | "sites" | "rtl" | "language" | "status"

const settingsNavigation: Array<{
  id: SettingsSection
  labelKey: MessageKey
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "fonts", labelKey: "options.nav.fonts", icon: Type },
  { id: "sites", labelKey: "options.nav.sites", icon: Globe2 },
  { id: "rtl", labelKey: "options.nav.rtl", icon: AlignRight },
  { id: "language", labelKey: "options.nav.language", icon: Languages },
  { id: "status", labelKey: "options.nav.status", icon: ListChecks }
]

const sectionDescriptionKeys: Record<SettingsSection, MessageKey> = {
  fonts: "options.section.fonts.description",
  sites: "options.section.sites.description",
  rtl: "options.section.rtl.description",
  language: "options.section.language.description",
  status: "options.section.status.description"
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

  const [customFontList, setCustomFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [systemFontsEnabled, setSystemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )
  const [websiteList, setWebsiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
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
  const [activeSection, setActiveSection] = useState<SettingsSection>("fonts")
  const activeNavigation = settingsNavigation.find(
    (item) => item.id === activeSection
  )
  const sidebarSide = direction === "rtl" ? "right" : "left"

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
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileHash, setSelectedFileHash] = useState("")
  const [fontName, setFontName] = useState("")
  const { toast } = useToast()

  React.useEffect(() => {
    document.title = t("common.settings")
  }, [t])

  const resetSelectedFile = () => {
    setSelectedFile(null)
    setSelectedFileHash("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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

    if (!selectedFile || !normalizedFontName) {
      toast({ title: t("options.toast.emptyFields") })
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
        originalFileName: selectedFile.name
      }

      const updatedFonts = [...customFontList, fontData]
      await setCustomFontList(updatedFonts)

      toast({ title: t("options.toast.fontAdded") })

      resetSelectedFile()
      setFontName("")
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
      const selectedFont = await getLocalValue<string>(
        STORAGE_KEYS.SELECTED_FONT
      )
      const storageUpdate = createCustomFontDeletionUpdate(
        customFontList,
        fontValue,
        selectedFont
      )
      await setLocalValues(storageUpdate)
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

  const effectiveWebsiteList =
    websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
  const activeWebsiteCount = effectiveWebsiteList.filter(
    (website) => website.isActive !== false
  ).length
  const cssOnlyWebsiteCount = effectiveWebsiteList.filter(
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

  const handleWebsiteToggle = async (website: WebsiteItem) => {
    const currentWebsiteList =
      websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
    const updatedWebsiteList = currentWebsiteList.map((item) =>
      item.url === website.url
        ? { ...item, isActive: item.isActive === false }
        : item
    )

    try {
      await setWebsiteList(updatedWebsiteList)
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
    return (
      effectiveWebsiteList.find((item) => item.url === website.url)
        ?.isActive !== false
    )
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
        const selectedFont = await getLocalValue<string>(
          STORAGE_KEYS.SELECTED_FONT
        )
        await setLocalValues({
          [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false,
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
      <div className="font-estedad" dir={direction} lang={language}>
        <SidebarProvider>
          <Sidebar collapsible="icon" dir={direction} side={sidebarSide}>
            <SidebarHeader>
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  alt=""
                  src={getExtensionAssetURL("assets/newlogo.svg")}
                  className="size-10 shrink-0"
                />
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

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>
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
                            onClick={() => setActiveSection(item.id)}>
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

            <SidebarFooter>
              <div className="flex items-center gap-3 rounded-md bg-[#f8fafc] px-3 py-2 text-xs text-[#64748b]">
                <Info className="size-4 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {t("common.version", { version: formatVersion(version) })}
                </span>
              </div>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-white/90 px-6 backdrop-blur">
              <SidebarTrigger className="shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-[#111827]">
                  {activeNavigation
                    ? t(activeNavigation.labelKey)
                    : t("common.settings")}
                </h2>
                <p className="text-xs text-[#64748b]">
                  {t(sectionDescriptionKeys[activeSection])}
                </p>
              </div>
            </header>

            <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
              {activeSection === "fonts" && (
                <div className="space-y-6">
                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-md border px-4 py-4 transition",
                        systemFontsEnabled
                          ? "border-[#dbeafe] bg-[#f8fbff]"
                          : "border-[#e5e7eb] bg-white"
                      )}>
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
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
                            {systemFontsEnabled
                              ? t("options.systemFonts.enabled")
                              : t("options.systemFonts.disabled")}
                          </p>
                        </div>
                      </div>
                      <Switch
                        dir="ltr"
                        checked={systemFontsEnabled}
                        onCheckedChange={(checked) =>
                          void handleSystemFontsToggle(checked)
                        }
                        aria-label={t("options.systemFonts.title")}
                      />
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">
                            {t("options.addFont.title")}
                          </h3>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {t("options.addFont.subtitle")}
                          </p>
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
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

                    <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
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
                <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#111827]">
                        {t("options.sites.title")}
                      </h3>
                      <p className="mt-1 text-xs text-[#64748b]">
                        {t("options.sites.count", {
                          active: formatNumber(activeWebsiteCount),
                          total: formatNumber(effectiveWebsiteList.length)
                        })}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
                      <Globe2 className="size-5" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {effectiveWebsiteList.map((website) => {
                      const active = isWebsiteActive(website)

                      return (
                        <div
                          key={website.url}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition",
                            active
                              ? "border-[#dbeafe] bg-[#f8fbff]"
                              : "border-[#e5e7eb] bg-white opacity-70"
                          )}>
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
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[#111827]">
                                {website.siteName || website.url}
                              </div>
                              <div className="truncate text-xs text-[#64748b]">
                                {website.customCss
                                  ? t("options.siteMode.customCss")
                                  : t("options.siteMode.general")}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={active}
                            onCheckedChange={() =>
                              void handleWebsiteToggle(website)
                            }
                            aria-label={t("options.siteToggleAria", {
                              site: website.siteName || website.url
                            })}
                          />
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {activeSection === "rtl" && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          {t("options.rtl.title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {t("options.rtl.subtitle")}
                        </p>
                      </div>
                      <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
                        <AlignRight className="size-5" />
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-md border px-4 py-4 transition",
                        rtlEnabled
                          ? "border-[#dbeafe] bg-[#f8fbff]"
                          : "border-[#e5e7eb] bg-white"
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

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
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

                    <div className="grid gap-3 sm:grid-cols-2">
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
                              "flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition",
                              active
                                ? "border-[#dbeafe] bg-[#f8fbff]"
                                : "border-[#e5e7eb] bg-white opacity-70"
                            )}>
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                alt=""
                                src={getExtensionAssetURL(site.icon)}
                                className={cn(
                                  "size-8 rounded-md object-contain",
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

              {activeSection === "language" && (
                <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#111827]">
                        {t("language.title")}
                      </h3>
                      <p className="mt-1 text-xs text-[#64748b]">
                        {t("language.subtitle")}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
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
                            "flex min-h-24 items-start justify-between gap-3 rounded-md border p-4 text-start transition",
                            active
                              ? "border-[#2374ff] bg-[#f8fbff]"
                              : "border-[#e5e7eb] bg-white hover:border-[#bfdbfe] hover:bg-[#f8fafc]"
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
              )}

              {activeSection === "status" && (
                <div className="grid gap-4 md:grid-cols-4">
                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <Settings className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {formatNumber(customFontList.length)}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      {t("options.status.customFonts")}
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <Globe2 className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {formatNumber(activeWebsiteCount)}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      {t("options.status.activeSites")}
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <ListChecks className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {formatNumber(cssOnlyWebsiteCount)}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      {t("options.status.cssOnly")}
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <AlignRight className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {formatNumber(activeRtlSiteCount)}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      {t("options.status.rtlSites")}
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
    <I18nProvider>
      <LocalizedOptionsRoot />
    </I18nProvider>
  )
}

void mountOptions()
