import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

const originalGlobals = {
  document: Reflect.get(globalThis, "document") as unknown,
  HTMLElement: Reflect.get(globalThis, "HTMLElement") as unknown,
  Node: Reflect.get(globalThis, "Node") as unknown,
  NodeFilter: Reflect.get(globalThis, "NodeFilter") as unknown,
  ShadowRoot: Reflect.get(globalThis, "ShadowRoot") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

class FakeElement {
  attributes = new Map<string, string>()
  childNodes: Array<{ nodeType: number; textContent?: string | null }> = []
  children: FakeElement[] = []
  classList = new Set<string>()
  isConnected = true
  isContentEditable = false
  ownerDocument: object | null = null
  parentElement: FakeElement | null = null
  shadowRoot: FakeShadowRoot | null = null
  styleProperties = new Map<string, { priority: string; value: string }>()
  style: {
    getPropertyValue: (name: string) => string
    length: number
    removeProperty: (name: string) => string
    setProperty: (name: string, value: string, priority?: string) => void
  } = {
    getPropertyValue: (name: string) =>
      this.styleProperties.get(name)?.value ?? "",
    length: 0,
    removeProperty: (name: string) => {
      const previousValue = this.styleProperties.get(name)?.value ?? ""
      this.styleProperties.delete(name)
      this.style.length = this.styleProperties.size
      return previousValue
    },
    setProperty: (name: string, value: string, priority = "") => {
      this.styleProperties.set(name, { priority, value })
      this.style.length = this.styleProperties.size
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

  removeAttribute(attributeName: string): void {
    this.attributes.delete(attributeName)
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

  constructor(readonly host?: FakeElement) {}

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
  delay: number
  id: number
}

type DomProcessorSetupOptions = {
  getFontFamily?: (element: FakeElement) => string
  requestIdleCallback?: boolean
}

function setupDomProcessorGlobals(options: DomProcessorSetupOptions = {}): {
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
  Reflect.set(globalThis, "ShadowRoot", FakeShadowRoot)
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
        fontFamily: options.getFontFamily
          ? options.getFontFamily(element)
          : element.getAttribute("data-font-kind") === "icon"
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
    setTimeout(callback: () => void, delay = 0) {
      const id = nextTaskId
      nextTaskId += 1
      timeoutTasks.push({ callback, delay, id })
      return id
    }
  })

  if (options.requestIdleCallback === false) {
    Reflect.deleteProperty(
      Reflect.get(globalThis, "window"),
      "requestIdleCallback"
    )
  }

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

test("active system font is removed only from inherited FontARA fallbacks", async () => {
  setupDomProcessorGlobals({
    getFontFamily: (element) =>
      element.getAttribute("data-computed-font") ?? "Georgia, serif"
  })
  const {
    collectFontWork,
    resetProcessedElements,
    setActiveFontFamilyForProcessing,
    writeFontWorkBatch
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()
  setActiveFontFamilyForProcessing("system-ui")

  const ownedParent = createTextElement("section", "existing parent text")
  ownedParent.setAttribute("data-computed-font", "Georgia, serif")
  writeFontWorkBatch(collectFontWork(ownedParent as unknown as HTMLElement))

  const inheritedChild = ownedParent.appendChild(
    createTextElement("span", "dynamic inherited text")
  )
  inheritedChild.setAttribute("data-computed-font", "system-ui, Georgia, serif")
  const siteOwnedText = createTextElement("p", "site-owned system text")
  siteOwnedText.setAttribute("data-computed-font", "system-ui, Georgia, serif")

  assert.equal(
    collectFontWork(inheritedChild as unknown as HTMLElement)[0]
      ?.fallbackFontFamily,
    "Georgia, serif"
  )
  assert.equal(
    collectFontWork(siteOwnedText as unknown as HTMLElement)[0]
      ?.fallbackFontFamily,
    "system-ui, Georgia, serif"
  )

  setActiveFontFamilyForProcessing(null)
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

test("mid-flight reconciliation reruns an exact root after its active traversal", async () => {
  let computedFontFamily = "OldFont, serif"
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals({
    getFontFamily: () => computedFontFamily
  })
  const {
    applyFontToTreeChunked,
    reconcileFontTreesChunked,
    resetProcessedElements
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const root = new FakeElement("main")
  const textElements = Array.from({ length: 450 }, (_, index) =>
    root.appendChild(createTextElement("p", `reconciled text ${index}`))
  )

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()

  const partiallyAppliedCount = textElements.filter(
    (element) =>
      element.getStyleProperty("font-family") ===
      "var(--fontara-font), OldFont, serif"
  ).length
  assert.ok(partiallyAppliedCount > 0)
  assert.ok(partiallyAppliedCount < textElements.length)

  computedFontFamily = "NewFont, serif"
  reconcileFontTreesChunked([root as unknown as HTMLElement])

  let safety = 50
  while ((idleTasks.length > 0 || timeoutTasks.length > 0) && safety > 0) {
    safety -= 1
    if (timeoutTasks.length > 0) timeoutTasks.shift()?.callback()
    else idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0, "The post-mutation reconciliation did not settle.")
  assert.equal(
    textElements.filter(
      (element) =>
        element.getStyleProperty("font-family") ===
        "var(--fontara-font), NewFont, serif"
    ).length,
    textElements.length
  )
  assert.equal(
    textElements.some((element) =>
      element.getStyleProperty("font-family").includes("OldFont")
    ),
    false
  )
})

test("reconciliation reclaims cloned FontARA declarations without ownership state", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals({
    getFontFamily: () => "SiteFont, serif"
  })
  const {
    reconcileFontTreesChunked,
    releaseOwnedFont,
    resetProcessedElements
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const clonedBody = new FakeElement("body")
  const clonedText = clonedBody.appendChild(
    createTextElement("p", "text copied by a body clone")
  )
  clonedText.setAttribute(
    "style",
    "font-family: var(--fontara-font), OldFont, serif !important"
  )
  clonedText.style.setProperty(
    "font-family",
    "var(--fontara-font), OldFont, serif",
    "important"
  )

  reconcileFontTreesChunked([clonedBody as unknown as HTMLElement])
  timeoutTasks.shift()?.callback()
  while (idleTasks.length > 0) {
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.equal(
    clonedText.getStyleProperty("font-family"),
    "var(--fontara-font), SiteFont, serif"
  )

  releaseOwnedFont(clonedText as unknown as HTMLElement)
  assert.equal(
    clonedText.getStyleProperty("font-family"),
    "",
    "The reconciled clone should be tracked as FontARA-owned."
  )
})

test("ordinary traversal reclaims an orphaned FontARA marker after reinsertion", async () => {
  let computedFontFamily = "OldSiteFont, serif"
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals({
    getFontFamily: () => computedFontFamily
  })
  const {
    applyFontToTreeChunked,
    collectFontWork,
    resetProcessedElements,
    writeFontWorkBatch
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const reinsertedText = createTextElement("p", "reinserted text")
  writeFontWorkBatch(collectFontWork(reinsertedText as unknown as HTMLElement))
  // CSSStyleDeclaration writes update the style attribute in a browser. Keep
  // the test double explicit so this remains a durable clone/reinsert marker.
  reinsertedText.setAttribute(
    "style",
    "font-family: var(--fontara-font), OldSiteFont, serif !important"
  )

  // Simulate teardown losing the WeakMap ownership record while a detached
  // framework node keeps the copied inline declaration and is later reinserted.
  resetProcessedElements()
  computedFontFamily = "NewSiteFont, serif"
  applyFontToTreeChunked(reinsertedText as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  while (idleTasks.length > 0) {
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.equal(
    reinsertedText.getStyleProperty("font-family"),
    "var(--fontara-font), NewSiteFont, serif"
  )
})

test("orphaned inline markers are removed progressively without crossing disabled shadow scope", async () => {
  const { timeoutTasks } = setupDomProcessorGlobals()
  const { removeOrphanedFontaraInlineStyles, resetProcessedElements } =
    await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const body = new FakeElement("body")
  const lightText = Array.from({ length: 450 }, (_, index) => {
    const element = body.appendChild(
      createTextElement("p", `orphaned light text ${index}`)
    )
    element.style.setProperty(
      "font-family",
      "var(--fontara-font), OldSiteFont, serif",
      "important"
    )
    return element
  })
  const host = body.appendChild(new FakeElement("fontara-shell"))
  const shadowRoot = new FakeShadowRoot(host)
  const shadowText = shadowRoot.appendChild(
    createTextElement("p", "orphaned shadow text")
  )
  shadowText.style.setProperty(
    "font-family",
    "var(--fontara-font), ShadowSiteFont, serif",
    "important"
  )
  host.shadowRoot = shadowRoot
  Reflect.set(Reflect.get(globalThis, "document"), "body", body)

  removeOrphanedFontaraInlineStyles({ includeShadowRoots: false })

  const removedImmediately = lightText.filter(
    (element) => element.getStyleProperty("font-family") === ""
  ).length
  assert.ok(removedImmediately > 0)
  assert.ok(removedImmediately < lightText.length)
  assert.equal(
    shadowText.getStyleProperty("font-family"),
    "var(--fontara-font), ShadowSiteFont, serif"
  )

  let safety = 20
  while (timeoutTasks.length > 0 && safety > 0) {
    safety -= 1
    timeoutTasks.shift()?.callback()
  }

  assert.ok(safety > 0)
  assert.equal(
    lightText.every(
      (element) => element.getStyleProperty("font-family") === ""
    ),
    true
  )
  assert.equal(
    shadowText.getStyleProperty("font-family"),
    "var(--fontara-font), ShadowSiteFont, serif"
  )
})

test("a disconnected in-flight root is dropped before another traversal slice", async () => {
  const { idleTasks, readEvents, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  for (let index = 0; index < 450; index += 1) {
    root.appendChild(createTextElement("p", `detached text ${index}`))
  }

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  assert.ok(readEvents.length > 0)
  assert.equal(idleTasks.length, 1)

  const readsBeforeDetach = readEvents.length
  root.isConnected = false
  idleTasks.shift()?.callback(timeoutDeadline())

  assert.equal(readEvents.length, readsBeforeDetach)
  assert.equal(idleTasks.length, 0)
})

test("adoption into another document shields owned styles from stale reconciliation and cleanup", async () => {
  const { readEvents, timeoutTasks } = setupDomProcessorGlobals()
  const {
    collectFontWork,
    reconcileFontTreesChunked,
    removeAllOwnedFontStyles,
    resetProcessedElements,
    writeFontWorkBatch
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const textElement = createTextElement("p", "adopted owned text")
  writeFontWorkBatch(collectFontWork(textElement as unknown as HTMLElement))
  textElement.setAttribute(
    "style",
    "font-family: var(--fontara-font), system-ui, sans-serif !important"
  )
  const targetOwnedValue = textElement.getStyleProperty("font-family")
  const readsBeforeAdoption = readEvents.length

  reconcileFontTreesChunked([textElement as unknown as HTMLElement])
  const staleReconciliation = timeoutTasks.shift()?.callback
  assert.ok(staleReconciliation)

  // The target document may run its own FontARA instance and intentionally
  // retain the exact same declaration. Source ownership must be rejected by
  // document identity rather than inferred from isConnected or style value.
  textElement.ownerDocument = {}
  textElement.isConnected = true
  textElement.style.setProperty("font-family", targetOwnedValue, "important")

  staleReconciliation()
  removeAllOwnedFontStyles()

  assert.equal(textElement.getStyleProperty("font-family"), targetOwnedValue)
  assert.equal(
    textElement.getAttribute("style"),
    "font-family: var(--fontara-font), system-ui, sans-serif !important"
  )
  assert.equal(readEvents.length, readsBeforeAdoption)
  assert.equal(timeoutTasks.length, 0)
})

test("an owned removal stays recognizable until its later-slice rewrite", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals({
    getFontFamily: () => "SiteFont, serif"
  })
  const {
    collectFontWork,
    isOwnedFontStyleMutation,
    reconcileFontTreesChunked,
    resetProcessedElements,
    writeFontWorkBatch
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const root = createTextElement("main", "root text")
  for (let index = 0; index < 450; index += 1) {
    root.appendChild(createTextElement("p", `descendant ${index}`))
  }
  writeFontWorkBatch(collectFontWork(root as unknown as HTMLElement))
  root.setAttribute(
    "style",
    "font-family: var(--fontara-font), SiteFont, serif !important"
  )

  reconcileFontTreesChunked([root as unknown as HTMLElement])
  timeoutTasks.shift()?.callback()

  assert.equal(root.getStyleProperty("font-family"), "")
  assert.equal(
    isOwnedFontStyleMutation(root as unknown as HTMLElement, "style"),
    true,
    "The observer must ignore FontARA's own progressive removal."
  )

  let safety = 30
  while (idleTasks.length > 0 && safety > 0) {
    safety -= 1
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0)
  assert.equal(
    root.getStyleProperty("font-family"),
    "var(--fontara-font), SiteFont, serif"
  )
})

test("a page rewrite after an owned removal is never mistaken for FontARA", async () => {
  setupDomProcessorGlobals({ getFontFamily: () => "SiteFont, serif" })
  const {
    collectFontWork,
    isOwnedFontStyleMutation,
    releaseOwnedFont,
    resetProcessedElements,
    writeFontWorkBatch
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const text = createTextElement("p", "page-restyled text")
  writeFontWorkBatch(collectFontWork(text as unknown as HTMLElement))
  text.setAttribute(
    "style",
    "font-family: var(--fontara-font), SiteFont, serif !important"
  )
  releaseOwnedFont(text as unknown as HTMLElement)

  text.style.setProperty("font-family", "PageFont, serif", "important")
  text.setAttribute("style", "font-family: PageFont, serif !important")

  assert.equal(
    isOwnedFontStyleMutation(text as unknown as HTMLElement, "style"),
    false
  )
})

test("multiple roots share the first slice so small updates are not starved", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreesChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const largeRoot = new FakeElement("main")
  const largeTextElements = Array.from({ length: 450 }, (_, index) =>
    largeRoot.appendChild(createTextElement("p", `large text ${index}`))
  )
  const smallRoot = new FakeElement("aside")
  const smallTextElement = smallRoot.appendChild(
    createTextElement("p", "urgent small update")
  )

  applyFontToTreesChunked([
    largeRoot as unknown as HTMLElement,
    smallRoot as unknown as HTMLElement
  ])
  timeoutTasks.shift()?.callback()

  assert.equal(
    smallTextElement
      .getStyleProperty("font-family")
      .includes("var(--fontara-font)"),
    true
  )
  assert.ok(countAppliedFontStyles(largeTextElements) > 0)
  assert.ok(
    countAppliedFontStyles(largeTextElements) < largeTextElements.length
  )
  assert.equal(idleTasks.length, 1)
})

test("a traversal slice does not scan every queued root for bookkeeping", async () => {
  const { timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreesChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const roots = Array.from({ length: 1_000 }, (_, index) =>
    createTextElement("p", `independent root ${index}`)
  )
  const originalFlatMap = Array.prototype.flatMap
  const flatMapInputLengths: number[] = []

  Reflect.set(
    Array.prototype,
    "flatMap",
    function instrumentedFlatMap(
      this: unknown[],
      callback: (...args: unknown[]) => unknown,
      thisArg?: unknown
    ): unknown[] {
      flatMapInputLengths.push(this.length)
      return Reflect.apply(originalFlatMap, this, [
        callback,
        thisArg
      ]) as unknown[]
    }
  )

  try {
    applyFontToTreesChunked(roots as unknown as HTMLElement[])
    // Enqueueing may transform the caller's root array once. Only measure the
    // scheduled processing slice, where a full queue scan becomes quadratic.
    flatMapInputLengths.length = 0
    timeoutTasks.shift()?.callback()

    assert.equal(
      flatMapInputLengths.some((length) => length >= roots.length),
      false,
      "A bounded slice must not flat-map the complete pending-root queue."
    )
  } finally {
    Reflect.set(Array.prototype, "flatMap", originalFlatMap)
    resetProcessedElements()
  }
})

test("timeout fallback completes progressive work without requestIdleCallback", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals({
    requestIdleCallback: false
  })
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const textElements = Array.from({ length: 450 }, (_, index) =>
    root.appendChild(createTextElement("p", `fallback text ${index}`))
  )

  applyFontToTreeChunked(root as unknown as HTMLElement)
  assert.equal(timeoutTasks[0]?.delay, 0)
  timeoutTasks.shift()?.callback()
  assert.ok(countAppliedFontStyles(textElements) > 0)
  assert.ok(countAppliedFontStyles(textElements) < textElements.length)
  assert.equal(idleTasks.length, 0)
  assert.equal(timeoutTasks[0]?.delay, 16)

  let safety = 20
  while (timeoutTasks.length > 0 && safety > 0) {
    safety -= 1
    timeoutTasks.shift()?.callback()
  }

  assert.ok(safety > 0)
  assert.equal(countAppliedFontStyles(textElements), textElements.length)
  assert.equal(idleTasks.length, 0)
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

test("reset after partial progress rejects stale idle work and permits a fresh traversal", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const root = new FakeElement("main")
  const textElements = Array.from({ length: 450 }, (_, index) =>
    root.appendChild(createTextElement("p", `restart text ${index}`))
  )

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  const partiallyAppliedCount = countAppliedFontStyles(textElements)
  assert.ok(partiallyAppliedCount > 0)
  assert.ok(partiallyAppliedCount < textElements.length)

  const staleIdleCallback = idleTasks.shift()?.callback
  assert.ok(staleIdleCallback)
  resetProcessedElements()
  staleIdleCallback(timeoutDeadline())
  assert.equal(countAppliedFontStyles(textElements), partiallyAppliedCount)
  assert.equal(idleTasks.length, 0)

  applyFontToTreeChunked(root as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  let safety = 20
  while (idleTasks.length > 0 && safety > 0) {
    safety -= 1
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0)
  assert.equal(countAppliedFontStyles(textElements), textElements.length)
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

test("direct shadow-root work respects contenteditable and aria-hidden hosts", async () => {
  const { idleTasks, readEvents, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreesChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const editableHost = new FakeElement("fontara-editor")
  editableHost.setAttribute("contenteditable", "true")
  const editableRoot = new FakeShadowRoot(editableHost)
  const editableText = editableRoot.appendChild(
    createTextElement("span", "editor shadow text")
  )
  editableHost.shadowRoot = editableRoot

  const hiddenHost = new FakeElement("fontara-hidden")
  hiddenHost.setAttribute("aria-hidden", "true")
  const hiddenRoot = new FakeShadowRoot(hiddenHost)
  const hiddenText = hiddenRoot.appendChild(
    createTextElement("span", "hidden shadow text")
  )
  hiddenHost.shadowRoot = hiddenRoot

  applyFontToTreesChunked([
    editableRoot as unknown as ShadowRoot,
    hiddenRoot as unknown as ShadowRoot
  ])

  let safety = 20
  while ((timeoutTasks.length > 0 || idleTasks.length > 0) && safety > 0) {
    safety -= 1
    if (timeoutTasks.length > 0) timeoutTasks.shift()?.callback()
    else idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0, "Excluded direct shadow-root work did not settle.")
  assert.equal(editableText.getStyleProperty("font-family"), "")
  assert.equal(hiddenText.getStyleProperty("font-family"), "")
  assert.equal(readEvents.includes("editor shadow text"), false)
  assert.equal(readEvents.includes("hidden shadow text"), false)
})

test("pre-start reconciliation rebuilds direct shadow-root host context", async () => {
  const { idleTasks, readEvents, timeoutTasks } = setupDomProcessorGlobals()
  const {
    applyFontToTreesChunked,
    reconcileFontTreesChunked,
    resetProcessedElements
  } = await import("../../src/inject/dom-processor")
  resetProcessedElements()

  const host = new FakeElement("fontara-late-hidden")
  const shadowRoot = new FakeShadowRoot(host)
  const shadowText = shadowRoot.appendChild(
    createTextElement("span", "pre-start hidden shadow text")
  )
  host.shadowRoot = shadowRoot

  applyFontToTreesChunked([shadowRoot as unknown as ShadowRoot])
  assert.equal(timeoutTasks.length, 1)

  host.setAttribute("aria-hidden", "true")
  reconcileFontTreesChunked([shadowRoot as unknown as ShadowRoot])

  let safety = 20
  while ((timeoutTasks.length > 0 || idleTasks.length > 0) && safety > 0) {
    safety -= 1
    if (timeoutTasks.length > 0) timeoutTasks.shift()?.callback()
    else idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.ok(safety > 0)
  assert.equal(shadowText.getStyleProperty("font-family"), "")
  assert.equal(readEvents.includes("pre-start hidden shadow text"), false)
})

test("lazy traversal registers every entered open shadow root for cleanup", async () => {
  const { idleTasks, timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  const { getKnownOpenShadowRoots } = await import(
    "../../src/inject/shadow-roots"
  )
  resetProcessedElements()

  const host = new FakeElement("fontara-shell")
  const shadowRoot = new FakeShadowRoot()
  shadowRoot.appendChild(createTextElement("span", "registered shadow text"))
  host.shadowRoot = shadowRoot

  applyFontToTreeChunked(host as unknown as HTMLElement)
  timeoutTasks.shift()?.callback()
  while (idleTasks.length > 0) {
    idleTasks.shift()?.callback(timeoutDeadline())
  }

  assert.equal(
    getKnownOpenShadowRoots().includes(shadowRoot as unknown as ShadowRoot),
    true
  )
})

test("an excluded subtree is skipped without a synchronous descendant query", async () => {
  const { timeoutTasks } = setupDomProcessorGlobals()
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  resetProcessedElements()

  const excludedRoot = new FakeElement("pre") as FakeElement & {
    querySelectorAll: () => FakeElement[]
  }
  let queryCount = 0
  excludedRoot.querySelectorAll = () => {
    queryCount += 1
    throw new Error("A full subtree query is not bounded work")
  }
  for (let index = 0; index < 2_000; index += 1) {
    excludedRoot.appendChild(createTextElement("code", `code ${index}`))
  }

  assert.doesNotThrow(() => {
    applyFontToTreeChunked(excludedRoot as unknown as HTMLElement)
  })
  assert.equal(queryCount, 0)
  assert.doesNotThrow(() => timeoutTasks.shift()?.callback())
  assert.equal(queryCount, 0)
})
