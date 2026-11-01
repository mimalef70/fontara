import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  collectFontWork,
  resetProcessedElements,
  writeFontWorkBatch
} from "../../src/inject/dom-processor"
import { removeEditableFontStyles } from "../../src/inject/editable-font-style"
import { startObserving, stopObserving } from "../../src/inject/observer"
import {
  clearKnownOpenShadowRoots,
  getKnownOpenShadowRoots
} from "../../src/inject/shadow-roots"

const GLOBAL_KEYS = [
  "cancelAnimationFrame",
  "clearTimeout",
  "document",
  "HTMLElement",
  "HTMLStyleElement",
  "MutationObserver",
  "Node",
  "requestAnimationFrame",
  "setTimeout",
  "ShadowRoot",
  "window"
] as const
const ORIGINAL_GLOBALS = GLOBAL_KEYS.map((key) => ({
  exists: key in globalThis,
  key,
  value: Reflect.get(globalThis, key)
}))

class FakeNode {
  static readonly TEXT_NODE = 3

  isConnected = true
  nodeType = 1
  ownerDocument: object | null = null
  parentElement: FakeElement | null = null
  rootNode: FakeNode | null = null

  getRootNode(): FakeNode {
    return this.rootNode ?? this.parentElement?.getRootNode() ?? this
  }
}

class FakeStyleDeclaration {
  readonly properties = new Map<string, { priority: string; value: string }>()

  get length(): number {
    return this.properties.size
  }

  getPropertyPriority(name: string): string {
    return this.properties.get(name)?.priority ?? ""
  }

  getPropertyValue(name: string): string {
    return this.properties.get(name)?.value ?? ""
  }

  removeProperty(name: string): string {
    const value = this.getPropertyValue(name)
    this.properties.delete(name)
    return value
  }

  setProperty(name: string, value: string, priority = ""): void {
    this.properties.set(name, { priority, value })
  }
}

class FakeShadowRoot extends FakeNode {
  readonly children: FakeElement[] = []
  readonly querySelectorCalls: string[] = []

  constructor(readonly host: FakeElement) {
    super()
    this.rootNode = this
  }

  append(child: FakeElement): void {
    child.remove()
    child.isConnected = this.host.isConnected
    child.rootNode = this
    this.children.push(child)
  }

  appendChild(child: FakeElement): void {
    this.append(child)
  }

  getRootNode(): FakeShadowRoot {
    return this
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string): FakeElement[] {
    this.querySelectorCalls.push(selector)
    const descendants = this.children.flatMap((child) => [
      child,
      ...child.descendants()
    ])
    if (selector === "*") return descendants
    if (selector === '[contenteditable]:not([contenteditable="false" i])') {
      return descendants.filter((element) => {
        const value = element.getAttribute("contenteditable")
        return value !== null && value.toLowerCase() !== "false"
      })
    }
    if (selector === "style[data-fontara-editable-style]") {
      return descendants.filter(
        (element) =>
          element.localName === "style" &&
          element.hasAttribute("data-fontara-editable-style")
      )
    }
    return []
  }
}

class FakeElement extends FakeNode {
  readonly attributes = new Map<string, string>()
  readonly childNodes: FakeNode[] = []
  readonly children: FakeElement[] = []
  readonly classList = new Set<string>()
  readonly querySelectorCalls: string[] = []
  isContentEditable = false
  shadowRoot: FakeShadowRoot | null = null
  readonly style = new FakeStyleDeclaration()
  textContent = ""

  constructor(readonly localName: string) {
    super()
  }

  get tagName(): string {
    return this.localName.toUpperCase()
  }

  appendChild(child: FakeElement): void {
    child.remove()
    child.parentElement = this
    child.isConnected = this.isConnected
    child.rootNode = null
    this.children.push(child)
    this.childNodes.push(child)
  }

  closest(): null {
    return null
  }

  descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()])
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  matches(selector: string): boolean {
    return (
      selector === "[data-fontara-shadow-host]" &&
      this.hasAttribute("data-fontara-shadow-host")
    )
  }

  querySelector(): FakeElement | null {
    return null
  }

  querySelectorAll(selector: string): FakeElement[] {
    this.querySelectorCalls.push(selector)
    return selector === "*" ? this.descendants() : []
  }

  removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    const childNodeIndex = this.childNodes.indexOf(child)
    if (childNodeIndex >= 0) this.childNodes.splice(childNodeIndex, 1)
    child.parentElement = null
    child.rootNode = null
    child.isConnected = false
  }

  remove(): void {
    if (this.parentElement) {
      this.parentElement.removeChild(this)
      return
    }
    if (this.rootNode instanceof FakeShadowRoot) {
      const index = this.rootNode.children.indexOf(this)
      if (index >= 0) this.rootNode.children.splice(index, 1)
      this.rootNode = null
    }
    this.isConnected = false
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
    if (name === "contenteditable") this.isContentEditable = false
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
    if (name === "contenteditable") {
      this.isContentEditable = value.toLowerCase() !== "false"
    }
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = []

  disconnectCount = 0
  readonly observations: Array<{
    options: MutationObserverInit
    target: unknown
  }> = []

  constructor(private readonly callback: MutationCallback) {
    FakeMutationObserver.instances.push(this)
  }

  disconnect(): void {
    this.disconnectCount += 1
  }

  observe(target: Node, options: MutationObserverInit): void {
    this.observations.push({ options, target })
  }

  trigger(records: MutationRecord[]): void {
    this.callback(records, this as unknown as MutationObserver)
  }
}

function getMutationObserverForTarget(
  target: unknown
): FakeMutationObserver | undefined {
  return FakeMutationObserver.instances.find((observer) =>
    observer.observations.some((observation) => observation.target === target)
  )
}

function installWindowMock(): {
  getComputedStyleCallCount: () => number
  getPendingTimerDelays: () => number[]
  runNextImmediateTask: () => boolean
  runImmediateTasks: () => void
  runTimersThrough: (maximumDelay: number) => void
} {
  const timers: Array<{ callback: () => void; delay: number; id: number }> = []
  let computedStyleCallCount = 0
  let nextTimerId = 1
  const clearTimer = (timerId: number) => {
    const index = timers.findIndex((timer) => timer.id === timerId)
    if (index >= 0) timers.splice(index, 1)
  }
  const scheduleTimer = (callback: () => void, delay = 0) => {
    const id = nextTimerId
    nextTimerId += 1
    timers.push({ callback, delay, id })
    return id
  }

  Reflect.set(globalThis, "clearTimeout", clearTimer)
  Reflect.set(globalThis, "setTimeout", scheduleTimer)
  Reflect.set(globalThis, "window", {
    clearTimeout: clearTimer,
    getComputedStyle() {
      computedStyleCallCount += 1
      return { fontFamily: "system-ui, sans-serif" }
    },
    setTimeout: scheduleTimer
  })

  const runTasks = (predicate: (delay: number) => boolean): void => {
    let safety = 5_000
    while (safety > 0) {
      const index = timers.findIndex((timer) => predicate(timer.delay))
      if (index < 0) break
      safety -= 1
      timers.splice(index, 1)[0]?.callback()
    }
    assert.ok(safety > 0, "Observer timer work did not settle.")
  }

  return {
    getComputedStyleCallCount() {
      return computedStyleCallCount
    },
    getPendingTimerDelays() {
      return timers.map(({ delay }) => delay)
    },
    runNextImmediateTask() {
      const index = timers.findIndex((timer) => timer.delay === 0)
      if (index < 0) return false
      timers.splice(index, 1)[0]?.callback()
      return true
    },
    runImmediateTasks() {
      runTasks((delay) => delay === 0)
    },
    runTimersThrough(maximumDelay: number) {
      runTasks((delay) => delay <= maximumDelay)
    }
  }
}

const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false" i])'

