import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test, { afterEach } from "node:test"

import { DEFAULT_RTL_SITE_SETTINGS } from "../../src/config/rtl-sites"
import { STORAGE_KEYS } from "../../src/config/storage"
import { RtlAutoDirection } from "../../src/inject/rtl/auto-direction"
import { getElementText, RtlEngine } from "../../src/inject/rtl/rtl-engine"
import { isRtlText } from "../../src/inject/rtl/text-direction"
import { getRtlActivationStateFromSettings } from "../../src/utils/rtl"

const ORIGINAL_GLOBALS = [
  "document",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "MutationObserver",
  "Node",
  "NodeFilter",
  "window"
].map((key) => ({
  exists: key in globalThis,
  key,
  value: Reflect.get(globalThis, key)
}))

class FakeClassList {
  private values = new Set<string>()

  add(className: string): void {
    this.values.add(className)
  }

  contains(className: string): boolean {
    return this.values.has(className)
  }

  remove(className: string): void {
    this.values.delete(className)
  }
}

class FakeStyleDeclaration {
  direction = ""
  textAlign = ""
  private properties = new Map<string, string>()
  private priorities = new Map<string, string>()

  getPropertyPriority(property: string): string {
    return this.priorities.get(property) ?? ""
  }

  getPropertyValue(property: string): string {
    if (property === "direction") return this.direction
    if (property === "text-align") return this.textAlign
    return this.properties.get(property) ?? ""
  }

  removeProperty(property: string): string {
    const previousValue = this.getPropertyValue(property)
    this.properties.delete(property)
    this.priorities.delete(property)

    if (property === "direction") {
      this.direction = ""
    } else if (property === "text-align") {
      this.textAlign = ""
    }

    return previousValue
  }

  setProperty(property: string, value: string, priority = ""): void {
    this.properties.set(property, value)
    if (priority) {
      this.priorities.set(property, priority)
    } else {
      this.priorities.delete(property)
    }

    if (property === "direction") {
      this.direction = value
    } else if (property === "text-align") {
      this.textAlign = value
    }
  }
}

class FakeTextNode {
  nodeType = 3

  constructor(public textContent: string) {}
}

class FakeElement {
  attributes = new Map<string, string>()
  childNodes: Array<FakeElement | FakeTextNode> = []
  classList = new FakeClassList()
  isConnected = true
  isContentEditable = false
  nodeType = 1
  parentElement: FakeElement | null = null
  shadowRoot: FakeElement | null = null
  style = new FakeStyleDeclaration()
  tagName: string
  textContent = ""

  constructor(public localName = "div") {
    this.tagName = localName.toUpperCase()
  }

  get dir(): string {
    return this.getAttribute("dir") ?? ""
  }

  set dir(value: string) {
    this.setAttribute("dir", value)
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  appendChild<T extends FakeElement | FakeTextNode>(child: T): T {
    if (child instanceof FakeElement) {
      child.parentElement = this
    }
    this.childNodes.push(child)
    return child
  }

  closest(selector: string): FakeElement | null {
    let current: FakeElement | null = this

    while (current) {
      if (current.matches(selector)) return current
      current = current.parentElement
    }

    return null
  }

  dispatchEvent(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener()
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0
  }

  getAttribute(attribute: string): string | null {
    return this.attributes.get(attribute) ?? null
  }

  matches(selector: string): boolean {
    return selector
      .split(",")
      .map((part) => part.trim())
      .some((part) => this.matchesSingleSelector(part))
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = []

    for (const child of this.childNodes) {
      if (!(child instanceof FakeElement)) continue
      if (child.matches(selector)) matches.push(child)
      matches.push(...child.querySelectorAll(selector))
    }

    return matches
  }

  removeAttribute(attribute: string): void {
    this.attributes.delete(attribute)
    if (attribute === "contenteditable") {
      this.isContentEditable = false
    }
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (registeredListener) => registeredListener !== listener
      )
    )
  }

  setAttribute(attribute: string, value: string): void {
    this.attributes.set(attribute, value)
    if (attribute === "contenteditable") {
      this.isContentEditable = value.toLowerCase() !== "false"
    }
  }

  private listeners = new Map<string, Array<() => void>>()

  private matchesSingleSelector(selector: string): boolean {
    if (!selector) return false
    if (selector === "*") return true
    if (selector === this.localName) return true
    if (selector === '[contenteditable]:not([contenteditable="false"])') {
      return this.isContentEditable
    }
    if (selector.startsWith("input")) {
      return this instanceof FakeInputElement
    }
    if (selector === "textarea") {
      return this instanceof FakeTextAreaElement
    }

    return false
  }
}

