import { useEffect, useState } from "react"

import { POPULAR_WEBSITES } from "../../config/sites"
import { STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { createRegexFromUrl, getMatchingWebsite } from "../../utils/url"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import { EMPTY_WEBSITE_LIST } from "../storage-defaults"
import { Check as CheckIcon } from "./icons"

const CustomUrlToggle = () => {
  const { direction, t } = useI18n()
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [websiteList, setWebsiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
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
        index === existingWebsiteIndex ? { ...item, isActive: checked } : item
      )
    }
    try {
      await setWebsiteList(updatedUrls)
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update custom URL setting.", error)
      }
    }
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

  const active = isUrlActive()
  const currentUrl = currentTab?.url

  if (
    !currentUrl?.startsWith("http") ||
    POPULAR_WEBSITES.some(
      (website) => getMatchingWebsite(currentUrl, [website]) !== null
    )
  )
    return null

  const isRtl = direction === "rtl"
  const hostName = new URL(currentUrl).hostname.slice(0, 25)
  const checkboxControl = (
    <div className="relative shrink-0">
      <input
        type="checkbox"
        name="customUrl"
        id="customUrl"
        className="peer sr-only"
        checked={active}
        onChange={(e) => void handleUrlToggle(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`flex size-4 cursor-pointer items-center justify-center rounded border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#2474FF]/30 peer-focus-visible:ring-offset-2 ${
          active
            ? "bg-[#2474FF] border-[#2474FF]"
            : "border-gray-300 hover:border-[#2474FF]"
        }`}>
        {active && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </div>
  )

  const siteIdentity = (
    <span
      className="inline-flex min-w-0 max-w-[8.5rem] items-center gap-1 align-middle"
      dir="ltr">
      {currentTab?.favIconUrl && (
        <img
          src={currentTab.favIconUrl || "/placeholder.svg"}
          className="!size-4 shrink-0 object-contain"
          alt="site icon"
        />
      )}
      <bdi className="truncate" dir="ltr">
        {hostName}
      </bdi>
    </span>
  )

  return (
    <div
      className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3"
      dir={direction}>
      <label
        className="block cursor-pointer overflow-y-hidden text-xs"
        htmlFor="customUrl">
        <div
          className={`flex w-full items-center gap-2 ${
            isRtl ? "justify-end" : "justify-start"
          }`}
          dir="ltr">
          {!isRtl && checkboxControl}
          <div
            dir={direction}
            className="inline-flex min-w-0 max-w-full items-center justify-start gap-1">
            <span className="shrink-0">{t("customUrl.enablePrefix")}</span>
            {siteIdentity}
            <span className="shrink-0">{t("customUrl.enableSuffix")}</span>
          </div>
          {isRtl && checkboxControl}
        </div>
      </label>
    </div>
  )
}

export default CustomUrlToggle
