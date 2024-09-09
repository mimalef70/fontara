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

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { useFontChange } from "~utils/useFontChange"

const storage = new Storage()

export const fonts = [
  { value: "Estedad", name: "استعداد", svg: ExampleSvg },
  { value: "Vazirmatn", name: "وزیر", svg: ExampleSvg },
  { value: "Morraba", name: "مربا", svg: ExampleSvg },
  { value: "Dana", name: "دانا", svg: ExampleSvg },
  { value: "Samim", name: "صمیم", svg: ExampleSvg },
  { value: "Shabnam", name: "شبنم", svg: ExampleSvg },
  { value: "Sahel", name: "ساحل", svg: ExampleSvg },
  { Value: "Parastoo", name: "پرستو", svg: ExampleSvg },
  { value: "Gandom", name: "گندم", svg: ExampleSvg },
  { value: "Tanha", name: "تنها", svg: ExampleSvg },
  { value: "Behdad", name: "بهداد", svg: ExampleSvg },
  { value: "Nika", name: "نیکا", svg: ExampleSvg },
  { value: "Ganjname", name: "گنج نامه", svg: ExampleSvg },
  { value: "Shahab", name: "شهاب", svg: ExampleSvg },
  { value: "Mikhak", name: "میخک", svg: ExampleSvg }
]

export default function SelectListFont() {
  const { selected, handleFontChange } = useFontChange()

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
          setCurrentTab(tab.url)
        }
      }
    )
  }, [chrome])
  return (
    <div className="flex flex-col justify-between h-full">
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
            " data-[closed]:scale-95 data-[closed]:opacity-0 w-[var(--button-width)] rounded-xl border border-black/5 bg-black/5 p-1 [--anchor-gap:var(--spacing-1)] focus:outline-none",
            "transition duration-100 ease-out data-[leave]:data-[closed]:opacity-0 mt-1 h-60 overflow-auto"
          )}>
          {fonts.map((font) => (
            <ListboxOption
              key={font.name}
              value={font}
              className="group flex gap-2 rounded-lg py-1.5 px-3  data-[focus]:bg-black/10 ">
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
                    <span className="font-normal text-sm">{font.name}</span>
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

      <div className="border border-gray-400 rounded-md p-2 flex items-center gap-2 select-none">
        <input type="checkbox" name="activeUrl" id="activeUrl" />
        <label className="text-base" htmlFor="activeUrl">
          افزونه فونت آرا برای این سایت فعال شود؟
        </label>
      </div>
    </div>
  )
}
