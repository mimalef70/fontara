import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { afterEach } from "node:test"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { WebsiteItem } from "../../src/definitions"
import { MESSAGE_TYPES_CS_TO_BG } from "../../src/utils/message"

type CssModuleLoader = (module: { exports: string }) => void
type RequireWithCssExtensions = {
  extensions: Record<string, CssModuleLoader | undefined>
}

const require = createRequire(import.meta.url)
const requireWithCssExtensions = require as unknown as RequireWithCssExtensions
const originalCSSExtension = requireWithCssExtensions.extensions[".css"]
const originalGlobals = {
  chrome: Reflect.get(globalThis, "chrome") as unknown,
  document: Reflect.get(globalThis, "document") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }

  requireWithCssExtensions.extensions[".css"] = originalCSSExtension
})

function installCSSModuleMock(): void {
  requireWithCssExtensions.extensions[".css"] = (module) => {
    module.exports = `
      @font-face {
        font-family: "Vazirmatn-Fontara";
        src: url("assets/fonts/vazirmatn/Vazirmatn.woff2") format("woff2");
      }
    `
  }
}

function installRuntimeMocks(
  options: { href?: string; websiteList?: WebsiteItem[] } = {}
): {
  lifecycleMessages: string[]
  styleIds: Set<string>
} {
  const lifecycleMessages: string[] = []
  const styleIds = new Set<string>()
  const matchingWebsite: WebsiteItem = {
    isActive: true,
    regex: "^https://github\\.com/.*$",
    url: "https://github.com"
  }
  const values = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["github.com"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: false,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.SITE_PROFILES]: [],
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false,
    [STORAGE_KEYS.TEXT_STROKE]: 0,
    [STORAGE_KEYS.WEBSITE_LIST]: options.websiteList ?? [matchingWebsite]
  }

  const elementsById = new Map<string, { id: string; textContent: string }>()
  const bodyElement = {
    childNodes: [],
    id: "body",
    isConnected: true,
    localName: "body",
    tagName: "BODY"
  }

  Reflect.set(globalThis, "document", {
    body: bodyElement,
    createElement(tagName: string) {
      const element = {
        id: "",
        textContent: "",
        remove() {}
      }
      if (tagName.toLowerCase() === "style") {
        Object.defineProperty(element, "id", {
          set(nextId: string) {
            styleIds.add(nextId)
          }
        })
      }
      return element
    },
    documentElement: {},
    getElementById(id: string) {
      return elementsById.get(id) ?? null
    },
    head: {
      appendChild(element: { id: string; textContent: string }) {
        if (element.id) {
          elementsById.set(element.id, element)
        }
      }
    },
    querySelectorAll() {
      return []
    }
  })

  Reflect.set(globalThis, "window", {
    location: {
      href: options.href ?? "https://github.com/mimalef70/fontara"
    },
    requestIdleCallback(
      callback: (deadline: { timeRemaining: () => number }) => void
    ) {
      callback({ timeRemaining: () => 50 })
      return 1
    },
    setTimeout
  })

  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      get lastError() {
        return undefined
      },
      sendMessage(message: { type: string }) {
        lifecycleMessages.push(message.type)
      }
    },
    storage: {
      local: {
        get(
          keys: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof keys === "string") {
            callback({ [keys]: values[keys as keyof typeof values] })
            return
          }

          callback({ ...keys, ...values })
        },
        set(_items: Record<string, unknown>, callback: () => void) {
          callback()
        }
      }
    }
  })

  return { lifecycleMessages, styleIds }
}

test("requestResolvedPageThemeOrFallback applies local theme before waiting for background", async () => {
  installCSSModuleMock()
  const runtime = installRuntimeMocks()

  const { createContentThemeScheduler } = await import(
    "../../src/inject/content-theme-scheduler"
  )

  const scheduler = createContentThemeScheduler({
    isDisposed: () => false,
    onExtensionContextInvalidated: () => {},
    sendDocumentLifecycleMessage: (type) => {
      runtime.lifecycleMessages.push(type)
      return true
    }
  })

  scheduler.requestResolvedPageThemeOrFallback(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
  )

  await new Promise((resolve) => setTimeout(resolve, 0))
  scheduler.dispose()

  assert.ok(runtime.styleIds.has("fontara-font-styles"))
  assert.deepEqual(runtime.lifecycleMessages, [
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
  ])
})

test("cleanUpThemeCommand keeps active default-site styles when local storage says active", async () => {
  installCSSModuleMock()
  const runtime = installRuntimeMocks()

  const { createContentThemeScheduler } = await import(
    "../../src/inject/content-theme-scheduler"
  )

  const scheduler = createContentThemeScheduler({
    isDisposed: () => false,
    onExtensionContextInvalidated: () => {},
    sendDocumentLifecycleMessage: () => true
  })

  scheduler.requestResolvedPageThemeOrFallback(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(runtime.styleIds.has("fontara-font-styles"))

  scheduler.cleanUpThemeCommand()
  await new Promise((resolve) => setTimeout(resolve, 0))
  scheduler.dispose()

  assert.ok(runtime.styleIds.has("fontara-font-styles"))
})

test("cleanUpThemeCommand removes styles when local storage says inactive", async () => {
  installCSSModuleMock()
  const runtime = installRuntimeMocks({
    href: "https://example.com/",
    websiteList: [
      {
        isActive: true,
        regex: "^https://github\\.com/.*$",
        url: "https://github.com"
      }
    ]
  })

  const { createContentThemeScheduler } = await import(
    "../../src/inject/content-theme-scheduler"
  )

  const scheduler = createContentThemeScheduler({
    isDisposed: () => false,
    onExtensionContextInvalidated: () => {},
    sendDocumentLifecycleMessage: () => true
  })

  scheduler.cleanUpThemeCommand()
  await new Promise((resolve) => setTimeout(resolve, 0))
  scheduler.dispose()

  assert.equal(runtime.styleIds.size, 0)
})
