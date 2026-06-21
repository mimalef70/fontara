import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { removeStyle, upsertStyle } from "../../src/inject/style-utils"

const ORIGINAL_GLOBALS = ["document", "HTMLElement", "HTMLStyleElement"].map(
  (key) => ({
    exists: key in globalThis,
    key,
    value: Reflect.get(globalThis, key)
  })
)

class FakeElement {
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  id = ""
  parentElement: FakeElement | null = null
  tagName: string
  textContent = ""

  constructor(public localName: string) {
    this.tagName = localName.toUpperCase()
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parentElement = this
    this.children.push(child)
    return child
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

  setAttribute(attribute: string, value: string): void {
    this.attributes.set(attribute, value)
  }
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

function installStyleDom(): { body: FakeElement; head: FakeElement } {
  const documentElement = new FakeElement("html")
  const head = new FakeElement("head")
  const body = new FakeElement("body")
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "document", {
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
  })

  return { body, head }
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
