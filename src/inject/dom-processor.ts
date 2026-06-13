import {
  EXCLUDED_INLINE_FONT_STYLE_PATTERN,
  EXCLUDED_TAGS,
  ICON_CLASS_PREFIXES,
  ICON_CLASS_SUBSTRINGS,
  ICON_CLASSES
} from "../config/selectors"
import { normalizeFontFamilyName, splitFontFamilies } from "../utils/font-data"
import { collectOpenShadowRoots, type FontaraFontRoot } from "./shadow-roots"

export type FontWork = {
  fallbackFontFamily: string
  node: HTMLElement
}

type FontWorkCollection = {
  done: boolean
  rootNode: FontaraFontRoot
  rootPending: boolean
  walker: TreeWalker
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
const ROOT_COLLECTIONS_PER_TIMEOUT = 20
const WORK_CHUNK_SIZE = 200

let processedElements = new WeakSet<HTMLElement>()
let processingGeneration = 0

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
      return Boolean(normalizedFamily) && !normalizedFamily.endsWith("-Fontara")
    })
    .join(", ")
}

function addFontWork(node: HTMLElement, work: FontWork[]): void {
  if (
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
    rootNode,
    rootPending: true,
    walker: document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!isHTMLElement(node)) {
          return NodeFilter.FILTER_SKIP
        }

        return isExcludedSubtree(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      }
    })
  }
}

function collectNextFontWork(
  collection: FontWorkCollection,
  work: FontWork[],
  deadline?: IdleDeadline
): boolean {
  let visitedCount = 0

  while (!collection.done && shouldContinueChunk(deadline, visitedCount)) {
    const node = collection.rootPending
      ? collection.rootNode
      : collection.walker.nextNode()

    collection.rootPending = false

    if (!node) {
      collection.done = true
      break
    }

    if (isHTMLElement(node)) {
      addFontWork(node, work)
    }

    visitedCount += 1
  }

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
  if (!node.isConnected) return

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
    window.requestIdleCallback((deadline) => callback(deadline))
    return
  }

  window.setTimeout(() => callback(), 16)
}

function shouldContinueChunk(
  deadline: IdleDeadline | undefined,
  writtenCount: number
): boolean {
  if (!deadline) {
    return writtenCount < WORK_CHUNK_SIZE
  }

  return deadline.timeRemaining() > 4 || writtenCount === 0
}

function writeFontWorkChunked(work: FontWork[], generation: number): void {
  if (work.length <= WORK_CHUNK_SIZE) {
    writeFontWorkBatch(work)
    return
  }

  let index = 0

  const step = (deadline?: IdleDeadline): void => {
    if (generation !== processingGeneration) return

    let writtenCount = 0
    while (
      index < work.length &&
      generation === processingGeneration &&
      shouldContinueChunk(deadline, writtenCount)
    ) {
      writeFontWork(work[index])
      index += 1
      writtenCount += 1
    }

    if (index < work.length) {
      scheduleIdle(step)
    }
  }

  scheduleIdle(step)
}

export function writeFontWorkBatchChunked(work: FontWork[]): void {
  writeFontWorkChunked(work, processingGeneration)
}

export function shouldChunkFontWork(work: FontWork[]): boolean {
  return work.length > WORK_CHUNK_SIZE
}

export function resetProcessedElements(): void {
  processedElements = new WeakSet<HTMLElement>()
  processingGeneration += 1
}

function expandFontRootNodes(rootNodes: FontaraFontRoot[]): FontaraFontRoot[] {
  const expandedRootNodes: FontaraFontRoot[] = []
  const seenRootNodes = new WeakSet<object>()

  function addRootNode(rootNode: FontaraFontRoot): void {
    if (seenRootNodes.has(rootNode)) return

    seenRootNodes.add(rootNode)
    expandedRootNodes.push(rootNode)

    for (const shadowRoot of collectOpenShadowRoots(rootNode)) {
      addRootNode(shadowRoot)
    }
  }

  for (const rootNode of rootNodes) {
    addRootNode(rootNode)
  }

  return expandedRootNodes
}

export function applyFontToTreeChunked(rootNode: FontaraFontRoot): void {
  applyFontToTreesChunked([rootNode])
}

export function applyFontToTreesChunked(rootNodes: FontaraFontRoot[]): void {
  if (rootNodes.length === 0) return

  const collections = expandFontRootNodes(rootNodes).flatMap((rootNode) => {
    const collection = createFontWorkCollection(rootNode)
    return collection ? [collection] : []
  })
  const work: FontWork[] = []
  const generation = processingGeneration
  let collectionIndex = 0

  if (collections.length === 0) return

  const collectStep = (deadline?: IdleDeadline): void => {
    if (generation !== processingGeneration) return

    let completedCollections = 0
    while (
      collectionIndex < collections.length &&
      generation === processingGeneration
    ) {
      const collection = collections[collectionIndex]
      if (!collectNextFontWork(collection, work, deadline)) {
        scheduleIdle(collectStep)
        return
      }

      collectionIndex += 1
      completedCollections += 1

      if (
        collectionIndex < collections.length &&
        ((deadline && !shouldContinueChunk(deadline, 1)) ||
          (!deadline && completedCollections >= ROOT_COLLECTIONS_PER_TIMEOUT))
      ) {
        scheduleIdle(collectStep)
        return
      }
    }

    writeFontWorkChunked(work, generation)
  }

  scheduleIdle(collectStep)
}