function installEditableDocumentMock(
  documentElement: FakeElement,
  head: FakeElement,
  body: FakeElement
): { getEditableQueryCount: () => number } {
  let editableQueryCount = 0
  const allElements = () => [documentElement, ...documentElement.descendants()]

  Reflect.set(globalThis, "document", {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: (id: string) =>
      allElements().find(
        (element) => (element as FakeElement & { id?: string }).id === id
      ) ?? null,
    head,
    querySelectorAll: (selector: string) => {
      if (selector === CONTENT_EDITABLE_SELECTOR) {
        editableQueryCount += 1
        return allElements().filter((element) => {
          const value = element.getAttribute("contenteditable")
          return value !== null && value.toLowerCase() !== "false"
        })
      }
      if (selector === "style[data-fontara-editable-style]") {
        return allElements().filter(
          (element) =>
            element.localName === "style" &&
            element.hasAttribute("data-fontara-editable-style")
        )
      }
      return []
    }
  })

  return {
    getEditableQueryCount: () => editableQueryCount
  }
}

afterEach(() => {
  removeEditableFontStyles()
  stopObserving()
  resetProcessedElements()
  clearKnownOpenShadowRoots()
  FakeMutationObserver.instances = []

  for (const { exists, key, value } of ORIGINAL_GLOBALS) {
    if (exists) Reflect.set(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test("observer reconnects to a replacement body and its open shadow roots", () => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const originalBody = new FakeElement("body")
  const originalShadowHost = new FakeElement("fontara-original-shell")
  const originalShadowRoot = new FakeShadowRoot(originalShadowHost)
  originalShadowHost.shadowRoot = originalShadowRoot
  originalBody.appendChild(originalShadowHost)
  documentElement.appendChild(head)
  documentElement.appendChild(originalBody)

  const documentValue = {
    body: originalBody,
    documentElement,
    querySelectorAll: () => []
  }
  let animationFrameCalls = 0
  let cancelledFrame: number | null = null

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", documentValue)
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", () => {
    animationFrameCalls += 1
    return animationFrameCalls
  })
  Reflect.set(globalThis, "cancelAnimationFrame", (frame: number) => {
    cancelledFrame = frame
  })

  startObserving()

  const mutationObserver = getMutationObserverForTarget(originalBody)
  const originalShadowObserver =
    getMutationObserverForTarget(originalShadowRoot)
  assert.ok(mutationObserver)
  assert.ok(originalShadowObserver)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) => target === originalBody && options.subtree
    ),
    true
  )

  const replacementBody = new FakeElement("body")
  const shadowHost = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot(shadowHost)
  shadowHost.shadowRoot = shadowRoot
  replacementBody.appendChild(shadowHost)
  documentElement.removeChild(originalBody)
  documentElement.appendChild(replacementBody)
  documentValue.body = replacementBody

  const bodyReplacementMutation = {
    addedNodes: [replacementBody],
    attributeName: null,
    removedNodes: [originalBody],
    target: documentElement,
    type: "childList"
  } as unknown as MutationRecord
  mutationObserver.trigger([bodyReplacementMutation])
  mutationObserver.trigger([bodyReplacementMutation])
  runImmediateTasks()

  assert.equal(animationFrameCalls, 1)
  assert.equal(mutationObserver.disconnectCount, 1)
  assert.equal(originalShadowObserver.disconnectCount, 1)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) => target === replacementBody && options.subtree
    ),
    true
  )
  const replacementShadowObserver = getMutationObserverForTarget(shadowRoot)
  assert.ok(replacementShadowObserver)
  assert.notEqual(replacementShadowObserver, originalShadowObserver)
  assert.equal(replacementShadowObserver.observations[0]?.options.subtree, true)

  stopObserving()
  assert.equal(replacementShadowObserver.disconnectCount, 1)
  assert.equal(cancelledFrame, 1)
})

