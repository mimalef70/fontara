import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import { ICON_EXCLUDED_SELECTORS } from "../../src/config/selectors"
import {
  isOwnedEditableFontStyle,
  pruneDisconnectedEditableFontStyles,
  refreshEditableFontStyles,
  removeEditableFontStyles,
  setActiveFontFamilyForEditableStyles
} from "../../src/inject/editable-font-style"
import { registerKnownOpenShadowRoot } from "../../src/inject/shadow-roots"

const GLOBAL_KEYS = [
  "document",
  "HTMLElement",
  "HTMLStyleElement",
  "ShadowRoot",
  "window"
] as const
const ORIGINAL_GLOBALS = GLOBAL_KEYS.map((key) => ({
  exists: key in globalThis,
  key,
  value: Reflect.get(globalThis, key)
}))

class FakeStyleDeclaration {
  private readonly properties = new Map<string, string>()

  get length(): number {
    return this.properties.size
  }

  getPropertyValue(name: string): string {
    return this.properties.get(name) ?? ""
  }

  removeProperty(name: string): string {
    const previousValue = this.getPropertyValue(name)
    this.properties.delete(name)
    return previousValue
  }

  setProperty(name: string, value: string): void {
    this.properties.set(name, value)
  }
}

class FakeElement {
  readonly attributes = new Map<string, string>()
  readonly children: FakeElement[] = []
  readonly style = new FakeStyleDeclaration()
  static isConnectedReads = 0
  attributeWriteCount = 0
  disabledWriteCount = 0
  id = ""
  isContentEditable = false
  parentElement: FakeElement | null = null
  root: FakeShadowRoot | null = null
  textWriteCount = 0
  private connected = true
  private disabledValue = false
  private textValue = ""

  constructor(readonly localName: string) {}

  get disabled(): boolean {
    return this.disabledValue
  }

  set disabled(value: boolean) {
    this.disabledWriteCount += 1
    this.disabledValue = value
  }

  get isConnected(): boolean {
    FakeElement.isConnectedReads += 1
    return this.connected
  }

  set isConnected(value: boolean) {
    this.connected = value
  }

  get tagName(): string {
    return this.localName.toUpperCase()
  }

  get textContent(): string {
    return this.textValue
  }

  set textContent(value: string) {
    this.textWriteCount += 1
    this.textValue = value
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  getRootNode(): FakeShadowRoot | FakeElement {
    return this.root ?? this
  }

  closest(): FakeElement | null {
    return null
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  remove(): void {
    if (this.root) {
      this.root.children.splice(this.root.children.indexOf(this), 1)
      this.root = null
    }
    this.parentElement = null
    this.isConnected = false
  }

  removeAttribute(name: string): void {
    this.attributeWriteCount += 1
    this.attributes.delete(name)
  }

  setAttribute(name: string, value: string): void {
    this.attributeWriteCount += 1
    this.attributes.set(name, value)
    if (name === "id") this.id = value
    if (name === "contenteditable") {
      this.isContentEditable = value.toLowerCase() !== "false"
    }
  }

  matches(selector: string): boolean {
    if (!selector.startsWith(`${this.localName}[contenteditable]`)) {
      return false
    }
    if (!this.isContentEditable) return false
    return !selector.includes('[id="') || selector.includes(`[id="${this.id}"]`)
  }

  querySelector(): FakeElement | null {
    return null
  }

  querySelectorAll(): FakeElement[] {
    return []
  }
}

class FakeShadowRoot {
  readonly children: FakeElement[] = []
  appendCount = 0

  constructor(readonly host: FakeElement) {}

  append(element: FakeElement): void {
    element.remove()
    element.isConnected = this.host.isConnected
    element.root = this
    this.children.push(element)
    this.appendCount += 1
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === "style[data-fontara-editable-style]") {
      return this.children.filter(
        (element) =>
          element.localName === "style" &&
          element.hasAttribute("data-fontara-editable-style")
      )
    }
    if (selector.startsWith("[contenteditable]")) {
      return this.children.filter((element) => element.isContentEditable)
    }
    return []
  }
}

class DeterministicTimers {
  private nextId = 1
  private readonly callbacks = new Map<number, () => void>()
  private readonly queue: number[] = []

