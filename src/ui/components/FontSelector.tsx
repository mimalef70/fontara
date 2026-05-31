import { useEffect, useState } from "react"

import { DEFAULT_FONTS } from "../../config/fonts"
import { STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { createCustomFontFaces } from "../../generators/custom-font-face"
import { cn } from "../../utils/cn"
import { useStorageValue } from "../hooks/use-storage"
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
}

const CUSTOM_FONT_STYLE_ID = "fontara-ui-custom-font-styles"

const FontSelector = () => {
  const [hoveredFont, setHoveredFont] = useState<string | null>(null)
  const [allFonts, setAllFonts] = useState<DisplayFont[]>(DEFAULT_FONTS)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFont, setSelectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_FONTS[0].value
  )
  const [customFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    []
  )

  useEffect(() => {
    if (customFontList) {
      setAllFonts([...DEFAULT_FONTS, ...customFontList])
    }
  }, [customFontList])

  useEffect(() => {
    const customFontFaces = createCustomFontFaces(customFontList)
    const existingStyle = document.getElementById(CUSTOM_FONT_STYLE_ID)

    if (!customFontFaces) {
      existingStyle?.remove()
      return
    }

    const styleElement =
      existingStyle instanceof HTMLStyleElement
        ? existingStyle
        : document.createElement("style")

    styleElement.id = CUSTOM_FONT_STYLE_ID
    styleElement.textContent = customFontFaces

    if (!styleElement.parentElement) {
      document.head.appendChild(styleElement)
    }
  }, [customFontList])

  const fontsByAuthor = allFonts.reduce<Record<string, DisplayFont[]>>(
    (acc, font) => {
      const author = font.author || "undefined"

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

  const currentFontName =
    allFonts.find((font) => font.value === selectedFont)?.name || "انتخاب فونت"

  return (
    <div>
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
            <DrawerTitle className="text-center">انتخاب فونت</DrawerTitle>
            <DrawerDescription className="text-center">
              فونت مورد نظر خود را انتخاب کنید
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-2 max-h-[60vh] overflow-y-auto">
            {Object.entries(fontsByAuthor).map(([author, fonts]) => (
              <div key={author} className="mt-4 mb-2">
                <h3 className="text-gray-400 text-xs font-semibold mb-2">
                  فونت های {author === "undefined" ? "دلخواه" : author}
                </h3>
                <div className="space-y-1">
                  {fonts.map((font) => (
                    <div
                      key={`${font.value}-${font.name}`}
                      onClick={() => void handleFontSelect(font.value)}
                      onMouseEnter={() => setHoveredFont(font.value)}
                      onMouseLeave={() => setHoveredFont(null)}
                      className={cn(
                        "flex items-center justify-between gap-2 relative p-3 rounded-md cursor-pointer",
                        {
                          "bg-blue-50": selectedFont === font.value,
                          "hover:bg-gray-50": selectedFont !== font.value
                        }
                      )}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span
                          className={cn("w-[7rem] text-sm font-medium", {
                            "text-[#0D92F4]": selectedFont === font.value
                          })}>
                          {font.name}
                        </span>
                        <span
                          className={cn("!w-full mx-auto text-xs", {
                            inline:
                              hoveredFont === font.value ||
                              selectedFont === font.value,
                            hidden:
                              hoveredFont !== font.value &&
                              selectedFont !== font.value,
                            "text-[#0D92F4] opacity-70":
                              selectedFont === font.value,
                            "text-gray-400": selectedFont !== font.value
                          })}
                          style={{
                            fontFamily: font.value
                          }}>
                          بِستَد دل و دین از من
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">بستن</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default FontSelector
