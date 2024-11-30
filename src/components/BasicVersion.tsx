import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { urlPatternToRegex } from "~utils/pattern"
import { useFontChange } from "~utils/useFontChange"
import PopoularUrl from "./PopoularUrl"
import Header from "./Header"
import FontSelector from "./FontSelector"
import CustomUrlToggle from "./CustomUrlToggle"
import crisp from "url:~assets/logos/crisp-active.png"
import dropbox from "url:~assets/logos/dropbox-active.png"
import duckduckgo from "url:~assets/logos/duckduckgo-active.png"
import facebook from "url:~assets/logos/facebook-active.png"
import feedly from "url:~assets/logos/feedly-active.png"
import getpocket from "url:~assets/logos/getpocket-active.png"
import github from "url:~assets/logos/github-active.png"
import gmail from "url:~assets/logos/gmail-active.png"
import goodreads from "url:~assets/logos/goodreads-active.png"
import google from "url:~assets/logos/google-active.png"
import inoreader from "url:~assets/logos/inoreader-active.png"
import instagram from "url:~assets/logos/instagram-active.png"
import linkedin from "url:~assets/logos/linkedin-active.png"
import medium from "url:~assets/logos/medium-active.png"
import messagesandroid from "url:~assets/logos/messagesandroid-active.png"
import slack from "url:~assets/logos/slack-active.png"
import telegram from "url:~assets/logos/telegram-active.png"
import trello from "url:~assets/logos/trello-active.png"
import twitter from "url:~assets/logos/twitter-active.png"
import virgool from "url:~assets/logos/virgool-active.png"
import whatsapp from "url:~assets/logos/whatsapp-active.png"
import wikipedia from "url:~assets/logos/wikipedia-active.png"
import wordpress from "url:~assets/logos/wordpress-active.png"
import { initializeFonts, resetFontToDefault } from "~contents/plasmo"


export const fonts = [
  {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  },
]

