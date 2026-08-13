import {
  EXCLUDED_INLINE_FONT_STYLE_PATTERN,
  EXCLUDED_TAGS,
  ICON_CLASS_PREFIXES,
  ICON_CLASS_SUBSTRINGS,
  ICON_CLASSES
} from "../config/selectors"
import { normalizeFontFamilyName, splitFontFamilies } from "../utils/font-data"
import {
  type FontaraFontRoot,
  isElementInCurrentDocument,
  isShadowRootInCurrentDocument,
  registerKnownOpenShadowRoot
} from "./shadow-roots"

export type FontWork = {
  fallbackFontFamily: string
  node: HTMLElement
}

type OwnedFontState = {
  fallbackFontFamily: string
  priority: string
  value: string
}

type OwnedFontCleanupJob = {
  elements: Set<HTMLElement>
  iterator: Iterator<HTMLElement>
  states: WeakMap<HTMLElement, OwnedFontState>
  versions: WeakMap<HTMLElement, number>
}

type OrphanFontCleanupFrame = {
  childIndex: number
  node: FontTraversalNode
  shadowVisited: boolean
}

type OrphanFontCleanupJob = {
  includeShadowRoots: boolean
  stack: OrphanFontCleanupFrame[]
}

type FontWorkCollection = {
  done: boolean
  reconcileOwned: boolean
  repeatReconcileOwned: boolean
  repeatRequested: boolean
  root: FontaraFontRoot
  stack: FontTraversalFrame[]
  started: boolean
}

type FontTraversalNode = Element | ShadowRoot

type FontTraversalFrame = {
  childIndex: number
  excludedAncestor: boolean
  node: FontTraversalNode
  ownedAncestor: HTMLElement | null
  shadowVisited: boolean
}

type FontWorkSlice = {
  deadline: IdleDeadline | undefined
  operationLimit: number
  startedAt: number
  visitedCount: number
}

const ICON_FONT_FAMILIES = new Set([
  "font awesome",
  "font awesome 5 brands",
  "font awesome 5 free",
  "font awesome 6 brands",
  "font awesome 6 free",
  "fontawesome",
  "glyphicon",
  "glyphicons halflings",
  "google symbols",
  "icomoon",
  "iconfont",
  "luminous symbols",
  "material design icons",
  "material icons",
  "material icons outlined",
  "material icons round",
  "material icons sharp",
  "material symbols",
  "material symbols outlined",
  "material symbols rounded",
  "material symbols sharp"
])
const ICON_FONT_FAMILY_PARTS = ["font awesome", "glyphicon"]
const TEXT_CONTROL_TAGS = new Set(["input", "textarea", "select", "option"])
const IDLE_CALLBACK_TIMEOUT_MS = 100
const IDLE_TIME_RESERVE_MS = 4
const FORCED_SLICE_BUDGET_MS = 8
const COLLECTION_OPERATIONS_PER_TURN = 40
const WORK_CHUNK_SIZE = 200
const TRAVERSAL_OPERATIONS_PER_SLICE = WORK_CHUNK_SIZE * 3

let ownedFontStates = new WeakMap<HTMLElement, OwnedFontState>()
let ownedFontElements = new Set<HTMLElement>()
let pendingOwnedMutationSnapshots = new WeakMap<HTMLElement, string | null>()
const pendingOwnedCleanupJobs: OwnedFontCleanupJob[] = []
const pendingOrphanCleanupJobs: OrphanFontCleanupJob[] = []
let orphanCleanupTimer: number | null = null
let disconnectedOwnedFontIterator: Iterator<HTMLElement> | null = null
let disconnectedOwnedFontPruneRequested = false
let disconnectedOwnedFontPruneTimer: number | null = null
let ownedFontVersionCounter = 0
let ownedFontVersions = new WeakMap<HTMLElement, number>()
let activeFontFamily = ""
let processingGeneration = 0
const scheduledCallbacks = new Set<{ cancel: () => void }>()
let pendingFontCollections: FontWorkCollection[] = []
let pendingFontCollectionHead = 0
let fontCollectionStepScheduled = false
let queuedFontRoots = new WeakMap<object, FontWorkCollection>()

function markOwnedStyleMutation(node: HTMLElement): void {
  pendingOwnedMutationSnapshots.set(node, node.getAttribute("style"))
}

function getContentEditableValue(node: HTMLElement): string | null {
  return typeof node.getAttribute === "function"
    ? node.getAttribute("contenteditable")
    : null
}

function isContentEditableRoot(node: HTMLElement): boolean {
  const value = getContentEditableValue(node)
  return value !== null && value.toLowerCase() !== "false"
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement
}