test("pruning one shadow root leaves every unaffected root observer untouched", (t) => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const hosts = Array.from(
    { length: 3 },
    (_, index) => new FakeElement(`fontara-shell-${index}`)
  )
  const roots = hosts.map((host) => {
    const root = new FakeShadowRoot(host)
    host.shadowRoot = root
    body.appendChild(host)
    return root
  })
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", () => 1)
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  t.after(() => {
    for (const host of hosts) host.isConnected = false
  })

  startObserving("shadow-only")
  const mainObserver = getMutationObserverForTarget(body)
  const rootObservers = roots.map((root) => getMutationObserverForTarget(root))
  assert.ok(mainObserver)
  assert.ok(rootObservers.every(Boolean))
  const [removedRootObserver, ...retainedRootObservers] = rootObservers
  assert.ok(removedRootObserver)

  const removedHost = hosts[0]
  assert.ok(removedHost)
  removedHost.remove()
  mainObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [removedHost],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(removedRootObserver.disconnectCount, 1)
  assert.equal(mainObserver.disconnectCount, 0)
  for (const [index, retainedObserver] of retainedRootObservers.entries()) {
    assert.ok(retainedObserver)
    assert.equal(retainedObserver.disconnectCount, 0)
    assert.equal(retainedObserver.observations.length, 1)
    assert.equal(
      getMutationObserverForTarget(roots[index + 1]),
      retainedObserver,
      "Pruning one root must not recreate observers for connected siblings."
    )
  }

  stopObserving()
  assert.equal(mainObserver.disconnectCount, 1)
  assert.equal(removedRootObserver.disconnectCount, 1)
  for (const retainedObserver of retainedRootObservers) {
    assert.equal(retainedObserver?.disconnectCount, 1)
  }
})

test("a stale source observer cannot mutate or retain an adopted shadow tree", () => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const host = new FakeElement("fontara-adopted-shell")
  const shadowRoot = new FakeShadowRoot(host)
  const textElement = new FakeElement("span")
  const textNode = new FakeNode()
  textNode.nodeType = FakeNode.TEXT_NODE
  Reflect.set(textNode, "textContent", "adopted shadow text")
  textNode.parentElement = textElement
  textElement.childNodes.push(textNode)
  shadowRoot.append(textElement)
  host.shadowRoot = shadowRoot
  body.appendChild(host)
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const sourceDocument = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  }
  for (const element of [documentElement, head, body, host, textElement]) {
    element.ownerDocument = sourceDocument
  }
  textNode.ownerDocument = sourceDocument

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", sourceDocument)
  const { getComputedStyleCallCount, runImmediateTasks } = installWindowMock()
  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  writeFontWorkBatch(collectFontWork(textElement as unknown as HTMLElement))
  const targetOwnedValue = textElement.style.getPropertyValue("font-family")
  textElement.setAttribute(
    "style",
    `font-family: ${targetOwnedValue} !important`
  )
  const readsBeforeAdoption = getComputedStyleCallCount()

  startObserving("shadow-only")
  const sourceObserver = getMutationObserverForTarget(body)
  const staleShadowObserver = getMutationObserverForTarget(shadowRoot)
  assert.ok(sourceObserver)
  assert.ok(staleShadowObserver)

  host.remove()
  const targetDocument = {}
  host.ownerDocument = targetDocument
  host.isConnected = true
  textElement.ownerDocument = targetDocument
  textElement.isConnected = true
  textNode.ownerDocument = targetDocument
  // Simulate the target document adopting ownership without changing the
  // declaration's bytes; value equality must not authorize source cleanup.
  textElement.style.setProperty("font-family", targetOwnedValue, "important")

  sourceObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [host],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(staleShadowObserver.disconnectCount, 1)
  assert.deepEqual(getKnownOpenShadowRoots(), [])

  // A MutationObserver callback can already be queued when disconnect runs.
  // Deliver it explicitly to prove that stale reconciliation is also fenced.
  staleShadowObserver.trigger([
    {
      addedNodes: [],
      attributeName: "style",
      oldValue: "font-family: PageFont, serif",
      removedNodes: [],
      target: textElement,
      type: "attributes"
    } as unknown as MutationRecord
  ])

  while (animationFrameCallbacks.length > 0) {
    animationFrameCallbacks.shift()?.()
  }
  runImmediateTasks()

  assert.equal(
    textElement.style.getPropertyValue("font-family"),
    targetOwnedValue
  )
  assert.equal(
    textElement.getAttribute("style"),
    `font-family: ${targetOwnedValue} !important`
  )
  assert.equal(getComputedStyleCallCount(), readsBeforeAdoption)
  assert.equal(staleShadowObserver.disconnectCount, 1)
  assert.deepEqual(getKnownOpenShadowRoots(), [])
})

