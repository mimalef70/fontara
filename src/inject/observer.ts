import {
  collectFontWork,
  shouldChunkFontWork,
  writeFontWorkBatch,
  writeFontWorkBatchChunked
} from "./dom-processor"

let observer: MutationObserver | null = null
let pendingNodes = new Set<HTMLElement>()
let scheduledFrame: number | null = null

function getMutationElement(node: Node): HTMLElement | null {
  if (node instanceof HTMLElement) {
    return node
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement
  }

  return null
}

function isNestedPendingNode(
  node: HTMLElement,
  nodes: Set<HTMLElement>
): boolean {
  let parent = node.parentElement

  while (parent) {
    if (nodes.has(parent)) return true
    parent = parent.parentElement
  }

  return false
}

function getTopLevelPendingNodes(nodes: Set<HTMLElement>): HTMLElement[] {
  return Array.from(nodes).filter((node) => !isNestedPendingNode(node, nodes))
}

function flushPendingNodes(): void {
  scheduledFrame = null

  const nodes = getTopLevelPendingNodes(pendingNodes)
  pendingNodes = new Set()
  const work = nodes.flatMap((node) =>
    node.isConnected ? collectFontWork(node) : []
  )

  if (shouldChunkFontWork(work)) {
    writeFontWorkBatchChunked(work)
    return
  }

  writeFontWorkBatch(work)
}

function scheduleFlush(): void {
  if (scheduledFrame !== null) return
  scheduledFrame = requestAnimationFrame(flushPendingNodes)
}

export function startObserving(): void {
  stopObserving()

  if (!document.body) return

  observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue

      for (const node of mutation.addedNodes) {
        const element = getMutationElement(node)
        if (element) {
          pendingNodes.add(element)
        }
      }
    }

    if (pendingNodes.size > 0) {
      scheduleFlush()
    }
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true
  })
}

export function stopObserving(): void {
  if (scheduledFrame !== null) {
    cancelAnimationFrame(scheduledFrame)
    scheduledFrame = null
  }

  pendingNodes = new Set()

  if (!observer) return

  observer.disconnect()
  observer = null
}
