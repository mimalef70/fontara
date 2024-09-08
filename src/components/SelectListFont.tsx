// import {
//   Listbox,
//   ListboxButton,
//   ListboxOption,
//   ListboxOptions,
//   Menu,
//   MenuButton,
//   MenuItem,
//   MenuItems
// } from "@headlessui/react"
// import {
//   CheckIcon,
//   ChevronDownIcon,
//   PencilIcon
// } from "@heroicons/react/24/solid"
// import clsx from "clsx"
// import { useState } from "react"
// import ExampleSvg from "react:../../assets/font-samples/estedad.svg"

// import { sendToBackground } from "@plasmohq/messaging"

// const fonts = [
//   { value: "Estedad", name: "استعداد", svg: ExampleSvg },
//   { value: "Vazirmatn", name: "وزیر", svg: ExampleSvg }
// ]

// export default function SelectListFont() {
//   const [selected, setSelected] = useState(fonts[0])

//   async function handleFontChange(font: (typeof fonts)[0]) {
//     setSelected(font)
//     await sendToBackground({
//       name: "changeFont",
//       body: { fontName: font.value }
//     })
//   }
//   return (
//     <div>
//       <Listbox value={selected} onChange={handleFontChange}>
//         <ListboxButton
//           className={clsx(
//             "relative select select-bordered block w-full rounded-lg bg-black/5 py-1.5 pl-8 p3-3 text-right text-sm/6 text-black",
//             "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-black/25"
//           )}>
//           {selected.name}
//         </ListboxButton>

//         <ListboxOptions
//           anchor="bottom"
//           transition
//           className={clsx(
//             " data-[closed]:scale-95 data-[closed]:opacity-0 w-[var(--button-width)] rounded-xl border border-black/5 bg-black/5 p-1 [--anchor-gap:var(--spacing-1)] focus:outline-none",
//             "transition duration-100 ease-out data-[leave]:data-[closed]:opacity-0"
//           )}>
//           {fonts.map((font) => (
//             <ListboxOption
//               key={font.name}
//               value={font}
//               className="group flex gap-2 rounded-lg py-1.5 px-3  data-[focus]:bg-black/10">
//               <CheckIcon className="invisible size-4 fill-black group-data-[selected]:visible" />
//               <div className="flex items-center space-x-2 rtl:space-x-reverse">
//                 <PencilIcon className="size-4 fill-gray-400" />
//                 <span className="font-normal text-sm">{font.name}</span>
//               </div>

//               <font.svg
//                 width={90}
//                 className="text-gray-400 hidden group-hover:inline"
//               />
//             </ListboxOption>
//           ))}
//         </ListboxOptions>
//       </Listbox>
//     </div>
//   )
// }
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

const storage = new Storage()

const fonts = [
  { value: "Estedad", name: "استعداد", svg: ExampleSvg },
  { value: "Vazirmatn", name: "وزیر", svg: ExampleSvg },
  { value: "Morraba", name: "مربا", svg: ExampleSvg },
  { value: "Dana", name: "دانا", svg: ExampleSvg }
]

export default function SelectListFont() {
  const [selected, setSelected] = useState(fonts[0])

  useEffect(() => {
    // Load the selected font from storage when the component mounts
    storage.get("selectedFont").then((storedFont) => {
      if (storedFont) {
        setSelected(fonts.find((font) => font.value === storedFont) || fonts[0])
      }
    })
  }, [])

  const handleFontChange = async (font: (typeof fonts)[0]) => {
    setSelected(font)
    await storage.set("selectedFont", font.value)
    await sendToBackground({
      name: "changeFont",
      body: { fontName: font.value }
    })
  }

  return (
    <div>
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
            "transition duration-100 ease-out data-[leave]:data-[closed]:opacity-0"
          )}>
          {fonts.map((font) => (
            <ListboxOption
              key={font.name}
              value={font}
              className="group flex gap-2 rounded-lg py-1.5 px-3  data-[focus]:bg-black/10">
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
    </div>
  )
}