class FakeHTMLElement extends FakeElement {}

class FakeInputElement extends FakeHTMLElement {
  type = "text"
  value = ""

  constructor() {
    super("input")
  }
}

class FakeTextAreaElement extends FakeHTMLElement {
  value = ""

  constructor() {
    super("textarea")
  }
}

class FakeMutationObserver {
  disconnect(): void {}
  observe(): void {}
}

afterEach(() => {
  for (const { exists, key, value } of ORIGINAL_GLOBALS) {
    if (exists) {
      Reflect.set(globalThis, key, value)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
})

function installRtlDom(editableNodes: FakeHTMLElement[]): void {
  const html = new FakeHTMLElement("html")
  const body = new FakeHTMLElement("body")
  html.appendChild(body)
  editableNodes.forEach((node) => {
    body.appendChild(node)
  })

  Reflect.set(globalThis, "Element", FakeElement)
  Reflect.set(globalThis, "HTMLElement", FakeHTMLElement)
  Reflect.set(globalThis, "HTMLInputElement", FakeInputElement)
  Reflect.set(globalThis, "HTMLTextAreaElement", FakeTextAreaElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "Node", {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  })
  Reflect.set(globalThis, "NodeFilter", {
    SHOW_TEXT: 4
  })
  Reflect.set(globalThis, "window", {
    location: { hostname: "chatgpt.com" }
  })
  Reflect.set(globalThis, "document", {
    body,
    createTreeWalker(root: FakeElement) {
      const textNodes = collectTextNodes(root)
      let index = 0

      return {
        nextNode() {
          return textNodes[index++] ?? null
        }
      }
    },
    documentElement: html,
    querySelectorAll(selector: string) {
      return html.querySelectorAll(selector)
    }
  })
}

function collectTextNodes(root: FakeElement): FakeTextNode[] {
  const textNodes: FakeTextNode[] = []

  for (const child of root.childNodes) {
    if (child instanceof FakeTextNode) {
      textNodes.push(child)
    } else {
      textNodes.push(...collectTextNodes(child))
    }
  }

  return textNodes
}

test("RTL runtime is wired as an independent feature", () => {
  const runtimeSource = fs.readFileSync(
    path.resolve("src/inject/content-runtime.ts"),
    "utf8"
  )
  const schedulerSource = fs.readFileSync(
    path.resolve("src/inject/content-theme-scheduler.ts"),
    "utf8"
  )
  const storageSource = fs.readFileSync(
    path.resolve("src/inject/content-storage.ts"),
    "utf8"
  )
  const rtlManagerSource = fs.readFileSync(
    path.resolve("src/inject/rtl/index.ts"),
    "utf8"
  )
  const themeApplierSource = fs.readFileSync(
    path.resolve("src/inject/theme-applier.ts"),
    "utf8"
  )
  const pageThemeSource = fs.readFileSync(
    path.resolve("src/generators/page-theme.ts"),
    "utf8"
  )

  assert.match(schedulerSource, /createFontaraPageThemeData/)
  assert.match(schedulerSource, /applyResolvedPageTheme/)
  assert.match(themeApplierSource, /applyResolvedRtlSupport/)
  assert.match(storageSource, /STORAGE_KEYS\.RTL_ENABLED/)
  assert.match(storageSource, /STORAGE_KEYS\.RTL_SITE_SETTINGS/)
  assert.match(runtimeSource, /cleanupRtlSupport/)
  assert.match(pageThemeSource, /resolveFontaraSiteConfig/)
  assert.doesNotMatch(pageThemeSource, /getRtlActivationStateFromSettings/)
  assert.doesNotMatch(rtlManagerSource, /getRtlActivationState/)
  assert.doesNotMatch(rtlManagerSource, /scheduleApplyRtlIfActive/)
  assert.match(rtlManagerSource, /createRtlSiteAdapter/)
  assert.match(rtlManagerSource, /RtlAutoDirection/)
})

test("RTL activation resolves from a settings snapshot", () => {
  const activeState = getRtlActivationStateFromSettings(
    "https://chatgpt.com/c/1",
    {
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.RTL_ENABLED]: true,
      [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_RTL_SITE_SETTINGS
    }
  )
  const disabledState = getRtlActivationStateFromSettings(
    "https://chatgpt.com/c/1",
    {
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.RTL_ENABLED]: true,
      [STORAGE_KEYS.RTL_SITE_SETTINGS]: {
        ...DEFAULT_RTL_SITE_SETTINGS,
        chatgpt: false
      }
    }
  )

  assert.equal(activeState.active, true)
  assert.equal(activeState.matchingSite?.id, "chatgpt")
  assert.equal(disabledState.active, false)
  assert.equal(disabledState.siteEnabled, false)
})

test("RTL adapters preserve sample platform coverage without font injection", () => {
  const siteAdaptersSource = fs.readFileSync(
    path.resolve("src/inject/rtl/site-adapters.ts"),
    "utf8"
  )
  const autoDirectionSource = fs.readFileSync(
    path.resolve("src/inject/rtl/auto-direction.ts"),
    "utf8"
  )

  for (const siteId of [
    "chatgpt",
    "claude",
    "gemini",
    "copilot",
    "perplexity",
    "openrouter",
    "deepseek",
    "notebooklm",
    "aistudio",
    "qwen",
    "arena"
  ]) {
    assert.match(siteAdaptersSource, new RegExp(`case "${siteId}"`))
  }

  assert.match(siteAdaptersSource, /\[data-testid="conversation-turn"\]/)
  assert.match(siteAdaptersSource, /\[data-testid="playground-message-list"\]/)
  assert.match(siteAdaptersSource, /\[data-message-bubble="assistant"\]/)
  assert.match(siteAdaptersSource, /const protectedSelector = joinSelectors/)
  assert.match(
    siteAdaptersSource,
    /getTextWithoutSelector\(element, protectedSelector\)/
  )
  assert.match(
    siteAdaptersSource,
    /detectDominantDirection\(\s*getTextWithoutSelector\(element, protectedSelector\)\s*\) !== "rtl"/
  )
  assert.match(
    siteAdaptersSource,
    /detectDominantDirection\(childText\) === "rtl"/
  )
  assert.match(siteAdaptersSource, /child\.closest\(protectedSelector\)/)
  assert.match(siteAdaptersSource, /fontara-gemini-rtl-list/)
  assert.match(siteAdaptersSource, /createTextWalkerAdapter/)
  assert.match(siteAdaptersSource, /ms-chat-session/)
  assert.match(siteAdaptersSource, /const DIRECTION_SAMPLE_CHAR_LIMIT = 1000/)
  assert.match(
    siteAdaptersSource,
    /normalized\.slice\(0, DIRECTION_SAMPLE_CHAR_LIMIT\)/
  )
  assert.match(autoDirectionSource, /EDITABLE_SELECTOR/)
  assert.match(autoDirectionSource, /GEMINI_UI_SKIP/)
  assert.match(
    autoDirectionSource,
    /applyDetectedDirection\(\s*element: HTMLElement,\s*firstChar: string \| null\s*\)/
  )
  assert.doesNotMatch(
    autoDirectionSource,
    /detectDirection\(element: HTMLElement\)/
  )
  assert.match(
    siteAdaptersSource,
    /const uiExclude = joinSelectors\(uiExcludeSelectors\)/
  )
  assert.doesNotMatch(
    siteAdaptersSource,
    /element\.closest\(joinSelectors\(uiExcludeSelectors\)\)/
  )
  assert.doesNotMatch(siteAdaptersSource, /Vazirmatn/)
  assert.doesNotMatch(siteAdaptersSource, /@font-face/)
})

test("RTL text detection covers Arabic and Hebrew scripts", () => {
  assert.equal(isRtlText("سلام دنیا"), true)
  assert.equal(isRtlText("שלום עולם"), true)
  assert.equal(isRtlText("hello world"), false)
})

test("RTL engine applies and restores directional styles", () => {
  installRtlDom([])
  const element = new FakeHTMLElement("article")
  element.setAttribute("dir", "ltr")
  element.style.setProperty("direction", "ltr")
  element.style.setProperty("text-align", "left")

  const engine = new RtlEngine({ rtlClass: "fontara-rtl-text" })
  engine.applyRTL(element as unknown as Element)

  assert.equal(element.getAttribute("dir"), "rtl")
  assert.equal(element.style.getPropertyValue("direction"), "rtl")
  assert.equal(element.style.getPropertyValue("text-align"), "right")
  assert.equal(element.style.getPropertyValue("unicode-bidi"), "plaintext")
  assert.equal(element.classList.contains("fontara-rtl-text"), true)

  engine.restoreStyles()

  assert.equal(element.getAttribute("dir"), "ltr")
  assert.equal(element.style.getPropertyValue("direction"), "ltr")
  assert.equal(element.style.getPropertyValue("text-align"), "left")
  assert.equal(element.style.getPropertyValue("unicode-bidi"), "")
  assert.equal(element.classList.contains("fontara-rtl-text"), false)
})

test("RTL engine restores original inline style priorities", () => {
  installRtlDom([])
  const element = new FakeHTMLElement("article")
  element.style.setProperty("direction", "ltr", "important")
  element.style.setProperty("text-align", "left", "important")
  element.style.setProperty("unicode-bidi", "normal", "important")

  const engine = new RtlEngine()
  engine.applyRTL(element as unknown as Element)

  assert.equal(element.style.getPropertyValue("direction"), "rtl")
  assert.equal(element.style.getPropertyPriority("direction"), "")
  assert.equal(element.style.getPropertyValue("text-align"), "right")
  assert.equal(element.style.getPropertyPriority("text-align"), "")
  assert.equal(element.style.getPropertyValue("unicode-bidi"), "plaintext")
  assert.equal(element.style.getPropertyPriority("unicode-bidi"), "")

  engine.restoreStyles()

  assert.equal(element.style.getPropertyValue("direction"), "ltr")
  assert.equal(element.style.getPropertyPriority("direction"), "important")
  assert.equal(element.style.getPropertyValue("text-align"), "left")
  assert.equal(element.style.getPropertyPriority("text-align"), "important")
  assert.equal(element.style.getPropertyValue("unicode-bidi"), "normal")
  assert.equal(element.style.getPropertyPriority("unicode-bidi"), "important")
})

test("RTL auto direction updates inputs and restores original values", () => {
  const input = new FakeInputElement()
  input.value = "hello"
  input.setAttribute("dir", "ltr")
  input.style.direction = "ltr"
  input.style.textAlign = "left"
  installRtlDom([input])

  const autoDirection = new RtlAutoDirection()
  autoDirection.enable()

  assert.equal(input.getAttribute("dir"), "ltr")
  assert.equal(input.style.direction, "")
  assert.equal(input.style.textAlign, "")

  input.value = "سلام"
  input.dispatchEvent("input")

  assert.equal(input.getAttribute("dir"), "rtl")
  assert.equal(input.style.direction, "rtl")
  assert.equal(input.style.textAlign, "right")

  input.value = "hello"
  input.dispatchEvent("input")

  assert.equal(input.getAttribute("dir"), "ltr")
  assert.equal(input.style.direction, "")
  assert.equal(input.style.textAlign, "")

  autoDirection.disable()

  assert.equal(input.getAttribute("dir"), "ltr")
  assert.equal(input.style.direction, "ltr")
  assert.equal(input.style.textAlign, "left")
})

test("RTL auto direction cleans up disconnected tracked inputs", () => {
  const input = new FakeInputElement()
  input.setAttribute("dir", "ltr")
  installRtlDom([input])

  const autoDirection = new RtlAutoDirection()
  autoDirection.enable()

  assert.equal(input.listenerCount("input"), 1)

  input.isConnected = false
  ;(
    autoDirection as unknown as {
      scanEditableNodes: () => void
    }
  ).scanEditableNodes()

  assert.equal(input.listenerCount("input"), 0)

  autoDirection.disable()
})

test("RTL engine reads textContent without forcing innerText layout", () => {
  const element = {
    innerText: "expensive rendered text",
    textContent: "cheap text content"
  } as unknown as Element

  assert.equal(getElementText(element), "cheap text content")
})
