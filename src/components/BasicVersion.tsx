import React, { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select"
import { Checkbox } from "./ui/Checkbox"
import { Storage } from "@plasmohq/storage"
import { urlPatternToRegex } from "~utils/pattern"
import { useFontChange } from "~utils/useFontChange"
import PopoularUrl from "./PopoularUrl"
import { CheckedCircle, Circle, PlusIcon } from "@/assets/icons/Icons"
import { Switch } from "./ui/Switch"

interface BoxItem {
  id?: string
  src?: string
  isActive?: boolean
  url?: string
  isInUi?: boolean
}

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
  },


]

const storage = new Storage()
declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome = typeof browser !== "undefined" ? browser : chrome

export const fonts = [
  {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  },
  {
    value: "Vazirmatn",
    name: "وزیر",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  },
  {
    value: "Morraba",
    name: "مربا",
    svg: "بستد دل و دین از من",
    style: "font-morabba"
  },
  {
    value: "Dana",
    name: "دانا",
    svg: "بستد دل و دین از من",
    style: "font-dana"
  },
  {
    value: "Samim",
    name: "صمیم",
    svg: "بستد دل و دین از من",
    style: "font-samim"
  },
  {
    value: "Shabnam",
    name: "شبنم",
    svg: "بستد دل و دین از من",
    style: "font-shabnam"
  },
  {
    value: "Sahel",
    name: "ساحل",
    svg: "بستد دل و دین از من",
    style: "font-sahel"
  },
  {
    Value: "Parastoo",
    name: "پرستو",
    svg: "بستد دل و دین از من",
    style: "font-parastoo"
  },
  {
    value: "Gandom",
    name: "گندم",
    svg: "بستد دل و دین از من",
    style: "font-gandom"
  },
  {
    value: "Tanha",
    name: "تنها",
    svg: "بستد دل و دین از من",
    style: "font-tanha"
  },
  {
    value: "Behdad",
    name: "بهداد",
    svg: "بستد دل و دین از من",
    style: "font-behdad"
  },
  {
    value: "Nika",
    name: "نیکا",
    svg: "بستد دل و دین از من",
    style: "font-nika"
  },
  {
    value: "Ganjname",
    name: "گنج نامه",
    svg: "بستد دل و دین از من",
    style: "font-ganjname"
  },
  {
    value: "Shahab",
    name: "شهاب",
    svg: "بستد دل و دین از من",
    style: "font-shahab"
  },
  {
    value: "Mikhak",
    name: "میخک",
    svg: "بستد دل و دین از من",
    style: "font-mikhak"
  }
]