function hasContentEditableAncestorOrSelf(node: HTMLElement): boolean {
  if (node.isContentEditable === true) {
    return true
  }

  let current: HTMLElement | null = node
  while (current) {
    if (isContentEditableRoot(current)) return true
    current = getComposedParentElement(current)
  }

  return false
}

function hasExcludedAncestor(node: HTMLElement): boolean {
  let current = getComposedParentElement(node)
  while (current) {
    if (isExcludedSubtree(current)) return true
    current = getComposedParentElement(current)
  }
  return false
}

function getComposedParentElement(node: HTMLElement): HTMLElement | null {
  if (node.parentElement) return node.parentElement
  const root = node.getRootNode?.()
  return typeof ShadowRoot !== "undefined" &&
    root instanceof ShadowRoot &&
    root.host instanceof HTMLElement
    ? root.host
    : null
}

function hasIconClass(node: HTMLElement): boolean {
  for (const className of node.classList) {
    if (ICON_CLASSES.has(className)) return true
    if (ICON_CLASS_PREFIXES.some((prefix) => className.startsWith(prefix))) {
      return true
    }
    if (
      ICON_CLASS_SUBSTRINGS.some((substring) => className.includes(substring))
    ) {
      return true
    }
  }

  return false
}

function hasAriaHidden(node: HTMLElement): boolean {
  return node.getAttribute("aria-hidden")?.toLowerCase() === "true"
}

function hasExcludedInlineFontStyle(node: HTMLElement): boolean {
  const styleAttribute = node.getAttribute("style") ?? ""
  return EXCLUDED_INLINE_FONT_STYLE_PATTERN.test(styleAttribute)
}

function isExcludedSubtree(node: HTMLElement): boolean {
  return (
    EXCLUDED_TAGS.has(node.tagName.toLowerCase()) ||
    hasAriaHidden(node) ||
    isContentEditableRoot(node)
  )
}

function isExcludedTarget(node: HTMLElement): boolean {
  return isExcludedSubtree(node) || hasIconClass(node)
}

function hasDirectText(node: HTMLElement): boolean {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return true
    }
  }

  return false
}

function hasRenderableText(node: HTMLElement): boolean {
  return (
    hasDirectText(node) || TEXT_CONTROL_TAGS.has(node.tagName.toLowerCase())
  )
}

function isIconFontFamily(fontFamily: string): boolean {
  return splitFontFamilies(fontFamily).some((family) => {
    const normalizedFamily = normalizeFontFamilyName(family)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")

    return (
      ICON_FONT_FAMILIES.has(normalizedFamily) ||
      ICON_FONT_FAMILY_PARTS.some((part) => normalizedFamily.includes(part))
    )
  })
}

function getCleanFontFamily(
  fontFamily: string,
  inheritedFromOwnedAncestor = false
): string {
  let activeFamilyRemoved = false
  return splitFontFamilies(fontFamily)
    .map((family) => family.trim())
    .filter((family, index) => {
      const normalizedFamily = normalizeFontFamilyName(family)
      if (
        inheritedFromOwnedAncestor &&
        !activeFamilyRemoved &&
        index === 0 &&
        activeFontFamily &&
        normalizedFamily.toLocaleLowerCase() === activeFontFamily
      ) {
        activeFamilyRemoved = true
        return false
      }
      return (
        Boolean(normalizedFamily) &&
        !normalizedFamily.endsWith("-Fontara") &&
        !/^FontAraGoogle-[a-f\d]{24}$/i.test(normalizedFamily)
      )
    })
    .join(", ")
}

function getNearestOwnedAncestor(node: HTMLElement | null): HTMLElement | null {
  let current = node
  while (current) {
    if (ownedFontStates.has(current)) return current
    current = getComposedParentElement(current)
  }
  return null
}

function getCurrentFontValue(node: HTMLElement): string {
  if (!node.style) return ""
  const getPropertyValue = node.style.getPropertyValue
  return typeof getPropertyValue === "function"
    ? getPropertyValue.call(node.style, "font-family")
    : node.style.fontFamily
}

function getCurrentFontPriority(node: HTMLElement): string {
  if (!node.style) return ""
  const getPropertyPriority = node.style.getPropertyPriority
  return typeof getPropertyPriority === "function"
    ? getPropertyPriority.call(node.style, "font-family")
    : getCurrentFontValue(node)
      ? "important"
      : ""
}

function removeInlineFontFamily(node: HTMLElement): void {
  if (typeof node.style.removeProperty === "function") {
    node.style.removeProperty("font-family")
  } else {
    node.style.fontFamily = ""
  }
  if (node.style.length === 0) node.removeAttribute("style")
}

