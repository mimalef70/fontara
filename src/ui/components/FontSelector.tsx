import { type CSSProperties, useEffect, useState } from "react"

import { DEFAULT_FONTS } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { cn } from "../../utils/cn"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import {
  decodeSystemFontValue,
  getSystemFontList,
  type SystemFontData
} from "../../utils/system-fonts"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"
import { CheckCircle, Circle, FolderFileFont } from "./icons"
import { Button } from "./ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "./ui/drawer"

type DisplayFont = {
  value: string
  name: string
  author?: string
  localizedName?: Partial<Record<SupportedUILanguage, string>>
  localizedAuthor?: Partial<Record<SupportedUILanguage, string>>
  fontFamily?: string
}

type FontPreviewStyle = CSSProperties & {
  "--fontara-preview-font": string
}

function getFontPreviewStyle(fontFamily: string): FontPreviewStyle {
  return {
    "--fontara-preview-font": formatFontFamilyForCSS(fontFamily)
  }
}

const FontSelector = () => {
  const { direction, language, t } = useI18n()
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [allFonts, setAllFonts] = useState<DisplayFont[]>(DEFAULT_FONTS)
  const [isOpen, setIsOpen] = useState(false)
  const [systemFonts, setSystemFonts] = useState<SystemFontData[]>([])
  const [systemFontsLoading, setSystemFontsLoading] = useState(false)
  const [systemFontsFailed, setSystemFontsFailed] = useState(false)
  const [selectedFont, setSelectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_FONTS[0].value
  )
  const [customFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [systemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )

  useEffect(() => {
    setAllFonts([...DEFAULT_FONTS, ...customFontList, ...systemFonts])
  }, [customFontList, systemFonts])

  useEffect(() => {
    let cancelled = false

    if (!systemFontsEnabled) {
      setSystemFonts([])
      setSystemFontsFailed(false)
      setSystemFontsLoading(false)
      return () => {
        cancelled = true
      }
    }

    setSystemFontsLoading(true)
    setSystemFontsFailed(false)

    getSystemFontList()
      .then((fonts) => {
        if (cancelled) return
        setSystemFonts(fonts)
        setSystemFontsFailed(fonts.length === 0)
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to load system fonts.", error)
        }
        if (!cancelled) {
          setSystemFonts([])
          setSystemFontsFailed(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSystemFontsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [systemFontsEnabled])

  const getFontDisplayName = (font: DisplayFont) =>
    font.localizedName?.[language] || font.name
  const getAuthorLabel = (font: DisplayFont) => {
    if (decodeSystemFontValue(font.value)) return t("fontSelector.systemGroup")
    if (!font.author) return t("fontSelector.customGroup")

    return font.localizedAuthor?.[language] || font.author
  }
  const getFontFamily = (font: DisplayFont) => font.fontFamily || font.value

  const fontsByAuthor = allFonts.reduce<Record<string, DisplayFont[]>>(
    (acc, font) => {
      const author = getAuthorLabel(font)

      if (!acc[author]) {
        acc[author] = []
      }
      acc[author].push(font)
      return acc
    },
    {}
  )

  const handleFontSelect = async (fontValue: string) => {
    try {
      await setSelectedFont(fontValue)
      setIsOpen(false)
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to save selected font.", error)
      }
    }
  }

  const selectedFontItem = allFonts.find((font) => font.value === selectedFont)
  const selectedSystemFontFamily = systemFontsEnabled
    ? decodeSystemFontValue(selectedFont)
    : null
  const currentFontName = selectedFontItem
    ? getFontDisplayName(selectedFontItem)
    : selectedSystemFontFamily
      ? selectedSystemFontFamily
      : t("fontSelector.placeholder")
  const fontSampleText = t("fontSelector.previewText")
  const isRtl = direction === "rtl"

  return (
    <div dir={direction}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full !h-[3rem] !shadow-[0_3px_8px_rgba(0,0,0,0.08)] !transition-all !duration-300  flex justify-between items-center hover:!bg-white">
        <span className="font-estedad text-sm">{currentFontName}</span>
        <span className="opacity-70">
          <FolderFileFont className="!size-6" />
        </span>
      </Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
        <DrawerContent dir={direction} className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("fontSelector.title")}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {t("fontSelector.description")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-2 max-h-[60vh] overflow-y-auto">
            {Object.entries(fontsByAuthor).map(([author, fonts]) => {
              const groupTitle = `${t("fontSelector.groupTitlePrefix")} ${author}`

              return (
                <div key={author} className="mt-4 mb-2">
                  <h3
                    dir={direction}
                    className="mb-2 text-start text-xs font-semibold text-gray-400">
                    {groupTitle}
                  </h3>
                  <div className="space-y-1">
                    {fonts.map((font) => {
                      const fontName = getFontDisplayName(font)
                      const isFontRowActive =
                        hoveredFont === font.value ||
                        selectedFont === font.value
                      const statusIcon =
                        hoveredFont === font.value &&
                        selectedFont !== font.value ? (
                          <Circle />
                        ) : (
                          selectedFont === font.value && <CheckCircle />
                        )

                      return (
                        <button
                          dir={direction}
                          type="button"
                          key={`${font.value}-${font.name}`}
                          onClick={() => void handleFontSelect(font.value)}
                          onMouseEnter={() => setHoveredFont(font.value)}
                          onMouseLeave={() => setHoveredFont(null)}
                          style={getFontPreviewStyle(getFontFamily(font))}
                          className={cn(
                            "relative flex min-h-[3.5rem] w-full cursor-pointer items-center rounded-md border-0 bg-transparent p-3 text-start",
                            {
                              "bg-blue-50": selectedFont === font.value,
                              "hover:bg-gray-50": selectedFont !== font.value
                            }
                          )}>
                          {isFontRowActive ? (
                            <div
                              dir="ltr"
                              className={cn(
                                "grid w-full items-center gap-3",
                                isRtl
                                  ? "grid-cols-[minmax(0,1fr)_minmax(4.5rem,7rem)_1.25rem]"
                                  : "grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)_1.25rem]"
                              )}>
                              {isRtl && (
                                <span
                                  dir="auto"
                                  className={cn(
                                    "fontara-font-preview min-w-0 truncate text-start text-xs",
                                    {
                                      "text-[#0D92F4] opacity-70":
                                        selectedFont === font.value,
                                      "text-gray-400":
                                        selectedFont !== font.value
                                    }
                                  )}>
                                  {fontSampleText}
                                </span>
                              )}
                              <span
                                dir="auto"
                                className={cn(
                                  "fontara-font-preview min-w-0 truncate text-start text-sm font-medium",
                                  {
                                    "text-[#0D92F4]":
                                      selectedFont === font.value
                                  }
                                )}>
                                {fontName}
                              </span>
                              {!isRtl && (
                                <span
                                  dir="auto"
                                  className={cn(
                                    "fontara-font-preview min-w-0 truncate text-start text-xs",
                                    {
                                      "text-[#0D92F4] opacity-70":
                                        selectedFont === font.value,
                                      "text-gray-400":
                                        selectedFont !== font.value
                                    }
                                  )}>
                                  {fontSampleText}
                                </span>
                              )}
                              <div
                                className={cn(
                                  "flex !size-5 items-center justify-center",
                                  {
                                    "text-gray-400": hoveredFont === font.value,
                                    "text-[#0D92F4]":
                                      selectedFont === font.value
                                  }
                                )}>
                                {statusIcon}
                              </div>
                            </div>
                          ) : (
                            <div
                              dir="ltr"
                              className={cn(
                                "grid w-full items-center gap-3",
                                isRtl
                                  ? "grid-cols-[minmax(0,1fr)_minmax(4.5rem,7rem)_1.25rem]"
                                  : "grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)_1.25rem]"
                              )}>
                              {isRtl && <span aria-hidden="true" />}
                              <span
                                dir="auto"
                                className={cn(
                                  "fontara-font-preview min-w-0 truncate text-start text-sm font-medium",
                                  {
                                    "text-[#0D92F4]":
                                      selectedFont === font.value
                                  }
                                )}>
                                {fontName}
                              </span>
                              {!isRtl && <span aria-hidden="true" />}
                              <span aria-hidden="true" className="!size-5" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {systemFontsEnabled && systemFontsLoading && (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {t("fontSelector.systemLoading")}
              </div>
            )}
            {systemFontsEnabled && systemFontsFailed && !systemFontsLoading && (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {t("fontSelector.systemUnavailable")}
              </div>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{t("common.close")}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default FontSelector
