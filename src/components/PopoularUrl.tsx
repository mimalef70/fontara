import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { initialBoxes } from "~data/popularUrlData"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~src/components/ui/tooltip"

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

function PopularUrl() {
  //? useStorage to get the boxes from the storage(like useState)
  const [boxes, setBoxes] = useStorage<BoxItem[]>(
    "popularActiveUrls",
    initialBoxes
  )

  const toggleActive = async (id: string) => {
    const updatedBoxes = boxes.map((box) =>
      box.id === id ? { ...box, isActive: !box.isActive } : box
    )
    setBoxes(updatedBoxes)

    browserAPI.runtime.sendMessage({
      action: "updatePopularActiveUrls",
      popularActiveUrls: updatedBoxes
    })
    await sendToBackground({
      name: "updatePopularActiveUrls",
      body: updatedBoxes
    })
  }

  return (
    <div className="mt-2 grid grid-cols-5 justify-items-center items-center overflow-auto h-[18rem] w-full">
      {boxes
        .filter((item) => item.isInUi)
        .map((box) => (
          <TooltipProvider key={box.id} delayDuration={90}>
            <Tooltip>
              <TooltipTrigger
                className="p-1 shadow-md hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] rounded-md size-12 flex items-center justify-center cursor-pointer transition-all duration-300 border border-gray-100"
                onClick={() => toggleActive(box.id)}>
                <img
                  src={box.src}
                  alt={`${box.id} Logo`}
                  className={`size-10 object-cover rounded-md transition-all duration-300 ${
                    box.isActive ? "" : "grayscale opacity-25"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent
                className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
                side="top"
                align="center">
                {box.id}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
    </div>
  )
}

export default PopularUrl
