import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { urlPatternToRegex } from "~src/utils/pattern"

import CustomUrlToggle from "./CustomUrlToggle"
import FontSelector from "./FontSelector"
import Header from "./layout/Header"
import PopoularUrl from "./PopoularUrl"
import Footer from "./layout/Footer"

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
  const [favicon, setFavicon] = useState<string>("")
  const [isActive, setIsActive] = useState(false)

  // ------------------------------------------
  const [extentionEnabledState, setExtentionEnabledState] = useState(true)
  // ------------------------------------------
  // Initialize extension state from storage
  useEffect(() => {
    const initializeExtensionState = async () => {
      // await storage.clear()
      const storedState = await storage.get<boolean>("isExtensionEnabled")
      setExtentionEnabledState(storedState)
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
      } catch (error) {
        console.error("Error checking current tab:", error)
      }
    }

    checkCurrentTab()
  }, [initialBoxes])

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

  return (
    <section className="h-full">
      {isActive && (
        <div className="absolute inset-0 bg-black/30 z-10" />
      )}
      <div className="flex flex-col justify-between h-full w-[90%] mx-auto relative">
        {/* Main content wrapper */}
        <div className="relative flex flex-col justify-between h-full">
          <Header
            extentionEnabledState={extentionEnabledState}
            setExtentionEnabledState={setExtentionEnabledState}
          />

          <div className={`
          flex-1 flex flex-col 
          ${!extentionEnabledState ? "opacity-50 pointer-events-none" : "opacity-100"}
          transition-opacity duration-200
        `}>
            {/* FontSelector with higher z-index to stay above overlay */}
            <div className="relative z-20">
              <FontSelector setIsActive={setIsActive} />
            </div>

            {/* Main content */}
            <div>
              <div style={{ direction: "rtl" }}>
                <div className="overflow-auto">
                  <PopoularUrl />
                </div>

                <CustomUrlToggle
                  currentTab={currentTab}
                  isCustomUrlActive={isCustomUrlActive}
                  setIsCustomUrlActive={setIsCustomUrlActive}
                  favicon={favicon}
                />
              </div>
            </div>
          </div>

          <Footer
            isExtensionEnabled={!extentionEnabledState}
          />
        </div>
      </div>
    </section>
  )
}
