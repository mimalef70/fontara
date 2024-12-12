import type { FC } from "react"
import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { initialBoxes } from "~data/popularUrlData"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~src/components/ui/tooltip"

// Types
export interface BoxItem {
  id: string
  src: string
  isActive: boolean
  url: string
  isInUi: boolean
}

type MessagePayload = {
  action: "updatePopularActiveUrls"
  popularActiveUrls: BoxItem[]
}

// Constants
const storage = new Storage()

// Browser API setup
declare const chrome: typeof browser
declare const browser: {
  runtime: {
    sendMessage: (message: MessagePayload) => Promise<void>
  }
}

const browserAPI = typeof browser !== "undefined" ? browser : chrome

// Component
const PopularUrl: FC = () => {
  const [boxes, setBoxes] = useState<BoxItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const initializeBoxes = async (): Promise<void> => {
      try {
        setIsLoading(true)
        const storedUrls = await storage.get<BoxItem[]>("popularActiveUrls")

        const mergedBoxes = storedUrls && storedUrls.length > 0
          ? initialBoxes.map(initialBox => ({
            ...initialBox,
            isActive: storedUrls.find(stored => stored.id === initialBox.id)?.isActive ?? initialBox.isActive
          }))
          : initialBoxes

        setBoxes(mergedBoxes)
        await storage.set("popularActiveUrls", mergedBoxes)

        await browserAPI.runtime.sendMessage({
          action: "updatePopularActiveUrls",
          popularActiveUrls: mergedBoxes
        })
      } catch (error) {
        console.error("Error initializing boxes:", error)
        setBoxes(initialBoxes)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeBoxes()
  }, [])

  const toggleActive = async (id: string): Promise<void> => {
    try {
      const updatedBoxes = boxes.map((box) =>
        box.id === id ? { ...box, isActive: !box.isActive } : box
      )
      setBoxes(updatedBoxes)

      await storage.set("popularActiveUrls", updatedBoxes)
      await browserAPI.runtime.sendMessage({
        action: "updatePopularActiveUrls",
        popularActiveUrls: updatedBoxes
      })
    } catch (error) {
      console.error("Error toggling active state:", error)
      setBoxes(boxes) // Revert on error
    }
  }

  if (isLoading) {
    return <div className="mt-2 flex justify-center">Loading...</div>
  }

  return (
    <div className="mt-2 grid grid-cols-5 justify-items-center items-center overflow-auto h-[18rem] w-full">
      {boxes
        .filter((item): item is BoxItem => item.isInUi)
        .map((box) => (
          <TooltipProvider key={box.id} delayDuration={90}>
            <Tooltip>
              <TooltipTrigger
                className="p-1 shadow-md hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] 
                          rounded-md size-12 flex items-center justify-center 
                          cursor-pointer transition-all duration-300 
                          border border-gray-100"
                onClick={() => void toggleActive(box.id)}
              >
                <img
                  src={box.src}
                  alt={`${box.id} Logo`}
                  className={`size-10 object-cover rounded-md 
                            transition-all duration-300 
                            ${box.isActive ? "" : "grayscale opacity-25"}`}
                />
              </TooltipTrigger>
              <TooltipContent
                className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
                side="top"
                align="center"
              >
                {box.id}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
    </div>
  )
}

export default PopularUrl