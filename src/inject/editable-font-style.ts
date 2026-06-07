import {
  escapeCSSString,
  normalizeFontFamilyName,
  splitFontFamilies
} from "../utils/font-data"
import { removeStyle, upsertStyle } from "./style-utils"

const EDITABLE_FONT_ID = "fontara-editable-font-style"
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false" i])'
const CODE_EDITABLE_GUARD_SELECTORS = [
  "code",
  "pre",
  '[role="code"]',
  "[data-language]",
  ".CodeMirror",
  ".cm-editor",
  ".cm-content",
  ".cm-line",
  ".monaco-editor",
  ".ace_editor",
  '[class~="code" i]',
  '[class*="code-block" i]',
  '[class*="codeblock" i]',
  '[class*="code-editor" i]',
  '[class*="code_editor" i]',
  '[class*="codemirror" i]',
  '[class*="monaco" i]'
]
const CODE_EDITABLE_GUARD_SELECTOR = `:is(${CODE_EDITABLE_GUARD_SELECTORS.join(", ")})`
const EDITABLE_CODE_SCOPE_GUARD = `:not(${CODE_EDITABLE_GUARD_SELECTOR}):not(${CODE_EDITABLE_GUARD_SELECTOR} *)`
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
// High-churn selector attributes are sampled during rebuilds, but only
// contenteditable changes should invalidate editable font CSS automatically.
export const EDITABLE_OBSERVER_ATTRIBUTES = ["contenteditable"]

type EditableFontRule = {
  css: string
  signature: string
}

let editableFontSignature = ""

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

function isCodeEditableElement(element: HTMLElement): boolean {
  return Boolean(element.closest?.(CODE_EDITABLE_GUARD_SELECTOR))
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
  if (isContentEditableElement(element) && !isCodeEditableElement(element)) {
    return true
  }

  const editableElements =
    element.querySelectorAll?.<HTMLElement>(CONTENT_EDITABLE_SELECTOR) ?? []

  for (const editableElement of editableElements) {
    if (!isCodeEditableElement(editableElement)) return true
  }

  return false
}

function getTopLevelContentEditableElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(CONTENT_EDITABLE_SELECTOR)
  ).filter(
    (element) =>
      isContentEditableElement(element) &&
      !hasContentEditableAncestor(element) &&
      !isCodeEditableElement(element)
  )
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
  const guardedSelector = `${selector}${EDITABLE_CODE_SCOPE_GUARD}${EDITABLE_SPECIFICITY_GUARD}`
  return [
    guardedSelector,
    `${guardedSelector} *${EDITABLE_CODE_SCOPE_GUARD}`,
    ...EDITABLE_TEXT_SELECTORS.map(
      (textSelector) =>
        `${guardedSelector} ${textSelector}${EDITABLE_CODE_SCOPE_GUARD}`
    )
  ]
}

function createEditableFontRule(element: HTMLElement): EditableFontRule | null {
  if (isCodeEditableElement(element)) return null

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