test("a second disconnection restarts an in-flight bounded shadow-root prune", (t) => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const hosts = Array.from(
    { length: 205 },
    (_, index) => new FakeElement(`fontara-shell-${index}`)
  )
  const roots = hosts.map((host) => {
    const root = new FakeShadowRoot(host)
    host.shadowRoot = root
    body.appendChild(host)
    return root
  })
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    addEventListener: () => {},
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => [],
    removeEventListener: () => {},
    visibilityState: "visible"
  })
  const { runImmediateTasks, runNextImmediateTask } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", () => 1)
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  t.after(() => {
    for (const host of hosts) host.isConnected = false
  })

  startObserving("shadow-only")
  const mainObserver = getMutationObserverForTarget(body)
  const firstRootObserver = getMutationObserverForTarget(roots[0])
  const middleRootObserver = getMutationObserverForTarget(roots[102])
  const lastRootObserver = getMutationObserverForTarget(roots[204])
  assert.ok(mainObserver)
  assert.ok(firstRootObserver)
  assert.ok(middleRootObserver)
  assert.ok(lastRootObserver)

  const firstHost = hosts[0]
  const lastHost = hosts[204]
  assert.ok(firstHost)
  assert.ok(lastHost)
  firstHost.remove()
  mainObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [firstHost],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(firstRootObserver.disconnectCount, 1)
  assert.equal(lastRootObserver.disconnectCount, 0)
  assert.equal(
    runNextImmediateTask(),
    true,
    "The first prune must leave bounded continuation work queued."
  )

  lastHost.remove()
  mainObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [lastHost],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])
  runImmediateTasks()

  assert.equal(lastRootObserver.disconnectCount, 1)
  assert.equal(middleRootObserver.disconnectCount, 0)
  assert.equal(
    getMutationObserverForTarget(roots[102]),
    middleRootObserver,
    "Restarting a prune must not disconnect or recreate a retained root observer."
  )
})

test("observer revisits a shadow host when direct shadow children are removed", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const shadowHost = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot(shadowHost)
  const removedChild = new FakeElement("span")
  shadowHost.shadowRoot = shadowRoot
  shadowRoot.children.push(removedChild)
  body.appendChild(shadowHost)
  documentElement.appendChild(body)

  let animationFrameCallback: (() => void) | null = null
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallback = callback
    return 1
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [removedChild],
      target: shadowRoot,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.ok(animationFrameCallback)
})

test("observer watches character data and page-owned font classification attributes", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  documentElement.appendChild(body)

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", () => 1)
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const bodyObservation = mutationObserver.observations.find(
    ({ target }) => target === body
  )
  assert.ok(bodyObservation)
  assert.equal(bodyObservation.options.characterData, true)
  assert.equal(bodyObservation.options.attributes, true)
  assert.equal(
    !bodyObservation.options.attributeFilter ||
      bodyObservation.options.attributeFilter.includes("class"),
    true
  )
  assert.equal(
    !bodyObservation.options.attributeFilter ||
      bodyObservation.options.attributeFilter.includes("style"),
    true
  )
})

test("observer schedules recycled text, icon, and character-data targets", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const recycledElement = new FakeElement("span")
  body.appendChild(recycledElement)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const textNode = new FakeNode()
  textNode.nodeType = FakeNode.TEXT_NODE
  textNode.parentElement = recycledElement
  for (const [type, attributeName] of [
    ["characterData", null],
    ["attributes", "style"],
    ["attributes", "class"]
  ] as const) {
    mutationObserver.trigger([
      {
        addedNodes: [],
        attributeName,
        oldValue: null,
        removedNodes: [],
        target: type === "characterData" ? textNode : recycledElement,
        type
      } as unknown as MutationRecord
    ])
  }

  assert.equal(animationFrameCallbacks.length, 1)
})

