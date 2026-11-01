import { ICON_EXCLUDED_SELECTORS } from "../config/selectors"
import {
  escapeCSSString,
  normalizeFontFamilyName,
  splitFontFamilies
} from "../utils/font-data"
import {
  clearKnownOpenShadowRoots,
  createKnownOpenShadowRootSnapshot,
  isShadowRootInCurrentDocument
} from "./shadow-roots"
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
const ICON_EDITABLE_GUARD_SELECTOR = `:is(${ICON_EXCLUDED_SELECTORS.join(", ")})`
const EDITABLE_ICON_SCOPE_GUARD = `:not(${ICON_EDITABLE_GUARD_SELECTOR}):not(${ICON_EDITABLE_GUARD_SELECTOR} *)`
const CONTENT_EDITABLE_INLINE_FONT_SELECTOR = [
  `${CONTENT_EDITABLE_SELECTOR}[style*="fontara-font"]`,
  `${CONTENT_EDITABLE_SELECTOR} [style*="fontara-font"]`
].join(", ")
const EDITABLE_TEXT_SELECTORS = ['[data-text="true"]', "p"]
const EDITABLE_TEXT_SAMPLE_SELECTOR = EDITABLE_TEXT_SELECTORS.join(", ")
const EDITABLE_SPECIFICITY_GUARD = ":not(#fontara-editable-font-specificity)"
const DEFAULT_EDITABLE_FALLBACK = "ui-sans-serif, system-ui, sans-serif"
const MAX_DYNAMIC_EDITABLE_RULES = 32
const INLINE_FONT_CLEANUP_OPERATIONS_PER_TURN = 400
const EDITABLE_STYLE_PRUNE_ENTRIES_PER_TURN = 100
const SHADOW_EDITABLE_ROOTS_PER_TURN = 100
const SHADOW_EDITABLE_STYLE_ATTRIBUTE = "data-fontara-editable-style"
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

type InlineFontCleanupFrame = {
  childIndex: number
  insideEditable: boolean
  node: Document | ShadowRoot | HTMLElement
  visited: boolean
}

type InlineFontCleanupJob = {
  root: Document | ShadowRoot
  stack: InlineFontCleanupFrame[]
}

type ShadowEditableRefreshJob = {
  iterator: Iterator<ShadowRoot>
  remaining: number | null
}

type ShadowEditableRemovalJob = {
  iterator: Iterator<HTMLStyleElement>
  roots: WeakMap<HTMLStyleElement, ShadowRoot>
  styles: Set<HTMLStyleElement>
}

let editableFontSignature = ""
let activeEditableFontFamily = ""
let shadowEditableStyles = new WeakMap<ShadowRoot, HTMLStyleElement>()
let ownedShadowEditableStyles = new Set<HTMLStyleElement>()
let ownedShadowEditableStyleRoots = new WeakMap<HTMLStyleElement, ShadowRoot>()
let pendingInlineFontCleanupJobs: InlineFontCleanupJob[] = []
let pendingInlineFontCleanupHead = 0
let inlineFontCleanupJobs = new WeakMap<object, InlineFontCleanupJob>()
let inlineFontCleanupTimer: { cancel: () => void } | null = null
let editableStylePruneIterator: SetIterator<HTMLStyleElement> | null = null
let editableStylePruneTimer: { cancel: () => void } | null = null
let editableStylePruneRestartRequested = false
let globalShadowRefreshJob: ShadowEditableRefreshJob | null = null
let pendingScopedShadowRefreshJobs: ShadowEditableRefreshJob[] = []
let pendingScopedShadowRefreshHead = 0
let shadowRefreshTimer: { cancel: () => void } | null = null
let pendingShadowRemovalJobs: ShadowEditableRemovalJob[] = []
let pendingShadowRemovalHead = 0
let shadowRemovalTimer: { cancel: () => void } | null = null

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement
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

    const root =
      typeof element.getRootNode === "function"
        ? (element.getRootNode() as ParentNode)
        : document
    return Array.from(root.querySelectorAll(selector)).includes(element)
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

