import { escapeCSSString } from "../utils/font-data"

const EDITABLE_FONT_ID = "fontara-editable-font-style"
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false" i])'
const DEFAULT_EDITABLE_FALLBACK = "ui-sans-serif, system-ui, sans-serif"
const STABLE_SELECTOR_ATTRIBUTES = [
  "data-testid",
  "data-test-id",
  "data-qa",
  "aria-label",
  "role",
  "name"
]

function getStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

function upsertStyle(id: string, textContent: string): HTMLStyleElement {
  let styleElement = document.getElementById(id) as HTMLStyleElement | null

  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = id
    getStyleHost().appendChild(styleElement)
  }

  if (styleElement.textContent !== textContent) {
    styleElement.textContent = textContent
  }

  return styleElement
}

function removeStyle(id: string): void {
  document.getElementById(id)?.remove()
}

function getElementTagName(element: HTMLElement): string {
  return (element.localName || element.tagName).toLowerCase()
}

function getAttributeSelector(
  attributeName: string,
  attributeValue: string
): string {
  return `[${attributeName}="${escapeCSSString(attributeValue)}"]`
}

function getUniqueSelector(element: HTMLElement): string | null {
  if (element.id) {
    const selector = getAttributeSelector("id", element.id)
    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector
      }
    } catch {}
  }

  const tagName = getElementTagName(element)
  const selectorParts = STABLE_SELECTOR_ATTRIBUTES.flatMap((attributeName) => {
    const value = element.getAttribute(attributeName)
    return value ? [getAttributeSelector(attributeName, value)] : []
  })

  if (selectorParts.length === 0) {
    return null
  }

  const selector = `${tagName}${selectorParts.join("")}`
  try {
    if (document.querySelectorAll(selector).length === 1) {
      return selector
    }
  } catch {}

  return null
}

function getNthOfTypeSelector(element: HTMLElement): string {
  const parent = element.parentElement
  if (!parent) return ""

  const sameTagSiblings = Array.from(parent.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.tagName.toLowerCase() === element.tagName.toLowerCase()
  )

  if (sameTagSiblings.length <= 1) return ""

  const index = sameTagSiblings.indexOf(element)
  return index === -1 ? "" : `:nth-of-type(${index + 1})`
}

function getSelectorPart(element: HTMLElement): string {
  const tagName = getElementTagName(element)
  const attributeSelectors = STABLE_SELECTOR_ATTRIBUTES.flatMap(
    (attributeName) => {
      const value = element.getAttribute(attributeName)
      return value ? [getAttributeSelector(attributeName, value)] : []
    }
  ).join("")

  return `${tagName}${attributeSelectors}${getNthOfTypeSelector(element)}`
}

function getElementSelector(element: HTMLElement): string {
  const uniqueSelector = getUniqueSelector(element)
  if (uniqueSelector) return uniqueSelector

  const parts: string[] = []
  let current: HTMLElement | null = element

  while (current) {
    const currentUniqueSelector = getUniqueSelector(current)
    if (currentUniqueSelector) {
      parts.unshift(currentUniqueSelector)
      break
    }

    parts.unshift(getSelectorPart(current))

    if (current === document.documentElement) break
    current = current.parentElement
  }

  return parts.join(" > ")
}

export function isContentEditableElement(element: HTMLElement): boolean {
  const value = element.getAttribute("contenteditable")
  return (
    value !== null &&
    value.toLowerCase() !== "false" &&
    element.isContentEditable !== false
  )
}

function hasContentEditableAncestor(element: HTMLElement): boolean {
  let parent = element.parentElement

  while (parent) {
    if (isContentEditableElement(parent)) return true
    parent = parent.parentElement
  }

  return false
}

export function containsContentEditableElement(element: HTMLElement): boolean {
  if (isContentEditableElement(element)) return true

  return Boolean(element.querySelector?.(CONTENT_EDITABLE_SELECTOR))
}

function getTopLevelContentEditableElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(CONTENT_EDITABLE_SELECTOR)
  ).filter(
    (element) =>
      isContentEditableElement(element) && !hasContentEditableAncestor(element)
  )
}

function splitFontFamilies(fontFamily: string): string[] {
  const families: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  let escaped = false

  for (const character of fontFamily) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === "\\") {
      current += character
      escaped = true
      continue
    }

    if (quote) {
      current += character
      if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'") {
      current += character
      quote = character
      continue
    }

    if (character === ",") {
      families.push(current)
      current = ""
      continue
    }

    current += character
  }

  families.push(current)
  return families
}

function normalizeFontFamilyName(fontFamily: string): string {
  return fontFamily.trim().replace(/^["']+|["']+$/g, "")
}

function getCleanFontFamily(fontFamily: string): string {
  const cleanFontFamily = splitFontFamilies(fontFamily)
    .map((family) => family.trim())
    .filter((family) => {
      const normalizedFamily = normalizeFontFamilyName(family)
      return (
        normalizedFamily &&
        normalizedFamily !== "var(--fontara-font)" &&
        !normalizedFamily.endsWith("-Fontara")
      )
    })
    .join(", ")

  return cleanFontFamily || DEFAULT_EDITABLE_FALLBACK
}

function createEditableFontRule(element: HTMLElement): string {
  const selector = getElementSelector(element)
  const fallbackFontFamily = getCleanFontFamily(
    window.getComputedStyle(element).fontFamily
  )
  const fontFamily = `var(--fontara-font), ${fallbackFontFamily}`

  return `
    ${selector},
    ${selector} * {
      font-family: ${fontFamily} !important;
    }
  `
}

export function refreshEditableFontStyles(): void {
  removeStyle(EDITABLE_FONT_ID)

  const editableFontCSS = getTopLevelContentEditableElements()
    .map(createEditableFontRule)
    .join("\n")

  if (editableFontCSS) {
    upsertStyle(EDITABLE_FONT_ID, editableFontCSS)
  }
}

export function removeEditableFontStyles(): void {
  removeStyle(EDITABLE_FONT_ID)
}
