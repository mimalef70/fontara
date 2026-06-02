import { applyFontToTreesChunked } from "./dom-processor"
import {
  containsContentEditableElement,
  EDITABLE_SELECTOR_ATTRIBUTES,
  isContentEditableElement,
  isInsideContentEditableElement,
  refreshEditableFontStyles
} from "./editable-font-style"

let observer: MutationObserver | null = null
let pendingNodes = new Set<HTMLElement>()
let scheduledFrame: number | null = null
let editableFontStylesDirty = false

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

function markEditableFontStylesDirtyForNode(node: Node): void {
  const element = getMutationElement(node)
  if (element && containsContentEditableElement(element)) {
    editableFontStylesDirty = true
  }
}

function addPendingNodeIfOutsideContentEditable(element: HTMLElement): void {
  if (!isInsideContentEditableElement(element)) {
    pendingNodes.add(element)
  }
}

function flushPendingNodes(): void {
  scheduledFrame = null

  const nodes = getTopLevelPendingNodes(pendingNodes)
  pendingNodes = new Set()
  const connectedNodes = nodes.filter((node) => node.isConnected)
  const shouldRefreshEditableFontStyles =
    editableFontStylesDirty ||
    connectedNodes.some(containsContentEditableElement)
  editableFontStylesDirty = false

  if (shouldRefreshEditableFontStyles) {
    refreshEditableFontStyles()
  }

  applyFontToTreesChunked(connectedNodes)
}

function scheduleFlush(): void {
  if (scheduledFrame !== null) return
  scheduledFrame = requestAnimationFrame(flushPendingNodes)
}

export function startObserving(): void {
  if (observer) return

  if (!document.body) return

  observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const element = getMutationElement(mutation.target)
        if (element) {
          addPendingNodeIfOutsideContentEditable(element)
          if (
            mutation.attributeName === "contenteditable" ||
            isContentEditableElement(element) ||
            containsContentEditableElement(element)
          ) {
            editableFontStylesDirty = true
          }
        }
        continue
      }

      if (mutation.type !== "childList") continue

      for (const node of mutation.addedNodes) {
        const element = getMutationElement(node)
        if (element) {
          addPendingNodeIfOutsideContentEditable(element)
          markEditableFontStylesDirtyForNode(element)
        }
      }

      for (const node of mutation.removedNodes) {
        markEditableFontStylesDirtyForNode(node)
      }
    }

    if (pendingNodes.size > 0 || editableFontStylesDirty) {
      scheduleFlush()
    }
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["contenteditable", ...EDITABLE_SELECTOR_ATTRIBUTES]
  })
}

export function stopObserving(): void {
  if (scheduledFrame !== null) {
    cancelAnimationFrame(scheduledFrame)
    scheduledFrame = null
  }

  pendingNodes = new Set()
  editableFontStylesDirty = false

  if (!observer) return

  observer.disconnect()
  observer = null
}
