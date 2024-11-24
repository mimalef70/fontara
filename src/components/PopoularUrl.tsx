import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "./BasicVersion"

interface BoxItem {
  id: string
  src: string
  isActive: boolean
  url: string
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
      // await storage.clear()
      const storedUrls = await storage.get<BoxItem[]>("activeUrls")
      if (storedUrls && storedUrls.length > 0) {
        setBoxes(storedUrls)
      } else {
        await storage.set("activeUrls", initialBoxes)
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
    await storage.set("activeUrls", updatedBoxes)

    browserAPI.runtime.sendMessage({
      action: "updateActiveUrls",
      activeUrls: updatedBoxes
    })
  }

  return (
    <div className="mt-2 grid grid-cols-5 justify-items-center overflow-auto h-96">
      {boxes
        .filter((item) => item.isInUi)
        .map((box) => (
          <div
            key={box.id}
            className={`shadow-sm border border-gray-300 rounded-md size-12 flex items-center justify-center cursor-pointer hover:shadow-xl hover:grayscale ${box.isActive ? "" : "hover:grayscale "
              }`}
            onClick={() => toggleActive(box.id)}>
            <img
              src={box.src}
              alt={`${box.id} Logo`}
              className={`w-full h-full object-cover transition-all duration-300 ${box.isActive ? "" : "grayscale opacity-25"
                }`}
            />
          </div>
        ))}
    </div>
  )
}

export default PopularUrl
