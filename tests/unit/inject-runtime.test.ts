import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { afterEach } from "node:test"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontData, WebsiteItem } from "../../src/definitions"

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: "sync" | "local" | "managed" | "session"
) => void

type StoredValues = {
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: FontData[]
  [STORAGE_KEYS.EXTENSION_ENABLED]: boolean
  [STORAGE_KEYS.SELECTED_FONT]: string
  [STORAGE_KEYS.WEBSITE_LIST]: WebsiteItem[]
}

const require = createRequire(import.meta.url)
const originalCSSExtension = require.extensions[".css"]
const originalGlobals = {
  addEventListener: Reflect.get(globalThis, "addEventListener") as unknown,
  cancelAnimationFrame: Reflect.get(
    globalThis,
    "cancelAnimationFrame"
  ) as unknown,
  chrome: Reflect.get(globalThis, "chrome") as unknown,
  document: Reflect.get(globalThis, "document") as unknown,
  HTMLElement: Reflect.get(globalThis, "HTMLElement") as unknown,
  MutationObserver: Reflect.get(globalThis, "MutationObserver") as unknown,
  Node: Reflect.get(globalThis, "Node") as unknown,
  NodeFilter: Reflect.get(globalThis, "NodeFilter") as unknown,
  removeEventListener: Reflect.get(
    globalThis,
    "removeEventListener"
  ) as unknown,
  requestAnimationFrame: Reflect.get(
    globalThis,
    "requestAnimationFrame"
  ) as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

class FakeStyleDeclaration {
  fontFamily = ""
  length = 0

  setProperty(propertyName: string, value: string): void {
    if (propertyName === "font-family") {
      this.fontFamily = value
      this.length = 1
    }
  }
}

class FakeElement {
  childNodes: Array<{ nodeType: number; textContent?: string | null }> = []
  classList = new Set<string>()
  id = ""
  isConnected = true
  parentElement: FakeElement | null = null
  style = new FakeStyleDeclaration()
  tagName: string
  textContent = ""

  constructor(
    tagName: string,
    private elementsById: Map<string, FakeElement>
  ) {
    this.tagName = tagName.toUpperCase()
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this
    if (child.id) {
      this.elementsById.set(child.id, child)
    }

    return child
  }

  remove(): void {
    if (this.id) {
      this.elementsById.delete(this.id)
    }
  }
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }

  require.extensions[".css"] = originalCSSExtension
})

function createRuntimeMocks(): {
  dispatchStorageChange: StorageListener
  getStyleText: (id: string) => string
  values: StoredValues
} {
  const elementsById = new Map<string, FakeElement>()
  const listeners: StorageListener[] = []
  const matchingWebsite: WebsiteItem = {
    isActive: true,
    regex: "^https?://example\\.com/?.*$",
    url: "https://example.com"
  }
  const customFont: FontData = {
    data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
    fileHash: "a".repeat(64),
    name: "Runtime Custom",
    originalFileName: "runtime.woff2",
    type: "woff2",
    value: "RuntimeCustom-Fontara"
  }
  const values: StoredValues = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [customFont],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: [matchingWebsite]
  }
  const documentMock = {
    body: new FakeElement("body", elementsById),
    createElement(tagName: string) {
      return new FakeElement(tagName, elementsById)
    },
    createTreeWalker() {
      return {
        nextNode() {
          return null
        }
      }
    },
    documentElement: new FakeElement("html", elementsById),
    getElementById(id: string) {
      return elementsById.get(id) ?? null
    },
    head: new FakeElement("head", elementsById),
    querySelectorAll() {
      return []
    }
  }

  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "Node", { TEXT_NODE: 3 })
  Reflect.set(globalThis, "NodeFilter", {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ELEMENT: 1
  })
  Reflect.set(
    globalThis,
    "MutationObserver",
    class {
      disconnect(): void {}
      observe(): void {}
    }
  )
  Reflect.set(globalThis, "document", documentMock)
  Reflect.set(globalThis, "window", {
    getComputedStyle() {
      return { fontFamily: "system-ui, sans-serif" }
    },
    location: { href: "https://example.com/" },
    requestIdleCallback(callback: (deadline: IdleDeadline) => void) {
      callback({ timeRemaining: () => 50 } as IdleDeadline)
      return 1
    },
    setTimeout
  })
  Reflect.set(
    globalThis,
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }
  )
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})
  Reflect.set(globalThis, "addEventListener", () => {})
  Reflect.set(globalThis, "removeEventListener", () => {})
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      onMessage: {
        addListener() {},
        removeListener() {}
      }
    },
    storage: {
      local: {
        get(
          keys: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof keys === "string") {
            callback({ [keys]: values[keys as keyof StoredValues] })
            return
          }

          callback({ ...keys, ...values })
        }
      },
      onChanged: {
        addListener(callback: StorageListener) {
          listeners.push(callback)
        },
        removeListener(callback: StorageListener) {
          const index = listeners.indexOf(callback)
          if (index !== -1) {
            listeners.splice(index, 1)
          }
        }
      }
    }
  })
  require.extensions[".css"] = (module) => {
    module.exports = `
      @font-face {
        font-family: "Vazirmatn-Fontara";
        src: url("assets/fonts/vazirmatn/Vazirmatn.woff2") format("woff2");
      }
    `
  }

  return {
    dispatchStorageChange(changes, areaName) {
      for (const listener of listeners) {
        listener(changes, areaName)
      }
    },
    getStyleText(id) {
      return elementsById.get(id)?.textContent ?? ""
    },
    values
  }
}

async function waitFor(
  condition: () => boolean,
  message: string
): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  assert.ok(condition(), message)
}

test("selected custom font changes inject its font-face without a reload", async () => {
  const runtime = createRuntimeMocks()

  await import("../../src/inject/index")
  await waitFor(
    () => runtime.getStyleText("fontara-font-styles").includes("@font-face"),
    "expected initial built-in font styles to be injected"
  )

  assert.match(
    runtime.getStyleText("fontara-editable-font-style"),
    /\[contenteditable\][\s\S]*var\(--fontara-font\)/
  )
  assert.equal(runtime.getStyleText("fontara-custom-font-styles"), "")

  runtime.values[STORAGE_KEYS.SELECTED_FONT] = "RuntimeCustom-Fontara"
  runtime.dispatchStorageChange(
    {
      [STORAGE_KEYS.SELECTED_FONT]: {
        newValue: "RuntimeCustom-Fontara",
        oldValue: DEFAULT_VALUES.SELECTED_FONT
      }
    },
    "local"
  )

  await waitFor(
    () =>
      runtime
        .getStyleText("fontara-custom-font-styles")
        .includes('font-family: "RuntimeCustom-Fontara"'),
    "expected selected custom font-face to be injected after storage change"
  )
  assert.match(
    runtime.getStyleText("fontara-dynamic-font"),
    /--fontara-font: "RuntimeCustom-Fontara"/
  )
})
