import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions
} from "@headlessui/react"
import {
  CheckIcon,
  ChevronDownIcon,
  PencilIcon
} from "@heroicons/react/24/solid"
import clsx from "clsx"
import React, { useEffect, useState } from "react"
import ExampleSvg from "react:../../assets/font-samples/estedad.svg"
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

import { Storage } from "@plasmohq/storage"

import { urlPatternToRegex } from "~utils/pattern"
import { useFontChange } from "~utils/useFontChange"

import PopoularUrl from "./PopoularUrl"

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
  }
]

const storage = new Storage()

// Declare type for browserAPI
declare const chrome: any
declare const browser: any

// Use browser for Firefox compatibility, fall back to chrome for Chrome
const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

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

          // Check if the current tab URL is in the list of active URLs
          const activeUrls = (await storage.get<BoxItem[]>("activeUrls")) || []
          const isUrlActive = activeUrls.some(
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

  useEffect(() => {
    async function updateActiveUrls() {
      if (currentTab) {
        const activeUrls = (await storage.get<BoxItem[]>("activeUrls")) || []
        let updatedUrls = activeUrls

        if (isCustomUrlActive) {
          if (!activeUrls.some((item) => item.url === currentTab)) {
            updatedUrls = [...activeUrls, { url: currentTab, isActive: true }]
          }
        } else {
          updatedUrls = activeUrls.filter((item) => item.url !== currentTab)
        }

        await storage.set("activeUrls", updatedUrls)
        browserAPI.runtime.sendMessage({
          action: "updateActiveUrls",
          activeUrls: updatedUrls
        })
      }
    }

    updateActiveUrls()
  }, [isCustomUrlActive, currentTab])

  function handleCustomUrlToggle() {
    setIsCustomUrlActive((prev) => !prev)
  }

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="overflow-auto " style={{ direction: "rtl" }}>
        <p className="text-center mb-2 text-xl text-blue-800">v2فونت آرا</p>

        <Listbox value={selected} onChange={handleFontChange}>
          <ListboxButton
            className={clsx(
              "relative select select-bordered block w-full rounded-lg bg-black/5 py-1.5 pl-8 p3-3 text-right text-sm/6 text-black",
              "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-black/25"
            )}>
            {selected.name}
          </ListboxButton>

          <ListboxOptions
            anchor="bottom"
            transition
            className={clsx(
              " data-[closed]:scale-95 data-[closed]:opacity-0 w-[var(--button-width)]  border border-black/5 bg-white  p-1 [--anchor-gap:var(--spacing-1)] focus:outline-none",
              "transition duration-100 ease-out data-[leave]:data-[closed]:opacity-0 mt-1 h-60 overflow-auto shadow-sm shadow-black divide-y-2 "
            )}>
            {fonts.map((font) => (
              <ListboxOption
                key={font.name}
                value={font}
                className="group flex gap-2  py-1.5 px-3  data-[focus]:bg-black/10 cursor-pointer ">
                {({ selected }) => (
                  <>
                    <CheckIcon
                      className={clsx(
                        "size-4 fill-black",
                        selected ? "visible" : "invisible"
                      )}
                    />
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <PencilIcon className="size-4 fill-gray-400" />
                      <span className={`font-estedad text-sm ${font.style}`}>
                        {font.name}
                      </span>
                    </div>
                    <p
                      className={`${font.style} text-gray-400 hidden group-hover:inline text-[13px]`}>
                      {font.svg}
                    </p>
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Listbox>
        <PopoularUrl boxes={boxes} setBoxes={setBoxes} />
      </div>

      {currentTab && (
        <div className="border border-gray-400 rounded-md p-2 flex items-center gap-2 select-none mx-auto w-[90%] ">
          <input
            type="checkbox"
            name="activeUrl"
            id="activeUrl"
            checked={isCustomUrlActive}
            onChange={handleCustomUrlToggle}
            className="checkbox checkbox-success checkbox-sm"
          />
          <label className="text-[14px] cursor-pointer" htmlFor="activeUrl">
            افزونه فونت آرا برای {currentTab.slice(0, -2)} شود؟
          </label>
        </div>
      )}
    </div>
  )
}