  get pendingCount(): number {
    return this.callbacks.size
  }

  clearTimeout(id: number): void {
    this.callbacks.delete(id)
  }

  drain(limit = 20_000): void {
    let turns = 0
    while (this.pendingCount > 0) {
      assert.ok(turns < limit, "The deterministic timer queue did not drain.")
      this.runNext()
      turns += 1
    }
  }

  runNext(): void {
    while (this.queue.length > 0) {
      const id = this.queue.shift()
      if (id === undefined) return
      const callback = this.callbacks.get(id)
      if (!callback) continue

      this.callbacks.delete(id)
      callback()
      return
    }
  }

  setTimeout(callback: () => void): number {
    const id = this.nextId
    this.nextId += 1
    this.callbacks.set(id, callback)
    this.queue.push(id)
    return id
  }
}

let currentHost: FakeElement | null = null
let currentTimers: DeterministicTimers | null = null

function installShadowEnvironment(
  getFontFamily: (element: FakeElement) => string = () =>
    "system-ui, sans-serif",
  timers?: DeterministicTimers
): { shadowRoot: FakeShadowRoot } {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  currentHost = new FakeElement("fontara-editor")
  const shadowRoot = new FakeShadowRoot(currentHost)

  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  })
  Reflect.set(globalThis, "window", {
    ...(timers
      ? {
          cancelIdleCallback: (id: number) => timers.clearTimeout(id),
          clearTimeout: (id: number) => timers.clearTimeout(id),
          requestIdleCallback: (callback: (deadline: IdleDeadline) => void) =>
            timers.setTimeout(() =>
              callback({
                didTimeout: false,
                timeRemaining: () => 50
              } as IdleDeadline)
            ),
          setTimeout: (callback: () => void) => timers.setTimeout(callback)
        }
      : {}),
    getComputedStyle: (element: FakeElement) => ({
      fontFamily: getFontFamily(element)
    })
  })

  currentTimers = timers ?? null

  registerKnownOpenShadowRoot(shadowRoot as unknown as ShadowRoot)
  return { shadowRoot }
}

