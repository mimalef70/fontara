import { escapeCSSString } from "../utils/font-data"

const EDITABLE_FONT_ID = "fontara-editable-font-style"
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false" i])'
const CONTENT_EDITABLE_INLINE_FONT_SELECTOR = [
  `${CONTENT_EDITABLE_SELECTOR}[style*="fontara-font"]`,
  `${CONTENT_EDITABLE_SELECTOR} [style*="fontara-font"]`
].join(", ")
const EDITABLE_TEXT_SELECTORS = ['[data-text="true"]', "p"]
const EDITABLE_TEXT_SAMPLE_SELECTOR = EDITABLE_TEXT_SELECTORS.join(", ")
const EDITABLE_SPECIFICITY_GUARD = ":not(#fontara-editable-font-specificity)"
const DEFAULT_EDITABLE_FALLBACK = "ui-sans-serif, system-ui, sans-serif"
const MAX_DYNAMIC_EDITABLE_RULES = 32
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
  const selectorParts = getStableAttributeSelectorParts(element, {
    includeId: true
  })

  if (selectorParts.length === 0) return null

  const attributeSelectors = selectorParts.join("")
  const selector = `${tagName}${CONTENT_EDITABLE_SELECTOR}${attributeSelectors}`

  return selectorTargetsElement(element, selector) ? selector : null
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

export function isInsideContentEditableElement(element: HTMLElement): boolean {
  return (
    isContentEditableElement(element) || hasContentEditableAncestor(element)
  )
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
      ? element.querySelector<HTMLElement>(EDITABLE_TEXT_SAMPLE_SELECTOR)
      : null
  return textElement ?? element
}

function getEditableFontTargets(selector: string): string[] {
  const guardedSelector = `${selector}${EDITABLE_SPECIFICITY_GUARD}`
  return [
    guardedSelector,
    `${guardedSelector} *`,
    ...EDITABLE_TEXT_SELECTORS.map(
      (textSelector) => `${guardedSelector} ${textSelector}`
    )
  ]
}

function createEditableFontRule(element: HTMLElement): EditableFontRule | null {
  const selector = getStableEditableSelector(element)
  if (!selector) return null

  const fallbackFontFamily = getCleanFontFamily(
    window.getComputedStyle(getEditableFontSample(element)).fontFamily
  )
  const fontFamily = `var(--fontara-font), ${fallbackFontFamily}`
  const targets = getEditableFontTargets(selector).join(",\n      ")

  return {
    css: `
      ${targets} {
        font-family: ${fontFamily} !important;
      }
    `,
    signature: `${selector}\u0000${fallbackFontFamily}`
  }
}

function getStaticEditableFontRule(): EditableFontRule {
  return {
    css: `
      ${getEditableFontTargets(CONTENT_EDITABLE_SELECTOR).join(",\n      ")} {
        font-family: var(--fontara-font), ${DEFAULT_EDITABLE_FALLBACK} !important;
      }
    `,
    signature: "static"
  }
}

function removeInlineFontStyle(element: HTMLElement): void {
  element.style.removeProperty("font-family")
  if (element.style.length === 0) {
    element.removeAttribute("style")
  }
}

function removeContentEditableInlineFontStyles(): void {
  document
    .querySelectorAll<HTMLElement>(CONTENT_EDITABLE_INLINE_FONT_SELECTOR)
    .forEach(removeInlineFontStyle)
}

export function refreshEditableFontStyles(): void {
  const editableFontRules = [
    getStaticEditableFontRule(),
    ...getTopLevelContentEditableElements()
      .flatMap((element) => createEditableFontRule(element) ?? [])
      .slice(0, MAX_DYNAMIC_EDITABLE_RULES)
  ]
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
    removeContentEditableInlineFontStyles()
    return
  }
}

export function removeEditableFontStyles(): void {
  editableFontSignature = ""
  removeStyle(EDITABLE_FONT_ID)
}