export default function BaseVersion() {
  const { selected, handleFontChange } = useFontChange()
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false)
  const [currentTab, setCurrentTab] = useState<string>("")
  const [boxes, setBoxes] = useState(initialBoxes)
  const [isActive, setIsActive] = useState(false);
  const [hoveredFont, setHoveredFont] = useState(null);
  const [isExtensionEnabled, setIsExtensionEnabled] = useState(false)

  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) =>
          browserAPI.tabs.query({ active: true, currentWindow: true }, resolve)
        )
        const tab = tabs[0]

        if (tab?.url) {
          const mainUrl = new URL(tab.url).origin
          const currentTabUrl = `${mainUrl}/*`
          setCurrentTab(currentTabUrl)

          // Check if the current URL matches any popular site
          const matchedSite = initialBoxes.some((box) =>
            urlPatternToRegex(box.url).test(tab.url)
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
  }, [])

  // this code
  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await new Promise((resolve) =>
          browserAPI.tabs.query({ active: true, currentWindow: true }, resolve)
        )
        const tab = tabs[0]

        if (tab?.url) {
          const mainUrl = new URL(tab.url).origin
          const currentTabUrl = `${mainUrl}/*`
          setCurrentTab(currentTabUrl)

          // Check if the current URL matches any popular site
          const matchedSite = initialBoxes.some((box) =>
            urlPatternToRegex(box.url).test(tab.url)
          )

          if (matchedSite) {
            setCurrentTab("")
            return // No need to check custom URLs if it's a popular site
          }

          // Changed storage key from "activeUrls" to "customActiveUrls"
          const customActiveUrls = (await storage.get<BoxItem[]>("customActiveUrls")) || []
          const isUrlActive = customActiveUrls.some(
            (item) => item.url === currentTabUrl
          )
          setIsCustomUrlActive(isUrlActive)
        }
      } catch (error) {
        console.error("Error checking current tab:", error)
      }
    }

    checkCurrentTab()
  }, [])

  // Change this part in your custom URL toggle useEffect:
  useEffect(() => {
    async function updateActiveUrls() {
      if (currentTab) {
        // Changed storage key from "activeUrls" to "customActiveUrls"
        const customActiveUrls = (await storage.get<BoxItem[]>("customActiveUrls")) || []
        let updatedUrls = customActiveUrls

        if (isCustomUrlActive) {
          if (!customActiveUrls.some((item) => item.url === currentTab)) {
            updatedUrls = [...customActiveUrls, { url: currentTab, isActive: true }]
          }
        } else {
          updatedUrls = customActiveUrls.filter((item) => item.url !== currentTab)
        }

        // Changed storage key from "activeUrls" to "customActiveUrls"
        await storage.set("customActiveUrls", updatedUrls)
        browserAPI.runtime.sendMessage({
          action: "updateCustomActiveUrls", // Changed action name
          customActiveUrls: updatedUrls // Changed payload key
        })
      }
    }

    updateActiveUrls()
  }, [isCustomUrlActive, currentTab])

  // Get The Logo Of The Tab
  const [favicon, setFavicon] = useState<string>("")

  useEffect(() => {
    const getFavicon = async () => {
      try {
        // Get all favicon links
        const links = document.querySelectorAll('link[rel*="icon"]')
        const favicons: string[] = []

        // Collect all potential favicon URLs
        links.forEach(link => {
          const href = link.getAttribute('href')
          if (href) {
            // Convert relative URLs to absolute
            try {
              const absoluteUrl = new URL(href, window.location.origin).href
              favicons.push(absoluteUrl)
            } catch {
              // If URL construction fails, try using the href directly
              favicons.push(href)
            }
          }
        })

        // If no icons found in link tags, try default favicon.ico
        if (favicons.length === 0) {
          favicons.push(new URL('/favicon.ico', window.location.origin).href)
        }

        // Check if favicon exists and is accessible
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
      } catch (error) {
        console.error("Error getting favicon:", error)
      }
    }

    // Get current tab's favicon
    const getCurrentTabFavicon = async () => {
      try {
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
        const tab = tabs[0]

        if (tab?.favIconUrl) {
          setFavicon(tab.favIconUrl)
        } else {
          getFavicon()
        }
      } catch (error) {
        console.error("Error getting tab favicon:", error)
        getFavicon()
      }
    }

    getCurrentTabFavicon()
  }, [currentTab])


  // ---------------------------------------------------------
  const handleExtensionToggle = async () => {
    setIsExtensionEnabled((prev) => !prev)
    setIsCustomUrlActive(false)

    // ----------------------------Popular----------------------------
    const updatedBoxes = boxes.map((box) =>
      box.id ? { ...box, isActive: box.isActive } : box
    )
    setBoxes(updatedBoxes)
    // Changed storage key from "activeUrls" to "popularActiveUrls"
    await storage.set("popularActiveUrls", updatedBoxes)

    browserAPI.runtime.sendMessage({
      action: "updatePopularActiveUrls", // Changed action name
      popularActiveUrls: updatedBoxes // Changed payload key
    })
    // -------------
    // Get current custom URLs
    const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
    let updatedUrls: BoxItem[]

    // Remove URL or set isActive to false
    updatedUrls = customActiveUrls.map(item =>
      item.url === currentTab ? { ...item, isActive: false } : item
    )

    // Save to storage
    await storage.set("customActiveUrls", updatedUrls)

    // Notify background script
    browserAPI.runtime.sendMessage({
      action: "updateCustomUrlStatus",
      data: updatedUrls
    })

    // Update current tab
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      browserAPI.tabs.sendMessage(tabs[0].id, {
        action: "setActiveStatus",
        isActive: !isExtensionEnabled
      })
    }
  }

  // ---------------------------------------------------------

  const handleCustomUrlToggle = async () => {
    try {
      const newIsActive = !isCustomUrlActive
      setIsCustomUrlActive(newIsActive)

      // Get current custom URLs
      const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls") || []
      let updatedUrls: BoxItem[]


      if (newIsActive) {
        // Add new URL if it doesn't exist, or update existing one
        const existingUrlIndex = customActiveUrls.findIndex(item => item.url === currentTab)
        if (existingUrlIndex === -1) {
          updatedUrls = [...customActiveUrls, { url: currentTab, isActive: true }]
        } else {
          updatedUrls = customActiveUrls.map(item =>
            item.url === currentTab ? { ...item, isActive: true } : item
          )
        }
      } else {
        // Remove URL or set isActive to false
        updatedUrls = customActiveUrls.map(item =>
          item.url === currentTab ? { ...item, isActive: false } : item
        )
      }

      // Save to storage
      await storage.set("customActiveUrls", updatedUrls)

      // Notify background script
      browserAPI.runtime.sendMessage({
        action: "updateCustomUrlStatus",
        data: updatedUrls
      })

      // Update current tab
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        browserAPI.tabs.sendMessage(tabs[0].id, {
          action: "setActiveStatus",
          isActive: newIsActive
        })
      }
    } catch (error) {
      console.error("Error toggling custom URL:", error)
      // Revert state if there's an error
      setIsCustomUrlActive(!isActive)
    }
  }



  return (
    <div className="flex flex-col justify-between h-full w-[90%] mx-auto">
      {/* Header with title and switch - always visible and active */}
      <div className="flex justify-between relative z-10">
        <p className="text-center mb-2 text-xl text-blue-800">v2فونت آرا</p>
        <Switch
          dir="ltr"
          checked={isExtensionEnabled}
          onCheckedChange={handleExtensionToggle}
        />
      </div>

      {/* Main content with conditional opacity and pointer-events */}
      <div className={`
      flex-1 flex flex-col 
      ${!isExtensionEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}
      transition-opacity duration-200
    `}>
        <div>
          {/* Font Selector */}
          <div className="relative">
            <div className="flex flex-col gap-3">
              <Select
                onValueChange={(value) =>
                  handleFontChange(fonts.find((font) => font.name === value)!)
                }
                onOpenChange={() => setIsActive((prev) => !prev)}
                dir="rtl"
                disabled={!isExtensionEnabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selected.name} />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
                  {fonts.map((font) => (
                    <div key={font.name} className="flex items-center justify-between gap-2 relative">
                      <SelectItem
                        value={font.name}
                        className="flex items-center gap-2 py-1 px-3 cursor-pointer"
                        onMouseEnter={() => setHoveredFont(font.name)}
                        onMouseLeave={() => setHoveredFont(null)}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className={`font-estedad text-sm ${font.style} ${selected.name === font.name ? "text-[#0D92F4]" : ""
                            }`}>
                            {font.name}
                          </span>
                          <span className={`${font.style} text-gray-400 text-[13px] ${hoveredFont === font.name && selected.name !== font.name
                            ? "inline"
                            : "hidden"
                            }`}>
                            {font.svg}
                          </span>
                        </div>
                      </SelectItem>
                      <div className="!size-5 fill-black absolute left-2 flex items-center justify-center">
                        {hoveredFont === font.name && selected.name !== font.name ? (
                          <Circle />
                        ) : (
                          selected.name === font.name && <CheckedCircle />
                        )}
                      </div>
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <a href='#'
                className={`flex cursor-pointer justify-center items-center gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] 
  bg-[#edf3fd] rounded-[3px] text-[13px] text-[#2374ff] text-center py-[9px] relative
`}>
                افزودن فونت دلخواه <PlusIcon />
              </a>
            </div>
          </div>
        </div>

        <div className={`${isActive ? 'opacity-30' : 'opacity-90'}`} style={{ direction: "rtl" }}>
          <div className="overflow-auto">
            <PopoularUrl
              boxes={boxes}
              setBoxes={setBoxes}
            />
          </div>

          {currentTab && (
            <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full">
              <label className="text-xs cursor-pointer flex items-center gap-1" htmlFor="activeUrl">
                <Checkbox
                  name="activeUrl"
                  id="activeUrl"
                  checked={isCustomUrlActive}
                  onCheckedChange={handleCustomUrlToggle}
                  disabled={!isExtensionEnabled}
                />
                برای سایت {" "}
                {currentTab && currentTab.slice(8, -2)} <img src={favicon} className="!size-4 object-contain" />
                {" "} فعال باشد؟
              </label>
            </div>
          )}
        </div>
      </div>
    </div >

  )
}
