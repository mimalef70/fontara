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
  __DEBUG__: Reflect.get(globalThis, "__DEBUG__") as unknown,
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
  attributes = new Map<string, string>()
  childNodes: Array<{ nodeType: number; textContent?: string | null }> = []
  classList = new Set<string>()
  children: FakeElement[] = []
  id = ""
  isConnected = true
  isContentEditable = false
  localName: string
  parentElement: FakeElement | null = null
  style = new FakeStyleDeclaration()
  tagName: string
  textContent = ""

  constructor(
    tagName: string,
    private elementsById: Map<string, FakeElement>
  ) {
    this.tagName = tagName.toUpperCase()
    this.localName = tagName.toLowerCase()
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this
    this.children.push(child)
    if (child.id) {
      this.elementsById.set(child.id, child)
    }

    return child
  }

  querySelector(selector: string): FakeElement | null {
    const selectors = selector.split(",").map((part) => part.trim())
    if (selectors.includes('[data-text="true"]')) {
      const dataTextElement = findFirstElement(
        this,
        (element) => element.getAttribute("data-text") === "true"
      )
      if (dataTextElement) return dataTextElement
    }

    if (selectors.includes("p")) {
      return findFirstElement(this, (element) => element.localName === "p")
    }

    return null
  }

  getAttribute(attributeName: string): string | null {
    return this.attributes.get(attributeName) ?? null
  }

  setAttribute(attributeName: string, value: string): void {
    this.attributes.set(attributeName, value)
    if (attributeName === "contenteditable") {
      this.isContentEditable = value.toLowerCase() !== "false"
    }
  }

  remove(): void {
    if (this.id) {
      this.elementsById.delete(this.id)
    }
  }
}

function findFirstElement(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
  for (const child of root.children) {
    if (predicate(child)) return child

    const match = findFirstElement(child, predicate)
    if (match) return match
  }

  return null
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }

  require.extensions[".css"] = originalCSSExtension
})

