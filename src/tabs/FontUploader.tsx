import React, { useState, useEffect } from 'react'
import { Storage } from "@plasmohq/storage"
import { defaultFonts } from "../components/FontSelector"
import '../style.css';
import { useToast } from "../components/ui/use-toast"
import { Toast, ToastProvider } from '~components/ui/Toast';
import { Toaster } from '~components/ui/toaster';

interface CustomFont {
    value: string
    name: string
    svg: string
    style: string
    type: string
}

interface FontData {
    name: string
    data: string
    type: string
}

const storage = new Storage()

const FontUploader = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fontName, setFontName] = useState("")
    const [savedFonts, setSavedFonts] = useState<CustomFont[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()


    useEffect(() => {
        loadCustomFonts()
    }, [])

    const loadCustomFonts = async () => {
        try {
            const fonts = await storage.get<CustomFont[]>("customFonts") || []
            setSavedFonts(fonts)
        } catch (error) {
            console.error("Error loading fonts:", error)
            toast({
                title: "خطا در بارگذاری فونت‌ها",
            })
        }
    }

    // File handling functions remain the same...
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const validTypes = ['.ttf', '.woff', '.woff2', '.otf']
            const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

            if (!validTypes.includes(extension)) {
                toast({
                    title: "لطفا یک فایل فونت معتبر (ttf, woff, woff2, otf) انتخاب کنید",
                })
                return
            }

            if (file.size > 2 * 1024 * 1024) {
                toast({
                    title: "حجم فایل فونت نباید بیشتر از 2 مگابایت باشد",
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
                if (reader.result && typeof reader.result === 'string') {
                    const base64Data = reader.result.split(',')[1]
                    resolve(base64Data)
                } else {
                    reject(new Error('Failed to read file'))
                }
            }
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })
    }

    const handleSaveFont = async () => {
        if (!selectedFile || !fontName) {
            toast({
                title: "لطفا فایل فونت و نام فونت را وارد کنید",
            })
            return
        }

        setIsLoading(true)

        try {
            // Check for duplicate names
            if (defaultFonts.some(font => font.name === fontName || font.value === fontName)) {
                throw new Error('این نام فونت قبلاً در لیست فونت‌های پیش‌فرض وجود دارد')
            }

            const currentFonts = await storage.get<CustomFont[]>("customFonts") || []
            if (currentFonts.some(font => font.name === fontName)) {
                throw new Error('فونتی با این نام قبلاً اضافه شده است')
            }

            // Convert file to base64
            const base64Data = await convertToBase64(selectedFile)
            const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.') + 1)

            // Create and save font data
            const fontData: FontData = {
                name: fontName,
                data: base64Data,
                type: extension
            }

            // Save to chrome.storage.local
            await new Promise<void>((resolve, reject) => {
                chrome.storage.local.set({ [`font_${fontName}`]: fontData }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError)
                    } else {
                        resolve()
                    }
                })
            })

            // Create metadata
            const newFont: CustomFont = {
                value: fontName,
                name: fontName,
                svg: "بستد دل و دین از من",
                style: `font-${fontName.toLowerCase()}`,
                type: extension
            }

            // Save metadata to storage
            const updatedFonts = [...currentFonts, newFont]
            await storage.set("customFonts", updatedFonts)

            // Update local state
            setSavedFonts(updatedFonts)

            // Reset form state
            setSelectedFile(null)
            setFontName("")

            // Show success message

            toast({
                title: "فونت با موفقیت اضافه شد",
            })

            // Close window and refresh parent
            if (window.opener) {
                window.opener.postMessage({ type: 'FONT_ADDED', fontName }, '*')
                window.close()
            }

        } catch (error) {
            console.error("Error processing font:", error)
            toast({
                title: "خطا در پردازش فونت",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteFont = async (fontName: string) => {
        try {
            // Remove from chrome.storage.local
            await new Promise<void>((resolve, reject) => {
                chrome.storage.local.remove(`font_${fontName}`, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError)
                    } else {
                        resolve()
                    }
                })
            })

            // Remove from metadata storage
            const currentFonts = await storage.get<CustomFont[]>("customFonts") || []
            const updatedFonts = currentFonts.filter(font => font.value !== fontName)
            await storage.set("customFonts", updatedFonts)

            // Update local state
            setSavedFonts(updatedFonts)

            // Show success message
            toast({
                title: "فونت با موفقیت حذف شد",
            })

            // Notify parent window
            if (window.opener) {
                window.opener.postMessage({ type: 'FONT_DELETED', fontName }, '*')
            }

        } catch (error) {
            console.error("Error deleting font:", error)
            toast({
                title: "خطا در حذف فونت",
            })
        }
    }
    return (
        <ToastProvider>
            <div className="p-4 max-w-xl mx-auto">
                <div className="bg-white rounded shadow p-6">
                    <h2 className="text-xl font-bold text-right mb-4">افزودن فونت دلخواه</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-right mb-2">انتخاب فونت</label>
                            <input
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
                            disabled={isLoading}
                        >
                            {isLoading ? 'در حال افزودن...' : 'افزودن فونت'}
                        </button>

                        {savedFonts.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold text-right mb-2">فونت‌های اضافه شده</h3>
                                <div className="space-y-2">
                                    {savedFonts.map(font => (
                                        <div
                                            key={font.value}
                                            className="flex justify-between items-center p-2 border rounded"
                                        >
                                            <button
                                                onClick={() => handleDeleteFont(font.value)}
                                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                                disabled={isLoading}
                                            >
                                                حذف
                                            </button>
                                            <span className={font.style}>{font.name}</span>
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

export default FontUploader