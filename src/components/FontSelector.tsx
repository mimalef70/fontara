import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { useStorage } from "~node_modules/@plasmohq/storage/dist/hook"
import { CheckCircle, Circle, PlusCircle } from "~src/components/icons"
import { defaultFonts, STORAGE_KEYS } from "~src/lib/constants"
import { cn } from "~src/lib/utils"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "./ui/Select"

const storage = new Storage()

const FontSelector = ({
  setIsOverlayActive
}: {
  setIsOverlayActive: (value: boolean) => void
}) => {
  const [hoveredFont, setHoveredFont] = useState(null)
  const [allFonts, setAllFonts] = useState(defaultFonts)
  const [selectedFont, setSelectedFont] = useStorage(STORAGE_KEYS.SELECTED_FONT)

  // useEffect(() => {
  //   const loadFonts = async () => {
  //     try {
  //       const customFonts = (await storage.get("customFonts")) || []

  //       setAllFonts([...defaultFonts, ...customFonts])

  //       const storedFontName = await storage.get("selectedFont")
  //       if (storedFontName) {
  //         const storedFont = [...defaultFonts, ...customFonts].find(
  //           (font) => font.value === storedFontName
  //         )
  //         if (storedFont) {
  //           setSelected(storedFont)
  //         }
  //       }
  //     } catch (error) {}
  //   }
  //   loadFonts()
  // }, [])

  // const handleFontChange = async (selectedValue) => {
  //   try {
  //     const newFont = allFonts.find((font) => font.value === selectedValue)
  //     if (!newFont) return

  //     setSelected(newFont)
  //     await storage.set("selectedFont", newFont.value)

  //     await sendToBackground({
  //       name: "changeFont",
  //       body: {
  //         fontName: newFont.value
  //       }
  //     })
  //   } catch (error) {}
  // }

  const fontsByAuthor = allFonts.reduce((acc, font) => {
    if (!acc[font.author]) {
      acc[font.author] = []
    }
    acc[font.author].push(font)
    return acc
  }, {})

  return (
    <Select
      value={selectedFont}
      onValueChange={setSelectedFont}
      onOpenChange={(open: boolean) => {
        setIsOverlayActive(open)
      }}
      dir="rtl">
      <SelectTrigger className="w-full !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 !h-[3rem] !shadow-[0_3px_8px_rgba(0,0,0,0.08)] !transition-all !duration-300 hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
        <SelectValue>
          <span className="font-estedad text-sm">
            {allFonts.find((font) => font.value === selectedFont)?.name}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 !border-0 !ring-0 !ring-offset-0">
        {Object.entries(fontsByAuthor).map(([author, fonts]) => (
          <SelectGroup key={author} className="mt-2 mb-1">
            <SelectLabel className="text-gray-400 text-xs font-semibold">
              فونت های {author}
            </SelectLabel>
            {(fonts as any).map((font) => (
              <div
                key={`${font.value}-${font.name}`}
                className="flex items-center justify-between gap-2 relative">
                <SelectItem
                  value={font.value}
                  className="flex items-center gap-2 py-1 px-3 cursor-pointer"
                  onMouseEnter={() => setHoveredFont(font.value)}
                  onMouseLeave={() => setHoveredFont(null)}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span
                      className={cn("!w-[7rem] text-sm font-medium", {
                        "text-[#0D92F4]": selectedFont === font.value
                      })}>
                      {font.name}
                    </span>
                    <span
                      className={cn("!w-full mx-auto text-xs", {
                        inline: hoveredFont === font.value,
                        hidden: hoveredFont !== font.value,
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
                </SelectItem>
                <div
                  className={cn(
                    "!size-5 absolute left-2 flex items-center justify-center",
                    {
                      "text-gray-400": hoveredFont === font.value,
                      "text-[#0D92F4]": selectedFont === font.value
                    }
                  )}>
                  {hoveredFont === font.value && selectedFont !== font.value ? (
                    <Circle />
                  ) : (
                    selectedFont === font.value && <CheckCircle />
                  )}
                </div>
              </div>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export default FontSelector