function stillOwnsFontDeclaration(
  node: HTMLElement,
  state: OwnedFontState
): boolean {
  return (
    getCurrentFontValue(node) === state.value &&
    getCurrentFontPriority(node) === state.priority
  )
}

function forgetOwnedFont(node: HTMLElement): void {
  ownedFontStates.delete(node)
  ownedFontElements.delete(node)
  ownedFontVersions.delete(node)
}

export function releaseOwnedFont(node: HTMLElement): void {
  const state = ownedFontStates.get(node)
  if (!state) return

  if (!isElementInCurrentDocument(node)) {
    forgetOwnedFont(node)
    return
  }

  if (stillOwnsFontDeclaration(node, state)) {
    removeInlineFontFamily(node)
    markOwnedStyleMutation(node)
  }
  forgetOwnedFont(node)
}

function releaseOrphanedFontaraFont(node: HTMLElement): void {
  if (!isElementInCurrentDocument(node)) {
    forgetOwnedFont(node)
    return
  }
  if (ownedFontStates.has(node)) {
    releaseOwnedFont(node)
    return
  }

  // A DOM clone/body replacement can copy FontARA's inline declaration while
  // losing the WeakMap ownership record. Treat the extension variable as the
  // durable ownership marker and reconcile it progressively instead of
  // mistaking it for a page-authored inline font.
  if (!getCurrentFontValue(node).includes("var(--fontara-font)")) return
  removeInlineFontFamily(node)
  markOwnedStyleMutation(node)
}

function createOrphanFontCleanupFrame(
  node: FontTraversalNode
): OrphanFontCleanupFrame {
  return { childIndex: 0, node, shadowVisited: false }
}

function processOrphanFontCleanupJob(
  job: OrphanFontCleanupJob,
  operationLimit: number
): { done: boolean; operations: number } {
  let operations = 0

  while (job.stack.length > 0 && operations < operationLimit) {
    const frame = job.stack[job.stack.length - 1]

    if (!frame.shadowVisited) {
      frame.shadowVisited = true
      if (
        isHTMLElement(frame.node) &&
        isElementInCurrentDocument(frame.node) &&
        !ownedFontStates.has(frame.node)
      ) {
        releaseOrphanedFontaraFont(frame.node)
      }
      if (job.includeShadowRoots) {
        const shadowRoot = getOpenShadowRoot(frame.node, { register: false })
        if (shadowRoot) {
          job.stack.push(createOrphanFontCleanupFrame(shadowRoot))
        }
      }
      operations += 1
      continue
    }

    const child = getElementChild(frame.node, frame.childIndex)
    if (child) {
      frame.childIndex += 1
      job.stack.push(createOrphanFontCleanupFrame(child))
      operations += 1
      continue
    }

    job.stack.pop()
    operations += 1
  }

  return { done: job.stack.length === 0, operations }
}

function runOrphanFontCleanupTurn(): void {
  orphanCleanupTimer = null
  let operations = 0

  while (
    pendingOrphanCleanupJobs.length > 0 &&
    operations < TRAVERSAL_OPERATIONS_PER_SLICE
  ) {
    const job = pendingOrphanCleanupJobs[0]
    if (!job) break
    const operationLimit = Math.min(
      WORK_CHUNK_SIZE,
      TRAVERSAL_OPERATIONS_PER_SLICE - operations
    )
    const result = processOrphanFontCleanupJob(job, operationLimit)
    operations += result.operations
    if (result.done) pendingOrphanCleanupJobs.shift()
    else break
  }

  if (pendingOrphanCleanupJobs.length > 0) {
    orphanCleanupTimer = window.setTimeout(runOrphanFontCleanupTurn, 0)
  }
}

export function removeOrphanedFontaraInlineStyles(
  options: { includeShadowRoots?: boolean } = {}
): void {
  const body = document.body
  if (!body) return
  pendingOrphanCleanupJobs.push({
    includeShadowRoots: options.includeShadowRoots !== false,
    stack: [createOrphanFontCleanupFrame(body)]
  })
  if (orphanCleanupTimer === null) runOrphanFontCleanupTurn()
}

export function releaseOwnedFontsInTree(root: HTMLElement): void {
  // Reconciliation releases owned declarations as each frame is entered, so
  // even very large detached/excluded subtrees are cleaned with the same hard
  // per-slice budget as normal font work.
  enqueueFontTrees([root], true)
}

