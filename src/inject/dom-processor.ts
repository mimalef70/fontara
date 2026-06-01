import { EXCLUDED_TAGS, ICON_CLASSES } from "../config/selectors"

export type FontWork = {
  fallbackFontFamily: string
  node: HTMLElement
}

type FontWorkCollection = {
  done: boolean
  rootNode: HTMLElement
  rootPending: boolean
  walker: TreeWalker
}

const ICON_FONT_FAMILY_PARTS = ["fontawesome", "material", "icon", "glyphicon"]
const TEXT_CONTROL_TAGS = new Set(["input", "textarea", "select", "option"])
const WORK_CHUNK_SIZE = 200

let processedElements = new WeakSet<HTMLElement>()
let processingGeneration = 0

function hasIconClass(node: HTMLElement): boolean {
  for (const className of node.classList) {
    if (ICON_CLASSES.has(className)) return true
  }

  return false
}

function isExcludedSubtree(node: HTMLElement): boolean {
  return EXCLUDED_TAGS.has(node.tagName.toLowerCase()) || hasIconClass(node)
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
  const normalizedFontFamily = fontFamily.toLowerCase()
  return ICON_FONT_FAMILY_PARTS.some((part) =>
    normalizedFontFamily.includes(part)
  )
}

function getCleanFontFamily(fontFamily: string): string {
  return fontFamily
    .split(",")
    .map((family) => family.trim().replace(/^["']+|["']+$/g, ""))
    .filter((family) => Boolean(family) && !family.endsWith("-Fontara"))
    .join(", ")
}

function hasAppliedFontaraFont(node: HTMLElement): boolean {
  return node.style.getPropertyValue("font-family").includes("--fontara-font")
}

function addFontWork(node: HTMLElement, work: FontWork[]): void {
  if (!hasRenderableText(node)) {
    return
  }

  if (processedElements.has(node) && hasAppliedFontaraFont(node)) {
    return
  }

  const fontFamily = window.getComputedStyle(node).fontFamily
  if (isIconFontFamily(fontFamily)) {
    return
  }

  processedElements.add(node)
  work.push({
    fallbackFontFamily: getCleanFontFamily(fontFamily),
    node
  })
}

function createFontWorkCollection(
  rootNode: HTMLElement
): FontWorkCollection | null {
  if (isExcludedSubtree(rootNode)) {
    return null
  }

  return {
    done: false,
    rootNode,
    rootPending: true,
    walker: document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!(node instanceof HTMLElement)) {
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

    if (node instanceof HTMLElement) {
      addFontWork(node, work)
    }

    visitedCount += 1
  }

  return collection.done
}

export function collectFontWork(rootNode: HTMLElement): FontWork[] {
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

export function applyFontToTreeChunked(rootNode: HTMLElement): void {
  if (!rootNode) return

  const collection = createFontWorkCollection(rootNode)
  const work: FontWork[] = []
  const generation = processingGeneration

  if (!collection) return

  const collectStep = (deadline?: IdleDeadline): void => {
    if (generation !== processingGeneration) return

    if (!collectNextFontWork(collection, work, deadline)) {
      scheduleIdle(collectStep)
      return
    }

    writeFontWorkChunked(work, generation)
  }

  scheduleIdle(collectStep)
}
