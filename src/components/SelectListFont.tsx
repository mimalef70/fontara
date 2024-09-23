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

import { Storage } from "@plasmohq/storage"

import { useFontChange } from "~utils/useFontChange"

import PopoularUrl, { initialBoxes } from "./PopoularUrl"

export const fonts = [
  { value: "Estedad", name: "استعداد", svg: ExampleSvg, style: "font-estedad" },
  { value: "Vazirmatn", name: "وزیر", svg: ExampleSvg, style: "font-estedad" },
  { value: "Morraba", name: "مربا", svg: ExampleSvg, style: "font-morabba" },
  { value: "Dana", name: "دانا", svg: ExampleSvg, style: "font-dana" },
  { value: "Samim", name: "صمیم", svg: ExampleSvg, style: "font-samim" },
  { value: "Shabnam", name: "شبنم", svg: ExampleSvg, style: "font-shabnam" },
  { value: "Sahel", name: "ساحل", svg: ExampleSvg, style: "font-sahel" },
  { Value: "Parastoo", name: "پرستو", svg: ExampleSvg, style: "font-parastoo" },
  { value: "Gandom", name: "گندم", svg: ExampleSvg, style: "font-gandom" },
  { value: "Tanha", name: "تنها", svg: ExampleSvg, style: "font-tanha" },
  { value: "Behdad", name: "بهداد", svg: ExampleSvg, style: "font-behdad" },
  { value: "Nika", name: "نیکا", svg: ExampleSvg, style: "font-nika" },
  {
    value: "Ganjname",
    name: "گنج نامه",
    svg: ExampleSvg,
    style: "font-ganjname"
  },
  { value: "Shahab", name: "شهاب", svg: ExampleSvg, style: "font-shahab" },
  { value: "Mikhak", name: "میخک", svg: ExampleSvg, style: "font-mikhak" }
]
function urlPatternToRegex(pattern) {
  return new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\//g, "\\/") + "$"
  )
}
export default function SelectListFont() {
  const { selected, handleFontChange } = useFontChange()
  const [isCustomUrlActive, setIsCustomUrlActive] = useState<boolean>(false)
  const [currentTab, setCurrentTab] = useState<string>("")
  useEffect(() => {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true
      },
      (tabs) => {
        const tab = tabs[0]
        if (tab.url) {
          const mainUrl = new URL(tab.url).origin
          setCurrentTab(mainUrl)

          // Check if the current URL matches any popular site
          const matchedSite = initialBoxes.some((box) => {
            const regex = urlPatternToRegex(box.url)
            return regex.test(tab.url)
          })

          // If matched, set currentTab to empty string
          if (matchedSite) {
            setCurrentTab("")
          }
        }
      }
    )
  }, [])
  useEffect(() => {
    console.log(isCustomUrlActive)
  }, [isCustomUrlActive])

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <p className="text-center mb-2 text-xl">فونت آرا</p>

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
                className="group flex gap-2  py-1.5 px-3  data-[focus]:bg-black/10 ">
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

                    <font.svg
                      width={90}
                      className="text-gray-400 hidden group-hover:inline"
                    />
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Listbox>
        {/* Popular URL */}
        <PopoularUrl />
      </div>

      {!!currentTab.length && (
        <div className="border border-gray-400 rounded-md p-2 flex items-center gap-2 select-none">
          <input
            type="checkbox"
            name="activeUrl"
            id="activeUrl"
            checked={isCustomUrlActive}
            onChange={(e) => setIsCustomUrlActive((prev) => !prev)}
          />
          <label className="text-[14px]" htmlFor="activeUrl">
            افزونه فونت آرا برای {currentTab} شود؟
          </label>
        </div>
      )}
    </div>
  )
}