export function isOwnedFontStyleMutation(
  node: HTMLElement,
  attributeName: string | null
): boolean {
  if (attributeName !== "style") return false
  if (pendingOwnedMutationSnapshots.has(node)) {
    if (
      node.getAttribute("style") === pendingOwnedMutationSnapshots.get(node)
    ) {
      return true
    }
  }
  const state = ownedFontStates.get(node)
  return Boolean(state && stillOwnsFontDeclaration(node, state))
}

export function clearOwnedFontMutationRecords(): void {
  pendingOwnedMutationSnapshots = new WeakMap<HTMLElement, string | null>()
}

function hasPageOwnedInlineFontStyle(node: HTMLElement): boolean {
  const state = ownedFontStates.get(node)
  if (state && stillOwnsFontDeclaration(node, state)) return false
  return hasExcludedInlineFontStyle(node)
}

function addFontWork(
  node: HTMLElement,
  work: FontWork[],
  context: { excludedAncestor: boolean; ownedAncestor: HTMLElement | null }
): void {
  if (!isElementInCurrentDocument(node)) {
    forgetOwnedFont(node)
    return
  }
  let state = ownedFontStates.get(node)
  if (state && !stillOwnsFontDeclaration(node, state)) {
    forgetOwnedFont(node)
    state = undefined
  }
  if (state && stillOwnsFontDeclaration(node, state)) {
    const currentVersion = ownedFontVersions.get(node)
    if (currentVersion !== undefined) {
      // Refresh the version even when no DOM write is required. This prevents
      // a cleanup iterator from an immediately previous theme from deleting a
      // declaration that the new theme has intentionally adopted unchanged.
      ownedFontVersionCounter += 1
      ownedFontVersions.set(node, ownedFontVersionCounter)
    }
  }

  if (!state && getCurrentFontValue(node).includes("var(--fontara-font)")) {
    // Detached/reinserted nodes and cloned bodies can preserve an old inline
    // marker after the WeakMap ownership was reset. Reclaim it on ordinary
    // application as well as explicit reconciliation.
    releaseOrphanedFontaraFont(node)
  }

  if (
    !isElementInCurrentDocument(node) ||
    context.excludedAncestor ||
    isExcludedTarget(node) ||
    !hasRenderableText(node) ||
    hasPageOwnedInlineFontStyle(node)
  ) {
    releaseOwnedFont(node)
    return
  }

  if (state && stillOwnsFontDeclaration(node, state)) return

  const fontFamily = window.getComputedStyle(node).fontFamily
  if (isIconFontFamily(fontFamily)) {
    releaseOwnedFont(node)
    return
  }

  work.push({
    fallbackFontFamily: getCleanFontFamily(
      fontFamily,
      Boolean(context.ownedAncestor)
    ),
    node
  })
}

function createFontWorkCollection(
  rootNode: FontaraFontRoot,
  reconcileOwned = false
): FontWorkCollection | null {
  const shadowHost =
    typeof ShadowRoot !== "undefined" && rootNode instanceof ShadowRoot
      ? rootNode.host instanceof HTMLElement
        ? rootNode.host
        : null
      : null
  const rootElement = isHTMLElement(rootNode) ? rootNode : shadowHost
  const excludedAncestor = rootElement
    ? (shadowHost ? isExcludedSubtree(shadowHost) : false) ||
      hasExcludedAncestor(rootElement)
    : false
  const ownedAncestor = rootElement
    ? ownedFontStates.has(rootElement)
      ? rootElement
      : getNearestOwnedAncestor(getComposedParentElement(rootElement))
    : null
  if (
    rootElement &&
    ((isHTMLElement(rootNode) && isExcludedSubtree(rootNode)) ||
      excludedAncestor ||
      hasContentEditableAncestorOrSelf(rootElement)) &&
    !reconcileOwned
  ) {
    if (isHTMLElement(rootNode)) releaseOwnedFontsInTree(rootNode)
    else enqueueFontTrees([rootNode], true)
    return null
  }

  return {
    done: false,
    reconcileOwned,
    repeatReconcileOwned: false,
    repeatRequested: false,
    root: rootNode,
    stack: [
      createFontTraversalFrame(rootNode, excludedAncestor, ownedAncestor)
    ],
    started: false
  }
}

function createFontTraversalFrame(
  node: FontTraversalNode,
  excludedAncestor = false,
  ownedAncestor: HTMLElement | null = null
): FontTraversalFrame {
  return {
    childIndex: 0,
    excludedAncestor,
    node,
    ownedAncestor,
    shadowVisited: false
  }
}

