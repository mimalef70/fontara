import React, { useState } from "react"
import logo from "url:~assets/newlogo.svg"

import { Storage } from "@plasmohq/storage"

import "./style.css"
import "./fonts.css"

import { useStorage } from "@plasmohq/storage/hook"

import { ToastProvider } from "~src/components/ui/Toast"
import { Toaster } from "~src/components/ui/toaster"
import { useToast } from "~src/hooks/use-toast"
import { defaultFonts } from "~src/lib/constants"
import type { CustomFont, FontData } from "~src/utils/types"
import { browserAPI } from "~src/utils/utils"

const storage = new Storage()

function OptionsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fontName, setFontName] = useState("")
  // const [savedFonts, setSavedFonts] = useState<CustomFont[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [savedFonts, setSavedFonts] = useStorage<CustomFont[]>(
    "customFonts",
    []
  )

  const generateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    return hashHex
  }

  const isFileContentDuplicate = async (fileHash: string): Promise<boolean> => {
    const allFonts: any = await browserAPI.storage.local.get(null)
    for (const key in allFonts) {
      if (key.startsWith("font_")) {
        const fontData = allFonts[key] as FontData
        if (fontData.fileHash === fileHash) {
          return true
        }
      }
    }
    return false
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = [".ttf", ".woff", ".woff2", ".otf"]
      const extension = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase()

      if (!validTypes.includes(extension)) {
        toast({
          title: "لطفا یک فایل فونت معتبر (ttf, woff, woff2, otf) انتخاب کنید"
        })
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "حجم فایل فونت نباید بیشتر از 2 مگابایت باشد"
        })
        return
      }

      // Generate hash and check for duplicates
      const fileHash = await generateFileHash(file)
      const isDuplicate = await isFileContentDuplicate(fileHash)

      if (isDuplicate) {
        toast({
          title: "این فایل فونت قبلاً آپلود شده است"
        })
        return
      }

      setSelectedFile(file)
    }
  }

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result && typeof reader.result === "string") {
          const base64Data = reader.result.split(",")[1]
          resolve(base64Data)
        } else {
          reject(new Error("Failed to read file"))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const handleSaveFont = async () => {
    if (!selectedFile || !fontName) {
      toast({
        title: "خطا در پردازش, لطفا فونت و نام فونت را مجددن چک کنید"
      })
      return
    }

    setIsLoading(true)

    try {
      // Check for duplicate names with null checks
      const normalizedNewName = fontName.toLowerCase().trim()

      const isDuplicateDefault = defaultFonts.some((font) => {
        const defaultName = font.name?.toLowerCase()?.trim() || ""
        const defaultValue = font.value?.toLowerCase()?.trim() || ""
        return (
          defaultName === normalizedNewName ||
          defaultValue === normalizedNewName
        )
      })

      if (isDuplicateDefault) {
        throw new Error("این نام فونت قبلاً در لیست فونت‌های پیش‌فرض وجود دارد")
      }

      const currentFonts =
        (await storage.get<CustomFont[]>("customFonts")) || []
      const isDuplicateCustom = currentFonts.some((font) => {
        const customName = font.name?.toLowerCase()?.trim() || ""
        return customName === normalizedNewName
      })

      if (isDuplicateCustom) {
        throw new Error("فونتی با این نام قبلاً اضافه شده است")
      }

      // Generate file hash
      const fileHash = await generateFileHash(selectedFile)

      // Convert file to base64
      const base64Data = await convertToBase64(selectedFile)
      const extension = selectedFile.name.substring(
        selectedFile.name.lastIndexOf(".") + 1
      )

      // Create and save font data
      const fontData: FontData = {
        name: fontName,
        data: base64Data,
        type: extension,
        fileHash,
        originalFileName: selectedFile.name
      }

      // Save to browserAPI.storage.local
      await new Promise<void>((resolve, reject) => {
        browserAPI.storage.local.set({ [`font_${fontName}`]: fontData }, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError)
          } else {
            resolve()
          }
        })
      })

      // Create metadata
      const newFont: CustomFont = {
        value: fontName,
        name: fontName,
        style: `font-${fontName.toLowerCase()}`,
        type: extension,
        fileHash,
        originalFileName: selectedFile.name
      }

      // Save metadata to storage
      const updatedFonts = [...currentFonts, newFont]
      await storage.set("customFonts", updatedFonts)

      // Update local state
      setSavedFonts(updatedFonts)

      toast({
        title: "فونت با موفقیت اضافه شد"
      })

      setSelectedFile(null)
      setFontName("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      // Close window and refresh parent
      if (window.opener) {
        window.opener.postMessage({ type: "FONT_ADDED", fontName }, "*")
        window.close()
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "خطا در پردازش فونت"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFont = async (fontName: string) => {
    try {
      // Remove from browserAPI.storage.local
      await new Promise<void>((resolve, reject) => {
        browserAPI.storage.local.remove(`font_${fontName}`, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError)
          } else {
            resolve()
          }
        })
      })

      // Remove from metadata storage
      const currentFonts =
        (await storage.get<CustomFont[]>("customFonts")) || []
      const updatedFonts = currentFonts.filter(
        (font) => font.value !== fontName
      )
      await storage.set("customFonts", updatedFonts)

      // Update local state
      setSavedFonts(updatedFonts)

      toast({
        title: "فونت با موفقیت حذف شد"
      })

      // Notify parent window
      if (window.opener) {
        window.opener.postMessage({ type: "FONT_DELETED", fontName }, "*")
      }
    } catch (error) {
      toast({
        title: "خطا در حذف فونت"
      })
    }
  }

  return (
    <ToastProvider>
      <div className="p-4 max-w-xl mx-auto font-estedad">
        <div className="bg-white rounded shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <img alt="" src={logo} className="w-1/3" />
            <h2 className="text-xl font-bold text-right ">
              افزودن فونت دلخواه
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-right mb-2">انتخاب فونت</label>
              <input
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
              <label className="block text-right mb-2">نام فونت</label>
              <input
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
              onClick={handleSaveFont}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
              disabled={isLoading}>
              {isLoading ? "در حال افزودن..." : "افزودن فونت"}
            </button>

            {savedFonts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-right mb-2">
                  فونت‌های اضافه شده
                </h3>
                <div className="space-y-2">
                  {savedFonts.map((font) => (
                    <div
                      key={font.value}
                      className="flex flex-col p-2 border rounded">
                      <div className="flex justify-between items-center w-full mb-1">
                        <button
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

export default OptionsPage
