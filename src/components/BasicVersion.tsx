import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { urlPatternToRegex } from "~src/utils/pattern"

import CustomUrlToggle from "./CustomUrlToggle"
import FontSelector from "./FontSelector"
import Header from "./layout/Header"
import PopoularUrl from "./PopoularUrl"


type IconlyIconProps = {
  size?: number;
  color?: string;
}

export const IconlyHeart = ({ size = 17, color = "#000000" }: IconlyIconProps) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
      <title>Iconly/Bold/Heart</title>
      <g id="Iconly/Bold/Heart" stroke="none" strokeWidth="1.5" fill="none" fillRule="evenodd">
        <g id="Heart" transform="translate(1.999783, 2.500540)" fill={color} fillRule="nonzero">
          <path d="M6.28001656,3.46389584e-14 C6.91001656,0.0191596721 7.52001656,0.129159672 8.11101656,0.330159672 L8.11101656,0.330159672 L8.17001656,0.330159672 C8.21001656,0.349159672 8.24001656,0.370159672 8.26001656,0.389159672 C8.48101656,0.460159672 8.69001656,0.540159672 8.89001656,0.650159672 L8.89001656,0.650159672 L9.27001656,0.820159672 C9.42001656,0.900159672 9.60001656,1.04915967 9.70001656,1.11015967 C9.80001656,1.16915967 9.91001656,1.23015967 10.0000166,1.29915967 C11.1110166,0.450159672 12.4600166,-0.00984032788 13.8500166,3.46389584e-14 C14.4810166,3.46389584e-14 15.1110166,0.0891596721 15.7100166,0.290159672 C19.4010166,1.49015967 20.7310166,5.54015967 19.6200166,9.08015967 C18.9900166,10.8891597 17.9600166,12.5401597 16.6110166,13.8891597 C14.6800166,15.7591597 12.5610166,17.4191597 10.2800166,18.8491597 L10.2800166,18.8491597 L10.0300166,19.0001597 L9.77001656,18.8391597 C7.48101656,17.4191597 5.35001656,15.7591597 3.40101656,13.8791597 C2.06101656,12.5301597 1.03001656,10.8891597 0.390016562,9.08015967 C-0.739983438,5.54015967 0.590016562,1.49015967 4.32101656,0.269159672 C4.61101656,0.169159672 4.91001656,0.0991596721 5.21001656,0.0601596721 L5.21001656,0.0601596721 L5.33001656,0.0601596721 C5.61101656,0.0191596721 5.89001656,3.46389584e-14 6.17001656,3.46389584e-14 L6.17001656,3.46389584e-14 Z M15.1900166,3.16015967 C14.7800166,3.01915967 14.3300166,3.24015967 14.1800166,3.66015967 C14.0400166,4.08015967 14.2600166,4.54015967 14.6800166,4.68915967 C15.3210166,4.92915967 15.7500166,5.56015967 15.7500166,6.25915967 L15.7500166,6.25915967 L15.7500166,6.29015967 C15.7310166,6.51915967 15.8000166,6.74015967 15.9400166,6.91015967 C16.0800166,7.08015967 16.2900166,7.17915967 16.5100166,7.20015967 C16.9200166,7.18915967 17.2700166,6.86015967 17.3000166,6.43915967 L17.3000166,6.43915967 L17.3000166,6.32015967 C17.3300166,4.91915967 16.4810166,3.65015967 15.1900166,3.16015967 Z"></path>
        </g>
      </g>
    </svg>
  )
}

