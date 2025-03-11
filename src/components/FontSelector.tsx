import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { CheckCircle, Circle, PlusCircle } from "~src/components/icons"
import { Button } from "~src/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "~src/components/ui/drawer"
import { defaultFonts, STORAGE_KEYS } from "~src/lib/constants"
import { cn } from "~src/lib/utils"

const FontSelector = ({
  setIsOverlayActive
}: {
  setIsOverlayActive: (value: boolean) => void
}) => {
  const [hoveredFont, setHoveredFont] = useState(null)
  const [allFonts, setAllFonts] = useState(defaultFonts)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFont, setSelectedFont] = useStorage({
    key: STORAGE_KEYS.SELECTED_FONT,
    instance: new Storage({
      area: "local"
    })
  })
  const [customFontList] = useStorage({
    key: "customFontList",
    instance: new Storage({
      area: "local"
    })
  })

  useEffect(() => {
    if (customFontList) {
      setAllFonts([...defaultFonts, ...customFontList])
    }
  }, [customFontList])

  const fontsByAuthor = allFonts.reduce((acc, font) => {
    if (!acc[font.author]) {
      acc[font.author] = []
    }
    acc[font.author].push(font)
    return acc
  }, {})

  const handleOpenChange = (open) => {
    setIsOpen(open)
    setIsOverlayActive(open)
  }

  const handleFontSelect = (fontValue) => {
    setSelectedFont(fontValue)
    setIsOpen(false)
    setIsOverlayActive(false)
  }

  const currentFontName =
    allFonts.find((font) => font.value === selectedFont)?.name || "انتخاب فونت"

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} direction="bottom">
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className="w-full !h-[3rem] !shadow-[0_3px_8px_rgba(0,0,0,0.08)] !transition-all !duration-300 hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] flex justify-between items-center">
          <span className="font-estedad text-sm">{currentFontName}</span>
          <span className="opacity-70">▼</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">انتخاب فونت</DrawerTitle>
          <DrawerDescription className="text-center">
            فونت مورد نظر خود را انتخاب کنید
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 py-2 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
          {Object.entries(fontsByAuthor).map(([author, fonts]) => (
            <div key={author} className="mt-4 mb-2">
              <h3 className="text-gray-400 text-xs font-semibold mb-2">
                فونت های {author === "undefined" ? "دلخواه" : author}
              </h3>
              <div className="space-y-1">
                {(fonts as any).map((font) => (
                  <div
                    key={`${font.value}-${font.name}`}
                    onClick={() => handleFontSelect(font.value)}
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
                        بِستَد دل و دین از من!
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
  )
}

export default FontSelector
