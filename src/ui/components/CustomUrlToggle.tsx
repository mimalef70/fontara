import React, { useEffect, useState } from "react"

import { STORAGE_KEYS } from "../../config/storage"
import { POPULAR_WEBSITES } from "../../config/sites"
import type { WebsiteItem } from "../../definitions"
import { createRegexFromUrl, getMatchingWebsite } from "../../utils/url"
import { useStorageValue } from "../hooks/use-storage"

import { Check as CheckIcon } from "./icons"

const CustomUrlToggle = () => {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [websiteList, setWebsiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    []
  )

  const handleUrlToggle = async (checked: boolean) => {
    if (!currentTab?.url) return

    let updatedUrls: WebsiteItem[]

    const existingWebsiteIndex = websiteList.findIndex(
      (item) => getMatchingWebsite(currentTab.url, [item]) !== null
    )

    if (existingWebsiteIndex === -1) {
      updatedUrls = [
        ...websiteList,
        {
          url: currentTab.url,
          regex: createRegexFromUrl(currentTab.url),
          isActive: true
        }
      ]
    } else {
      updatedUrls = websiteList.map((item, index) =>
        index === existingWebsiteIndex
          ? { ...item, isActive: checked }
          : item
      )
    }
    await setWebsiteList(updatedUrls)
  }

  const isUrlActive = (): boolean => {
    return getMatchingWebsite(currentTab?.url, websiteList)?.isActive === true
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
    !currentTab.url?.startsWith("http") ||
    POPULAR_WEBSITES.some(
      (website) => getMatchingWebsite(currentTab.url, [website]) !== null
    )
  )
    return null

  return (
    <div className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3">
      <label
        className="text-xs cursor-pointer overflow-y-hidden"
        htmlFor="customUrl">
        <div className="flex items-center w-full gap-1">
          <div className="relative">
            <input
              type="checkbox"
              name="customUrl"
              id="customUrl"
              className="sr-only"
              checked={isUrlActive()}
              onChange={(e) => handleUrlToggle(e.target.checked)}
            />
            <div
              onClick={() => handleUrlToggle(!isUrlActive())}
              className={`h-4 w-4 rounded border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isUrlActive()
                  ? "bg-[#2474FF] border-[#2474FF]"
                  : "border-gray-300 hover:border-[#2474FF]"
              }`}>
              {isUrlActive() && (
                <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />
              )}
            </div>
          </div>
          <div className="flex items-center justify-around gap-1 ">
            <span className="shrink-0">برای سایت</span>
            <span className="truncate" dir="ltr">
              {currentTab?.url && new URL(currentTab.url).hostname.slice(0, 25)}
            </span>
            {currentTab?.favIconUrl && (
              <img
                src={currentTab.favIconUrl || "/placeholder.svg"}
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
