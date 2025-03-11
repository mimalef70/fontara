import React, { useState } from "react"
import logo from "url:~assets/newlogo.svg"

import { Storage } from "@plasmohq/storage"

import "./style.css"
import "./fonts.css"

import { useStorage } from "@plasmohq/storage/hook"

import { ToastProvider } from "~src/components/ui/Toast"
import { Toaster } from "~src/components/ui/toaster"
import { useToast } from "~src/hooks/use-toast"
import type { CustomFont, FontData } from "~src/utils/types"

function OptionsPage() {
  const [customFontList, setCustomFontList] = useStorage(
    {
      key: "customFontList",
      instance: new Storage({
        area: "local"
      })
    },
    []
  )

  const fontUtils = {
    generateFileHash: async (file) => {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    },
    isFileContentDuplicate: async (fileHash: string) => {
      customFontList.forEach((customFont: CustomFont) => {
        console.log(customFont.fileHash === fileHash)
        if (customFont.fileHash === fileHash) return true
      })
      return false
    },
    convertToBase64: (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result && typeof reader.result === "string") {
            // resolve(reader.result.split(",")[1])
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
  const [selectedFile, setSelectedFile] = useState(null)
  const [fontName, setFontName] = useState("")
  const { toast } = useToast()

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

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
      toast({ title: "حجم فایل فونت نباید بیشتر از 2 مگابایت باشد" })
      return
    }

    // const fileHash = await fontUtils.generateFileHash(file)
    // const isDuplicate = await fontUtils.isFileContentDuplicate(fileHash)

    // if (isDuplicate) {
    //   toast({ title: "این فایل فونت قبلاً آپلود شده است" })
    //   return
    // }

    setSelectedFile(file)
  }

  const handleSaveFont = async () => {
    if (!selectedFile || !fontName) {
      toast({ title: "فیلدهای خالی را پر کنید" })
      return
    }

    setIsLoading(true)

    try {
      const isDuplicateName = customFontList.some((font) => {
        return (
          (font.name.toLowerCase().trim() || "") ===
          fontName.toLowerCase().trim()
        )
      })

      if (isDuplicateName) {
        throw new Error("نام فونت تکراری است")
      }

      // Process and save the font
      // const fileHash = await fontUtils.generateFileHash(selectedFile)
      const base64Data = await fontUtils.convertToBase64(selectedFile)
      const extension = selectedFile.name.substring(
        selectedFile.name.lastIndexOf(".") + 1
      )

      const suffix = "-Fontara"
      let value

      // Generate random prefix and check if it exists
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
        name: fontName,
        data: base64Data,
        // fileHash: fileHash,
        type: extension,
        originalFileName: selectedFile.name
      }

      const updatedFonts = [...customFontList, fontData]
      setCustomFontList(updatedFonts)

      toast({ title: "فونت با موفقیت اضافه شد" })

      // Reset form
      setSelectedFile(null)
      setFontName("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "خطا در پردازش فونت"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFont = async (fontValue: string) => {
    const updatedFonts = customFontList.filter(
      (font) => font.value !== fontValue
    )
    setCustomFontList(updatedFonts)
    toast({ title: "فونت با موفقیت حذف شد" })
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
