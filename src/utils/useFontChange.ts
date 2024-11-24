import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
// import x from "src/components/SelectListFont"

import { Storage } from "@plasmohq/storage"

import { fonts } from "~components/BasicVersion"

const storage = new Storage()

export function useFontChange() {
  const [selected, setSelected] = useState(fonts[0])

  useEffect(() => {
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
      name: "changeFont" as "ping", //Temporary Fix
      body: { fontName: font.value }
    })
  }
  return { selected, handleFontChange }
}
