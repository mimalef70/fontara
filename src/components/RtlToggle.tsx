import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { STORAGE_KEYS } from "~src/lib/constants"

import { Check as CheckIcon } from "./icons"

const RtlToggle = () => {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [rtlList, setRtlList] = useStorage(
    {
      key: STORAGE_KEYS.RTL_LIST,
      instance: new Storage({ area: "local" })
    },
    [] as string[]
  )

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

  const getHostname = (): string | null => {
    try {
      return new URL(currentTab?.url || "").hostname
    } catch {
      return null
    }
  }

  const isRtlActive = (): boolean => {
    const hostname = getHostname()
    if (!hostname) return false
    return rtlList.includes(hostname)
  }

  const handleToggle = () => {
    const hostname = getHostname()
    if (!hostname) return

    if (isRtlActive()) {
      setRtlList(rtlList.filter((h) => h !== hostname))
    } else {
      setRtlList([...rtlList, hostname])
    }
  }

  if (!currentTab || !currentTab.url?.startsWith("http")) return null

  return (
    <div className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3">
      <label className="text-xs cursor-pointer overflow-y-hidden">
        <div className="flex items-center w-full gap-1">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={isRtlActive()}
              onChange={handleToggle}
            />
            <div
              onClick={handleToggle}
              className={`h-4 w-4 rounded border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isRtlActive()
                  ? "bg-[#2474FF] border-[#2474FF]"
                  : "border-gray-300 hover:border-[#2474FF]"
              }`}>
              {isRtlActive() && (
                <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />
              )}
            </div>
          </div>
          <span>راست‌چین کردن صفحه</span>
        </div>
      </label>
    </div>
  )
}

export default RtlToggle
