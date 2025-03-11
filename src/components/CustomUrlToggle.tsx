import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { STORAGE_KEYS } from "~src/lib/constants"
import { popularWebsites } from "~src/lib/popularWebsites"

import { Checkbox } from "./ui/Checkbox"

type Props = {}

const CustomUrlToggle = (props: Props) => {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [websiteList, setWebsiteList] = useStorage(
    {
      key: STORAGE_KEYS.WEBSITE_LIST,
      instance: new Storage({
        area: "local"
      })
    },
    []
  )

  const createRegexFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      return `^https?://${hostname.replace(/\./g, "\\.")}/?.*$`
    } catch (e) {
      return url // Fallback if URL parsing fails
    }
  }

  const handleUrlToggle = (checked: boolean) => {
    let updatedUrls
    const regex = new RegExp(currentTab?.url, "i")
    const existingWebsiteIndex = websiteList.findIndex((item) =>
      regex.test(item.url)
    )
    if (existingWebsiteIndex === -1) {
      // Website doesn't exist, add it with isActive: true
      updatedUrls = [
        ...websiteList,
        {
          url: currentTab.url,
          regex: createRegexFromUrl(currentTab.url),
          isActive: true
        }
      ]
    } else {
      // Website exists, toggle isActive property
      updatedUrls = websiteList.map((item, index) =>
        index === existingWebsiteIndex
          ? { ...item, isActive: !item.isActive }
          : item
      )
    }
    setWebsiteList(updatedUrls)
  }

  const isUrlActive = (): boolean => {
    // if (!currentTab || !websiteList) return false
    for (const website of websiteList) {
      const regex = new RegExp(website.regex, "i")
      // Test if current URL matches the pattern
      if (regex.test(currentTab.url.trim())) {
        return website.isActive
      }
    }
    return false
  }

  useEffect(() => {
    const getActiveTab = async () => {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      setCurrentTab(tabs[0])
    }
    getActiveTab()
  }, [])

  if (
    !currentTab ||
    !currentTab.url.startsWith("http") ||
    popularWebsites.some((website) =>
      new RegExp(website.regex, "i").test(currentTab.url)
    )
  )
    return null

  return (
    <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full mt-3">
      <label
        className="text-xs cursor-pointer overflow-y-hidden"
        htmlFor="customUrl">
        <div className="flex items-center w-full gap-1">
          <Checkbox
            name="customUrl"
            id="customUrl"
            checked={isUrlActive()}
            onCheckedChange={handleUrlToggle}
          />
          <div className="flex items-center justify-around gap-1 ">
            <span className="shrink-0">برای سایت</span>
            <span className="truncate" dir="ltr">
              {currentTab?.url && new URL(currentTab.url).hostname.slice(0, 25)}
            </span>
            <img
              src={currentTab?.favIconUrl}
              className="!size-4 object-contain"
              alt="site icon"
            />
            <span className="shrink-0">فعال باشد؟</span>
          </div>
        </div>
      </label>
    </div>
  )
}

export default CustomUrlToggle
