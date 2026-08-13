import {
  EXCLUDED_INLINE_FONT_STYLE_PATTERN,
  EXCLUDED_TAGS,
  ICON_CLASS_PREFIXES,
  ICON_CLASS_SUBSTRINGS,
  ICON_CLASSES
} from "../config/selectors"
import { normalizeFontFamilyName, splitFontFamilies } from "../utils/font-data"
import type { FontaraFontRoot } from "./shadow-roots"

export type FontWork = {
  fallbackFontFamily: string
  node: HTMLElement
}

type FontWorkCollection = {
  done: boolean
  stack: FontTraversalFrame[]
}

type FontTraversalNode = Element | ShadowRoot

type FontTraversalFrame = {
  childIndex: number
  node: FontTraversalNode
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

let processedElements = new WeakSet<HTMLElement>()
let processingGeneration = 0
const scheduledCallbacks = new Set<{ cancel: () => void }>()

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
    current = current.parentElement
  }

  return false
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
    hasIconClass(node) ||
    hasAriaHidden(node) ||
    isContentEditableRoot(node)
  )
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

function getCleanFontFamily(fontFamily: string): string {
  return splitFontFamilies(fontFamily)
    .map((family) => family.trim())
    .filter((family) => {
      const normalizedFamily = normalizeFontFamilyName(family)
      return (
        Boolean(normalizedFamily) &&
        !normalizedFamily.endsWith("-Fontara") &&
        !/^FontAraGoogle-[a-f\d]{24}$/i.test(normalizedFamily)
      )
    })
    .join(", ")
}

function addFontWork(node: HTMLElement, work: FontWork[]): void {
  if (
    !node.isConnected ||
    processedElements.has(node) ||
    !hasRenderableText(node) ||
    hasExcludedInlineFontStyle(node)
  ) {
    return
  }

  processedElements.add(node)

  const fontFamily = window.getComputedStyle(node).fontFamily
  if (isIconFontFamily(fontFamily)) {
    return
  }

  work.push({
    fallbackFontFamily: getCleanFontFamily(fontFamily),
    node
  })
}

function createFontWorkCollection(
  rootNode: FontaraFontRoot
): FontWorkCollection | null {
  if (
    isHTMLElement(rootNode) &&
    (isExcludedSubtree(rootNode) || hasContentEditableAncestorOrSelf(rootNode))
  ) {
    return null
  }

  return {
    done: false,
    stack: [createFontTraversalFrame(rootNode)]
  }
}

function createFontTraversalFrame(node: FontTraversalNode): FontTraversalFrame {
  return {
    childIndex: 0,
    node,
    shadowVisited: false
  }
}

function getOpenShadowRoot(node: FontTraversalNode): ShadowRoot | null {
  if (!isHTMLElement(node)) return null
  const shadowRoot = node.shadowRoot
  return shadowRoot && typeof shadowRoot.querySelectorAll === "function"
    ? shadowRoot
    : null
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
      const shadowRoot = getOpenShadowRoot(frame.node)
      if (shadowRoot) {
        collection.stack.push(createFontTraversalFrame(shadowRoot))
      }
      if (slice) slice.visitedCount += 1
      continue
    }

    const child = getElementChild(frame.node, frame.childIndex)
    if (child) {
      frame.childIndex += 1
      if (!isHTMLElement(child) || !isExcludedSubtree(child)) {
        collection.stack.push(createFontTraversalFrame(child))
      }
      if (slice) slice.visitedCount += 1
      continue
    }

    // Complete descendants before their ancestor. This keeps the computed
    // fallback pristine when an earlier progressive batch has already written
    // FontARA styles elsewhere in the tree.
    collection.stack.pop()
    if (isHTMLElement(frame.node)) addFontWork(frame.node, work)
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
  if (!node.isConnected) {
    processedElements.delete(node)
    return
  }

  node.style.setProperty(
    "font-family",
    getFontFamilyValue(fallbackFontFamily),
    "important"
  )
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

export function resetProcessedElements(): void {
  cancelScheduledCallbacks()
  processedElements = new WeakSet<HTMLElement>()
  processingGeneration += 1
}

export function applyFontToTreeChunked(rootNode: FontaraFontRoot): void {
  applyFontToTreesChunked([rootNode])
}

export function applyFontToTreesChunked(rootNodes: FontaraFontRoot[]): void {
  if (rootNodes.length === 0) return

  const collections = rootNodes.flatMap((rootNode) => {
    const collection = createFontWorkCollection(rootNode)
    return collection ? [collection] : []
  })
  const generation = processingGeneration
  let nextCollectionIndex = 0
  let remainingCollections = collections.length

  if (collections.length === 0) return

  const getNextCollection = (): FontWorkCollection | null => {
    for (let checked = 0; checked < collections.length; checked += 1) {
      const collection = collections[nextCollectionIndex]
      nextCollectionIndex = (nextCollectionIndex + 1) % collections.length
      if (!collection.done) return collection
    }
    return null
  }

  const collectStep = (deadline?: IdleDeadline): void => {
    if (generation !== processingGeneration) return

    const work: FontWork[] = []
    const slice = createFontWorkSlice(deadline, TRAVERSAL_OPERATIONS_PER_SLICE)
    while (
      remainingCollections > 0 &&
      generation === processingGeneration &&
      hasSliceBudget(slice)
    ) {
      const collection = getNextCollection()
      if (!collection) break
      if (
        collectNextFontWork(
          collection,
          work,
          slice,
          COLLECTION_OPERATIONS_PER_TURN
        )
      ) {
        remainingCollections -= 1
      }
    }

    if (generation !== processingGeneration) return

    // Keep computed-style reads and inline writes separated inside each
    // bounded slice, but commit every completed slice immediately. The old
    // all-or-nothing collection made a mature SPA appear stuck until its
    // entire DOM had been scanned.
    writeFontWorkBatch(work)

    if (remainingCollections > 0) {
      scheduleIdle(collectStep)
    }
  }

  scheduleInitialSlice(() => collectStep())
}
