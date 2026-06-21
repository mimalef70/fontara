const STYLE_OWNER_ATTRIBUTE = "data-fontara-style"
const STYLE_ID_ATTRIBUTE = "data-fontara-style-id"
const STYLE_OWNER_VALUE = "true"

const ownedStyleElements = new Map<string, HTMLStyleElement>()

export function getStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

export function upsertStyle(id: string, textContent: string): HTMLStyleElement {
  let styleElement = getOwnedStyle(id)

  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = id
    markOwnedStyle(styleElement, id)
    getStyleHost().appendChild(styleElement)
  }

  if (styleElement.textContent !== textContent) {
    styleElement.textContent = textContent
  }

  return styleElement
}

export function removeStyle(id: string): void {
  getOwnedStyle(id)?.remove()
  ownedStyleElements.delete(id)
}

function getOwnedStyle(id: string): HTMLStyleElement | null {
  const styleElement = ownedStyleElements.get(id)
  if (isOwnedStyle(styleElement, id)) {
    return styleElement
  }

  ownedStyleElements.delete(id)
  return null
}

function markOwnedStyle(styleElement: HTMLStyleElement, id: string): void {
  styleElement.setAttribute(STYLE_OWNER_ATTRIBUTE, STYLE_OWNER_VALUE)
  styleElement.setAttribute(STYLE_ID_ATTRIBUTE, id)
  ownedStyleElements.set(id, styleElement)
}

function isOwnedStyle(
  element: Element | null | undefined,
  id: string
): element is HTMLStyleElement {
  return (
    isStyleElement(element) &&
    (!("isConnected" in element) || element.isConnected) &&
    element.getAttribute(STYLE_OWNER_ATTRIBUTE) === STYLE_OWNER_VALUE &&
    element.getAttribute(STYLE_ID_ATTRIBUTE) === id
  )
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