test("large child-list additions coalesce to the mutation target", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const existingText = new FakeNode()
  existingText.nodeType = FakeNode.TEXT_NODE
  existingText.parentElement = body
  Reflect.set(existingText, "textContent", "Existing target text")
  body.childNodes.push(existingText)
  documentElement.appendChild(body)

  const addedElements = Array.from({ length: 1_001 }, () => {
    const element = new FakeElement("input")
    body.appendChild(element)
    return element
  })
  let addedNodeIterations = 0
  const originalIterator = addedElements[Symbol.iterator].bind(addedElements)
  Object.defineProperty(addedElements, Symbol.iterator, {
    value: function* countedAddedNodes() {
      for (const element of originalIterator()) {
        addedNodeIterations += 1
        yield element
      }
    }
  })

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  const { runImmediateTasks, runTimersThrough } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver = getMutationObserverForTarget(body)
  assert.ok(mutationObserver)
  mutationObserver.trigger([
    {
      addedNodes: addedElements,
      attributeName: null,
      removedNodes: [],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(
    addedNodeIterations,
    0,
    "A large sibling batch must not enqueue and discover every added node individually."
  )
  assert.equal(animationFrameCallbacks.length, 1)
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()
  runTimersThrough(16)

  assert.match(
    addedElements[0]?.style.getPropertyValue("font-family") ?? "",
    /var\(--fontara-font\)/,
    "The coalesced mutation target must own the bounded subtree traversal."
  )
  assert.match(
    addedElements[1_000]?.style.getPropertyValue("font-family") ?? "",
    /var\(--fontara-font\)/,
    "The target traversal must still reach the end of the large sibling batch."
  )
})

test("ordinary editor text and child churn do not rebuild document editable CSS", () => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const editor = new FakeElement("div")
  const existingTextContainer = new FakeElement("span")
  const removedTextContainer = new FakeElement("span")
  editor.setAttribute("contenteditable", "true")
  editor.appendChild(existingTextContainer)
  editor.appendChild(removedTextContainer)
  body.appendChild(editor)
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  const { getEditableQueryCount } = installEditableDocumentMock(
    documentElement,
    head,
    body
  )
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const textNode = new FakeNode()
  textNode.nodeType = FakeNode.TEXT_NODE
  textNode.parentElement = existingTextContainer
  const addedTextContainer = new FakeElement("span")
  editor.appendChild(addedTextContainer)
  removedTextContainer.remove()

  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [],
      target: textNode,
      type: "characterData"
    } as unknown as MutationRecord,
    {
      addedNodes: [addedTextContainer],
      attributeName: null,
      removedNodes: [removedTextContainer],
      target: editor,
      type: "childList"
    } as unknown as MutationRecord
  ])

  while (animationFrameCallbacks.length > 0) {
    animationFrameCallbacks.shift()?.()
  }
  runImmediateTasks()

  assert.equal(
    getEditableQueryCount(),
    0,
    "Typing and ordinary child churn inherit the existing editor rule and must not rescan every document editor."
  )
})

