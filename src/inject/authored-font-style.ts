// CSS substring selectors cannot distinguish font declarations from custom
// properties. Let the browser's CSS parser identify explicitly authored fonts.
const ATTRIBUTE = "data-fontara-authored-font"
let observer: MutationObserver | null = null
const marked = new Set<HTMLElement>()

function refresh(element: Element): void {
  if (!(element instanceof HTMLElement)) return
  const authored = Boolean(
    element.style.getPropertyValue("font-family") ||
      element.style.getPropertyValue("font")
  )
  if (authored) {
    element.setAttribute(ATTRIBUTE, "")
    marked.add(element)
  } else {
    marked.delete(element)
    element.removeAttribute(ATTRIBUTE)
  }
}

function scan(root: Element): void {
  refresh(root)
  for (const element of root.querySelectorAll(`[style], [${ATTRIBUTE}]`)) {
    refresh(element)
  }
}

export function trackAuthoredFontStyles(): void {
  if (observer) return
  if (document.documentElement) scan(document.documentElement)
  observer = new MutationObserver((records) => {
    let removed = false
    for (const record of records) {
      if (record.type === "attributes") {
        refresh(record.target as Element)
      } else {
        removed ||= record.removedNodes.length > 0
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node)
        }
      }
    }
    if (removed) {
      for (const element of marked) {
        if (!element.isConnected) {
          element.removeAttribute(ATTRIBUTE)
          marked.delete(element)
        }
      }
    }
  })
  observer.observe(document, {
    attributes: true,
    attributeFilter: ["style"],
    childList: true,
    subtree: true
  })
}

export function stopTrackingAuthoredFontStyles(): void {
  observer?.disconnect()
  observer = null
  for (const element of marked) element.removeAttribute(ATTRIBUTE)
  marked.clear()
}
