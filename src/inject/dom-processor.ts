import { EXCLUDED_TAGS, ICON_CLASSES } from "../config/selectors"

function isIconElement(node: HTMLElement, fontFamily: string): boolean {
  const hasIconClass = ICON_CLASSES.some(
    (className) =>
      node.classList.contains(className) ||
      node.closest(`.${className}`) !== null
  )

  if (hasIconClass) return true

  const normalizedFontFamily = fontFamily.toLowerCase()
  return (
    normalizedFontFamily.includes("fontawesome") ||
    normalizedFontFamily.includes("material") ||
    normalizedFontFamily.includes("icon") ||
    normalizedFontFamily.includes("glyphicon")
  )
}

function getCleanFontFamily(fontFamily: string): string {
  return fontFamily
    .split(",")
    .map((family) => family.trim().replace(/^["']+|["']+$/g, ""))
    .filter((family) => !family.includes("-Fontara") && Boolean(family))
    .join(", ")
}

export function processElement(node: HTMLElement): void {
  if (EXCLUDED_TAGS.includes(node.tagName.toLowerCase())) {
    return
  }

  const computedStyle = window.getComputedStyle(node)
  const fontFamily = computedStyle.fontFamily

  if (isIconElement(node, fontFamily)) {
    return
  }

  const cleanFontFamily = getCleanFontFamily(fontFamily)
  node.style.setProperty(
    "font-family",
    `var(--fontara-font)${cleanFontFamily ? `, ${cleanFontFamily}` : ""}`,
    "important"
  )
}

export function applyFontToTree(rootNode: HTMLElement): void {
  if (!rootNode) return

  processElement(rootNode)

  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode()

  while (node) {
    if (node instanceof HTMLElement) {
      processElement(node)
    }
    node = walker.nextNode()
  }
}
