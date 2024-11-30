import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "@/data/popularUrlData"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip"

interface BoxItem {
  id?: string
  src?: string
  isActive?: boolean
  url?: string
  isInUi?: boolean
}

const storage = new Storage()
declare const chrome: any
declare const browser: any

// Use browser for Firefox compatibility, fall back to chrome for Chrome
const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

type Props = {
  boxes: BoxItem[]
  setBoxes: (boxes: BoxItem[]) => void
}

function PopularUrl({ boxes, setBoxes }: Props) {
  useEffect(() => {
    const initializeBoxes = async () => {
      // Changed storage key from "activeUrls" to "popularActiveUrls"
      const storedUrls = await storage.get<BoxItem[]>("popularActiveUrls")
      if (storedUrls && storedUrls.length > 0) {
        setBoxes(storedUrls)
      } else {
        // Changed storage key from "activeUrls" to "popularActiveUrls"
        await storage.set("popularActiveUrls", initialBoxes)
        setBoxes(initialBoxes)
      }
    }

    initializeBoxes()
  }, [])

  const toggleActive = async (id: string) => {
    const updatedBoxes = boxes.map((box) =>
      box.id === id ? { ...box, isActive: !box.isActive } : box
    )
    setBoxes(updatedBoxes)
    // Changed storage key from "activeUrls" to "popularActiveUrls"
    await storage.set("popularActiveUrls", updatedBoxes)

    browserAPI.runtime.sendMessage({
      action: "updatePopularActiveUrls", // Changed action name
      popularActiveUrls: updatedBoxes // Changed payload key
    })
  }

  return (
    <div className="mt-2 grid grid-cols-5 justify-items-center items-center overflow-auto h-80 w-full">
      {boxes
        .filter((item) => item.isInUi)
        .map((box) => (

          <TooltipProvider key={box.id} delayDuration={90}>
            <Tooltip>
              <TooltipTrigger
                className="shadow-sm border border-gray-300 rounded-md size-12 flex items-center justify-center cursor-pointer hover:shadow-xl"
                onClick={() => toggleActive(box.id)}>
                <img
                  src={box.src}
                  alt={`${box.id} Logo`}
                  className={`w-full h-full object-cover transition-all duration-300 ${box.isActive ? "" : "grayscale opacity-25"
                    }`}
                />
              </TooltipTrigger>
              <TooltipContent
                className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm"
                side="top"
                align="center">
                {box.id}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>


        ))
      }
    </div >
  )
}

export default PopularUrl