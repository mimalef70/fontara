import { type CSSProperties, useEffect, useState } from "react"

import { DEFAULT_FONTS } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { cn } from "../../utils/cn"
import { escapeCSSString } from "../../utils/font-data"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import { EMPTY_CUSTOM_FONT_LIST } from "../storage-defaults"
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
}

type FontPreviewStyle = CSSProperties & {
  "--fontara-preview-font": string
}

function getFontPreviewStyle(fontValue: string): FontPreviewStyle {
  return {
    "--fontara-preview-font": `"${escapeCSSString(fontValue)}"`
  }
}

const FontSelector = () => {
  const { direction, language, t } = useI18n()
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [allFonts, setAllFonts] = useState<DisplayFont[]>(DEFAULT_FONTS)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFont, setSelectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_FONTS[0].value
  )
  const [customFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )

  useEffect(() => {
    if (customFontList) {
      setAllFonts([...DEFAULT_FONTS, ...customFontList])
    }
  }, [customFontList])

  const getFontDisplayName = (font: DisplayFont) =>
    font.localizedName?.[language] || font.name
  const getAuthorLabel = (font: DisplayFont) => {
    if (!font.author) return t("fontSelector.customGroup")

    return font.localizedAuthor?.[language] || font.author
  }

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
  const currentFontName = selectedFontItem
    ? getFontDisplayName(selectedFontItem)
    : t("fontSelector.placeholder")
  const fontSampleText = t("fontSelector.previewText")

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
        <DrawerContent className="max-h-[85vh]">
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

                      return (
                        <button
                          type="button"
                          key={`${font.value}-${font.name}`}
                          onClick={() => void handleFontSelect(font.value)}
                          onMouseEnter={() => setHoveredFont(font.value)}
                          onMouseLeave={() => setHoveredFont(null)}
                          style={getFontPreviewStyle(font.value)}
                          className={cn(
                            "flex items-center justify-between gap-2 relative p-3 rounded-md cursor-pointer w-full border-0 bg-transparent text-start",
                            {
                              "bg-blue-50": selectedFont === font.value,
                              "hover:bg-gray-50": selectedFont !== font.value
                            }
                          )}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span
                              dir="auto"
                              className={cn(
                                "fontara-font-preview w-[7rem] text-sm font-medium",
                                {
                                  "text-[#0D92F4]": selectedFont === font.value
                                }
                              )}>
                              {fontName}
                            </span>
                            <span
                              dir="auto"
                              className={cn(
                                "fontara-font-preview !w-full mx-auto text-xs",
                                {
                                  inline:
                                    hoveredFont === font.value ||
                                    selectedFont === font.value,
                                  hidden:
                                    hoveredFont !== font.value &&
                                    selectedFont !== font.value,
                                  "text-[#0D92F4] opacity-70":
                                    selectedFont === font.value,
                                  "text-gray-400": selectedFont !== font.value
                                }
                              )}>
                              {fontSampleText}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "!size-5 flex items-center justify-center",
                              {
                                "text-gray-400": hoveredFont === font.value,
                                "text-[#0D92F4]": selectedFont === font.value
                              }
                            )}>
                            {hoveredFont === font.value &&
                            selectedFont !== font.value ? (
                              <Circle />
                            ) : (
                              selectedFont === font.value && <CheckCircle />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
