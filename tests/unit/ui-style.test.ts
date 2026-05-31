import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const require = createRequire(import.meta.url)

test("UI uses the bundled Estedad font family", () => {
  const tailwindConfig = require("../../tailwind.config.js") as {
    theme?: {
      extend?: {
        fontFamily?: Record<string, string[]>
      }
    }
  }
  const estedadFontFamily = tailwindConfig.theme?.extend?.fontFamily?.estedad
  const styleCSS = fs.readFileSync(path.resolve("src/style.css"), "utf8")

  assert.deepEqual(estedadFontFamily?.slice(0, 2), [
    "Estedad-Fontara",
    "Vazirmatn-Fontara"
  ])
  assert.match(
    styleCSS,
    /font-family: "Estedad-Fontara", "Vazirmatn-Fontara", sans-serif;/
  )
})
