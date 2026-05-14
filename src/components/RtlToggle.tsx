import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { STORAGE_KEYS } from "~src/lib/constants"

import { Check as CheckIcon, Settings } from "./icons"

export interface RtlItem {
  hostname: string
  selector?: string
}

const RtlToggle = () => {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectorInput, setSelectorInput] = useState("")
  const [rtlList, setRtlList] = useStorage(
    {
      key: STORAGE_KEYS.RTL_LIST,
      instance: new Storage({ area: "local" })
    },
    [] as RtlItem[]
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

  const getRtlItem = (): RtlItem | undefined => {
    const hostname = getHostname()
    if (!hostname) return undefined
    return rtlList.find((item) => item.hostname === hostname)
  }

  const isRtlActive = (): boolean => !!getRtlItem()

  const handleToggle = () => {
    const hostname = getHostname()
    if (!hostname) return

    if (isRtlActive()) {
      setRtlList(rtlList.filter((item) => item.hostname !== hostname))
      setShowSettings(false)
    } else {
      setRtlList([...rtlList, { hostname }])
    }
  }

  const handleSaveSelector = () => {
    const hostname = getHostname()
    if (!hostname) return

    const updated = rtlList.map((item) =>
      item.hostname === hostname
        ? { ...item, selector: selectorInput.trim() || undefined }
        : item
    )
    setRtlList(updated)
  }

  useEffect(() => {
    const item = getRtlItem()
    setSelectorInput(item?.selector || "")
  }, [rtlList, currentTab])

  if (!currentTab || !currentTab.url?.startsWith("http")) return null

  return (
    <div className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3">
      <div className="flex items-center w-full gap-1 text-xs">
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
        <span className="flex-1 cursor-pointer" onClick={handleToggle}>
          راستچین کردن صفحه
        </span>
        {isRtlActive() && (
          <div
            onClick={() => setShowSettings(!showSettings)}
            className="cursor-pointer text-gray-500 hover:text-[#2474FF] transition-colors">
            <Settings className="h-4 w-4" />
          </div>
        )}
      </div>

      {showSettings && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500">
              سلکتور CSS (اختیاری):
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                dir="ltr"
                placeholder="مثلاً: body, .main-content"
                value={selectorInput}
                onChange={(e) => setSelectorInput(e.target.value)}
                className="flex-1 text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#2474FF]"
              />
              <button
                onClick={handleSaveSelector}
                className="text-[10px] bg-[#2474FF] text-white rounded px-2 py-1 hover:bg-[#1a5fd4]">
                ذخیره
              </button>
            </div>
            <span className="text-[9px] text-gray-400">
              اگر html direction کار نکرد، سلکتور المان مورد نظر را وارد کنید
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RtlToggle
