import {
  applyFontToTreesChunked,
  clearOwnedFontMutationRecords,
  isOwnedFontStyleMutation,
  pruneDisconnectedOwnedFontStyles,
  reconcileFontTreesChunked,
  resetProcessedElements
} from "./dom-processor"
import {
  EDITABLE_OBSERVER_ATTRIBUTES,
  isContentEditableElement,
  isInsideContentEditableElement,
  isOwnedEditableFontStyle,
  pruneDisconnectedEditableFontStyles,
  pruneEditableFontStylesForRoots,
  refreshEditableFontStyles
} from "./editable-font-style"
import {
  clearKnownOpenShadowRoots,
  createOpenShadowRootTracker,
  type FontaraFontRoot,
  isElementInCurrentDocument,
  isShadowRootInCurrentDocument,
  type OpenShadowRootTracker
} from "./shadow-roots"

let observer: MutationObserver | null = null
let observationStarted = false
let observedBody: HTMLElement | null = null
let observedDocumentElement: HTMLElement | null = null
let shadowRootObservers = new Map<ShadowRoot, MutationObserver>()
let pendingNodes = new Set<FontaraFontRoot>()
let pendingReconciliationNodes = new Set<FontaraFontRoot>()
let scheduledFrame: number | null = null
let scheduledFlushTimeout: number | null = null
let ownedMutationRecordClearTimer: number | null = null
let editableFontStylesDirty = false
let editableDocumentStylesDirty = false
let dirtyEditableShadowRoots = new Set<ShadowRoot>()
let shadowRootTracker: OpenShadowRootTracker | null = null
let observationMode: FontObservationMode = "all"

export type FontObservationMode = "all" | "shadow-only"

const PENDING_FLUSH_TIMEOUT_MS = 100
const LARGE_CHILD_LIST_THRESHOLD = 100

const OBSERVER_OPTIONS: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeOldValue: true,
  attributeFilter: [
    ...EDITABLE_OBSERVER_ATTRIBUTES,
    "aria-hidden",
    "class",
    "data-fontara-editable-style",
    "disabled",
    "media",
    "style",
    "type"
  ]
}

const FONT_RELEVANT_INLINE_STYLE_PATTERN =
  /(?:^|;)\s*(?:font(?:-[\w-]+)?|--[^:;]*font[^:;]*)\s*:/i

const DOCUMENT_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true
}

function getMutationElement(node: Node): HTMLElement | null {
  if (node instanceof HTMLElement) {
    return node
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement
  }

  return null
}

function getMutationElementNode(node: Node): Element | null {
  if (typeof Element !== "undefined" && node instanceof Element) return node
  return node instanceof HTMLElement ? node : null
}

function getParentFontRoot(root: FontaraFontRoot): FontaraFontRoot | null {
  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
    return root.host instanceof HTMLElement ? root.host : null
  }

  if (root.parentElement instanceof HTMLElement) return root.parentElement
  const rootNode = root.getRootNode?.()
  return typeof ShadowRoot !== "undefined" && rootNode instanceof ShadowRoot
    ? rootNode
    : null
}

function isNestedPendingRoot(
  root: FontaraFontRoot,
  roots: Set<FontaraFontRoot>
): boolean {
  let parent = getParentFontRoot(root)

  while (parent) {
    if (roots.has(parent)) return true
    parent = getParentFontRoot(parent)
  }

  return false
}

function getTopLevelPendingRoots(
  roots: Set<FontaraFontRoot>
): FontaraFontRoot[] {
  return Array.from(roots).filter((root) => !isNestedPendingRoot(root, roots))
}

function markEditableFontStylesDirtyForNode(
  node: Node,
  options: { requireEditableRoot?: boolean } = {}
): void {
  const element = getMutationElement(node)
  const ownedStyle = Boolean(
    element &&
      (isOwnedEditableFontStyle(element) ||
        element.getAttribute?.("data-fontara-editable-style") === "true")
  )
  if (
    element &&
    (ownedStyle || shouldProcessElement(element)) &&
    (ownedStyle ||
      (options.requireEditableRoot
        ? isContentEditableElement(element)
        : isInsideContentEditableElement(element)))
  ) {
    editableFontStylesDirty = true
    const root = element.getRootNode?.()
    if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
      dirtyEditableShadowRoots.add(root)
    } else {
      editableDocumentStylesDirty = true
    }
  }
}