afterEach(async () => {
  removeEditableFontStyles()
  if (currentTimers) currentTimers.drain()
  else {
    for (let turn = 0; turn < 20; turn += 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
    }
  }
  setActiveFontFamilyForEditableStyles(null)
  if (currentHost) currentHost.isConnected = false
  currentHost = null
  currentTimers = null
  FakeElement.isConnectedReads = 0

  for (const { exists, key, value } of ORIGINAL_GLOBALS) {
    if (exists) Reflect.set(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})

const SHADOW_STYLE_SELECTOR = "style[data-fontara-editable-style]"

function createRegisteredShadowRoots(count: number): FakeShadowRoot[] {
  return Array.from({ length: count }, (_, index) => {
    const host = new FakeElement(`fontara-editor-${index}`)
    const root = new FakeShadowRoot(host)
    const editor = new FakeElement("div")
    editor.setAttribute("contenteditable", "true")
    editor.setAttribute("id", `editor-${index}`)
    root.append(editor)
    registerKnownOpenShadowRoot(root as unknown as ShadowRoot)
    return root
  })
}

function countEditableShadowStyles(roots: FakeShadowRoot[]): number {
  return roots.reduce(
    (count, root) =>
      count + Number(Boolean(root.querySelector(SHADOW_STYLE_SELECTOR))),
    0
  )
}

test("editable icon guards do not exclude ordinary inline font styling", () => {
  installShadowEnvironment()
  assert.equal(ICON_EXCLUDED_SELECTORS.includes('[style*="font-"]'), false)
  assert.equal(ICON_EXCLUDED_SELECTORS.includes(".fa"), true)
  assert.equal(
    ICON_EXCLUDED_SELECTORS.includes('[class*="material-icon"]'),
    true
  )
})

test("shadow editable styles repair all tampering once and then remain stable", () => {
  const { shadowRoot } = installShadowEnvironment()
  refreshEditableFontStyles({ includeDocument: false })

  const style = shadowRoot.querySelector("style[data-fontara-editable-style]")
  assert.ok(style)
  const expectedCSS = style.textContent
  assert.match(expectedCSS, /var\(--fontara-font\)/)

  style.removeAttribute("data-fontara-editable-style")
  style.textContent = "contenteditable { font-family: Comic Sans MS; }"
  style.setAttribute("disabled", "")
  style.disabled = true
  style.setAttribute("media", "not all")
  style.setAttribute("type", "text/plain")

  refreshEditableFontStyles({ includeDocument: false })

  assert.equal(
    shadowRoot.querySelector("style[data-fontara-editable-style]"),
    style,
    "Repair must retain the owned style node instead of multiplying it."
  )
  assert.equal(style.getAttribute("data-fontara-editable-style"), "true")
  assert.equal(style.textContent, expectedCSS)
  assert.equal(style.hasAttribute("disabled"), false)
  assert.equal(style.disabled, false)
  assert.equal(style.hasAttribute("media"), false)
  assert.equal(style.hasAttribute("type"), false)

  const stableWriteCounts = {
    append: shadowRoot.appendCount,
    attribute: style.attributeWriteCount,
    disabled: style.disabledWriteCount,
    text: style.textWriteCount
  }
  refreshEditableFontStyles({ includeDocument: false })
  refreshEditableFontStyles({ includeDocument: false })

  assert.deepEqual(
    {
      append: shadowRoot.appendCount,
      attribute: style.attributeWriteCount,
      disabled: style.disabledWriteCount,
      text: style.textWriteCount
    },
    stableWriteCounts,
    "A repaired style must not produce new mutations on subsequent refreshes."
  )
})

test("dynamic editable fallbacks stay byte-stable for system and Google runtime fonts", () => {
  let computedFontFamily = "system-ui, system-ui, Arial, sans-serif"
  const { shadowRoot } = installShadowEnvironment(() => computedFontFamily)
  const editor = new FakeElement("div")
  editor.setAttribute("contenteditable", "true")
  editor.setAttribute("id", "editor")
  shadowRoot.append(editor)

  setActiveFontFamilyForEditableStyles("system-ui")
  refreshEditableFontStyles({ includeDocument: false })
  const style = shadowRoot.querySelector("style[data-fontara-editable-style]")
  assert.ok(style)
  const systemCSS = style.textContent

  computedFontFamily = "system-ui, Arial, sans-serif"
  refreshEditableFontStyles({ includeDocument: false })
  refreshEditableFontStyles({ includeDocument: false })
  assert.equal(style.textContent, systemCSS)
  assert.match(systemCSS, /var\(--fontara-font\), Arial, sans-serif/)
  assert.doesNotMatch(systemCSS, /system-ui, system-ui/)

  const activeGoogleFamily = `FontAraGoogle-${"a".repeat(24)}`
  const staleGoogleFamily = `FontAraGoogle-${"b".repeat(24)}`
  setActiveFontFamilyForEditableStyles(activeGoogleFamily)
  computedFontFamily = `${activeGoogleFamily}, ${staleGoogleFamily}, Arial, sans-serif`
  refreshEditableFontStyles({ includeDocument: false })
  const googleCSS = style.textContent

  computedFontFamily = `${activeGoogleFamily}, Arial, sans-serif`
  refreshEditableFontStyles({ includeDocument: false })
  refreshEditableFontStyles({ includeDocument: false })
  assert.equal(style.textContent, googleCSS)
  assert.doesNotMatch(googleCSS, /FontAraGoogle-/)
  assert.match(googleCSS, /var\(--fontara-font\), Arial, sans-serif/)
})

test("detached shadow styles are pruned using their original root", () => {
  const { shadowRoot } = installShadowEnvironment()
  refreshEditableFontStyles({ includeDocument: false })
  const originalStyle = shadowRoot.querySelector(
    "style[data-fontara-editable-style]"
  )
  assert.ok(originalStyle)

  originalStyle.remove()
  assert.ok(currentHost)
  currentHost.isConnected = false
  pruneDisconnectedEditableFontStyles()
  assert.equal(isOwnedEditableFontStyle(originalStyle), false)

  currentHost.isConnected = true
  refreshEditableFontStyles({ includeDocument: false })
  const replacementStyle = shadowRoot.querySelector(
    "style[data-fontara-editable-style]"
  )
  assert.ok(replacementStyle)
  assert.notEqual(replacementStyle, originalStyle)
})

test("editable style pruning is bounded and keeps same-task reconnected roots", async () => {
  installShadowEnvironment()
  const entries: Array<{
    host: FakeElement
    root: FakeShadowRoot
    style: FakeElement
  }> = []

  for (let index = 0; index < 350; index += 1) {
    const host = new FakeElement(`fontara-editor-${index}`)
    const root = new FakeShadowRoot(host)
    refreshEditableFontStyles({
      documentMode: "preserve",
      roots: [root as unknown as ShadowRoot]
    })
    const style = root.querySelector("style[data-fontara-editable-style]")
    assert.ok(style)
    entries.push({ host, root, style })
  }

  // Let the unrelated bounded inline-style cleanup queue settle first.
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20))
  const tail = entries[entries.length - 1]
  assert.ok(tail)
  tail.host.isConnected = false
  FakeElement.isConnectedReads = 0

  pruneDisconnectedEditableFontStyles()
  assert.ok(
    FakeElement.isConnectedReads <= 100,
    `A synchronous editable-style prune inspected ${FakeElement.isConnectedReads} roots.`
  )

  // MutationObserver reports a removal for a same-task move. The style must
  // survive when its host reconnects before the bounded scan reaches it.
  tail.host.isConnected = true
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20))
  assert.equal(isOwnedEditableFontStyle(tail.style), true)
  assert.equal(
    tail.root.querySelector("style[data-fontara-editable-style]"),
    tail.style
  )

  tail.host.isConnected = false
  FakeElement.isConnectedReads = 0
  pruneDisconnectedEditableFontStyles()
  assert.ok(FakeElement.isConnectedReads <= 100)
  assert.equal(isOwnedEditableFontStyle(tail.style), true)
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20))
  assert.equal(isOwnedEditableFontStyle(tail.style), false)
})