function getTopLevelContentEditableElements(
  root: Document | ShadowRoot = document,
  limit = MAX_DYNAMIC_EDITABLE_RULES
): HTMLElement[] {
  const elements: HTMLElement[] = []
  for (const element of root.querySelectorAll<HTMLElement>(
    CONTENT_EDITABLE_SELECTOR
  )) {
    if (
      isContentEditableElement(element) &&
      !hasContentEditableAncestor(element) &&
      !isCodeEditableElement(element)
    ) {
      elements.push(element)
      if (elements.length >= limit) break
    }
  }
  return elements
}

function getCleanFontFamily(fontFamily: string): string {
  const cleanFontFamily = splitFontFamilies(fontFamily)
    .map((family) => family.trim())
    .filter((family) => {
      const normalizedFamily = normalizeFontFamilyName(family)
      const normalizedFamilyKey = normalizedFamily.toLocaleLowerCase()
      return (
        normalizedFamily &&
        normalizedFamily !== "var(--fontara-font)" &&
        normalizedFamilyKey !== activeEditableFontFamily &&
        !normalizedFamilyKey.endsWith("-fontara") &&
        !/^fontaragoogle-[a-f\d]{24}$/i.test(normalizedFamily)
      )
    })
    .join(", ")

  return cleanFontFamily || DEFAULT_EDITABLE_FALLBACK
}

export function setActiveFontFamilyForEditableStyles(
  fontName: string | null | undefined
): void {
  const nextFamily = fontName
    ? normalizeFontFamilyName(fontName).toLocaleLowerCase()
    : ""
  if (nextFamily === activeEditableFontFamily) return

  activeEditableFontFamily = nextFamily
  // Supersede any global refresh that sampled fallback stacks for the
  // previous active family. The next theme apply starts a fresh snapshot.
  cancelShadowEditableRefresh()
  // The active family participates in fallback sanitization, so a font switch
  // must force dynamic editable rules to be sampled again.
  editableFontSignature = ""
}

function getEditableFontSample(element: HTMLElement): HTMLElement {
  const textElement =
    typeof element.querySelector === "function"
      ? element.querySelector<HTMLElement>(EDITABLE_TEXT_SAMPLE_SELECTOR)
      : null
  return textElement ?? element
}