function createRuntimeMocks(): {
  dispatchWindowEvent: (type: string, event: { persisted?: boolean }) => void
  dispatchStorageChange: StorageListener
  getStorageGetCount: (key: string) => number
  getStyleText: (id: string) => string
  getTreeWalkerCount: () => number
  setRuntimeRemoveError: (error: unknown) => void
  values: StoredValues
} {
  const elementsById = new Map<string, FakeElement>()
  const listeners: StorageListener[] = []
  const storageGetCounts = new Map<string, number>()
  const windowListeners = new Map<string, Array<(event: unknown) => void>>()
  let runtimeRemoveError: unknown = null
  let treeWalkerCount = 0
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
  const bodyElement = new FakeElement("body", elementsById)
  const editableElement = new FakeElement("div", elementsById)
  editableElement.id = "prompt-textarea"
  editableElement.setAttribute("contenteditable", "true")
  elementsById.set(editableElement.id, editableElement)
  bodyElement.appendChild(editableElement)
  const twitterEditableElement = new FakeElement("div", elementsById)
  twitterEditableElement.setAttribute("contenteditable", "true")
  twitterEditableElement.setAttribute("data-testid", "tweetTextarea_0")
  twitterEditableElement.setAttribute("role", "textbox")
  const twitterTextElement = new FakeElement("span", elementsById)
  twitterTextElement.setAttribute("data-text", "true")
  twitterEditableElement.appendChild(twitterTextElement)
  bodyElement.appendChild(twitterEditableElement)
  const linkedinEditableElement = new FakeElement("div", elementsById)
  linkedinEditableElement.setAttribute("contenteditable", "true")
  linkedinEditableElement.setAttribute(
    "aria-label",
    "Text editor for creating content"
  )
  linkedinEditableElement.setAttribute("role", "textbox")
  const linkedinParagraphElement = new FakeElement("p", elementsById)
  linkedinEditableElement.appendChild(linkedinParagraphElement)
  bodyElement.appendChild(linkedinEditableElement)
  const documentMock = {
    body: bodyElement,
    createElement(tagName: string) {
      return new FakeElement(tagName, elementsById)
    },
    createTreeWalker() {
      treeWalkerCount += 1
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
    querySelectorAll(selector: string) {
      if (selector === '[contenteditable]:not([contenteditable="false" i])') {
        return [
          editableElement,
          twitterEditableElement,
          linkedinEditableElement
        ]
      }

      if (selector === '[id="prompt-textarea"]') {
        return [editableElement]
      }

      if (
        selector ===
        'div[contenteditable]:not([contenteditable="false" i])[id="prompt-textarea"]'
      ) {
        return [editableElement]
      }

      if (
        selector ===
        'div[contenteditable]:not([contenteditable="false" i])[data-testid="tweetTextarea_0"][role="textbox"]'
      ) {
        return [twitterEditableElement]
      }

      if (
        selector ===
        'div[contenteditable]:not([contenteditable="false" i])[aria-label="Text editor for creating content"][role="textbox"]'
      ) {
        return [linkedinEditableElement]
      }

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
    getComputedStyle(element: FakeElement) {
      return {
        fontFamily:
          element === editableElement
            ? '"ChatGPT Sans", Arial, sans-serif'
            : element === twitterTextElement
              ? '"TwitterChirp", system-ui, sans-serif'
              : element === linkedinParagraphElement
                ? '"LinkedIn Sans", Arial, sans-serif'
                : "system-ui, sans-serif"
      }
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
  Reflect.set(
    globalThis,
    "addEventListener",
    (type: string, callback: (event: unknown) => void) => {
      const callbacks = windowListeners.get(type) ?? []
      callbacks.push(callback)
      windowListeners.set(type, callbacks)
    }
  )
  Reflect.set(
    globalThis,
    "removeEventListener",
    (type: string, callback: (event: unknown) => void) => {
      const callbacks = windowListeners.get(type) ?? []
      windowListeners.set(
        type,
        callbacks.filter(
          (registeredCallback) => registeredCallback !== callback
        )
      )
    }
  )
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
        removeListener() {
          if (runtimeRemoveError) throw runtimeRemoveError
        }
      }
    },
    storage: {
      local: {
        get(
          keys: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof keys === "string") {
            storageGetCounts.set(keys, (storageGetCounts.get(keys) ?? 0) + 1)
            callback({ [keys]: values[keys as keyof StoredValues] })
            return
          }

          for (const key of Object.keys(keys)) {
            storageGetCounts.set(key, (storageGetCounts.get(key) ?? 0) + 1)
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
    dispatchWindowEvent(type, event) {
      for (const listener of windowListeners.get(type) ?? []) {
        listener(event)
      }
    },
    dispatchStorageChange(changes, areaName) {
      for (const listener of listeners) {
        listener(changes, areaName)
      }
    },
    getStorageGetCount(key) {
      return storageGetCounts.get(key) ?? 0
    },
    getStyleText(id) {
      return elementsById.get(id)?.textContent ?? ""
    },
    getTreeWalkerCount() {
      return treeWalkerCount
    },
    setRuntimeRemoveError(error) {
      runtimeRemoveError = error
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
  const originalWarn = console.warn
  let warnCalls = 0

  Reflect.set(globalThis, "__DEBUG__", true)
  console.warn = () => {
    warnCalls += 1
  }

  try {
    await import("../../src/inject/index")
    await waitFor(
      () => runtime.getStyleText("fontara-font-styles").includes("@font-face"),
      "expected initial built-in font styles to be injected"
    )

    const editableStyle = runtime.getStyleText("fontara-editable-font-style")
    assert.match(
      editableStyle,
      /\[contenteditable\]:not\(\[contenteditable="false" i\]\)[\s\S]*:not\(#fontara-editable-font-specificity\) p[\s\S]*var\(--fontara-font\), ui-sans-serif, system-ui, sans-serif/
    )
    assert.match(editableStyle, /\.cm-editor/)
    assert.match(editableStyle, /\.monaco-editor/)
    assert.match(
      editableStyle,
      /div\[contenteditable\]:not\(\[contenteditable="false" i\]\)\[id="prompt-textarea"\][\s\S]*var\(--fontara-font\), "ChatGPT Sans", Arial, sans-serif/
    )
    assert.match(
      editableStyle,
      /div\[contenteditable\]:not\(\[contenteditable="false" i\]\)\[id="prompt-textarea"\][\s\S]*:not\(#fontara-editable-font-specificity\) \[data-text="true"\]/
    )
    assert.match(
      editableStyle,
      /div\[contenteditable\]:not\(\[contenteditable="false" i\]\)\[data-testid="tweetTextarea_0"\]\[role="textbox"\][\s\S]*\[data-text="true"\][\s\S]*var\(--fontara-font\), "TwitterChirp", system-ui, sans-serif/
    )
    assert.match(
      editableStyle,
      /div\[contenteditable\]:not\(\[contenteditable="false" i\]\)\[aria-label="Text editor for creating content"\]\[role="textbox"\][\s\S]*:not\(#fontara-editable-font-specificity\) p[\s\S]*var\(--fontara-font\), "LinkedIn Sans", Arial, sans-serif/
    )
    assert.doesNotMatch(editableStyle, /> div:nth-of-type/)
    assert.doesNotMatch(editableStyle, /section\[data-testid=/)
    assert.equal(runtime.getStyleText("fontara-custom-font-styles"), "")
    assert.equal(runtime.getStorageGetCount(STORAGE_KEYS.CUSTOM_FONT_LIST), 0)
    const initialTreeWalkerCount = runtime.getTreeWalkerCount()

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
    assert.equal(runtime.getTreeWalkerCount(), initialTreeWalkerCount)
    assert.equal(runtime.getStorageGetCount(STORAGE_KEYS.CUSTOM_FONT_LIST), 1)

    runtime.values[STORAGE_KEYS.SELECTED_FONT] = "MissingCustom-Fontara"
    runtime.dispatchStorageChange(
      {
        [STORAGE_KEYS.SELECTED_FONT]: {
          newValue: "MissingCustom-Fontara",
          oldValue: "RuntimeCustom-Fontara"
        }
      },
      "local"
    )

    await waitFor(
      () =>
        /--fontara-font: "Vazirmatn-Fontara"/.test(
          runtime.getStyleText("fontara-dynamic-font")
        ) && runtime.getStyleText("fontara-custom-font-styles") === "",
      "expected missing selected custom font to fall back to the default font"
    )
    assert.equal(runtime.getStorageGetCount(STORAGE_KEYS.CUSTOM_FONT_LIST), 2)

    runtime.setRuntimeRemoveError(
      new TypeError("Cannot read properties of undefined (reading 'onMessage')")
    )
    assert.doesNotThrow(() => {
      runtime.dispatchWindowEvent("pagehide", { persisted: false })
    })
    assert.equal(warnCalls, 0)
  } finally {
    console.warn = originalWarn
  }
})
