import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { startObserving, stopObserving } from "../../src/inject/observer"

const GLOBAL_KEYS = [
  "cancelAnimationFrame",
  "document",
  "HTMLElement",
  "MutationObserver",
  "Node",
  "requestAnimationFrame",
  "ShadowRoot"
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
  parentElement: FakeElement | null = null
}

class FakeShadowRoot extends FakeNode {
  readonly children: FakeElement[] = []

  constructor(readonly host: FakeElement) {
    super()
  }

  querySelectorAll(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()])
  }
}

class FakeElement extends FakeNode {
  readonly attributes = new Map<string, string>()
  readonly children: FakeElement[] = []
  isContentEditable = false
  shadowRoot: FakeShadowRoot | null = null

  constructor(readonly localName: string) {
    super()
  }

  get tagName(): string {
    return this.localName.toUpperCase()
  }

  appendChild(child: FakeElement): void {
    child.parentElement?.removeChild(child)
    child.parentElement = this
    child.isConnected = this.isConnected
    this.children.push(child)
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

  querySelectorAll(selector: string): FakeElement[] {
    return selector === "*" ? this.descendants() : []
  }

  removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parentElement = null
    child.isConnected = false
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

afterEach(() => {
  stopObserving()
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
  Reflect.set(globalThis, "requestAnimationFrame", () => {
    animationFrameCalls += 1
    return animationFrameCalls
  })
  Reflect.set(globalThis, "cancelAnimationFrame", (frame: number) => {
    cancelledFrame = frame
  })

  startObserving()

  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  assert.ok(mutationObserver)
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

  assert.equal(animationFrameCalls, 1)
  assert.equal(mutationObserver.disconnectCount, 1)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) => target === replacementBody && options.subtree
    ),
    true
  )
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) => target === shadowRoot && options.subtree
    ),
    true
  )

  stopObserving()
  assert.equal(cancelledFrame, 1)
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
