import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { removeStyle, upsertStyle } from "../../src/inject/style-utils"

const ORIGINAL_GLOBALS = [
  "document",
  "HTMLElement",
  "HTMLStyleElement",
  "MutationObserver"
].map((key) => ({
  exists: key in globalThis,
  key,
  value: Reflect.get(globalThis, key)
}))

const TEST_STYLE_IDS = [
  "fontara-custom-css",
  "fontara-dynamic-font",
  "fontara-resilient-style"
]

class FakeElement {
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  id = ""
  appendCount = 0
  parentElement: FakeElement | null = null
  tagName: string
  textContent = ""

  constructor(public localName: string) {
    this.tagName = localName.toUpperCase()
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.remove()
    child.parentElement = this
    this.children.push(child)
    this.appendCount += 1
    return child
  }

  contains(candidate: FakeElement | null): boolean {
    if (!candidate) return false
    if (candidate === this) return true
    return this.children.some((child) => child.contains(candidate))
  }

  getAttribute(attribute: string): string | null {
    return this.attributes.get(attribute) ?? null
  }

  remove(): void {
    if (!this.parentElement) return

    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this
    )
    this.parentElement = null
  }

  removeAttribute(attribute: string): void {
    this.attributes.delete(attribute)
  }

  setAttribute(attribute: string, value: string): void {
    this.attributes.set(attribute, value)
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = []

  disconnectCount = 0
  observations: Array<{
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
  for (const id of TEST_STYLE_IDS) removeStyle(id)
  FakeMutationObserver.instances = []

  for (const { exists, key, value } of ORIGINAL_GLOBALS) {
    if (exists) {
      Reflect.set(globalThis, key, value)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
})

function installStyleDom(): {
  body: FakeElement
  documentElement: FakeElement
  documentValue: {
    body: FakeElement
    documentElement: FakeElement
    head: FakeElement
  }
  head: FakeElement
} {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  const documentValue = {
    body,
    createElement(tagName: string) {
      return new FakeElement(tagName)
    },
    documentElement,
    getElementById(id: string) {
      return findFirstElement(documentElement, (element) => element.id === id)
    },
    head,
    querySelectorAll(selector: string) {
      if (selector !== 'style[data-fontara-style="true"]') return []

      return findAllElements(
        documentElement,
        (element) =>
          element.localName === "style" &&
          element.getAttribute("data-fontara-style") === "true"
      )
    }
  }
  Reflect.set(globalThis, "document", documentValue)

  return { body, documentElement, documentValue, head }
}

function findFirstElement(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
  if (predicate(root)) return root

  for (const child of root.children) {
    const match = findFirstElement(child, predicate)
    if (match) return match
  }

  return null
}

function findAllElements(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement[] {
  const matches = predicate(root) ? [root] : []

  for (const child of root.children) {
    matches.push(...findAllElements(child, predicate))
  }

  return matches
}

test("upsertStyle ignores page-owned elements that reuse a FontARA id", () => {
  const { head } = installStyleDom()
  const pageOwnedStyle = new FakeElement("style")
  pageOwnedStyle.id = "fontara-dynamic-font"
  pageOwnedStyle.textContent = "body { color: red; }"
  head.appendChild(pageOwnedStyle)

  const styleElement = upsertStyle("fontara-dynamic-font", ".fontara { }")

  assert.notEqual(styleElement, pageOwnedStyle)
  assert.equal(pageOwnedStyle.textContent, "body { color: red; }")
  assert.equal(styleElement.textContent, ".fontara { }")
  assert.equal(styleElement.getAttribute("data-fontara-style"), "true")
  assert.equal(
    styleElement.getAttribute("data-fontara-style-id"),
    "fontara-dynamic-font"
  )

  const updatedStyleElement = upsertStyle(
    "fontara-dynamic-font",
    ".fontara { color: blue; }"
  )

  assert.equal(updatedStyleElement, styleElement)
  assert.equal(pageOwnedStyle.textContent, "body { color: red; }")
  assert.equal(styleElement.textContent, ".fontara { color: blue; }")

  removeStyle("fontara-dynamic-font")

  assert.equal(head.children.includes(pageOwnedStyle), true)
  assert.equal(
    head.children.includes(styleElement as unknown as FakeElement),
    false
  )
})

test("removeStyle ignores page-owned elements without a FontARA marker", () => {
  const { head } = installStyleDom()
  const pageOwnedStyle = new FakeElement("style")
  pageOwnedStyle.id = "fontara-custom-css"
  pageOwnedStyle.textContent = "html { color-scheme: dark; }"
  head.appendChild(pageOwnedStyle)

  removeStyle("fontara-custom-css")

  assert.equal(head.children.includes(pageOwnedStyle), true)
  assert.equal(pageOwnedStyle.textContent, "html { color-scheme: dark; }")
})

test("owned styles self-heal once after coalesced removal and tampering", async () => {
  const { body, documentElement, documentValue, head } = installStyleDom()
  const styleElement = upsertStyle(
    "fontara-resilient-style",
    ":root { --fontara-font: Test; }"
  ) as unknown as FakeElement
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]

  assert.ok(mutationObserver)
  assert.equal(head.appendCount, 1)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) =>
        target === documentValue && options.childList && !options.subtree
    ),
    true
  )
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) =>
        target === documentElement && options.childList && !options.subtree
    ),
    true
  )
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) =>
        target === head && options.childList && !options.subtree
    ),
    true
  )
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) => target === styleElement && options.subtree
    ),
    true
  )

  body.appendChild(styleElement)
  styleElement.id = "page-overwrite"
  styleElement.setAttribute("data-fontara-style", "false")
  styleElement.textContent = "body { color: red; }"

  const mutation = {
    addedNodes: [],
    attributeName: "data-fontara-style",
    removedNodes: [],
    target: styleElement,
    type: "attributes"
  } as unknown as MutationRecord
  mutationObserver.trigger([mutation])
  mutationObserver.trigger([mutation])
  await Promise.resolve()

  assert.equal(styleElement.parentElement, head)
  assert.equal(styleElement.id, "fontara-resilient-style")
  assert.equal(styleElement.getAttribute("data-fontara-style"), "true")
  assert.equal(
    styleElement.getAttribute("data-fontara-style-id"),
    "fontara-resilient-style"
  )
  assert.equal(styleElement.textContent, ":root { --fontara-font: Test; }")
  assert.equal(head.appendCount, 2)
  assert.equal(mutationObserver.disconnectCount, 1)
})