test("shadow style upsert and cleanup remove namespaced orphan clones", async () => {
  const { shadowRoot } = installShadowEnvironment()
  refreshEditableFontStyles({ includeDocument: false })
  const ownedStyle = shadowRoot.querySelector(
    "style[data-fontara-editable-style]"
  )
  assert.ok(ownedStyle)

  const clone = new FakeElement("style")
  clone.setAttribute("data-fontara-editable-style", "true")
  clone.textContent = ownedStyle.textContent
  shadowRoot.append(clone)

  refreshEditableFontStyles({ includeDocument: false })
  assert.deepEqual(
    shadowRoot.querySelectorAll("style[data-fontara-editable-style]"),
    [ownedStyle]
  )

  const secondClone = new FakeElement("style")
  secondClone.setAttribute("data-fontara-editable-style", "true")
  shadowRoot.append(secondClone)
  removeEditableFontStyles()
  if (currentTimers) currentTimers.drain()
  else {
    for (let turn = 0; turn < 20; turn += 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
    }
  }
  assert.equal(
    shadowRoot.querySelectorAll("style[data-fontara-editable-style]").length,
    0
  )
})

test("legacy editable inline declarations are removed asynchronously", async () => {
  const { shadowRoot } = installShadowEnvironment()
  const editor = new FakeElement("div")
  editor.setAttribute("contenteditable", "true")
  editor.setAttribute("id", "editor")
  const text = new FakeElement("span")
  text.style.setProperty(
    "font-family",
    "var(--fontara-font), Arial, sans-serif"
  )
  text.parentElement = editor
  editor.children.push(text)
  shadowRoot.append(editor)
  text.root = shadowRoot
  text.isConnected = true

  refreshEditableFontStyles({ includeDocument: false })
  assert.match(text.style.getPropertyValue("font-family"), /fontara-font/)

  await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
  assert.equal(text.style.getPropertyValue("font-family"), "")
})

