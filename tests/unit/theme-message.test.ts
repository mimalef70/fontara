import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { afterEach } from "node:test"

import { DEFAULT_RTL_SITE_SETTINGS } from "../../src/config/rtl-sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontaraContentCommandMessage } from "../../src/definitions"
import { MESSAGE_TYPES_BG_TO_CS } from "../../src/utils/message"

type CssModuleLoader = (module: { exports: string }) => void
type RequireWithCssExtensions = {
  extensions: Record<string, CssModuleLoader | undefined>
}

const require = createRequire(import.meta.url)
const requireWithCssExtensions = require as unknown as RequireWithCssExtensions
const originalCSSExtension = requireWithCssExtensions.extensions[".css"]
const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  requireWithCssExtensions.extensions[".css"] = originalCSSExtension
  Reflect.set(globalThis, "chrome", originalChrome)
})

function installCSSModuleMock(): void {
  requireWithCssExtensions.extensions[".css"] = (module) => {
    module.exports = `
      :root {
        --fontara-test-site-css: 1;
      }
      @font-face {
        font-family: "Vazirmatn-Fontara";
        src: url("assets/fonts/vazirmatn/Vazirmatn.woff2") format("woff2");
      }
    `
  }
}

function installChromeRuntimeMock(): void {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      }
    },
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: undefined })
        },
        set(_items: Record<string, unknown>, callback: () => void) {
          callback()
        }
      }
    }
  })
}

function createSettings(): Record<string, unknown> {
  return {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["chatgpt.com"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: false,
    [STORAGE_KEYS.RTL_ENABLED]: true,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_RTL_SITE_SETTINGS,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        pattern: "chatgpt.com",
        textStroke: 0.5
      }
    ],
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false,
    [STORAGE_KEYS.TEXT_STROKE]: 0.1,
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        customCss: true,
        isActive: true,
        regex: "^https://chatgpt\\.com/.*$",
        url: "https://chatgpt.com"
      }
    ]
  }
}

test("theme message factory creates a resolved FontAra page command", async () => {
  installCSSModuleMock()
  installChromeRuntimeMock()

  const { createFontaraContentCommandMessage } = await import(
    "../../src/background/theme-message"
  )

  const command = (await createFontaraContentCommandMessage(
    "https://chatgpt.com/",
    createSettings()
  )) as Extract<
    FontaraContentCommandMessage,
    { type: "fontara-bg-cs-apply-theme" }
  >

  assert.equal(command.type, MESSAGE_TYPES_BG_TO_CS.APPLY_THEME)
  assert.equal(command.data.font.active, true)
  assert.equal(command.data.font.fontName, DEFAULT_VALUES.SELECTED_FONT)
  assert.match(command.data.font.fontFaceCSS, /chrome-extension:\/\/fontara/)
  assert.match(command.data.font.customCSS ?? "", /--fontara-test-site-css/)
  assert.match(command.data.font.textStrokeCSS, /0\.5px !important/)
  assert.equal(command.data.rtl.active, true)
  assert.equal(command.data.rtl.siteId, "chatgpt")
})

test("theme message factory cleans up when no FontAra engine is active", async () => {
  installCSSModuleMock()
  installChromeRuntimeMock()

  const { createFontaraContentCommandMessage } = await import(
    "../../src/background/theme-message"
  )
  const settings = {
    ...createSettings(),
    [STORAGE_KEYS.EXTENSION_ENABLED]: false
  }

  const command = await createFontaraContentCommandMessage(
    "https://chatgpt.com/",
    settings
  )

  assert.deepEqual(command, {
    type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP
  })
})
