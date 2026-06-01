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
  const fontSelectorSource = fs.readFileSync(
    path.resolve("src/ui/components/FontSelector.tsx"),
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
  assert.match(
    styleCSS,
    /#root \* \{[\s\S]*font-family: var\(--fontara-ui-font, "Vazirmatn-Fontara"\)[\s\S]*!important;/
  )
  assert.match(popupSource, /useSelectedUIFont\(\)/)
  assert.match(optionsSource, /useSelectedUIFont\(\)/)
  assert.match(
    styleCSS,
    /#root \.fontara-font-preview \{[\s\S]*font-family: var\(--fontara-preview-font\)[\s\S]*!important;/
  )
  assert.match(fontSelectorSource, /"--fontara-preview-font"/)
  assert.match(fontSelectorSource, /FONT_SAMPLE_TEXT/)
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

test("extension pages render inside error boundaries", () => {
  const errorBoundarySource = fs.readFileSync(
    path.resolve("src/ui/components/ErrorBoundary.tsx"),
    "utf8"
  )
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )

  assert.match(errorBoundarySource, /componentDidCatch/)
  assert.match(errorBoundarySource, /getDerivedStateFromError/)
  assert.match(popupSource, /<ErrorBoundary title="خطا در بارگذاری پاپ‌آپ/)
  assert.match(optionsSource, /<ErrorBoundary title="خطا در بارگذاری تنظیمات/)
})

test("UI storage hooks use stable initial value references", () => {
  const storageHookSource = fs.readFileSync(
    path.resolve("src/ui/hooks/use-storage.ts"),
    "utf8"
  )
  const uiSources = [
    "src/ui/hooks/use-selected-ui-font.ts",
    "src/ui/popup/index.tsx",
    "src/ui/options/index.tsx",
    "src/ui/components/CustomUrlToggle.tsx",
    "src/ui/components/FontSelector.tsx",
    "src/ui/components/PopularSection.tsx",
    "src/ui/components/layout/Header.tsx",
    "src/ui/components/layout/Footer.tsx"
  ]
    .map((sourcePath) => fs.readFileSync(path.resolve(sourcePath), "utf8"))
    .join("\n")

  assert.match(storageHookSource, /initialValueRef = React\.useRef/)
  assert.match(uiSources, /EMPTY_CUSTOM_FONT_LIST/)
  assert.match(uiSources, /EMPTY_WEBSITE_LIST/)
  assert.match(uiSources, /getExtensionEnabledInitialValue/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.CUSTOM_FONT_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.WEBSITE_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(
    uiSources,
    /STORAGE_KEYS\.EXTENSION_ENABLED,\s*\([^)]*\)\s*=>/
  )
})
