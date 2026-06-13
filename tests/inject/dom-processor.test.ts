import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

const originalGlobals = {
  document: Reflect.get(globalThis, "document") as unknown,
  HTMLElement: Reflect.get(globalThis, "HTMLElement") as unknown,
  Node: Reflect.get(globalThis, "Node") as unknown,
  NodeFilter: Reflect.get(globalThis, "NodeFilter") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

class FakeElement {
  attributes = new Map<string, string>()
  childNodes: Array<{ nodeType: number; textContent?: string | null }> = []
  children: FakeElement[] = []
  classList = new Set<string>()
  isConnected = true
  isContentEditable = false
  parentElement: FakeElement | null = null
  style = {
    setProperty() {}
  }
  tagName: string
  textContent = ""

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this
    this.children.push(child)
    return child
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
}

function createTextElement(tagName: string, text: string): FakeElement {
  const element = new FakeElement(tagName)
  element.childNodes.push({ nodeType: 3, textContent: text })
  element.textContent = text
  return element
}

function setupDomProcessorGlobals(): void {
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "Node", { TEXT_NODE: 3 })
  Reflect.set(globalThis, "NodeFilter", {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ELEMENT: 1
  })
  Reflect.set(globalThis, "document", {
    createTreeWalker(
      root: FakeElement,
      _whatToShow: number,
      filter: { acceptNode: (node: FakeElement) => number }
    ) {
      const acceptedNodes: FakeElement[] = []

      function visit(node: FakeElement): void {
        for (const child of node.children) {
          const result = filter.acceptNode(child)
          if (result === 2) continue
          if (result === 1) acceptedNodes.push(child)
          visit(child)
        }
      }

      visit(root)

      return {
        nextNode() {
          return acceptedNodes.shift() ?? null
        }
      }
    }
  })
  Reflect.set(globalThis, "window", {
    getComputedStyle(element: FakeElement) {
      return {
        fontFamily:
          element.getAttribute("data-font-kind") === "icon"
            ? '"Font Awesome 6 Free"'
            : element.getAttribute("data-font-kind") === "material-text"
              ? '"Material Sans", system-ui'
              : "system-ui, sans-serif"
      }
    }
  })
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }
})

test("font work skips code, icon, aria-hidden, and inline font targets", async () => {
  setupDomProcessorGlobals()
  const { collectFontWork } = await import("../../src/inject/dom-processor")
  const root = new FakeElement("main")
  const visibleText = root.appendChild(createTextElement("p", "visible text"))
  const childInsideStyledWrapper = createTextElement("span", "nested text")
  const styledWrapper = root.appendChild(
    createTextElement("div", "styled text")
  )
  const codeElement = root.appendChild(createTextElement("code", "code text"))
  const preElement = root.appendChild(new FakeElement("pre"))
  const ariaHiddenElement = root.appendChild(
    createTextElement("span", "hidden text")
  )
  const iconPrefixElement = root.appendChild(
    createTextElement("span", "prefix icon")
  )
  const iconSubstringElement = root.appendChild(
    createTextElement("span", "substring icon")
  )
  const iconFontElement = root.appendChild(
    createTextElement("span", "icon font")
  )
  const materialTextElement = root.appendChild(
    createTextElement("span", "material text")
  )
  const fontFamilyElement = root.appendChild(
    createTextElement("span", "inline font family")
  )
  const fontShorthandElement = root.appendChild(
    createTextElement("span", "inline font shorthand")
  )
  const fontWeightElement = root.appendChild(
    createTextElement("span", "inline font weight")
  )

  styledWrapper.setAttribute("style", "font-size: 16px")
  styledWrapper.appendChild(childInsideStyledWrapper)
  preElement.appendChild(createTextElement("span", "pre text"))
  ariaHiddenElement.setAttribute("aria-hidden", "true")
  iconPrefixElement.classList.add("fa-user")
  iconSubstringElement.classList.add("buttonIcon")
  iconFontElement.setAttribute("data-font-kind", "icon")
  materialTextElement.setAttribute("data-font-kind", "material-text")
  fontFamilyElement.setAttribute("style", "font-family: Arial, sans-serif")
  fontShorthandElement.setAttribute("style", "font: 16px Arial")
  fontWeightElement.setAttribute("style", "font-weight: 700")

  const work = collectFontWork(root as unknown as HTMLElement)
  const expectedNodes = [
    visibleText,
    styledWrapper,
    childInsideStyledWrapper,
    materialTextElement,
    fontWeightElement
  ] as unknown as HTMLElement[]
  const styledWrapperNode = styledWrapper as unknown as HTMLElement
  const codeElementNode = codeElement as unknown as HTMLElement
  const fontFamilyNode = fontFamilyElement as unknown as HTMLElement
  const fontShorthandNode = fontShorthandElement as unknown as HTMLElement

  assert.deepEqual(
    work.map((item) => item.node),
    expectedNodes
  )
  assert.equal(work[0]?.fallbackFontFamily, "system-ui, sans-serif")
  assert.equal(
    work.some((item) => item.node === styledWrapperNode),
    true
  )
  assert.equal(
    work.some((item) => item.node === codeElementNode),
    false
  )
  assert.equal(
    work.some((item) => item.node === fontFamilyNode),
    false
  )
  assert.equal(
    work.some((item) => item.node === fontShorthandNode),
    false
  )
})