test("owned styles move into a replacement head", async () => {
  const { documentElement, documentValue, head } = installStyleDom()
  const styleElement = upsertStyle(
    "fontara-resilient-style",
    ".fontara { font-family: Test; }"
  ) as unknown as FakeElement
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  const replacementHead = new FakeElement("head")

  assert.ok(mutationObserver)
  head.remove()
  documentElement.appendChild(replacementHead)
  documentValue.head = replacementHead

  mutationObserver.trigger([
    {
      addedNodes: [replacementHead],
      attributeName: null,
      removedNodes: [head],
      target: documentElement,
      type: "childList"
    } as unknown as MutationRecord
  ])
  await Promise.resolve()

  assert.equal(styleElement.parentElement, replacementHead)
  assert.equal(replacementHead.children.includes(styleElement), true)
})

test("owned styles survive a complete documentElement replacement", async () => {
  const { documentElement, documentValue } = installStyleDom()
  const styleElement = upsertStyle(
    "fontara-resilient-style",
    ".fontara { font-family: Test; }"
  ) as unknown as FakeElement
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]
  const replacementDocumentElement = new FakeElement("html")
  const replacementHead = new FakeElement("head")
  const replacementBody = new FakeElement("body")
  replacementDocumentElement.appendChild(replacementHead)
  replacementDocumentElement.appendChild(replacementBody)

  assert.ok(mutationObserver)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) =>
        target === documentValue && options.childList && !options.subtree
    ),
    true
  )

  documentValue.documentElement = replacementDocumentElement
  documentValue.head = replacementHead
  documentValue.body = replacementBody

  mutationObserver.trigger([
    {
      addedNodes: [replacementDocumentElement],
      attributeName: null,
      removedNodes: [documentElement],
      target: documentValue,
      type: "childList"
    } as unknown as MutationRecord
  ])
  await Promise.resolve()

  assert.equal(styleElement.parentElement, replacementHead)
  assert.equal(replacementHead.children.includes(styleElement), true)
  assert.equal(
    mutationObserver.observations.some(
      ({ options, target }) =>
        target === replacementDocumentElement &&
        options.childList &&
        !options.subtree
    ),
    true
  )
})

test("removeStyle retires expected CSS so a late mutation cannot restore it", async () => {
  const { head } = installStyleDom()
  const styleElement = upsertStyle(
    "fontara-resilient-style",
    ".fontara { font-family: Test; }"
  ) as unknown as FakeElement
  const mutationObserver =
    FakeMutationObserver.instances[FakeMutationObserver.instances.length - 1]

  assert.ok(mutationObserver)
  removeStyle("fontara-resilient-style")
  mutationObserver.trigger([
    {
      addedNodes: [],
      attributeName: null,
      removedNodes: [styleElement],
      target: head,
      type: "childList"
    } as unknown as MutationRecord
  ])
  await Promise.resolve()

  assert.equal(head.children.includes(styleElement), false)
  assert.equal(mutationObserver.disconnectCount, 1)
})
