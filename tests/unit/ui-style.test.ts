import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const require = createRequire(import.meta.url)

test("UI follows the selected extension font", () => {
  const tailwindConfig = require("../../tailwind.config.js") as {
    theme?: {
      extend?: {
        fontFamily?: Record<string, string[]>
      }
    }
  }
  const estedadFontFamily = tailwindConfig.theme?.extend?.fontFamily?.estedad
  const styleCSS = fs.readFileSync(path.resolve("src/style.css"), "utf8")
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )

  assert.equal(
    estedadFontFamily?.[0],
    'var(--fontara-ui-font, "Vazirmatn-Fontara")'
  )
  assert.match(
    styleCSS,
    /font-family: var\(--fontara-ui-font, "Vazirmatn-Fontara"\)/
  )
  assert.match(popupSource, /useSelectedUIFont\(\)/)
  assert.match(optionsSource, /useSelectedUIFont\(\)/)
})

test("drawer keeps focus out of aria-hidden popup content", () => {
  const drawerSource = fs.readFileSync(
    path.resolve("src/ui/components/ui/drawer.tsx"),
    "utf8"
  )

  assert.match(drawerSource, /autoFocus = true/)
  assert.match(drawerSource, /document\.getElementById\("root"\)/)
  assert.match(drawerSource, /container=\{container \?\? defaultContainer\}/)
})
