import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import { STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
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
import { ToastProvider } from "../components/ui/Toast"
import { Toaster } from "../components/ui/toaster"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useStorageValue } from "../hooks/use-storage"
import { useToast } from "../hooks/use-toast"
import { EMPTY_CUSTOM_FONT_LIST } from "../storage-defaults"

function OptionsPage() {
  useSelectedUIFont()

  const [customFontList, setCustomFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )

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

  return (
    <ToastProvider>
      <div className="p-4 max-w-xl mx-auto font-estedad">
        <div className="bg-white rounded shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <img
              alt=""
              src={getExtensionAssetURL("assets/newlogo.svg")}
              className="w-1/3"
            />
            <h2 className="text-xl font-bold text-right ">
              افزودن فونت دلخواه
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="custom-font-file"
                className="block text-right mb-2">
                انتخاب فونت
              </label>
              <input
                id="custom-font-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".ttf,.woff,.woff2,.otf"
                className="w-full p-2 border rounded"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-500 text-right mt-1">
                فرمت‌های مجاز: ttf, woff, woff2, otf (حداکثر 2 مگابایت)
              </p>
            </div>

            <div>
              <label
                htmlFor="custom-font-name"
                className="block text-right mb-2">
                نام فونت
              </label>
              <input
                id="custom-font-name"
                type="text"
                value={fontName}
                onChange={(e) => setFontName(e.target.value)}
                placeholder="نام فونت را وارد کنید"
                className="w-full p-2 border rounded"
                disabled={isLoading}
                dir="rtl"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveFont}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
              disabled={isLoading}>
              {isLoading ? "در حال افزودن..." : "افزودن فونت"}
            </button>

            {customFontList.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-right mb-2">
                  فونت‌های اضافه شده
                </h3>
                <div className="space-y-2">
                  {customFontList.map((font: FontData) => (
                    <div
                      key={font.value}
                      className="flex flex-col p-2 border rounded">
                      <div className="flex justify-between items-center w-full mb-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteFont(font.value)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                          disabled={isLoading}>
                          حذف
                        </button>
                        <span>{font.name}</span>
                      </div>
                      {font.originalFileName && (
                        <div className="text-sm text-gray-500 text-right w-full border-t pt-1 mt-1">
                          نام فایل: {font.originalFileName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
