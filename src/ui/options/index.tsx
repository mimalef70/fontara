import {
  FileText,
  Globe2,
  Info,
  ListChecks,
  Settings,
  Trash2,
  Type,
  Upload
} from "lucide-react"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

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
import { EMPTY_CUSTOM_FONT_LIST, EMPTY_WEBSITE_LIST } from "../storage-defaults"

type SettingsSection = "fonts" | "sites" | "status"

const settingsNavigation: Array<{
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "fonts", label: "فونت‌های دلخواه", icon: Type },
  { id: "sites", label: "سایت‌ها", icon: Globe2 },
  { id: "status", label: "وضعیت", icon: ListChecks }
]

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "۰ KB"

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 1
    }).format(kilobytes)} KB`
  }

  return `${new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 1
  }).format(kilobytes / 1024)} MB`
}

function OptionsPage() {
  useSelectedUIFont()

  const [customFontList, setCustomFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [websiteList, setWebsiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
  )
  const [activeSection, setActiveSection] = useState<SettingsSection>("fonts")

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
            reject(new Error("Failed to read file"))
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
        title: "لطفا یک فایل فونت معتبر (ttf, woff, woff2, otf) انتخاب کنید"
      })
      resetSelectedFile()
      return
    }

    if (file.size > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
      toast({ title: "حجم فایل فونت نباید بیشتر از 2 مگابایت باشد" })
      resetSelectedFile()
      return
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer())
    if (!isFontFileSignatureSupported(extension, fileBytes)) {
      toast({ title: "محتوای فایل انتخاب‌شده با فرمت فونت سازگار نیست" })
      resetSelectedFile()
      return
    }

    const fileHash = await fontUtils.generateFileHash(fileBytes)
    const isDuplicate = fontUtils.isFileContentDuplicate(fileHash)

    if (isDuplicate) {
      toast({ title: "این فایل فونت قبلاً آپلود شده است" })
      resetSelectedFile()
      return
    }

    setSelectedFile(file)
    setSelectedFileHash(fileHash)
  }

  const handleSaveFont = async () => {
    const normalizedFontName = fontName.trim()

    if (!selectedFile || !normalizedFontName) {
      toast({ title: "فیلدهای خالی را پر کنید" })
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
        throw new Error("نام فونت تکراری است")
      }

      const fileHash =
        selectedFileHash ||
        (await fontUtils.generateFileHash(
          new Uint8Array(await selectedFile.arrayBuffer())
        ))
      if (fontUtils.isFileContentDuplicate(fileHash)) {
        throw new Error("این فایل فونت قبلاً آپلود شده است")
      }

      const base64Data = await fontUtils.convertToBase64(selectedFile)
      const extension = getFontFileExtension(selectedFile.name)
      const normalizedDataURL = normalizeFontDataURL(base64Data, extension)
      if (!normalizedDataURL || !getFontDataURLFormat(normalizedDataURL)) {
        throw new Error("فایل فونت معتبر نیست")
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

      toast({ title: "فونت با موفقیت اضافه شد" })

      resetSelectedFile()
      setFontName("")
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "خطا در پردازش فونت"
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
      toast({ title: "فونت با موفقیت حذف شد" })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "خطا در حذف فونت"
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
          error instanceof Error ? error.message : "خطا در ذخیره تنظیمات سایت"
      })
    }
  }

  const isWebsiteActive = (website: WebsiteItem) => {
    return (
      effectiveWebsiteList.find((item) => item.url === website.url)
        ?.isActive !== false
    )
  }

  return (
    <ToastProvider>
      <div className="font-estedad" dir="rtl">
        <SidebarProvider>
          <Sidebar collapsible="icon" dir="rtl" side="right">
            <SidebarHeader>
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  alt=""
                  src={getExtensionAssetURL("assets/newlogo.svg")}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <h1 className="truncate text-base font-bold text-[#111827]">
                    فونت آرا
                  </h1>
                  <p className="text-xs text-[#64748b]">تنظیمات افزونه</p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>بخش‌ها</SidebarGroupLabel>
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
                              {item.label}
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
                  نسخه ۴.۳
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
                  {settingsNavigation.find((item) => item.id === activeSection)
                    ?.label || "تنظیمات"}
                </h2>
                <p className="text-xs text-[#64748b]">
                  {activeSection === "fonts" && "مدیریت فونت‌های اضافه‌شده"}
                  {activeSection === "sites" && "مدیریت سایت‌های پیش‌فرض"}
                  {activeSection === "status" && "نمای کلی وضعیت تنظیمات"}
                </p>
              </div>
            </header>

            <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
              {activeSection === "fonts" && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          افزودن فونت
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          ttf, woff, woff2, otf تا ۲ MB
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
                          فایل فونت
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
                          نام فونت
                        </label>
                        <input
                          id="custom-font-name"
                          type="text"
                          value={fontName}
                          onChange={(event) => setFontName(event.target.value)}
                          placeholder="نام فونت را وارد کنید"
                          className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
                          disabled={isLoading}
                          dir="rtl"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleSaveFont}
                        className="h-11 w-full bg-[#2374ff] text-white hover:bg-[#1f66df]"
                        disabled={isLoading}>
                        <Upload className="size-4" />
                        {isLoading ? "در حال افزودن" : "افزودن فونت"}
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">
                          فونت‌های ذخیره‌شده
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          {customFontList.length} فونت،{" "}
                          {formatBytes(fontStorageBytes)}
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
                              حذف
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-dashed border-[#dbe3ef] text-sm text-[#64748b]">
                        فونتی ذخیره نشده است
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeSection === "sites" && (
                <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#111827]">
                        سایت‌های پیش‌فرض
                      </h3>
                      <p className="mt-1 text-xs text-[#64748b]">
                        {activeWebsiteCount} فعال از{" "}
                        {effectiveWebsiteList.length} سایت
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
                                  ? "CSS اختصاصی"
                                  : "حالت عمومی"}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={active}
                            onCheckedChange={() =>
                              void handleWebsiteToggle(website)
                            }
                            aria-label={`تغییر وضعیت ${website.siteName || website.url}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {activeSection === "status" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <Settings className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {customFontList.length}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      فونت دلخواه
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <Globe2 className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {activeWebsiteCount}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">سایت فعال</div>
                  </section>

                  <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
                    <ListChecks className="mb-4 size-5 text-[#2374ff]" />
                    <div className="text-2xl font-bold text-[#111827]">
                      {cssOnlyWebsiteCount}
                    </div>
                    <div className="mt-1 text-sm text-[#64748b]">
                      CSS اختصاصی
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

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("FontAra options root element was not found.")
}

createRoot(rootElement).render(
  <ErrorBoundary title="خطا در بارگذاری تنظیمات فونت‌آرا">
    <OptionsPage />
  </ErrorBoundary>
)