function getOpenShadowRoot(
  node: FontTraversalNode,
  options: { register?: boolean } = {}
): ShadowRoot | null {
  if (!isHTMLElement(node)) return null
  const shadowRoot = node.shadowRoot
  if (!shadowRoot || typeof shadowRoot.querySelectorAll !== "function") {
    return null
  }
  // The DOM processor can reach a root before the independent bounded tracker.
  // Register it immediately so cleanup and editable-style management see the
  // same set of roots.
  if (options.register !== false) registerKnownOpenShadowRoot(shadowRoot)
  return shadowRoot
}

function getElementChild(
  rootNode: FontTraversalNode,
  childIndex: number
): Element | null {
  const { children } = rootNode
  if (typeof children.item === "function") return children.item(childIndex)
  return (children as unknown as Element[])[childIndex] ?? null
}

function collectNextFontWork(
  collection: FontWorkCollection,
  work: FontWork[],
  slice?: FontWorkSlice,
  maxOperations = Number.POSITIVE_INFINITY
): boolean {
  collection.started = true
  const initialOperationCount = slice?.visitedCount ?? 0

  while (
    !collection.done &&
    (!slice || hasSliceBudget(slice)) &&
    (slice?.visitedCount ?? 0) - initialOperationCount < maxOperations
  ) {
    const frame = collection.stack[collection.stack.length - 1]
    if (!frame) {
      collection.done = true
      break
    }

    if (!frame.shadowVisited) {
      frame.shadowVisited = true
      if (collection.reconcileOwned && isHTMLElement(frame.node)) {
        releaseOrphanedFontaraFont(frame.node)
      }
      const shadowRoot = getOpenShadowRoot(frame.node)
      if (shadowRoot) {
        collection.stack.push(
          createFontTraversalFrame(
            shadowRoot,
            frame.excludedAncestor ||
              (isHTMLElement(frame.node) && isExcludedSubtree(frame.node)),
            isHTMLElement(frame.node) && ownedFontStates.has(frame.node)
              ? frame.node
              : frame.ownedAncestor
          )
        )
      }
      if (slice) slice.visitedCount += 1
      continue
    }

    const child = getElementChild(frame.node, frame.childIndex)
    if (child) {
      frame.childIndex += 1
      if (
        collection.reconcileOwned ||
        !isHTMLElement(child) ||
        !isExcludedSubtree(child)
      ) {
        collection.stack.push(
          createFontTraversalFrame(
            child,
            frame.excludedAncestor ||
              (isHTMLElement(frame.node) && isExcludedSubtree(frame.node)),
            isHTMLElement(frame.node) && ownedFontStates.has(frame.node)
              ? frame.node
              : frame.ownedAncestor
          )
        )
      }
      if (slice) slice.visitedCount += 1
      continue
    }

    // Complete descendants before their ancestor. This keeps the computed
    // fallback pristine when an earlier progressive batch has already written
    // FontARA styles elsewhere in the tree.
    collection.stack.pop()
    if (isHTMLElement(frame.node)) {
      addFontWork(frame.node, work, frame)
    }
    if (slice) slice.visitedCount += 1
  }

  collection.done = collection.stack.length === 0
  return collection.done
}

export function collectFontWork(rootNode: FontaraFontRoot): FontWork[] {
  const collection = createFontWorkCollection(rootNode)
  const work: FontWork[] = []

  if (!collection) return work

  while (!collection.done) {
    collectNextFontWork(collection, work)
  }

  return work
}

function getFontFamilyValue(fallbackFontFamily: string): string {
  return `var(--fontara-font)${
    fallbackFontFamily ? `, ${fallbackFontFamily}` : ""
  }`
}

function writeFontWork({ fallbackFontFamily, node }: FontWork): void {
  if (!isElementInCurrentDocument(node)) {
    forgetOwnedFont(node)
    return
  }
  const value = getFontFamilyValue(fallbackFontFamily)
  node.style.setProperty("font-family", value, "important")
  const state = {
    fallbackFontFamily,
    priority: "important",
    value
  }
  ownedFontStates.set(node, state)
  ownedFontElements.add(node)
  ownedFontVersionCounter += 1
  ownedFontVersions.set(node, ownedFontVersionCounter)
}

export function writeFontWorkBatch(work: FontWork[]): void {
  for (const item of work) {
    writeFontWork(item)
  }
}