function markEditableFontStylesDirtyForRoot(root: FontaraFontRoot): void {
  editableFontStylesDirty = true
  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
    dirtyEditableShadowRoots.add(root)
  } else {
    editableDocumentStylesDirty = true
  }
}

function addPendingNodeIfOutsideContentEditable(element: HTMLElement): void {
  if (
    shouldProcessElement(element) &&
    !isInsideContentEditableElement(element)
  ) {
    pendingNodes.add(element)
  }
}

function isInsideOpenShadowRoot(node: Node): boolean {
  if (typeof ShadowRoot === "undefined") return false
  const root =
    typeof node.getRootNode === "function" ? node.getRootNode() : null
  return root instanceof ShadowRoot
}

function shouldProcessElement(element: HTMLElement): boolean {
  return observationMode === "all" || isInsideOpenShadowRoot(element)
}

function shouldProcessRoot(root: FontaraFontRoot): boolean {
  return (
    observationMode === "all" ||
    (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) ||
    isInsideOpenShadowRoot(root)
  )
}

function isConnectedFontRoot(root: FontaraFontRoot): boolean {
  return typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot
    ? isShadowRootInCurrentDocument(root)
    : isElementInCurrentDocument(root as HTMLElement)
}

function addPendingReconciliationRoot(root: FontaraFontRoot): void {
  if (!shouldProcessRoot(root)) return
  if (root instanceof HTMLElement && isInsideContentEditableElement(root)) {
    return
  }
  pendingReconciliationNodes.add(root)
}

function observeShadowRoot(
  shadowRoot: ShadowRoot,
  options: { process?: boolean } = {}
): void {
  if (!observer || shadowRootObservers.has(shadowRoot)) return
  const shadowObserver = new MutationObserver(handleMutations)
  shadowObserver.observe(shadowRoot, OBSERVER_OPTIONS)
  shadowRootObservers.set(shadowRoot, shadowObserver)
  if (options.process === false) return
  markEditableFontStylesDirtyForRoot(shadowRoot)
  applyFontToTreesChunked([shadowRoot])
  if (scheduledFrame === null) scheduleFlush()
}

function disconnectShadowRootObserver(root: ShadowRoot): void {
  const shadowObserver = shadowRootObservers.get(root)
  if (!shadowObserver) return
  shadowObserver.takeRecords?.()
  shadowObserver.disconnect()
  shadowRootObservers.delete(root)
}

function disconnectShadowRootObservers(roots: Iterable<ShadowRoot>): void {
  for (const root of roots) disconnectShadowRootObserver(root)
}

function releasePrunedShadowRoots(roots: readonly ShadowRoot[]): void {
  // Stop delivery before removing FontARA's owned style. Otherwise the root's
  // observer can queue that removal and immediately attempt to repair it.
  disconnectShadowRootObservers(roots)
  pruneEditableFontStylesForRoots(roots)
}

function disconnectAllShadowRootObservers(): void {
  for (const shadowObserver of shadowRootObservers.values()) {
    shadowObserver.takeRecords?.()
    shadowObserver.disconnect()
  }
  shadowRootObservers = new Map<ShadowRoot, MutationObserver>()
}

function scheduleOwnedMutationRecordClear(): void {
  if (ownedMutationRecordClearTimer !== null) return
  ownedMutationRecordClearTimer = window.setTimeout(() => {
    ownedMutationRecordClearTimer = null
    clearOwnedFontMutationRecords()
  }, 0)
}

function resetOwnedMutationRecordClear(): void {
  if (ownedMutationRecordClearTimer !== null) {
    window.clearTimeout(ownedMutationRecordClearTimer)
    ownedMutationRecordClearTimer = null
  }
  clearOwnedFontMutationRecords()
}