test("adding and removing a contenteditable root rebuilds document editable CSS", () => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  const { getEditableQueryCount } = installEditableDocumentMock(
    documentElement,
    head,
    body
  )
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const editor = new FakeElement("div")
  editor.setAttribute("contenteditable", "true")
  body.appendChild(editor)
  mutationObserver.trigger([
    {
      addedNodes: [editor],
      attributeName: null,
      removedNodes: [],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()
  assert.equal(getEditableQueryCount(), 1)

  editor.remove()
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [editor],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()

  assert.equal(
    getEditableQueryCount(),
    2,
    "Removing the editor must invalidate rules that may target its stable attributes."
  )
})

test("custom-CSS shadow-only mode processes generic Shadow DOM without touching light DOM", (t) => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const lightInput = new FakeElement("input")
  const shadowHost = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot(shadowHost)
  const shadowInput = new FakeElement("input")
  shadowHost.shadowRoot = shadowRoot
  shadowRoot.appendChild(shadowInput)
  body.appendChild(lightInput)
  body.appendChild(shadowHost)
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const documentValue = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  }
  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", documentValue)
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  t.after(() => {
    shadowHost.isConnected = false
  })

  startObserving("shadow-only")
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  runImmediateTasks()
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()

  assert.match(
    shadowInput.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )
  assert.equal(
    lightInput.style.getPropertyValue("font-family"),
    "",
    "Custom site CSS owns light-DOM targeting."
  )

  const lateLightInput = new FakeElement("input")
  const lateShadowInput = new FakeElement("input")
  body.appendChild(lateLightInput)
  shadowRoot.appendChild(lateShadowInput)
  mutationObserver.trigger([
    {
      addedNodes: [lateLightInput],
      attributeName: null,
      removedNodes: [],
      target: body,
      type: "childList"
    } as unknown as MutationRecord,
    {
      addedNodes: [lateShadowInput],
      attributeName: null,
      removedNodes: [],
      target: shadowRoot,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(animationFrameCallbacks.length, 1)
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()

  assert.match(
    lateShadowInput.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )
  assert.equal(
    lateLightInput.style.getPropertyValue("font-family"),
    "",
    "Shadow-only observation must not apply generic inline fonts in light DOM."
  )
})

test("observer timeout flushes pending work when animation frames are suspended", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  const cancelledFrames: number[] = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  const { runTimersThrough } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", (frame: number) => {
    cancelledFrames.push(frame)
  })

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const lateInput = new FakeElement("input")
  body.appendChild(lateInput)
  mutationObserver.trigger([
    {
      addedNodes: [lateInput],
      attributeName: null,
      removedNodes: [],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(animationFrameCallbacks.length, 1)
  runTimersThrough(100)

  assert.deepEqual(cancelledFrames, [1])
  assert.match(
    lateInput.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )
})

test("attribute mutations schedule one reconciliation traversal", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const input = new FakeElement("input")
  body.appendChild(input)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  const {
    getComputedStyleCallCount,
    getPendingTimerDelays,
    runImmediateTasks
  } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  const computedStyleCallsBeforeMutation = getComputedStyleCallCount()

  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: "class",
      removedNodes: [],
      target: input,
      type: "attributes"
    } as unknown as MutationRecord
  ])

  animationFrameCallbacks.shift()?.()
  runImmediateTasks()

  assert.equal(
    getComputedStyleCallCount() - computedStyleCallsBeforeMutation,
    1
  )
  assert.equal(getPendingTimerDelays().includes(16), false)
  assert.match(
    input.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )
})

test("non-font inline animation changes do not reconcile a subtree", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const animatedContainer = new FakeElement("section")
  body.appendChild(animatedContainer)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  const bodyObservation = mutationObserver.observations.find(
    ({ target }) => target === body
  )
  assert.equal(bodyObservation?.options.attributeOldValue, true)

  animatedContainer.setAttribute("style", "transform: translateX(10px)")
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: "style",
      oldValue: "transform: translateX(0)",
      removedNodes: [],
      target: animatedContainer,
      type: "attributes"
    } as unknown as MutationRecord
  ])
  assert.equal(animationFrameCallbacks.length, 0)

  animatedContainer.setAttribute("style", "transform: translateX(10px)")
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: "style",
      oldValue: "font-family: PageFont; transform: translateX(0)",
      removedNodes: [],
      target: animatedContainer,
      type: "attributes"
    } as unknown as MutationRecord
  ])
  assert.equal(animationFrameCallbacks.length, 1)
})

test("shadow-only removal reconciles the ShadowRoot instead of its light-DOM host", (t) => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const shadowHost = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot(shadowHost)
  const removedInput = new FakeElement("input")
  const remainingInput = new FakeElement("input")
  shadowHost.shadowRoot = shadowRoot
  shadowRoot.appendChild(removedInput)
  shadowRoot.appendChild(remainingInput)
  body.appendChild(shadowHost)
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  })
  const { runImmediateTasks, runTimersThrough } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  t.after(() => {
    shadowHost.isConnected = false
  })

  startObserving("shadow-only")
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  runImmediateTasks()
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()
  assert.match(
    remainingInput.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )

  remainingInput.style.removeProperty("font-family")
  removedInput.remove()
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [removedInput],
      target: shadowRoot,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(animationFrameCallbacks.length, 1)
  animationFrameCallbacks.shift()?.()
  runTimersThrough(20)

  assert.match(
    remainingInput.style.getPropertyValue("font-family"),
    /var\(--fontara-font\)/
  )
})

