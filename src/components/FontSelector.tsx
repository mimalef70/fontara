import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { CheckedCircle, Circle, PlusIcon } from "~assets/icons/index"
import { defaultFonts } from "~src/utils/fonts"

import {
  Select,
  SelectContent,
  SelectItem,
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
  const [selected, setSelected] = useState(defaultFonts[0])
  const [allFonts, setAllFonts] = useState(defaultFonts)

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const customFonts = (await storage.get("customFonts")) || []

        setAllFonts([...defaultFonts, ...customFonts])

        const storedFontName = await storage.get("selectedFont")
        if (storedFontName) {
          const storedFont = [...defaultFonts, ...customFonts].find(
            (font) => font.value === storedFontName
          )
          if (storedFont) {
            setSelected(storedFont)
          }
        }
      } catch (error) {}
    }
    loadFonts()
  }, [])

  const handleFontChange = async (selectedValue) => {
    try {
      const newFont = allFonts.find((font) => font.value === selectedValue)
      if (!newFont) return

      setSelected(newFont)
      await storage.set("selectedFont", newFont.value)

      await sendToBackground({
        name: "changeFont",
        body: {
          fontName: newFont.value
        }
      })
    } catch (error) {}
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-3">
        <Select
          value={selected.value}
          onValueChange={handleFontChange}
          onOpenChange={(open: boolean) => {
            setIsOverlayActive(open)
          }}
          dir="rtl">
          <SelectTrigger className="w-full !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 !h-[3rem] !shadow-[0_3px_8px_rgba(0,0,0,0.08)] !transition-all !duration-300 hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
            <SelectValue>
              <span className={`font-estedad text-sm ${selected.style}`}>
                {selected.name}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 !border-0 !ring-0 !ring-offset-0">
            {allFonts.map((font) => (
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
                      className={`!w-[7rem] font-estedad text-sm ${font.style} ${selected.value === font.value ? "text-[#0D92F4]" : ""}`}>
                      {font.name}
                    </span>
                    <span
                      className={`!w-full mx-auto ${font.style} text-gray-400 text-[13px] ${hoveredFont === font.value ? "inline" : "hidden"}`}>
                      {font.svg}
                    </span>
                  </div>
                </SelectItem>
                <div className="!size-5 fill-black absolute left-2 flex items-center justify-center">
                  {hoveredFont === font.value &&
                  selected.value !== font.value ? (
                    <Circle />
                  ) : (
                    selected.value === font.value && <CheckedCircle />
                  )}
                </div>
              </div>
            ))}
          </SelectContent>
        </Select>
        <a
          href={chrome.runtime.getURL("tabs/font-uploader.html")}
          target="_blank"
          className="flex cursor-pointer justify-center items-center gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] bg-[#edf3fd] rounded-[3px] text-[13px] text-[#2374ff] text-center py-[9px] relative">
          <PlusIcon />
          افزودن فونت دلخواه
        </a>
      </div>
    </div>
  )
}

export default FontSelector