function observeCurrentDocument(): void {
  if (!observer) return

  if (observationStarted) observer.disconnect()
  disconnectAllShadowRootObservers()
  observationStarted = true
  shadowRootTracker?.dispose()
  shadowRootTracker = null
  observedDocumentElement = document.documentElement
  observedBody = document.body

  // Watching Document covers a rare documentElement replacement, while the
  // direct documentElement observation detects head/body replacement without
  // paying the cost of a second full-subtree observer.
  observer.observe(document, DOCUMENT_OBSERVER_OPTIONS)

  if (observedDocumentElement) {
    observer.observe(observedDocumentElement, DOCUMENT_OBSERVER_OPTIONS)
  }

  if (observedBody) {
    observer.observe(observedBody, OBSERVER_OPTIONS)
    shadowRootTracker = createOpenShadowRootTracker({
      onDisconnectedRootsPruned: ({ roots }) => {
        releasePrunedShadowRoots(roots)
      },
      onRoot: observeShadowRoot,
      root: observedBody
    })
  }
}

function isEditableStyleAttributeMutation(
  mutation: MutationRecord,
  element: HTMLElement
): boolean {
  if (!isOwnedEditableFontStyle(element)) return false
  if (mutation.attributeName === "data-fontara-editable-style") return true
  return (
    mutation.attributeName === "disabled" ||
    mutation.attributeName === "media" ||
    mutation.attributeName === "type"
  )
}

function isFontRelevantStyleMutation(
  mutation: MutationRecord,
  element: HTMLElement
): boolean {
  if (mutation.attributeName !== "style") return true
  const previousStyle = mutation.oldValue ?? ""
  const currentStyle = element.getAttribute("style") ?? ""
  return (
    FONT_RELEVANT_INLINE_STYLE_PATTERN.test(previousStyle) ||
    FONT_RELEVANT_INLINE_STYLE_PATTERN.test(currentStyle)
  )
}

function synchronizeObservedBody(): boolean {
  if (
    document.body === observedBody &&
    document.documentElement === observedDocumentElement
  ) {
    return false
  }

  const previousBody = observedBody
  const bodyChanged = document.body !== previousBody
  if (bodyChanged) {
    pendingNodes = new Set()
    pendingReconciliationNodes = new Set()
    editableFontStylesDirty = true
    editableDocumentStylesDirty = true
    pruneDisconnectedOwnedFontStyles()
    pruneDisconnectedEditableFontStyles()
    resetOwnedMutationRecordClear()
    // A body generation owns a fresh bounded tracker. Retire the strong global
    // registry now; moved/connected roots in the replacement body are
    // rediscovered without retaining the detached previous body indefinitely.
    clearKnownOpenShadowRoots()
    // Reset before discovery: createOpenShadowRootTracker performs one bounded
    // synchronous slice and may immediately enqueue a newly found root.
    resetProcessedElements({ preserveOwnedStyles: true })
  }
  observeCurrentDocument()

  if (!bodyChanged) return false

  if (observedBody) {
    if (shouldProcessElement(observedBody)) {
      pendingReconciliationNodes.add(observedBody)
    }
  }

  scheduleFlush()
  return true
}

function isDocumentStructureMutation(mutation: MutationRecord): boolean {
  return (
    mutation.type === "childList" &&
    (mutation.target === document ||
      mutation.target === observedDocumentElement ||
      mutation.target === document.documentElement)
  )
}

function flushPendingNodes(): void {
  if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame)
  if (scheduledFlushTimeout !== null) {
    window.clearTimeout(scheduledFlushTimeout)
  }
  scheduledFrame = null
  scheduledFlushTimeout = null

  const nodes = getTopLevelPendingRoots(pendingNodes)
  pendingNodes = new Set()
  const reconciliationNodes = getTopLevelPendingRoots(
    pendingReconciliationNodes
  )
  pendingReconciliationNodes = new Set()
  const connectedNodes = nodes.filter(isConnectedFontRoot)
  const connectedReconciliationNodes =
    reconciliationNodes.filter(isConnectedFontRoot)
  const shouldRefreshEditableFontStyles =
    editableFontStylesDirty ||
    connectedNodes.some(
      (root) =>
        root instanceof HTMLElement && isInsideContentEditableElement(root)
    )
  editableFontStylesDirty = false

  if (shouldRefreshEditableFontStyles) {
    const connectedDirtyShadowRoots = Array.from(
      dirtyEditableShadowRoots
    ).filter(isShadowRootInCurrentDocument)
    refreshEditableFontStyles({
      documentMode:
        observationMode === "shadow-only"
          ? "remove"
          : editableDocumentStylesDirty
            ? "refresh"
            : "preserve",
      roots: connectedDirtyShadowRoots
    })
  }
  editableDocumentStylesDirty = false
  dirtyEditableShadowRoots = new Set<ShadowRoot>()

  applyFontToTreesChunked(connectedNodes)
  reconcileFontTreesChunked(connectedReconciliationNodes)
}