export const fonts = [
  {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
]

// Types
interface BoxItem {
  id?: string
  src?: string
  isActive?: boolean
  url?: string
  isInUi?: boolean
}

interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

// Constants
const DEFAULT_STATE: ExtensionState = {
  isEnabled: true,
  defaultFont: {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
}

// Browser API setup
const storage = new Storage()
declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

export default function BaseVersion() {
  // State
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false)
  const [currentTab, setCurrentTab] = useState<string>("")
  const [boxes, setBoxes] = useState<BoxItem[]>(initialBoxes)
  const [favicon, setFavicon] = useState<string>("")
  const [isExtensionEnabled, setIsExtensionEnabled] = useState(true)
  const [isActive, setIsActive] = useState(false)

  // Initialize extension state from storage
  useEffect(() => {
    const initializeExtensionState = async () => {
      // await storage.clear()
      const storedState = await storage.get<boolean>("isExtensionEnabled")
      setIsExtensionEnabled(storedState ?? true) // Default to true if not set

    }

    initializeExtensionState()
  }, [])

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
          const matchedSite = boxes.some(
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
      } catch (error) {
        console.error("Error checking current tab:", error)
      }
    }

    checkCurrentTab()
  }, [boxes])

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

  // Get favicon
  useEffect(() => {
    const getCurrentTabFavicon = async () => {
      try {
        const tabs = await browserAPI.tabs.query({
          active: true,
          currentWindow: true
        })
        const tab = tabs[0]

        if (tab?.favIconUrl) {
          setFavicon(tab.favIconUrl)
        } else {
          // Fallback to searching for favicon in page
          const links = document.querySelectorAll('link[rel*="icon"]')
          const favicons: string[] = []

          links.forEach((link) => {
            const href = link.getAttribute("href")
            if (href) {
              try {
                const absoluteUrl = new URL(href, window.location.origin).href
                favicons.push(absoluteUrl)
              } catch {
                favicons.push(href)
              }
            }
          })

          if (favicons.length === 0) {
            favicons.push(new URL("/favicon.ico", window.location.origin).href)
          }

          // Try each favicon until one works
          for (const url of favicons) {
            try {
              const response = await fetch(url, { method: "HEAD" })
              if (response.ok) {
                setFavicon(url)
                break
              }
            } catch {
              continue
            }
          }
        }
      } catch (error) {
        console.error("Error getting favicon:", error)
      }
    }

    getCurrentTabFavicon()
  }, [currentTab])

  // handleExtensionToggle
  const handleExtensionToggle = async () => {
    try {
      const newState = !isExtensionEnabled
      setIsExtensionEnabled(newState)

      // Save to storage
      await storage.set("isExtensionEnabled", newState)
      await storage.set("extensionState", {
        ...DEFAULT_STATE,
        isEnabled: newState
      })

      // Send message to background script
      browserAPI.runtime.sendMessage({
        action: "toggleExtension",
        isEnabled: newState
      })

      await browserAPI.action.setIcon({
        path: newState
          ? {
            "16": "../../assets/icon-active-16.png"
          }
          : {
            "16": "../../assets/icon-16.png",
            "32": "../../assets/icon-32.png",
            "48": "../../assets/icon-48.png"
          }
      })

      // Update all tabs
      const tabs = await browserAPI.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith("http")) {
          try {
            await browserAPI.tabs.sendMessage(tab.id, {
              action: "toggle",
              isExtensionEnabled: newState
            })
          } catch (error) {
            console.log(`Error sending message to tab ${tab.id}:`, error)
          }
        }
      }
    } catch (error) {
      console.error("Error toggling extension:", error)
      setIsExtensionEnabled(!isExtensionEnabled)
    }
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
      browserAPI.runtime.sendMessage({
        action: "updateCustomUrlStatus",
        data: updatedUrls
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
      console.error("Error toggling custom URL:", error)
      setIsCustomUrlActive(!isCustomUrlActive)
    }
  }

  return (
    <div className={`flex flex-col justify-between h-full w-[90%] mx-auto`}>
      <div
        className={`${isActive ? "opacity-30" : "opacity-100"} transition-opacity duration-200`}>
        <Header
          isExtensionEnabled={isExtensionEnabled}
          onToggle={handleExtensionToggle}
        />
      </div>

      <div
        className={`
        flex-1 flex flex-col 
        ${!isExtensionEnabled ? "opacity-50 pointer-events-none" : "opacity-100"}
        transition-opacity duration-200
      `}>
        {/* FontSelector is outside the dimming wrapper */}
        <FontSelector setIsActive={setIsActive} />

        {/* Wrap the content to be dimmed */}
        <div
          className={`${isActive ? "opacity-30" : "opacity-100"} transition-opacity duration-200`}>
          <div style={{ direction: "rtl" }}>
            <div className="overflow-auto">
              <PopoularUrl boxes={boxes} setBoxes={setBoxes} />
            </div>

            <CustomUrlToggle
              currentTab={currentTab}
              isCustomUrlActive={isCustomUrlActive}
              onToggle={handleCustomUrlToggle}
              favicon={favicon}
            />
          </div>
        </div>
      </div>

      <div
        className={`${isActive ? "opacity-30" : "opacity-100"} transition-opacity duration-200 p-4`}>
        <footer className="w-full">
          <p className="flex justify-center items-center text-gray-500 gap-1">
            <span className="font-semibold flex gap-1 items-center justify-center"> طراحی و توسعه با <IconlyHeart /> توسط </span>
            <a
              href="https://x.com/mimalef70"
              className="font-black text-gray-700">
              مصطفی الهیاری
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