function getEditableFontTargets(selector: string): string[] {
  const guardedSelector = `${selector}${EDITABLE_CODE_SCOPE_GUARD}${EDITABLE_ICON_SCOPE_GUARD}${EDITABLE_SPECIFICITY_GUARD}`
  return [
    guardedSelector,
    `${guardedSelector} *${EDITABLE_CODE_SCOPE_GUARD}${EDITABLE_ICON_SCOPE_GUARD}`,
    ...EDITABLE_TEXT_SELECTORS.map(
      (textSelector) =>
        `${guardedSelector} ${textSelector}${EDITABLE_CODE_SCOPE_GUARD}${EDITABLE_ICON_SCOPE_GUARD}`
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

function createInlineFontCleanupFrame(
  node: Document | ShadowRoot | HTMLElement,
  insideEditable = false
): InlineFontCleanupFrame {
  return {
    childIndex: 0,
    insideEditable,
    node,
    visited: false
  }
}

function getCleanupElementChild(
  node: Document | ShadowRoot | HTMLElement,
  childIndex: number
): HTMLElement | null {
  const children = node.children
  if (!children) return null

  const child =
    typeof children.item === "function"
      ? children.item(childIndex)
      : (children as unknown as Element[])[childIndex]
  return isHTMLElement(child) ? child : null
}

function hasFontaraInlineFont(element: HTMLElement): boolean {
  const getPropertyValue = element.style?.getPropertyValue
  return (
    typeof getPropertyValue === "function" &&
    getPropertyValue
      .call(element.style, "font-family")
      .includes("var(--fontara-font)")
  )
}

function processInlineFontCleanupJob(
  job: InlineFontCleanupJob,
  operationLimit: number
): { done: boolean; operations: number } {
  let operationCount = 0

  while (job.stack.length > 0 && operationCount < operationLimit) {
    const frame = job.stack[job.stack.length - 1]

    if (!frame.visited) {
      frame.visited = true
      if (isHTMLElement(frame.node)) {
        frame.insideEditable =
          frame.insideEditable || isContentEditableElement(frame.node)
        if (
          hasFontaraInlineFont(frame.node) &&
          (frame.insideEditable ||
            selectorTargetsElement(
              frame.node,
              CONTENT_EDITABLE_INLINE_FONT_SELECTOR
            ))
        ) {
          removeInlineFontStyle(frame.node)
        }
      }
      operationCount += 1
      continue
    }

    const child = getCleanupElementChild(frame.node, frame.childIndex)
    if (child) {
      frame.childIndex += 1
      job.stack.push(createInlineFontCleanupFrame(child, frame.insideEditable))
      operationCount += 1
      continue
    }

    job.stack.pop()
    operationCount += 1
  }

  return { done: job.stack.length === 0, operations: operationCount }
}

function scheduleInlineFontCleanupTurn(): void {
  if (inlineFontCleanupTimer !== null) return
  inlineFontCleanupTimer = scheduleTimer(runInlineFontCleanupTurn)
}

function runInlineFontCleanupTurn(): void {
  inlineFontCleanupTimer = null
  let remainingOperations = INLINE_FONT_CLEANUP_OPERATIONS_PER_TURN

  while (
    pendingInlineFontCleanupHead < pendingInlineFontCleanupJobs.length &&
    remainingOperations > 0
  ) {
    const job = pendingInlineFontCleanupJobs[pendingInlineFontCleanupHead]
    pendingInlineFontCleanupHead += 1
    if (!job) break

    if (
      typeof ShadowRoot !== "undefined" &&
      job.root instanceof ShadowRoot &&
      !isShadowRootInCurrentDocument(job.root)
    ) {
      inlineFontCleanupJobs.delete(job.root)
      continue
    }

    const operationLimit = Math.min(100, remainingOperations)
    const result = processInlineFontCleanupJob(job, operationLimit)
    remainingOperations -= result.operations

    if (result.done) {
      inlineFontCleanupJobs.delete(job.root)
    } else {
      pendingInlineFontCleanupJobs.push(job)
    }
  }

  if (
    pendingInlineFontCleanupHead >= 1_024 &&
    pendingInlineFontCleanupHead * 2 >= pendingInlineFontCleanupJobs.length
  ) {
    pendingInlineFontCleanupJobs = pendingInlineFontCleanupJobs.slice(
      pendingInlineFontCleanupHead
    )
    pendingInlineFontCleanupHead = 0
  }

  if (pendingInlineFontCleanupHead < pendingInlineFontCleanupJobs.length) {
    scheduleInlineFontCleanupTurn()
  }
}

function removeContentEditableInlineFontStyles(
  root: Document | ShadowRoot = document
): void {
  if (inlineFontCleanupJobs.has(root)) return

  const job: InlineFontCleanupJob = {
    root,
    stack: [createInlineFontCleanupFrame(root)]
  }
  inlineFontCleanupJobs.set(root, job)
  pendingInlineFontCleanupJobs.push(job)
  scheduleInlineFontCleanupTurn()
}

function cancelInlineFontCleanup(): void {
  if (inlineFontCleanupTimer !== null) {
    inlineFontCleanupTimer.cancel()
  }
  inlineFontCleanupTimer = null
  pendingInlineFontCleanupJobs = []
  pendingInlineFontCleanupHead = 0
  inlineFontCleanupJobs = new WeakMap<object, InlineFontCleanupJob>()
}

function createEditableFontCSS(root: Document | ShadowRoot): string {
  const editableFontRules = [
    getStaticEditableFontRule(),
    ...getTopLevelContentEditableElements(root).flatMap(
      (element) => createEditableFontRule(element) ?? []
    )
  ]
  return editableFontRules.map((rule) => rule.css).join("\n")
}

function removeOrphanShadowEditableStyles(
  root: ShadowRoot,
  retainedStyle?: HTMLStyleElement
): void {
  for (const candidate of root.querySelectorAll<HTMLStyleElement>(
    `style[${SHADOW_EDITABLE_STYLE_ATTRIBUTE}]`
  )) {
    if (candidate === retainedStyle) continue

    candidate.remove()
    ownedShadowEditableStyles.delete(candidate)
    ownedShadowEditableStyleRoots.delete(candidate)
  }
}

function upsertShadowEditableStyle(root: ShadowRoot, css: string): void {
  let style: HTMLStyleElement | null | undefined =
    shadowEditableStyles.get(root)
  if (!style) {
    style = document.createElement("style")
  }

  shadowEditableStyles.set(root, style)
  ownedShadowEditableStyles.add(style)
  ownedShadowEditableStyleRoots.set(style, root)
  removeOrphanShadowEditableStyles(root, style)
  if (style.getRootNode() !== root) root.append(style)
  if (style.getAttribute(SHADOW_EDITABLE_STYLE_ATTRIBUTE) !== "true") {
    style.setAttribute(SHADOW_EDITABLE_STYLE_ATTRIBUTE, "true")
  }
  if (style.hasAttribute("disabled")) style.removeAttribute("disabled")
  if (style.hasAttribute("media")) style.removeAttribute("media")
  if (style.hasAttribute("type")) style.removeAttribute("type")
  if (style.disabled) style.disabled = false
  if (style.textContent !== css) style.textContent = css
}

function scheduleTimer(callback: () => void): { cancel: () => void } {
  if (typeof window.setTimeout === "function") {
    const timerId = window.setTimeout(callback, 0)
    return { cancel: () => window.clearTimeout(timerId) }
  }

  const timerId = globalThis.setTimeout(callback, 0)
  return { cancel: () => globalThis.clearTimeout(timerId) }
}

function processShadowEditableRefreshJob(
  job: ShadowEditableRefreshJob,
  operationLimit: number
): { done: boolean; operations: number } {
  let operations = 0

  while (
    operations < operationLimit &&
    (job.remaining === null || job.remaining > 0)
  ) {
    const entry = job.iterator.next()
    if (entry.done) return { done: true, operations }
    if (job.remaining !== null) job.remaining -= 1
    operations += 1
    if (!isShadowRootInCurrentDocument(entry.value)) continue
    upsertShadowEditableStyle(entry.value, createEditableFontCSS(entry.value))
    removeContentEditableInlineFontStyles(entry.value)
  }

  return {
    done: job.remaining === 0,
    operations
  }
}

function runShadowRefreshTurn(): void {
  shadowRefreshTimer = null
  let operations = 0

  if (globalShadowRefreshJob) {
    const result = processShadowEditableRefreshJob(
      globalShadowRefreshJob,
      SHADOW_EDITABLE_ROOTS_PER_TURN
    )
    operations += result.operations
    if (result.done) globalShadowRefreshJob = null
  }

  while (
    pendingScopedShadowRefreshHead < pendingScopedShadowRefreshJobs.length &&
    operations < SHADOW_EDITABLE_ROOTS_PER_TURN
  ) {
    const job = pendingScopedShadowRefreshJobs[pendingScopedShadowRefreshHead]
    if (!job) break
    const result = processShadowEditableRefreshJob(
      job,
      SHADOW_EDITABLE_ROOTS_PER_TURN - operations
    )
    operations += result.operations
    if (!result.done) break
    pendingScopedShadowRefreshHead += 1
  }

  if (
    pendingScopedShadowRefreshHead >= 1_024 &&
    pendingScopedShadowRefreshHead * 2 >= pendingScopedShadowRefreshJobs.length
  ) {
    pendingScopedShadowRefreshJobs = pendingScopedShadowRefreshJobs.slice(
      pendingScopedShadowRefreshHead
    )
    pendingScopedShadowRefreshHead = 0
  }

  if (
    globalShadowRefreshJob ||
    pendingScopedShadowRefreshHead < pendingScopedShadowRefreshJobs.length
  ) {
    shadowRefreshTimer = scheduleTimer(runShadowRefreshTurn)
  }
}

function startGlobalShadowRefresh(): void {
  shadowRefreshTimer?.cancel()
  shadowRefreshTimer = null
  const snapshot = createKnownOpenShadowRootSnapshot()
  globalShadowRefreshJob = {
    iterator: snapshot.iterator,
    remaining: snapshot.remaining
  }
  runShadowRefreshTurn()
}

function enqueueScopedShadowRefresh(roots: Iterable<ShadowRoot>): void {
  pendingScopedShadowRefreshJobs.push({
    iterator: roots[Symbol.iterator](),
    remaining: null
  })
  if (shadowRefreshTimer === null) runShadowRefreshTurn()
}

function runShadowRemovalTurn(): void {
  shadowRemovalTimer = null
  let operations = 0

  while (
    pendingShadowRemovalHead < pendingShadowRemovalJobs.length &&
    operations < SHADOW_EDITABLE_ROOTS_PER_TURN
  ) {
    const job = pendingShadowRemovalJobs[pendingShadowRemovalHead]
    if (!job) break
    const entry = job.iterator.next()
    if (entry.done) {
      pendingShadowRemovalHead += 1
      continue
    }

    operations += 1
    const style = entry.value
    const root = job.roots.get(style)
    if (root && isShadowRootInCurrentDocument(root)) {
      const currentStyle = shadowEditableStyles.get(root)
      for (const candidate of root.querySelectorAll<HTMLStyleElement>(
        `style[${SHADOW_EDITABLE_STYLE_ATTRIBUTE}]`
      )) {
        if (candidate === currentStyle) continue
        if (candidate !== style && ownedShadowEditableStyles.has(candidate)) {
          continue
        }
        candidate.remove()
        job.styles.delete(candidate)
        job.roots.delete(candidate)
      }
    }
    if (style !== shadowEditableStyles.get(root as ShadowRoot)) style.remove()
    job.styles.delete(style)
    job.roots.delete(style)
  }

  if (
    pendingShadowRemovalHead >= 1_024 &&
    pendingShadowRemovalHead * 2 >= pendingShadowRemovalJobs.length
  ) {
    pendingShadowRemovalJobs = pendingShadowRemovalJobs.slice(
      pendingShadowRemovalHead
    )
    pendingShadowRemovalHead = 0
  }

  if (pendingShadowRemovalHead < pendingShadowRemovalJobs.length) {
    shadowRemovalTimer = scheduleTimer(runShadowRemovalTurn)
  }
}

function enqueueShadowStyleRemoval(
  styles: Set<HTMLStyleElement>,
  roots: WeakMap<HTMLStyleElement, ShadowRoot>
): void {
  if (styles.size === 0) return
  pendingShadowRemovalJobs.push({ iterator: styles.values(), roots, styles })
  if (shadowRemovalTimer === null) runShadowRemovalTurn()
}

function cancelShadowEditableRefresh(): void {
  shadowRefreshTimer?.cancel()
  shadowRefreshTimer = null
  globalShadowRefreshJob = null
  pendingScopedShadowRefreshJobs = []
  pendingScopedShadowRefreshHead = 0
}

export function isOwnedEditableFontStyle(
  value: unknown
): value is HTMLStyleElement {
  return (
    typeof HTMLStyleElement !== "undefined" &&
    value instanceof HTMLStyleElement &&
    ownedShadowEditableStyles.has(value)
  )
}

function beginEditableStylePruneCycle(): void {
  editableStylePruneIterator = ownedShadowEditableStyles.values()
}

function runEditableStylePruneTurn(): void {
  editableStylePruneTimer = null
  let visited = 0

  while (
    editableStylePruneIterator &&
    visited < EDITABLE_STYLE_PRUNE_ENTRIES_PER_TURN
  ) {
    const entry = editableStylePruneIterator.next()
    if (entry.done) {
      editableStylePruneIterator = null
      if (editableStylePruneRestartRequested) {
        editableStylePruneRestartRequested = false
        beginEditableStylePruneCycle()
      }
      break
    }

    visited += 1
    const style = entry.value
    const root = ownedShadowEditableStyleRoots.get(style)
    if (root && isShadowRootInCurrentDocument(root)) continue

    style.remove()
    ownedShadowEditableStyles.delete(style)
    ownedShadowEditableStyleRoots.delete(style)
    if (root) shadowEditableStyles.delete(root)
  }

  scheduleEditableStylePruneTurn()
}

function scheduleEditableStylePruneTurn(): void {
  if (!editableStylePruneIterator || editableStylePruneTimer !== null) return
  editableStylePruneTimer = scheduleTimer(runEditableStylePruneTurn)
}

function cancelEditableStylePrune(): void {
  editableStylePruneTimer?.cancel()
  editableStylePruneTimer = null
  editableStylePruneIterator = null
  editableStylePruneRestartRequested = false
}

/**
 * Pauses maintenance owned by the active theme without removing its styles.
 * Retired-generation style removal deliberately keeps running so a pause or
 * mode switch cannot strand stale Shadow DOM styles.
 */
export function cancelPendingEditableFontWork(): void {
  cancelInlineFontCleanup()
  cancelEditableStylePrune()
  cancelShadowEditableRefresh()
  // A cancelled document cleanup must be scheduled again when the same theme
  // resumes. The style node remains in place and its next upsert is idempotent.
  editableFontSignature = ""
}

export function pruneDisconnectedEditableFontStyles(): void {
  if (editableStylePruneIterator || editableStylePruneTimer) {
    // A style may have become detached after the current iterator passed it.
    // Finish this bounded pass, then perform one fresh pass.
    editableStylePruneRestartRequested = true
    return
  }

  beginEditableStylePruneCycle()
  runEditableStylePruneTurn()
}

export function pruneEditableFontStylesForRoots(
  roots: Iterable<ShadowRoot>
): void {
  for (const root of roots) {
    if (isShadowRootInCurrentDocument(root)) continue
    const style = shadowEditableStyles.get(root)
    if (style) {
      style.remove()
      ownedShadowEditableStyles.delete(style)
      ownedShadowEditableStyleRoots.delete(style)
      shadowEditableStyles.delete(root)
    }
  }
}

export function refreshEditableFontStyles(
  options: {
    documentMode?: "preserve" | "refresh" | "remove"
    includeDocument?: boolean
    roots?: Iterable<ShadowRoot>
  } = {}
): void {
  const documentMode =
    options.documentMode ??
    (options.includeDocument === false ? "remove" : "refresh")
  const editableFontRules =
    documentMode === "refresh"
      ? [
          getStaticEditableFontRule(),
          ...getTopLevelContentEditableElements(document).flatMap(
            (element) => createEditableFontRule(element) ?? []
          )
        ]
      : []
  const nextSignature = editableFontRules
    .map((rule) => rule.signature)
    .join("\u0002")

  const documentStyleIsCurrent =
    nextSignature === editableFontSignature &&
    (!nextSignature || document.getElementById(EDITABLE_FONT_ID))

  if (documentMode === "refresh" && !documentStyleIsCurrent) {
    editableFontSignature = nextSignature
    const editableFontCSS = editableFontRules.map((rule) => rule.css).join("\n")

    if (editableFontCSS) {
      upsertStyle(EDITABLE_FONT_ID, editableFontCSS)
      removeContentEditableInlineFontStyles()
    }
  }

  if (documentMode === "remove") {
    editableFontSignature = ""
    removeStyle(EDITABLE_FONT_ID)
  }

  // A newly discovered shadow root is independent from the document-level
  // signature. Always reconcile its scoped stylesheet even when the document
  // rules themselves did not change.
  if (options.roots) enqueueScopedShadowRefresh(options.roots)
  else startGlobalShadowRefresh()
}

export function removeEditableFontStyles(): void {
  cancelInlineFontCleanup()
  cancelEditableStylePrune()
  cancelShadowEditableRefresh()
  editableFontSignature = ""
  removeStyle(EDITABLE_FONT_ID)

  const oldOwnedStyles = ownedShadowEditableStyles
  const oldOwnedRoots = ownedShadowEditableStyleRoots
  shadowEditableStyles = new WeakMap<ShadowRoot, HTMLStyleElement>()
  ownedShadowEditableStyles = new Set<HTMLStyleElement>()
  ownedShadowEditableStyleRoots = new WeakMap<HTMLStyleElement, ShadowRoot>()
  enqueueShadowStyleRemoval(oldOwnedStyles, oldOwnedRoots)
  document
    .querySelectorAll<HTMLStyleElement>(
      `style[${SHADOW_EDITABLE_STYLE_ATTRIBUTE}]`
    )
    .forEach((style) => {
      style.remove()
    })
  // Once the active theme and every owned shadow style are retired, keeping a
  // strong global registry would retain components removed while FontARA is
  // disabled. A later enable performs fresh bounded discovery.
  clearKnownOpenShadowRoots()
}