function scheduleFlush(): void {
  if (scheduledFrame !== null || scheduledFlushTimeout !== null) return
  scheduledFrame = requestAnimationFrame(flushPendingNodes)
  scheduledFlushTimeout = window.setTimeout(
    flushPendingNodes,
    PENDING_FLUSH_TIMEOUT_MS
  )
}

function handleMutations(mutations: MutationRecord[]): void {
  let shouldPruneDisconnectedState = false
  for (const mutation of mutations) {
    if (isDocumentStructureMutation(mutation)) {
      if (synchronizeObservedBody()) return
      continue
    }

    if (mutation.type === "attributes") {
      const element = getMutationElement(mutation.target)
      if (element) {
        if (isOwnedFontStyleMutation(element, mutation.attributeName)) {
          continue
        }
        if (!isFontRelevantStyleMutation(mutation, element)) continue
        if (shouldProcessElement(element)) {
          pendingReconciliationNodes.add(element)
        } else if (element.shadowRoot) {
          addPendingReconciliationRoot(element.shadowRoot)
        }
        shadowRootTracker?.discover(element)
        if (isEditableStyleAttributeMutation(mutation, element)) {
          markEditableFontStylesDirtyForNode(element)
        }
        if (
          shouldProcessElement(element) &&
          (mutation.attributeName === "contenteditable" ||
            isContentEditableElement(element))
        ) {
          markEditableFontStylesDirtyForNode(element, {
            requireEditableRoot: true
          })
        }
      }
      continue
    }

    if (mutation.type === "characterData") {
      const element = getMutationElement(mutation.target)
      if (element) {
        addPendingNodeIfOutsideContentEditable(element)
      }
      continue
    }

    if (mutation.type !== "childList") continue

    // Character/text churn inside an existing editor is already covered by
    // the stable editable stylesheet. Rebuilding dynamic rules on every
    // keystroke would query every editor and force computed-style reads.
    // Only a direct mutation of FontARA's owned style needs a refresh here.
    const mutationTargetElement = getMutationElement(mutation.target)
    if (
      mutationTargetElement &&
      (isOwnedEditableFontStyle(mutationTargetElement) ||
        mutationTargetElement.getAttribute?.("data-fontara-editable-style") ===
          "true")
    ) {
      markEditableFontStylesDirtyForNode(mutationTargetElement)
    }

    if (mutation.addedNodes.length > LARGE_CHILD_LIST_THRESHOLD) {
      if (
        typeof ShadowRoot !== "undefined" &&
        mutation.target instanceof ShadowRoot
      ) {
        shadowRootTracker?.discover(mutation.target)
        pendingNodes.add(mutation.target)
      } else if (mutation.target instanceof HTMLElement) {
        shadowRootTracker?.discover(mutation.target)
        addPendingNodeIfOutsideContentEditable(mutation.target)
      }
    } else {
      for (const node of mutation.addedNodes) {
        const element = getMutationElement(node)
        if (element) {
          shadowRootTracker?.discover(element)
          if (
            element.shadowRoot &&
            isShadowRootInCurrentDocument(element.shadowRoot)
          ) {
            markEditableFontStylesDirtyForRoot(element.shadowRoot)
          }
          addPendingNodeIfOutsideContentEditable(element)
          if (
            shouldProcessElement(element) &&
            isContentEditableElement(element)
          ) {
            markEditableFontStylesDirtyForNode(element, {
              requireEditableRoot: true
            })
          }
        }
      }
    }

    for (const node of mutation.removedNodes) {
      const removedElement = getMutationElement(node)
      if (
        removedElement &&
        (isOwnedEditableFontStyle(removedElement) ||
          removedElement.getAttribute?.("data-fontara-editable-style") ===
            "true") &&
        typeof ShadowRoot !== "undefined" &&
        mutation.target instanceof ShadowRoot
      ) {
        markEditableFontStylesDirtyForRoot(mutation.target)
      }
      if (removedElement && isContentEditableElement(removedElement)) {
        const mutationRoot =
          typeof ShadowRoot !== "undefined" &&
          mutation.target instanceof ShadowRoot
            ? mutation.target
            : mutation.target instanceof HTMLElement
              ? mutation.target
              : null
        if (mutationRoot) markEditableFontStylesDirtyForRoot(mutationRoot)
      }
      const element = removedElement
      if (element) {
        // A same-task DOM move produces a removed record even though the
        // subtree is already connected at delivery time. Preserve the last
        // known-good owned styles; the matching added record will discover
        // any genuinely new descendants without flashing the moved subtree.
        if (!isElementInCurrentDocument(element)) {
          shouldPruneDisconnectedState = true
        }
      }
      const removedNodeElement = getMutationElementNode(node)
      if (
        removedNodeElement &&
        !isElementInCurrentDocument(removedNodeElement)
      ) {
        shouldPruneDisconnectedState = true
      }
    }

    // A progressive traversal keeps an index into the live child list.
    // Removing an earlier sibling can shift an unvisited node behind that
    // index, so revisit the stable parent after the current frame.
    if (mutation.removedNodes.length > 0) {
      if (
        typeof ShadowRoot !== "undefined" &&
        mutation.target instanceof ShadowRoot
      ) {
        shadowRootTracker?.discover(mutation.target)
        addPendingReconciliationRoot(mutation.target)
      } else if (mutation.target instanceof HTMLElement) {
        shadowRootTracker?.discover(mutation.target)
        addPendingNodeIfOutsideContentEditable(mutation.target)
      }
    }
  }

  // Document and per-root observers deliver in separate callbacks during the
  // same microtask checkpoint. Retain ownership snapshots until all of them
  // drain, then clear once before the next task.
  scheduleOwnedMutationRecordClear()

  if (shouldPruneDisconnectedState) {
    pruneDisconnectedOwnedFontStyles()
    const prunedRoots = shadowRootTracker?.pruneDisconnected()
    if (prunedRoots) {
      releasePrunedShadowRoots(prunedRoots)
    }
  }

  if (
    pendingNodes.size > 0 ||
    pendingReconciliationNodes.size > 0 ||
    editableFontStylesDirty
  ) {
    scheduleFlush()
  }
}

