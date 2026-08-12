const STYLE_OWNER_ATTRIBUTE = "data-fontara-style"
const STYLE_ID_ATTRIBUTE = "data-fontara-style-id"
const STYLE_OWNER_VALUE = "true"

const ownedStyleElements = new Map<string, HTMLStyleElement>()
const expectedStyleContents = new Map<string, string>()

let styleRepairObserver: MutationObserver | null = null
let styleRepairScheduled = false

const STYLE_ELEMENT_REPAIR_OBSERVER_OPTIONS: MutationObserverInit = {
  attributes: true,
  attributeFilter: [
    "disabled",
    "id",
    "media",
    "type",
    STYLE_OWNER_ATTRIBUTE,
    STYLE_ID_ATTRIBUTE
  ],
  characterData: true,
  childList: true,
  subtree: true
}
const DOCUMENT_STYLE_REPAIR_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true
}

export function getStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

export function upsertStyle(id: string, textContent: string): HTMLStyleElement {
  expectedStyleContents.set(id, textContent)
  repairOwnedStyles()

  const styleElement = ownedStyleElements.get(id)
  if (!styleElement) {
    throw new Error(`Unable to create FontARA style: ${id}`)
  }

  return styleElement
}

export function removeStyle(id: string): void {
  expectedStyleContents.delete(id)
  ownedStyleElements.get(id)?.remove()
  ownedStyleElements.delete(id)

  if (expectedStyleContents.size === 0) {
    stopStyleRepairObserver()
  }
}

/**
 * Restores the exact style nodes owned by this content-script instance.
 *
 * Keeping the expected CSS separately lets us recover when an SPA removes the
 * current head, moves a style into another container, or mutates its marker or
 * text. The observer is disconnected while repairing so our own writes cannot
 * create a mutation loop.
 */
export function repairOwnedStyles(): void {
  if (expectedStyleContents.size === 0) {
    stopStyleRepairObserver()
    return
  }

  styleRepairObserver?.disconnect()

  const styleHost = getStyleHost()

  for (const [id, textContent] of expectedStyleContents) {
    let styleElement = ownedStyleElements.get(id)

    if (!isStyleElement(styleElement)) {
      styleElement = document.createElement("style")
      ownedStyleElements.set(id, styleElement)
    }

    if (styleElement.id !== id) {
      styleElement.id = id
    }

    if (
      styleElement.getAttribute(STYLE_OWNER_ATTRIBUTE) !== STYLE_OWNER_VALUE
    ) {
      styleElement.setAttribute(STYLE_OWNER_ATTRIBUTE, STYLE_OWNER_VALUE)
    }

    if (styleElement.getAttribute(STYLE_ID_ATTRIBUTE) !== id) {
      styleElement.setAttribute(STYLE_ID_ATTRIBUTE, id)
    }

    styleElement.disabled = false
    for (const attributeName of ["disabled", "media", "type"]) {
      if (styleElement.getAttribute(attributeName) !== null) {
        styleElement.removeAttribute(attributeName)
      }
    }

    if (styleElement.textContent !== textContent) {
      styleElement.textContent = textContent
    }

    if (styleElement.parentElement !== styleHost) {
      styleHost.appendChild(styleElement)
    }
  }

  startStyleRepairObserver()
}

function startStyleRepairObserver(): void {
  if (
    typeof MutationObserver !== "function" ||
    !document.documentElement ||
    expectedStyleContents.size === 0
  ) {
    return
  }

  styleRepairObserver ??= new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesOwnedStyles)) scheduleStyleRepair()
  })
  styleRepairObserver.observe(document, DOCUMENT_STYLE_REPAIR_OBSERVER_OPTIONS)
  styleRepairObserver.observe(
    document.documentElement,
    DOCUMENT_STYLE_REPAIR_OBSERVER_OPTIONS
  )

  const styleHost = getStyleHost()
  if (styleHost !== document.documentElement) {
    styleRepairObserver.observe(
      styleHost,
      DOCUMENT_STYLE_REPAIR_OBSERVER_OPTIONS
    )
  }

  for (const styleElement of ownedStyleElements.values()) {
    styleRepairObserver.observe(
      styleElement,
      STYLE_ELEMENT_REPAIR_OBSERVER_OPTIONS
    )
  }
}

function stopStyleRepairObserver(): void {
  styleRepairObserver?.disconnect()
  styleRepairObserver = null
  styleRepairScheduled = false
}

function scheduleStyleRepair(): void {
  if (styleRepairScheduled) return

  styleRepairScheduled = true
  queueMicrotask(() => {
    styleRepairScheduled = false
    repairOwnedStyles()
  })
}

function mutationTouchesOwnedStyles(mutation: MutationRecord): boolean {
  for (const styleElement of ownedStyleElements.values()) {
    // Attribute and character-data observations are scoped to the owned style
    // nodes, so only the style itself or one of its text descendants matters.
    // Do not treat an ancestor target (head/html) as damage: that would turn
    // ordinary page churn into needless repair work.
    if (
      mutation.type !== "childList" &&
      nodeContains(styleElement, mutation.target)
    ) {
      return true
    }

    if (mutation.type !== "childList") continue

    if (nodeContains(styleElement, mutation.target)) return true

    for (const node of mutation.addedNodes) {
      if (
        nodeContains(node, styleElement) ||
        nodeContains(styleElement, node)
      ) {
        return true
      }
    }

    for (const node of mutation.removedNodes) {
      if (
        nodeContains(node, styleElement) ||
        nodeContains(styleElement, node)
      ) {
        return true
      }
    }
  }

  return false
}

function nodeContains(node: Node, candidate: Node): boolean {
  if (node === candidate) return true

  const container = node as Node & {
    contains?: (candidate: Node | null) => boolean
  }
  return container.contains?.(candidate) === true
}

function isStyleElement(
  element: Element | null | undefined
): element is HTMLStyleElement {
  if (!element) return false
  if (typeof HTMLStyleElement !== "undefined") {
    return element instanceof HTMLStyleElement
  }

  return (
    typeof HTMLElement !== "undefined" &&
    element instanceof HTMLElement &&
    element.tagName.toLowerCase() === "style"
  )
}
