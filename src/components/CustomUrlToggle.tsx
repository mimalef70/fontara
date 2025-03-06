import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { Checkbox } from "~src/components/ui/Checkbox"
import type { BoxItem } from "~src/utils/types"
import { browserAPI, urlPatternToRegex } from "~src/utils/utils"

const storage = new Storage()

const CustomUrlToggle = () => {
  const [favicon, setFavicon] = useState<string>("")
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false) // rename to isCurrentTabActive
  const [hostName, setHostName] = useState<string>("") // rename to currentTabUrl

  const useActiveTab = async () => {
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true
    })
    return {
      tab: tabs[0]
    }
  }

  // Initialize custom URL status
  useEffect(() => {
    const initializeCustomUrlStatus = async () => {
      const customActiveUrls =
        (await storage.get<BoxItem[]>("customActiveUrls")) || []
      const { tab } = await useActiveTab()

      if (tab?.url) {
        const mainUrl = new URL(tab.url).origin
        const currentTabUrl = `${mainUrl}/*`
        const urlEntry = customActiveUrls.find(
          (item) => item.url === currentTabUrl
        )
        setIsCustomUrlActive(urlEntry?.isActive ?? false)
      }
    }

    initializeCustomUrlStatus()
  }, [])

  useEffect(() => {
    const getFavicon = async () => {
      try {
        const { tab } = await useActiveTab()
        if (tab?.favIconUrl) {
          setFavicon(tab.favIconUrl)
          return
        } else {
          setFavicon("")
        }
      } catch (error) {
        setFavicon("")
      }
    }

    getFavicon()
  }, [hostName])

  // Check current tab
  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const { tab } = await useActiveTab()

        if (tab?.url) {
          const mainUrl = new URL(tab.url).origin
          const currentTabUrl = `${mainUrl}/*`
          setHostName(currentTabUrl)

          // Check if the current URL matches any popular site
          const matchedSite = initialBoxes.some(
            (box) => box.url && urlPatternToRegex(box.url).test(tab.url)
          )

          if (matchedSite) {
            setHostName("")
            return
          }

          // Get current custom URLs
          const customActiveUrls =
            (await storage.get<BoxItem[]>("customActiveUrls")) || []
          const isUrlActive = customActiveUrls.some(
            (item) => item.url === currentTabUrl && item.isActive
          )
          setIsCustomUrlActive(isUrlActive)
        }
      } catch (error) {}
    }

    checkCurrentTab()
  }, [initialBoxes])

  const handleCustomUrlToggle = async () => {
    try {
      const newIsActive = !isCustomUrlActive
      setIsCustomUrlActive(newIsActive)

      const customActiveUrls =
        (await storage.get<BoxItem[]>("customActiveUrls")) || []
      let updatedUrls: BoxItem[]

      if (newIsActive) {
        const existingUrlIndex = customActiveUrls.findIndex(
          (item) => item.url === hostName
        )
        if (existingUrlIndex === -1) {
          updatedUrls = [...customActiveUrls, { url: hostName, isActive: true }]
        } else {
          updatedUrls = customActiveUrls.map((item) =>
            item.url === hostName ? { ...item, isActive: true } : item
          )
        }
      } else {
        updatedUrls = customActiveUrls.map((item) =>
          item.url === hostName ? { ...item, isActive: false } : item
        )
      }

      await storage.set("customActiveUrls", updatedUrls)

      await sendToBackground({
        name: "updateCustomUrlStatus",
        body: updatedUrls
      })

      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tabs[0]?.id) {
        browserAPI.tabs.sendMessage(tabs[0].id, {
          action: "setActiveStatus",
          isActive: newIsActive
        })
      }
    } catch (error) {
      setIsCustomUrlActive(!isCustomUrlActive)
    }
  }

  if (
    !hostName ||
    hostName.toLowerCase().includes("extension") ||
    hostName.toLowerCase().includes("newtab")
  )
    return null

  return (
    <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full mt-3">
      <label
        className="text-xs cursor-pointer overflow-y-hidden"
        htmlFor="activeUrl">
        <div className="flex items-center w-full gap-1">
          <Checkbox
            name="activeUrl"
            id="activeUrl"
            checked={isCustomUrlActive}
            onCheckedChange={handleCustomUrlToggle}
          />
          <div className="flex items-center justify-around gap-1 ">
            <span className="shrink-0">برای سایت</span>
            <span className="truncate" dir="ltr">
              {hostName.slice(8, -2)}
            </span>
            {favicon && (
              <img
                src={favicon}
                className="!size-4 object-contain"
                alt="site icon"
              />
            )}
            <span className="shrink-0">فعال باشد؟</span>
          </div>
        </div>
      </label>
    </div>
  )
}

export default CustomUrlToggle
