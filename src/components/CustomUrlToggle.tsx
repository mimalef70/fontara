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
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false)
  const [currentTab, setCurrentTab] = useState<string>("")

  // Update custom URLs when toggled
  useEffect(() => {
    const updateActiveUrls = async () => {
      if (currentTab) {
        const customActiveUrls =
          (await storage.get<BoxItem[]>("customActiveUrls")) || []
        let updatedUrls = customActiveUrls

        if (isCustomUrlActive) {
          if (!customActiveUrls.some((item) => item.url === currentTab)) {
            updatedUrls = [
              ...customActiveUrls,
              { url: currentTab, isActive: true }
            ]
          }
        } else {
          updatedUrls = customActiveUrls.filter(
            (item) => item.url !== currentTab
          )
        }

        await storage.set("customActiveUrls", updatedUrls)
        browserAPI.runtime.sendMessage({
          action: "updateCustomActiveUrls",
          customActiveUrls: updatedUrls
        })
      }
    }

    updateActiveUrls()
  }, [isCustomUrlActive, currentTab])

  // Initialize custom URL status
  useEffect(() => {
    const initializeCustomUrlStatus = async () => {
      const customActiveUrls =
        (await storage.get<BoxItem[]>("customActiveUrls")) || []
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })
      const tab = tabs[0]

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

  const getFavicon = async () => {
    try {
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })
      const tab = tabs[0]

      // Special case: Handle chrome:// and extension:// URLs
      if (
        tab?.url &&
        (tab.url.startsWith("chrome://") || tab.url.startsWith("extension://"))
      ) {
        // For chrome:// and extension:// pages, use a default icon or leave empty
        setFavicon("")
        return
      }

      // If tab has a direct favicon, use it
      if (tab?.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
        setFavicon(tab.favIconUrl)
        return
      }

      // Only proceed with favicon fetching for regular URLs
      if (
        tab?.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("extension://")
      ) {
        const url = new URL(tab.url)
        const possibleFavicons = [
          `${url.origin}/favicon.ico`,
          `${url.origin}/favicon.png`,
          `${url.origin}/apple-touch-icon.png`,
          `${url.origin}/apple-touch-icon-precomposed.png`
        ]

        // Try each possible favicon URL
        for (const faviconUrl of possibleFavicons) {
          try {
            const response = await fetch(faviconUrl, { method: "HEAD" })
            if (response.ok) {
              setFavicon(faviconUrl)
              return
            }
          } catch {
            continue
          }
        }

        // If no favicon found, use Google's favicon service as fallback
        const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
        setFavicon(googleFaviconUrl)
      }
    } catch (error) {
      // Set a default icon or leave empty
      setFavicon("")
    }
  }

  // Update favicon when tab changes
  useEffect(() => {
    getFavicon()

    // Listen for tab updates to refresh favicon
    const handleTabUpdate = (tabId, changeInfo, tab) => {
      if (changeInfo.favIconUrl) {
        getFavicon()
      }
    }

    browserAPI.tabs.onUpdated.addListener(handleTabUpdate)

    return () => {
      browserAPI.tabs.onUpdated.removeListener(handleTabUpdate)
    }
  }, [currentTab])

  // Check current tab
  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await browserAPI.tabs.query({
          active: true,
          currentWindow: true
        })
        const tab = tabs[0]

        if (tab?.url) {
          const mainUrl = new URL(tab.url).origin
          const currentTabUrl = `${mainUrl}/*`
          setCurrentTab(currentTabUrl)

          // Check if the current URL matches any popular site
          const matchedSite = initialBoxes.some(
            (box) => box.url && urlPatternToRegex(box.url).test(tab.url)
          )

          if (matchedSite) {
            setCurrentTab("")
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

  const displayTabName = () => {
    const tabName = currentTab.slice(8, -2)
    return tabName.length > 20 ? `${tabName.slice(0, 20)}...` : tabName
  }

  const handleCustomUrlToggle = async () => {
    try {
      const newIsActive = !isCustomUrlActive
      setIsCustomUrlActive(newIsActive)

      const customActiveUrls =
        (await storage.get<BoxItem[]>("customActiveUrls")) || []
      let updatedUrls: BoxItem[]

      if (newIsActive) {
        const existingUrlIndex = customActiveUrls.findIndex(
          (item) => item.url === currentTab
        )
        if (existingUrlIndex === -1) {
          updatedUrls = [
            ...customActiveUrls,
            { url: currentTab, isActive: true }
          ]
        } else {
          updatedUrls = customActiveUrls.map((item) =>
            item.url === currentTab ? { ...item, isActive: true } : item
          )
        }
      } else {
        updatedUrls = customActiveUrls.map((item) =>
          item.url === currentTab ? { ...item, isActive: false } : item
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
    !currentTab ||
    currentTab.toLowerCase().includes("extension") ||
    currentTab.toLowerCase().includes("newtab")
  )
    return null

  return (
    <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full mt-3">
      <label
        className="text-xs cursor-pointer flex items-center whitespace-nowrap overflow-x-auto overflow-y-hidden"
        htmlFor="activeUrl">
        <div className="flex items-center gap-2 min-w-max px-1">
          <Checkbox
            name="activeUrl"
            id="activeUrl"
            checked={isCustomUrlActive}
            onCheckedChange={handleCustomUrlToggle}
            className="shrink-0"
          />
          <span className="shrink-0">برای سایت</span>
          <span className="flex items-center gap-1 shrink-0">
            <span>{displayTabName()}</span>
            {favicon && (
              <img
                src={favicon}
                className="!size-4 object-contain"
                alt="site icon"
              />
            )}
          </span>
          <span className="shrink-0">فعال باشد؟</span>
        </div>
      </label>
    </div>
  )
}

export default CustomUrlToggle