export function startObserving(mode: FontObservationMode = "all"): void {
  if (observer && observationMode !== mode) stopObserving()
  observationMode = mode
  pruneDisconnectedOwnedFontStyles()
  pruneDisconnectedEditableFontStyles()
  if (observer) {
    synchronizeObservedBody()
    return
  }

  observer = new MutationObserver(handleMutations)

  observeCurrentDocument()
}

export function stopObserving(): void {
  if (scheduledFrame !== null) {
    cancelAnimationFrame(scheduledFrame)
    scheduledFrame = null
  }
  if (scheduledFlushTimeout !== null) {
    window.clearTimeout(scheduledFlushTimeout)
    scheduledFlushTimeout = null
  }
  resetOwnedMutationRecordClear()

  if (observer) {
    // Drain queued records without synchronously walking detached subtrees.
    // Ownership metadata is weak and disconnected DOM cannot affect the page.
    observer.takeRecords?.()
    observer.disconnect()
  }

  pendingNodes = new Set()
  pendingReconciliationNodes = new Set()
  editableFontStylesDirty = false
  editableDocumentStylesDirty = false
  dirtyEditableShadowRoots = new Set<ShadowRoot>()
  observationStarted = false
  observationMode = "all"
  observedBody = null
  observedDocumentElement = null
  disconnectAllShadowRootObservers()
  shadowRootTracker?.dispose()
  shadowRootTracker = null
  clearKnownOpenShadowRoots()
  observer = null
  resetProcessedElements({ preserveOwnedStyles: true })
}