test("observer repairs a tampered owned editable style type", (t) => {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  const shadowHost = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot(shadowHost)
  shadowHost.shadowRoot = shadowRoot
  body.appendChild(shadowHost)
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    documentElement,
    getElementById: () => null,
    head,
    querySelectorAll: () => []
  })
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  t.after(() => {
    shadowHost.isConnected = false
  })

  startObserving("shadow-only")
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  animationFrameCallbacks.shift()?.()
  runImmediateTasks()

  const style = shadowRoot.querySelector("style[data-fontara-editable-style]")
  assert.ok(style)
  const editableRefreshCount = () =>
    shadowRoot.querySelectorCalls.filter(
      (selector) => selector === CONTENT_EDITABLE_SELECTOR
    ).length
  const initialEditableRefreshCount = editableRefreshCount()
  style.setAttribute("type", "text/plain")
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: "type",
      removedNodes: [],
      target: style,
      type: "attributes"
    } as unknown as MutationRecord
  ])
  animationFrameCallbacks.shift()?.()

  assert.equal(style.hasAttribute("type"), false)
  assert.equal(editableRefreshCount(), initialEditableRefreshCount + 1)

  style.remove()
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [style],
      target: shadowRoot,
      type: "childList"
    } as unknown as MutationRecord
  ])
  animationFrameCallbacks.shift()?.()

  assert.equal(
    shadowRoot.querySelector("style[data-fontara-editable-style]"),
    style
  )
  assert.equal(editableRefreshCount(), initialEditableRefreshCount + 2)
})

test("detached removals do not synchronously scan removed subtrees", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  const firstRemovedTree = new FakeElement("section")
  const secondRemovedTree = new FakeElement("section")
  firstRemovedTree.appendChild(new FakeElement("span"))
  secondRemovedTree.appendChild(new FakeElement("span"))
  body.appendChild(firstRemovedTree)
  body.appendChild(secondRemovedTree)
  documentElement.appendChild(body)

  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", () => 1)
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
  firstRemovedTree.querySelectorCalls.length = 0
  secondRemovedTree.querySelectorCalls.length = 0
  firstRemovedTree.remove()
  secondRemovedTree.remove()

  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [firstRemovedTree, secondRemovedTree],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])

  assert.equal(firstRemovedTree.querySelectorCalls.includes("*"), false)
  assert.equal(secondRemovedTree.querySelectorCalls.includes("*"), false)
})

test("stopping observation cancels queued DOM processing", () => {
  const documentElement = new FakeElement("html")
  const body = new FakeElement("body")
  documentElement.appendChild(body)

  const animationFrameCallbacks: Array<() => void> = []
  Reflect.set(globalThis, "Node", FakeNode)
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
  Reflect.set(globalThis, "document", {
    body,
    documentElement,
    querySelectorAll: () => []
  })
  const { runImmediateTasks } = installWindowMock()
  Reflect.set(globalThis, "requestAnimationFrame", (callback: () => void) => {
    animationFrameCallbacks.push(callback)
    return animationFrameCallbacks.length
  })
  Reflect.set(globalThis, "cancelAnimationFrame", () => {})

  startObserving()
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)

  const lateInput = new FakeElement("input")
  body.appendChild(lateInput)
  mutationObserver.trigger([
    {
      addedNodes: [lateInput],
      attributeName: null,
      removedNodes: [],
      target: body,
      type: "childList"
    } as unknown as MutationRecord
  ])
  animationFrameCallbacks.shift()?.()

  stopObserving()
  runImmediateTasks()

  assert.equal(lateInput.style.getPropertyValue("font-family"), "")
})