test("global shadow editable refresh and teardown stay bounded and reach the tail root", () => {
  const timers = new DeterministicTimers()
  installShadowEnvironment(undefined, timers)
  const roots = createRegisteredShadowRoots(1_201)
  const tailRoot = roots[roots.length - 1]
  assert.ok(tailRoot)

  refreshEditableFontStyles({ includeDocument: false })

  let styledRootCount = countEditableShadowStyles(roots)
  assert.ok(
    styledRootCount <= 100,
    `A synchronous global refresh reconciled ${styledRootCount} shadow roots.`
  )
  assert.equal(tailRoot.querySelector(SHADOW_STYLE_SELECTOR), null)
  assert.ok(timers.pendingCount > 0)

  while (timers.pendingCount > 0) {
    const previousCount = styledRootCount
    timers.runNext()
    styledRootCount = countEditableShadowStyles(roots)
    assert.ok(
      styledRootCount - previousCount <= 100,
      `One refresh turn reconciled ${styledRootCount - previousCount} shadow roots.`
    )
  }

  assert.equal(styledRootCount, roots.length)
  assert.ok(tailRoot.querySelector(SHADOW_STYLE_SELECTOR))

  removeEditableFontStyles()

  let remainingStyleCount = countEditableShadowStyles(roots)
  assert.ok(
    roots.length - remainingStyleCount <= 100,
    `A synchronous teardown removed ${roots.length - remainingStyleCount} shadow styles.`
  )
  assert.ok(tailRoot.querySelector(SHADOW_STYLE_SELECTOR))
  assert.ok(timers.pendingCount > 0)

  while (timers.pendingCount > 0) {
    const previousCount = remainingStyleCount
    timers.runNext()
    remainingStyleCount = countEditableShadowStyles(roots)
    assert.ok(
      previousCount - remainingStyleCount <= 100,
      `One teardown turn removed ${previousCount - remainingStyleCount} shadow styles.`
    )
  }

  assert.equal(remainingStyleCount, 0)
  assert.equal(tailRoot.querySelector(SHADOW_STYLE_SELECTOR), null)
})

test("a font switch supersedes an in-flight global shadow editable refresh", () => {
  const timers = new DeterministicTimers()
  let computedFontFamily = '"Old Runtime Font", "Old Fallback", sans-serif'
  installShadowEnvironment(() => computedFontFamily, timers)
  const roots = createRegisteredShadowRoots(1_101)
  const tailRoot = roots[roots.length - 1]
  assert.ok(tailRoot)

  setActiveFontFamilyForEditableStyles("Old Runtime Font")
  refreshEditableFontStyles({ includeDocument: false })

  while (countEditableShadowStyles(roots) === 0 && timers.pendingCount > 0) {
    timers.runNext()
  }
  const initiallyStyledRoot = roots.find((root) =>
    root.querySelector(SHADOW_STYLE_SELECTOR)
  )
  assert.ok(initiallyStyledRoot)
  assert.ok(countEditableShadowStyles(roots) < roots.length)
  assert.match(
    initiallyStyledRoot.querySelector(SHADOW_STYLE_SELECTOR)?.textContent ?? "",
    /Old Fallback/
  )

  computedFontFamily = '"New Runtime Font", "New Fallback", sans-serif'
  setActiveFontFamilyForEditableStyles("New Runtime Font")
  refreshEditableFontStyles({ includeDocument: false })
  timers.drain()

  for (const root of roots) {
    const css = root.querySelector(SHADOW_STYLE_SELECTOR)?.textContent ?? ""
    assert.match(css, /New Fallback/)
    assert.doesNotMatch(css, /Old Fallback/)
  }
  assert.match(
    tailRoot.querySelector(SHADOW_STYLE_SELECTOR)?.textContent ?? "",
    /New Fallback/
  )
})