function scheduleIdle(callback: (deadline?: IdleDeadline) => void): void {
  if (typeof window.requestIdleCallback === "function") {
    let completed = false
    let scheduled: { cancel: () => void } | null = null
    const callbackId = window.requestIdleCallback(
      (deadline) => {
        completed = true
        if (scheduled) scheduledCallbacks.delete(scheduled)
        callback(deadline)
      },
      {
        timeout: IDLE_CALLBACK_TIMEOUT_MS
      }
    )
    scheduled = {
      cancel: () => window.cancelIdleCallback?.(callbackId)
    }
    if (!completed) scheduledCallbacks.add(scheduled)
    return
  }

  scheduleTimeout(() => callback(), 16)
}

function scheduleInitialSlice(callback: () => void): void {
  // A newly enabled, already-rendered SPA must show progress even when the
  // browser has no idle time. Continuations still prefer idle periods.
  scheduleTimeout(callback, 0)
}

function scheduleTimeout(callback: () => void, delay: number): void {
  let completed = false
  let scheduled: { cancel: () => void } | null = null
  const timeoutId = window.setTimeout(() => {
    completed = true
    if (scheduled) scheduledCallbacks.delete(scheduled)
    callback()
  }, delay)
  scheduled = {
    cancel: () => window.clearTimeout(timeoutId)
  }
  if (!completed) scheduledCallbacks.add(scheduled)
}

function cancelScheduledCallbacks(): void {
  for (const scheduled of scheduledCallbacks) scheduled.cancel()
  scheduledCallbacks.clear()
}

function releaseCapturedOwnedFont(
  job: OwnedFontCleanupJob,
  node: HTMLElement
): void {
  const state = job.states.get(node)
  const version = job.versions.get(node)
  if (!state || version === undefined) return

  if (!isElementInCurrentDocument(node)) {
    job.states.delete(node)
    job.elements.delete(node)
    job.versions.delete(node)
    forgetOwnedFont(node)
    return
  }

  const currentState = ownedFontStates.get(node)
  const currentVersion = ownedFontVersions.get(node)
  if (
    currentState &&
    currentVersion !== undefined &&
    currentVersion !== version
  ) {
    return
  }
  if (stillOwnsFontDeclaration(node, state)) {
    removeInlineFontFamily(node)
    markOwnedStyleMutation(node)
  }
  job.states.delete(node)
  job.elements.delete(node)
  job.versions.delete(node)
  if (currentVersion === version) forgetOwnedFont(node)
}

function runOwnedCleanupTurn(): void {
  let visited = 0
  while (pendingOwnedCleanupJobs.length > 0 && visited < WORK_CHUNK_SIZE) {
    const job = pendingOwnedCleanupJobs[0]
    if (!job) break
    const next = job.iterator.next()
    if (next.done) {
      pendingOwnedCleanupJobs.shift()
      continue
    }
    visited += 1
    releaseCapturedOwnedFont(job, next.value)
  }

  if (pendingOwnedCleanupJobs.length > 0) {
    window.setTimeout(runOwnedCleanupTurn, 0)
  }
}

function runDisconnectedOwnedFontPruneTurn(): void {
  disconnectedOwnedFontPruneTimer = null
  disconnectedOwnedFontIterator ??= ownedFontElements.values()

  let visited = 0
  while (visited < WORK_CHUNK_SIZE) {
    const next = disconnectedOwnedFontIterator.next()
    if (next.done) {
      disconnectedOwnedFontIterator = null
      if (disconnectedOwnedFontPruneRequested) {
        disconnectedOwnedFontPruneRequested = false
        disconnectedOwnedFontIterator = ownedFontElements.values()
        continue
      }
      return
    }
    visited += 1
    if (!isElementInCurrentDocument(next.value)) forgetOwnedFont(next.value)
  }

  disconnectedOwnedFontPruneTimer = window.setTimeout(
    runDisconnectedOwnedFontPruneTurn,
    0
  )
}

export function pruneDisconnectedOwnedFontStyles(): void {
  if (disconnectedOwnedFontIterator) {
    disconnectedOwnedFontPruneRequested = true
    return
  }
  disconnectedOwnedFontIterator = ownedFontElements.values()
  runDisconnectedOwnedFontPruneTurn()
}

function cancelDisconnectedOwnedFontPrune(): void {
  if (disconnectedOwnedFontPruneTimer !== null) {
    window.clearTimeout(disconnectedOwnedFontPruneTimer)
  }
  disconnectedOwnedFontPruneTimer = null
  disconnectedOwnedFontIterator = null
  disconnectedOwnedFontPruneRequested = false
}

function getCurrentTime(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now()
}

function createFontWorkSlice(
  deadline?: IdleDeadline,
  operationLimit = WORK_CHUNK_SIZE
): FontWorkSlice {
  return {
    deadline,
    operationLimit,
    startedAt: getCurrentTime(),
    visitedCount: 0
  }
}

