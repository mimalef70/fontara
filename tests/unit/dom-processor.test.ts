import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

const originalGlobals = {
  document: Reflect.get(globalThis, "document") as unknown,
  HTMLElement: Reflect.get(globalThis, "HTMLElement") as unknown,
  Node: Reflect.get(globalThis, "Node") as unknown,
  NodeFilter: Reflect.get(globalThis, "NodeFilter") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

class FakeStyleDeclaration {
  private values = new Map<string, string>()

  get fontFamily(): string {
    return this.getPropertyValue("font-family")
  }

  set fontFamily(value: string) {
    if (value) {
      this.values.set("font-family", value)
      return
    }

    this.values.delete("font-family")
  }

  get length(): number {
    return this.values.size
  }

  getPropertyValue(propertyName: string): string {
    return this.values.get(propertyName) ?? ""
  }

  setProperty(propertyName: string, value: string): void {
    this.values.set(propertyName, value)
  }
}

class FakeElement {
  childNodes: Array<
    FakeElement | { nodeType: number; textContent?: string | null }
  >
  children: FakeElement[] = []
  classList = new Set<string>()
  isConnected = true
  style = new FakeStyleDeclaration()
  tagName: string

  constructor(tagName: string, textContent: string) {
    this.tagName = tagName.toUpperCase()
    this.childNodes = [{ nodeType: 3, textContent }]
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    this.childNodes.push(child)
    return child
  }
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }
})

function getTreeWalkerNodes(root: FakeElement): FakeElement[] {
  const nodes: FakeElement[] = []

  for (const child of root.children) {
    nodes.push(child, ...getTreeWalkerNodes(child))
  }

  return nodes
}

function installDOMProcessorMocks(
  options: {
    requestIdleCallback?: (callback: (deadline: IdleDeadline) => void) => number
  } = {}
): void {
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "Node", { TEXT_NODE: 3 })
  Reflect.set(globalThis, "NodeFilter", {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ELEMENT: 1
  })
  Reflect.set(globalThis, "document", {
    createTreeWalker(rootNode: FakeElement) {
      const nodes = getTreeWalkerNodes(rootNode)
      let index = 0

      return {
        nextNode() {
          const node = nodes[index]
          index += 1
          return node ?? null
        }
      }
    }
  })
  Reflect.set(globalThis, "window", {
    getComputedStyle() {
      return {
        fontFamily: "TwitterChirp, Arial, sans-serif"
      }
    },
    requestIdleCallback:
      options.requestIdleCallback ??
      ((callback: (deadline: IdleDeadline) => void) => {
        callback({ timeRemaining: () => 50 } as IdleDeadline)
        return 1
      }),
    setTimeout
  })
}

test("processed text nodes are re-applied when the site removes the inline font style", async () => {
  installDOMProcessorMocks()
  const { collectFontWork, resetProcessedElements, writeFontWorkBatch } =
    await import("../../src/inject/dom-processor")
  const textElement = new FakeElement(
    "span",
    " علم و فناوری "
  ) as unknown as HTMLElement

  resetProcessedElements()

  let work = collectFontWork(textElement)
  assert.equal(work.length, 1)
  writeFontWorkBatch(work)
  assert.match(
    textElement.style.getPropertyValue("font-family"),
    /--fontara-font/
  )

  textElement.style.fontFamily = ""
  work = collectFontWork(textElement)

  assert.equal(work.length, 1)
})

test("chunked initial traversal writes collected work before the whole tree is collected", async () => {
  const idleCallbacks: Array<(deadline: IdleDeadline) => void> = []
  installDOMProcessorMocks({
    requestIdleCallback(callback) {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    }
  })
  const { applyFontToTreeChunked, resetProcessedElements } = await import(
    "../../src/inject/dom-processor"
  )
  const root = new FakeElement("div", "")
  const firstSidebarItem = root.appendChild(
    new FakeElement("span", " صفحه اصلی ")
  )
  const secondSidebarItem = root.appendChild(new FakeElement("span", " جستجو "))

  resetProcessedElements()
  applyFontToTreeChunked(root as unknown as HTMLElement)

  assert.equal(firstSidebarItem.style.getPropertyValue("font-family"), "")
  assert.equal(secondSidebarItem.style.getPropertyValue("font-family"), "")

  idleCallbacks.shift()?.({ timeRemaining: () => 0 } as IdleDeadline)
  assert.equal(firstSidebarItem.style.getPropertyValue("font-family"), "")
  assert.equal(secondSidebarItem.style.getPropertyValue("font-family"), "")

  idleCallbacks.shift()?.({ timeRemaining: () => 0 } as IdleDeadline)
  assert.match(
    firstSidebarItem.style.getPropertyValue("font-family"),
    /--fontara-font/
  )
  assert.equal(secondSidebarItem.style.getPropertyValue("font-family"), "")
})