export const initialBoxes: BoxItem[] = [
  { id: "crisp", src: crisp, isActive: true, url: "", isInUi: true },
  {
    id: "dropbox",
    src: dropbox,
    isActive: true,
    url: "https://www.*dropbox.com/*",
    isInUi: true
  },
  {
    id: "duckduckgo",
    src: duckduckgo,
    isActive: true,
    url: "https://duckduckgo.com/*",
    isInUi: true
  },
  {
    id: "facebook",
    src: facebook,
    isActive: true,
    url: "https://www.facebook.com/*",
    isInUi: true
  },
  {
    id: "feedly",
    src: feedly,
    isActive: true,
    url: "https://feedly.com/*",
    isInUi: true
  },
  {
    id: "getpocket",
    src: getpocket,
    isActive: true,
    url: "https://getpocket.com/*",
    isInUi: true
  },
  {
    id: "github",
    src: github,
    isActive: true,
    url: "https://github.com/*",
    isInUi: true
  },
  {
    id: "gmail",
    src: gmail,
    isActive: true,
    url: "https://mail.google.com/*",
    isInUi: true
  },
  {
    id: "goodreads",
    src: goodreads,
    isActive: true,
    url: "https://www.goodreads.com/*",
    isInUi: true
  },
  {
    id: "google",
    src: google,
    isActive: true,
    url: "https://www.google.com/*",
    isInUi: true
  },
  {
    id: "inoreader",
    src: inoreader,
    isActive: true,
    url: "https://www.inoreader.com/*",
    isInUi: true
  },
  {
    id: "instagram",
    src: instagram,
    isActive: true,
    url: "https://www.instagram.com/*",
    isInUi: true
  },
  {
    id: "linkedin",
    src: linkedin,
    isActive: true,
    url: "https://*linkedin.com/*",
    isInUi: true
  },
  {
    id: "medium",
    src: medium,
    isActive: true,
    url: "https://medium.com/*",
    isInUi: true
  },
  {
    id: "messagesandroid",
    src: messagesandroid,
    isActive: true,
    url: "https://messages.google.com/*",
    isInUi: true
  },
  {
    id: "slack",
    src: slack,
    isActive: true,
    url: "https://slack.com/*",
    isInUi: true
  },
  {
    id: "telegram",
    src: telegram,
    isActive: true,
    url: "https://web.telegram.org/*",
    isInUi: true
  },
  {
    id: "trello",
    src: trello,
    isActive: true,
    url: "https://trello.com/*",
    isInUi: true
  },
  {
    id: "twitter",
    src: twitter,
    isActive: true,
    url: "https://x.com/*",
    isInUi: true
  },
  {
    id: "virgool",
    src: virgool,
    isActive: true,
    url: "https://virgool.io/*",
    isInUi: true
  },
  {
    id: "whatsapp",
    src: whatsapp,
    isActive: true,
    url: "https://web.whatsapp.com/*",
    isInUi: true
  },
  {
    id: "wikipedia",
    src: wikipedia,
    isActive: true,
    url: "https://*.wikipedia.org/*",
    isInUi: true
  },
  {
    id: "wordpress",
    src: wordpress,
    isActive: true,
    url: "https://*.wordpress.org/*",
    isInUi: true
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
const browserAPI: typeof chrome = typeof browser !== "undefined" ? browser : chrome

export default function BaseVersion() {
  // State
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false)
  const [currentTab, setCurrentTab] = useState<string>("")
  const [boxes, setBoxes] = useState<BoxItem[]>(initialBoxes)
  const [favicon, setFavicon] = useState<string>("")
  const [isExtensionEnabled, setIsExtensionEnabled] = useState(true)


  // Initialize extension state from storage
  useEffect(() => {
    const initializeExtensionState = async () => {
      const storedState = await storage.get<boolean>("isExtensionEnabled")
      setIsExtensionEnabled(storedState ?? true) // Default to true if not set
    }

    initializeExtensionState()
  }, [])


  // Initialize custom URL status
  useEffect(() => {
    const initializeCustomUrlStatus = async () => {
      const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]

      if (tab?.url) {
        const mainUrl = new URL(tab.url).origin
        const currentTabUrl = `${mainUrl}/*`
        const urlEntry = customActiveUrls.find(item => item.url === currentTabUrl)
        setIsCustomUrlActive(urlEntry?.isActive ?? false)
      }
    }

    initializeCustomUrlStatus()
  }, [])

  // Check current tab
  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
        const tab = tabs[0]

        if (tab?.url) {
          const mainUrl = new URL(tab.url).origin
          const currentTabUrl = `${mainUrl}/*`
          setCurrentTab(currentTabUrl)

          // Check if the current URL matches any popular site
          const matchedSite = boxes.some((box) =>
            box.url && urlPatternToRegex(box.url).test(tab.url)
          )

          if (matchedSite) {
            setCurrentTab("")
            return
          }

          // Get current custom URLs
          const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
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
        const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
        let updatedUrls = customActiveUrls

        if (isCustomUrlActive) {
          if (!customActiveUrls.some((item) => item.url === currentTab)) {
            updatedUrls = [...customActiveUrls, { url: currentTab, isActive: true }]
          }
        } else {
          updatedUrls = customActiveUrls.filter((item) => item.url !== currentTab)
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
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
        const tab = tabs[0]

        if (tab?.favIconUrl) {
          setFavicon(tab.favIconUrl)
        } else {
          // Fallback to searching for favicon in page
          const links = document.querySelectorAll('link[rel*="icon"]')
          const favicons: string[] = []

          links.forEach(link => {
            const href = link.getAttribute('href')
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
            favicons.push(new URL('/favicon.ico', window.location.origin).href)
          }

          // Try each favicon until one works
          for (const url of favicons) {
            try {
              const response = await fetch(url, { method: 'HEAD' })
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

      // Get all tabs and update them
      const tabs = await browserAPI.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith('http')) {
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

      // Reload active tab to ensure changes take effect
      const activeTab = await browserAPI.tabs.query({ active: true, currentWindow: true })
      if (activeTab[0]?.id) {
        await browserAPI.tabs.reload(activeTab[0].id)
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

      const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
      let updatedUrls: BoxItem[]

      if (newIsActive) {
        const existingUrlIndex = customActiveUrls.findIndex(item => item.url === currentTab)
        if (existingUrlIndex === -1) {
          updatedUrls = [...customActiveUrls, { url: currentTab, isActive: true }]
        } else {
          updatedUrls = customActiveUrls.map(item =>
            item.url === currentTab ? { ...item, isActive: true } : item
          )
        }
      } else {
        updatedUrls = customActiveUrls.map(item =>
          item.url === currentTab ? { ...item, isActive: false } : item
        )
      }

      await storage.set("customActiveUrls", updatedUrls)
      browserAPI.runtime.sendMessage({
        action: "updateCustomUrlStatus",
        data: updatedUrls
      })

      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
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
    <div className="flex flex-col justify-between h-full w-[90%] mx-auto">
      <Header
        isExtensionEnabled={isExtensionEnabled}
        onToggle={handleExtensionToggle}
      />

      <div className={`
        flex-1 flex flex-col 
        ${!isExtensionEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}
        transition-opacity duration-200
      `}>
        <FontSelector
        />

        <div style={{ direction: "rtl" }}>
          <div className="overflow-auto">
            <PopoularUrl
              boxes={boxes}
              setBoxes={setBoxes}
            />
          </div>

          <CustomUrlToggle
            currentTab={currentTab}
            isCustomUrlActive={isCustomUrlActive}
            onToggle={handleCustomUrlToggle}
            favicon={favicon}
          />
        </div>
      </div>
      <footer className="w-full">
        <p className="flex justify-center items-center text-gray-500 gap-1">
          <span className="font-medium">  طراحی و توسعه با 💖توسط </span><a href="https://x.com/mimalef70" className="font-black text-gray-700">مصطفی الهیاری</a>
        </p>
      </footer>
    </div>
  )
}