function hasSliceBudget(slice: FontWorkSlice): boolean {
  if (slice.visitedCount === 0) return true
  if (slice.visitedCount >= slice.operationLimit) return false

  if (slice.deadline && !slice.deadline.didTimeout) {
    return slice.deadline.timeRemaining() > IDLE_TIME_RESERVE_MS
  }

  // A timed-out idle callback reports no remaining idle time. Give it a small
  // wall-clock budget as well as a hard node cap so progress is guaranteed
  // without monopolizing the main thread.
  return getCurrentTime() - slice.startedAt < FORCED_SLICE_BUDGET_MS
}

function writeFontWorkChunked(work: FontWork[], generation: number): void {
  if (work.length <= WORK_CHUNK_SIZE) {
    writeFontWorkBatch(work)
    return
  }

  let index = 0

  const step = (deadline?: IdleDeadline): void => {
    if (generation !== processingGeneration) return

    const slice = createFontWorkSlice(deadline)
    while (
      index < work.length &&
      generation === processingGeneration &&
      hasSliceBudget(slice)
    ) {
      writeFontWork(work[index])
      index += 1
      slice.visitedCount += 1
    }

    if (index < work.length) {
      scheduleIdle(step)
    }
  }

  scheduleInitialSlice(() => step())
}

export function writeFontWorkBatchChunked(work: FontWork[]): void {
  writeFontWorkChunked(work, processingGeneration)
}

export function shouldChunkFontWork(work: FontWork[]): boolean {
  return work.length > WORK_CHUNK_SIZE
}

export function resetProcessedElements(
  options: { preserveOwnedStyles?: boolean } = {}
): void {
  cancelScheduledCallbacks()
  if (!options.preserveOwnedStyles) {
    cancelDisconnectedOwnedFontPrune()
    ownedFontStates = new WeakMap<HTMLElement, OwnedFontState>()
    ownedFontElements = new Set<HTMLElement>()
    ownedFontVersions = new WeakMap<HTMLElement, number>()
  }
  pendingFontCollections = []
  pendingFontCollectionHead = 0
  fontCollectionStepScheduled = false
  queuedFontRoots = new WeakMap<object, FontWorkCollection>()
  clearOwnedFontMutationRecords()
  processingGeneration += 1
}

export function removeAllOwnedFontStyles(): void {
  const oldElements = ownedFontElements
  if (oldElements.size === 0) return
  const job: OwnedFontCleanupJob = {
    elements: oldElements,
    iterator: oldElements.values(),
    states: ownedFontStates,
    versions: ownedFontVersions
  }
  const cleanupWasIdle = pendingOwnedCleanupJobs.length === 0
  pendingOwnedCleanupJobs.push(job)

  // Atomically detach the cleanup generation. New theme work can now own the
  // same DOM nodes without a stale cleanup turn deleting its declarations.
  ownedFontElements = new Set<HTMLElement>()
  ownedFontStates = new WeakMap<HTMLElement, OwnedFontState>()
  ownedFontVersions = new WeakMap<HTMLElement, number>()

  // Clear a useful visible batch immediately, then yield between bounded
  // batches. The root variable/style is removed before this function during a
  // theme cleanup, so the remaining inline declarations cannot keep rendering
  // the selected font while their bookkeeping is drained.
  if (cleanupWasIdle) runOwnedCleanupTurn()
}

export function setActiveFontFamilyForProcessing(
  fontName: string | null | undefined
): void {
  activeFontFamily = fontName
    ? normalizeFontFamilyName(fontName).toLocaleLowerCase()
    : ""
}

export function applyFontToTreeChunked(rootNode: FontaraFontRoot): void {
  applyFontToTreesChunked([rootNode])
}

export function applyFontToTreesChunked(rootNodes: FontaraFontRoot[]): void {
  enqueueFontTrees(rootNodes, false)
}

export function reconcileFontTreesChunked(rootNodes: FontaraFontRoot[]): void {
  enqueueFontTrees(rootNodes, true)
}

