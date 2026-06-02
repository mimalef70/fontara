import { escapeCSSString } from "../utils/font-data"

const EDITABLE_FONT_ID = "fontara-editable-font-style"
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false" i])'
const EDITABLE_TEXT_SELECTOR = '[data-text="true"]'
const DEFAULT_EDITABLE_FALLBACK = "ui-sans-serif, system-ui, sans-serif"
export const EDITABLE_SELECTOR_ATTRIBUTES = [
  "id",
  "data-testid",
  "data-test-id",
  "data-qa",
  "aria-label",
  "role",
  "name"
]

type EditableFontRule = {
  css: string
  signature: string
}

let editableFontSignature = ""

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
  const selectorParts = getStableAttributeSelectorParts(element, {
    includeId: false
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
  const attributeSelectors = getStableAttributeSelectorParts(element, {
    includeId: false
  }).join("")

  return `${tagName}${attributeSelectors}${getNthOfTypeSelector(element)}`
}

function getStableAttributeSelectorParts(
  element: HTMLElement,
  options: { includeId: boolean }
): string[] {
  return EDITABLE_SELECTOR_ATTRIBUTES.flatMap((attributeName) => {
    if (!options.includeId && attributeName === "id") return []

    const value =
      attributeName === "id" ? element.id : element.getAttribute(attributeName)
    return value ? [getAttributeSelector(attributeName, value)] : []
  })
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

function selectorTargetsElement(
  element: HTMLElement,
  selector: string
): boolean {
  try {
    if (typeof element.matches === "function") {
      return element.matches(selector)
    }

    return Array.from(document.querySelectorAll(selector)).includes(element)
  } catch {
    return false
  }
}

function getStableEditableSelector(element: HTMLElement): string | null {
  const tagName = getElementTagName(element)
  const attributeSelectors = getStableAttributeSelectorParts(element, {
    includeId: true
  }).join("")
  const selector = `${tagName}${CONTENT_EDITABLE_SELECTOR}${attributeSelectors}`

  return selectorTargetsElement(element, selector) ? selector : null
}

function getEditableRootSelectors(element: HTMLElement): string[] {
  const selectors = new Set<string>()
  const stableEditableSelector = getStableEditableSelector(element)

  if (stableEditableSelector) {
    selectors.add(stableEditableSelector)
  }

  selectors.add(getElementSelector(element))
  return Array.from(selectors)
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

function getEditableFontSample(element: HTMLElement): HTMLElement {
  const textElement =
    typeof element.querySelector === "function"
      ? element.querySelector<HTMLElement>(EDITABLE_TEXT_SELECTOR)
      : null
  return textElement ?? element
}

function getEditableFontTargets(selector: string): string[] {
  return [selector, `${selector} *`, `${selector} ${EDITABLE_TEXT_SELECTOR}`]
}

function createEditableFontRule(element: HTMLElement): EditableFontRule {
  const selectors = getEditableRootSelectors(element)
  const fallbackFontFamily = getCleanFontFamily(
    window.getComputedStyle(getEditableFontSample(element)).fontFamily
  )
  const fontFamily = `var(--fontara-font), ${fallbackFontFamily}`
  const targets = selectors.flatMap(getEditableFontTargets).join(",\n      ")

  return {
    css: `
      ${targets} {
        font-family: ${fontFamily} !important;
      }
    `,
    signature: `${selectors.join("\u0001")}\u0000${fallbackFontFamily}`
  }
}

export function refreshEditableFontStyles(): void {
  const editableFontRules = getTopLevelContentEditableElements().map(
    createEditableFontRule
  )
  const nextSignature = editableFontRules
    .map((rule) => rule.signature)
    .join("\u0002")

  if (
    nextSignature === editableFontSignature &&
    (!nextSignature || document.getElementById(EDITABLE_FONT_ID))
  ) {
    return
  }

  editableFontSignature = nextSignature
  const editableFontCSS = editableFontRules.map((rule) => rule.css).join("\n")

  if (editableFontCSS) {
    upsertStyle(EDITABLE_FONT_ID, editableFontCSS)
    return
  }

  removeStyle(EDITABLE_FONT_ID)
}

export function removeEditableFontStyles(): void {
  editableFontSignature = ""
  removeStyle(EDITABLE_FONT_ID)
}
