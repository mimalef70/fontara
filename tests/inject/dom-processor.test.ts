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
  shadowRoot: FakeShadowRoot | null = null
  styleProperties = new Map<string, { priority: string; value: string }>()
  style = {
    setProperty: (name: string, value: string, priority = "") => {
      this.styleProperties.set(name, { priority, value })
    }
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

  getStyleProperty(propertyName: string): string {
    return this.styleProperties.get(propertyName)?.value ?? ""
  }
}

class FakeShadowRoot {
  children: FakeElement[] = []

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    return child
  }

  querySelectorAll(): FakeElement[] {
    return this.children
  }
}

function createTextElement(tagName: string, text: string): FakeElement {
  const element = new FakeElement(tagName)
  element.childNodes.push({ nodeType: 3, textContent: text })
  element.textContent = text
  return element
}

type ScheduledIdleTask = {
  callback: (deadline: IdleDeadline) => void
  id: number
  options?: IdleRequestOptions
}

type ScheduledTimeoutTask = {
  callback: () => void
  id: number
}

function setupDomProcessorGlobals(): {
  idleTasks: ScheduledIdleTask[]
  readEvents: string[]
  timeoutTasks: ScheduledTimeoutTask[]
} {
  const idleTasks: ScheduledIdleTask[] = []
  const readEvents: string[] = []
  const timeoutTasks: ScheduledTimeoutTask[] = []
  let nextTaskId = 1

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
    cancelIdleCallback(callbackId: number) {
      const index = idleTasks.findIndex((task) => task.id === callbackId)
      if (index >= 0) idleTasks.splice(index, 1)
    },
    clearTimeout(timeoutId: number) {
      const index = timeoutTasks.findIndex((task) => task.id === timeoutId)
      if (index >= 0) timeoutTasks.splice(index, 1)
    },
    getComputedStyle(element: FakeElement) {
      readEvents.push(element.textContent)
      return {
        fontFamily:
          element.getAttribute("data-font-kind") === "icon"
            ? '"Font Awesome 6 Free"'
            : element.getAttribute("data-font-kind") === "material-text"
              ? '"Material Sans", system-ui'
              : "system-ui, sans-serif"
      }
    },
    requestIdleCallback(
      callback: (deadline: IdleDeadline) => void,
      options?: IdleRequestOptions
    ) {
      const id = nextTaskId
      nextTaskId += 1
      idleTasks.push({ callback, id, options })
      return id
    },
    setTimeout(callback: () => void) {
      const id = nextTaskId
      nextTaskId += 1
      timeoutTasks.push({ callback, id })
      return id
    }
  })

  return { idleTasks, readEvents, timeoutTasks }
}

afterEach(async () => {
  const { resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()
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
    childInsideStyledWrapper,
    styledWrapper,
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

function countAppliedFontStyles(elements: FakeElement[]): number {
  return elements.filter((element) =>
    element.getStyleProperty("font-family").includes("var(--fontara-font)")
  ).length
}

function timeoutDeadline(): IdleDeadline {
  return {
    didTimeout: true,
    timeRemaining: () => 0
  }
}

test("large existing DOM applies progressively even when idle callbacks time out", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const textElements = Array.from({ length: 450 }, (_, index) =>
    root.appendChild(createTextElement("p", `text ${index}`))
  )

  applyFontToTreeChunked(root as unknown as HTMLElement)

  assert.equal(timeoutTasks.length, 1)
  assert.equal(idleTasks.length, 0)
  timeoutTasks.shift()?.callback()

  const firstAppliedCount = countAppliedFontStyles(textElements)
  assert.ok(firstAppliedCount > 0)
  assert.ok(firstAppliedCount < textElements.length)
  assert.equal(root.getStyleProperty("font-family"), "")
  assert.equal(idleTasks.length, 1)
  assert.ok((idleTasks[0]?.options?.timeout ?? 0) > 0)

  const beforeTimedOutSlice = countAppliedFontStyles(textElements)
  idleTasks.shift()?.callback(timeoutDeadline())
  const afterTimedOutSlice = countAppliedFontStyles(textElements)
  assert.ok(afterTimedOutSlice - beforeTimedOutSlice > 1)
  assert.ok(afterTimedOutSlice - beforeTimedOutSlice <= 200)

  let safety = 20
  while (idleTasks.length > 0 && safety > 0) {
    safety -= 1
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0)
  assert.equal(countAppliedFontStyles(textElements), textElements.length)
  assert.equal(
    textElements[0]?.getStyleProperty("font-family"),
    "var(--fontara-font), system-ui, sans-serif"
  )
  assert.equal(
    textElements[0]?.styleProperties.get("font-family")?.priority,
    "important"
  )
})

test("reset cancels queued traversal and stale callbacks cannot restore styles", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const textElement = root.appendChild(createTextElement("p", "stale text"))

  applyFontToTreeChunked(root as unknown as HTMLElement)
  const staleCallback = timeoutTasks[0]?.callback
  assert.ok(staleCallback)

  resetProcessedElements()
  assert.equal(timeoutTasks.length, 0)
  staleCallback()

  assert.equal(textElement.getStyleProperty("font-family"), "")
  assert.equal(idleTasks.length, 0)
  assert.equal(timeoutTasks.length, 0)
})

test("progressive batches read descendants before writing their ancestors", async () => {
  const { idleTasks, readEvents, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const parent = root.appendChild(createTextElement("div", "parent text"))
  const descendants = Array.from({ length: 260 }, (_, index) =>
    parent.appendChild(createTextElement("span", `child ${index}`))
  )

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()

  assert.ok(countAppliedFontStyles(descendants) > 0)
  assert.ok(countAppliedFontStyles(descendants) < descendants.length)
  assert.equal(parent.getStyleProperty("font-family"), "")
  assert.equal(readEvents.includes("parent text"), false)

  while (idleTasks.length > 0) {
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.equal(
    parent.getStyleProperty("font-family").includes("FontAraGoogle"),
    false
  )
  assert.equal(
    parent.getStyleProperty("font-family"),
    "var(--fontara-font), system-ui, sans-serif"
  )
})

test("lazy traversal applies nested open shadow roots without a synchronous pre-scan", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const host = root.appendChild(new FakeElement("fontara-shell"))
  const firstShadowRoot = new FakeShadowRoot()
  const nestedHost = firstShadowRoot.appendChild(
    new FakeElement("nested-shell")
  )
  const nestedShadowRoot = new FakeShadowRoot()
  const shadowText = nestedShadowRoot.appendChild(
    createTextElement("span", "nested shadow text")
  )
  host.shadowRoot = firstShadowRoot
  nestedHost.shadowRoot = nestedShadowRoot

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  while (idleTasks.length > 0) {
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.equal(
    shadowText.getStyleProperty("font-family"),
    "var(--fontara-font), system-ui, sans-serif"
  )
})