function enqueueFontTrees(
  rootNodes: FontaraFontRoot[],
  reconcileOwned: boolean
): void {
  if (rootNodes.length === 0) return

  let addedCollection = false
  for (const rootNode of rootNodes) {
    const existing = queuedFontRoots.get(rootNode as object)
    if (existing && !existing.done) {
      if (!existing.started) {
        if (!reconcileOwned || existing.reconcileOwned) continue

        // Root context (host aria/contenteditable state and nearest owned
        // ancestor) is captured when a collection is created. A framework can
        // mutate that context before the first scheduled slice; rebuild rather
        // than promoting a stale frame in place.
        const replacement = createFontWorkCollection(rootNode, true)
        existing.done = true
        existing.stack = []
        if (replacement) {
          queuedFontRoots.set(rootNode as object, replacement)
          pendingFontCollections.push(replacement)
          addedCollection = true
        } else {
          queuedFontRoots.delete(rootNode as object)
        }
        continue
      }
      // The cursor may already have passed the mutated node. Promote the
      // unfinished tail for immediate correctness, then request one fresh pass
      // after it completes. A boolean repeat request bounds continuous SPA
      // churn without allowing duplicate traversal chains to accumulate.
      existing.repeatRequested = true
      existing.repeatReconcileOwned ||= reconcileOwned
      if (reconcileOwned) existing.reconcileOwned = true
      continue
    }
    const collection = createFontWorkCollection(rootNode, reconcileOwned)
    if (!collection) continue
    queuedFontRoots.set(rootNode as object, collection)
    pendingFontCollections.push(collection)
    addedCollection = true
  }
  if (!addedCollection) return
  scheduleFontCollectionStep(true)
}

function compactPendingFontCollections(): void {
  if (
    pendingFontCollectionHead < 1_024 ||
    pendingFontCollectionHead * 2 < pendingFontCollections.length
  ) {
    return
  }
  pendingFontCollections = pendingFontCollections.slice(
    pendingFontCollectionHead
  )
  pendingFontCollectionHead = 0
}

function dequeuePendingFontCollection(): FontWorkCollection | null {
  const collection = pendingFontCollections[pendingFontCollectionHead] ?? null
  if (!collection) return null
  pendingFontCollectionHead += 1
  compactPendingFontCollections()
  return collection
}

function enqueuePendingFontCollection(collection: FontWorkCollection): void {
  pendingFontCollections.push(collection)
}

function hasPendingFontCollections(): boolean {
  return pendingFontCollectionHead < pendingFontCollections.length
}

function isConnectedFontWorkRoot(root: FontaraFontRoot): boolean {
  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
    return isShadowRootInCurrentDocument(root)
  }
  return isElementInCurrentDocument(root as HTMLElement)
}

function runFontCollectionStep(deadline?: IdleDeadline): void {
  fontCollectionStepScheduled = false
  const generation = processingGeneration
  if (!hasPendingFontCollections()) return

  const work: FontWork[] = []
  const slice = createFontWorkSlice(deadline, TRAVERSAL_OPERATIONS_PER_SLICE)
  while (
    hasPendingFontCollections() &&
    generation === processingGeneration &&
    hasSliceBudget(slice)
  ) {
    const collection = dequeuePendingFontCollection()
    if (!collection) break
    if (collection.done) {
      if (queuedFontRoots.get(collection.root as object) === collection) {
        queuedFontRoots.delete(collection.root as object)
      }
      slice.visitedCount += 1
      continue
    }
    if (!isConnectedFontWorkRoot(collection.root)) {
      collection.done = true
      if (queuedFontRoots.get(collection.root as object) === collection) {
        queuedFontRoots.delete(collection.root as object)
      }
      slice.visitedCount += 1
      continue
    }
    collectNextFontWork(collection, work, slice, COLLECTION_OPERATIONS_PER_TURN)
    if (!collection.done) {
      enqueuePendingFontCollection(collection)
      continue
    }

    if (collection.repeatRequested) {
      const repeatedCollection = createFontWorkCollection(
        collection.root,
        collection.repeatReconcileOwned
      )
      if (repeatedCollection) {
        queuedFontRoots.set(collection.root as object, repeatedCollection)
        enqueuePendingFontCollection(repeatedCollection)
        continue
      }
    }
    if (queuedFontRoots.get(collection.root as object) === collection) {
      queuedFontRoots.delete(collection.root as object)
    }
  }

  if (generation !== processingGeneration) return

  if (!hasPendingFontCollections()) {
    pendingFontCollections = []
    pendingFontCollectionHead = 0
  }

  // Keep computed-style reads and inline writes separated inside each bounded
  // slice while making every slice visible immediately.
  writeFontWorkBatch(work)

  if (hasPendingFontCollections()) {
    scheduleFontCollectionStep(false)
  }
}

function scheduleFontCollectionStep(initial: boolean): void {
  if (fontCollectionStepScheduled || !hasPendingFontCollections()) return
  fontCollectionStepScheduled = true
  if (initial) {
    scheduleInitialSlice(() => runFontCollectionStep())
  } else {
    scheduleIdle(runFontCollectionStep)
  }
}
