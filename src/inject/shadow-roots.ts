export type FontaraFontRoot = HTMLElement | ShadowRoot
const SHADOW_DISCOVERY_NODES_PER_SLICE = 400
const SHADOW_PRUNE_ENTRIES_PER_SLICE = 100
const SHADOW_RESCAN_INTERVAL_MS = 1_000
const SHADOW_LATE_HOST_RESCAN_LIMIT = 30
const LATE_SHADOW_HOST_SELECTOR = "[data-fontara-shadow-host]"

const knownOpenShadowRoots = new Set<ShadowRoot>()

export function isElementInCurrentDocument(element: Element): boolean {
  if (element.isConnected === false) return false
  const ownerDocument = element.ownerDocument
  return !ownerDocument || ownerDocument === document
}

export function isShadowRootInCurrentDocument(root: ShadowRoot): boolean {
  return !root.host || isElementInCurrentDocument(root.host)
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement
}

function getElementShadowRoot(element: HTMLElement): ShadowRoot | null {
  const shadowRoot = element.shadowRoot
  return shadowRoot && typeof shadowRoot.querySelectorAll === "function"
    ? shadowRoot
    : null
}

function getElementChildren(root: ParentNode): Element[] {
  return Array.from(root.children ?? [])
}

function isPotentialLateShadowHost(element: HTMLElement): boolean {
  if ((element.localName || element.tagName.toLowerCase()).includes("-")) {
    return true
  }
  try {
    return element.matches?.(LATE_SHADOW_HOST_SELECTOR) === true
  } catch {
    return false
  }
}

export function registerKnownOpenShadowRoot(root: ShadowRoot): void {
  if (!isShadowRootInCurrentDocument(root)) return
  knownOpenShadowRoots.add(root)
}

export function getKnownOpenShadowRoots(): ShadowRoot[] {
  const roots: ShadowRoot[] = []
  for (const root of knownOpenShadowRoots) {
    if (!isShadowRootInCurrentDocument(root)) {
      knownOpenShadowRoots.delete(root)
      continue
    }
    roots.push(root)
  }
  return roots
}

export function clearKnownOpenShadowRoots(): void {
  knownOpenShadowRoots.clear()
}

export function createKnownOpenShadowRootSnapshot(): {
  iterator: Iterator<ShadowRoot>
  remaining: number
} {
  return {
    iterator: knownOpenShadowRoots.values(),
    remaining: knownOpenShadowRoots.size
  }
}

export type OpenShadowRootTracker = {
  discover: (root?: ParentNode) => void
  dispose: () => void
  getRoots: () => ShadowRoot[]
  pruneDisconnected: () => OpenShadowRootPruneResult
}

export type OpenShadowRootPruneResult = false | readonly ShadowRoot[]

type OpenShadowRootTrackerOptions = {
  onDisconnectedRootsPruned?: (result: {
    cycleCompleted: boolean
    roots: readonly ShadowRoot[]
  }) => void
  onRoot: (root: ShadowRoot) => void
  onRootReconnected?: (root: ShadowRoot) => void
  root: ParentNode
}

type PendingRootFrame = {
  childIndex: number
  knownChildCount: number
  lastVisitedChild: Element | null
  restartRequested: boolean
  root: ParentNode
  rootInspected: boolean
}

type LateShadowHostState = {
  attempts: number
  generation: number
}

type LateShadowHostEntry = {
  generation: number
  host: HTMLElement
}

type ShadowPruneStage = "idle" | "known-roots" | "late-hosts" | "roots"

export function createOpenShadowRootTracker(
  options: OpenShadowRootTrackerOptions
): OpenShadowRootTracker {
  const seenRoots = new WeakSet<ShadowRoot>()
  const roots = new Set<ShadowRoot>()
  const lateShadowHosts = new Map<HTMLElement, LateShadowHostState>()
  let lateHostQueue: LateShadowHostEntry[] = []
  let lateHostQueueHead = 0
  let nextLateHostQueue: LateShadowHostEntry[] = []
  let nextLateHostGeneration = 1
  let lateRescanRemaining = 0
  let rescanCycleActive = false
  let pendingRoots: PendingRootFrame[] = []
  let pendingRootHead = 0
  let queuedRootFrames = new WeakMap<object, PendingRootFrame>()
  let disposed = false
  let scheduledTask: ReturnType<typeof setTimeout> | null = null
  let rescanTimer: ReturnType<typeof setTimeout> | null = null
  let pruneTask: ReturnType<typeof setTimeout> | null = null
  let pruneStage: ShadowPruneStage = "idle"
  let rootPruneIterator: SetIterator<ShadowRoot> | null = null
  let knownRootPruneIterator: SetIterator<ShadowRoot> | null = null
  let lateHostPruneIterator: MapIterator<HTMLElement> | null = null
  let pruneRestartRequested = false
  let asyncPrunedAnyRoot = false

  const handleVisibilityChange = (): void => {
    if (disposed || document.visibilityState === "hidden") return
    enqueue(options.root, true)
    schedule()
    scheduleRescan()
  }

  const enqueue = (
    root: ParentNode,
    requestRestart = false,
    rootInspected = false
  ): void => {
    const key = root as object
    const queuedFrame = queuedRootFrames.get(key)
    if (queuedFrame) {
      if (requestRestart) queuedFrame.restartRequested = true
      return
    }
    const frame: PendingRootFrame = {
      childIndex: 0,
      knownChildCount: root.children?.length ?? 0,
      lastVisitedChild: null,
      restartRequested: false,
      root,
      rootInspected
    }
    queuedRootFrames.set(key, frame)
    pendingRoots.push(frame)
  }

  const compactPendingRoots = (): void => {
    if (pendingRootHead < 1_024 || pendingRootHead * 2 < pendingRoots.length) {
      return
    }
    pendingRoots = pendingRoots.slice(pendingRootHead)
    pendingRootHead = 0
  }

  const finishPendingRoot = (frame: PendingRootFrame): void => {
    if (frame.restartRequested) {
      frame.childIndex = 0
      frame.knownChildCount = frame.root.children?.length ?? 0
      frame.lastVisitedChild = null
      frame.restartRequested = false
      frame.rootInspected = false
      return
    }
    pendingRootHead += 1
    queuedRootFrames.delete(frame.root as object)
    compactPendingRoots()
  }

  const queueLateShadowHost = (element: HTMLElement): void => {
    if (lateShadowHosts.has(element)) return
    const state = {
      attempts: 0,
      generation: nextLateHostGeneration
    }
    nextLateHostGeneration += 1
    lateShadowHosts.set(element, state)
    const entry = { generation: state.generation, host: element }
    if (rescanCycleActive) nextLateHostQueue.push(entry)
    else lateHostQueue.push(entry)
  }

  const schedule = (): void => {
    if (
      disposed ||
      scheduledTask !== null ||
      pendingRootHead >= pendingRoots.length
    ) {
      return
    }
    scheduledTask = setTimeout(runSlice, 0)
  }

  const discoverShadowRoot = (element: HTMLElement): void => {
    const shadowRoot = getElementShadowRoot(element)
    if (!shadowRoot) {
      if (isPotentialLateShadowHost(element)) queueLateShadowHost(element)
      return
    }
    lateShadowHosts.delete(element)
    const wasSeen = seenRoots.has(shadowRoot)
    if (!wasSeen || !roots.has(shadowRoot)) {
      if (!wasSeen) seenRoots.add(shadowRoot)
      roots.add(shadowRoot)
      registerKnownOpenShadowRoot(shadowRoot)
      // Signal before onRoot so consumers can invalidate observation guards
      // before their normal discovery callback observes and processes the
      // reconnected root. This also works when the host is nested inside an
      // added wrapper and is reached by the tracker's bounded traversal.
      if (wasSeen) options.onRootReconnected?.(shadowRoot)
      options.onRoot(shadowRoot)
    }
    enqueue(shadowRoot)
  }

  const runSlice = (): void => {
    scheduledTask = null
    let visited = 0
    while (
      !disposed &&
      pendingRootHead < pendingRoots.length &&
      visited < SHADOW_DISCOVERY_NODES_PER_SLICE
    ) {
      const frame = pendingRoots[pendingRootHead]
      if (!frame) break
      const shadowHost = (frame.root as ShadowRoot).host
      if (
        (isHTMLElement(frame.root) &&
          !isElementInCurrentDocument(frame.root)) ||
        (isHTMLElement(shadowHost) && !isElementInCurrentDocument(shadowHost))
      ) {
        frame.restartRequested = false
        finishPendingRoot(frame)
        visited += 1
        continue
      }
      if (!frame.rootInspected) {
        frame.rootInspected = true
        if (isHTMLElement(frame.root)) discoverShadowRoot(frame.root)
        visited += 1
        continue
      }

      const children = frame.root.children
      const currentChildCount = children?.length ?? 0
      if (currentChildCount < frame.knownChildCount) {
        // The collection is live. If an earlier sibling disappears, move the
        // cursor back by the shrink amount so the shifted child is not skipped.
        frame.childIndex = Math.max(
          0,
          frame.childIndex - (frame.knownChildCount - currentChildCount)
        )
      }
      frame.knownChildCount = currentChildCount
      const getChildAt = (index: number): Element | null =>
        children?.item ? children.item(index) : (children?.[index] ?? null)
      if (
        frame.childIndex > 0 &&
        frame.lastVisitedChild &&
        getChildAt(frame.childIndex - 1) !== frame.lastVisitedChild
      ) {
        // A same-length replace/reorder cannot be detected from collection
        // length. Restarting prevents an unvisited shifted sibling from
        // falling behind the live cursor. Queued descendants stay deduped.
        frame.childIndex = 0
        frame.lastVisitedChild = null
      }
      const child = getChildAt(frame.childIndex)
      if (!child) {
        finishPendingRoot(frame)
        visited += 1
        continue
      }
      frame.childIndex += 1
      frame.lastVisitedChild = child
      if (isHTMLElement(child)) discoverShadowRoot(child)
      enqueue(child, false, true)
      visited += 1
    }
    schedule()
    scheduleRescan()
  }

  const runRescanSlice = (): void => {
    rescanTimer = null
    if (disposed) return
    if (lateShadowHosts.size === 0) {
      lateHostQueue = []
      lateHostQueueHead = 0
      nextLateHostQueue = []
      lateRescanRemaining = 0
      rescanCycleActive = false
      return
    }

    if (!rescanCycleActive) {
      rescanCycleActive = true
      lateRescanRemaining = lateHostQueue.length - lateHostQueueHead
    }

    const canDiscover = document.visibilityState !== "hidden"
    let visited = 0
    while (
      !disposed &&
      lateRescanRemaining > 0 &&
      visited < SHADOW_DISCOVERY_NODES_PER_SLICE
    ) {
      const entry = lateHostQueue[lateHostQueueHead]
      lateHostQueueHead += 1
      lateRescanRemaining -= 1
      visited += 1
      if (!entry) continue

      const state = lateShadowHosts.get(entry.host)
      if (!state || state.generation !== entry.generation) continue
      if (!isElementInCurrentDocument(entry.host)) {
        lateShadowHosts.delete(entry.host)
        continue
      }

      if (canDiscover) discoverShadowRoot(entry.host)
      const currentState = lateShadowHosts.get(entry.host)
      if (!currentState || currentState.generation !== entry.generation) {
        continue
      }
      currentState.attempts += 1
      if (currentState.attempts >= SHADOW_LATE_HOST_RESCAN_LIMIT) {
        lateShadowHosts.delete(entry.host)
      } else {
        nextLateHostQueue.push(entry)
      }
    }

    if (lateRescanRemaining > 0) {
      rescanTimer = setTimeout(runRescanSlice, 0)
      return
    }

    rescanCycleActive = false
    lateHostQueue = nextLateHostQueue
    lateHostQueueHead = 0
    nextLateHostQueue = []
    scheduleRescan()
  }

  const scheduleRescan = (): void => {
    if (
      disposed ||
      rescanTimer !== null ||
      lateShadowHosts.size === 0 ||
      typeof setTimeout !== "function"
    ) {
      return
    }
    rescanTimer = setTimeout(runRescanSlice, SHADOW_RESCAN_INTERVAL_MS)
  }

  const stopLateHostRescanIfEmpty = (): void => {
    if (lateShadowHosts.size !== 0) return
    if (rescanTimer !== null) clearTimeout(rescanTimer)
    rescanTimer = null
    rescanCycleActive = false
    lateRescanRemaining = 0
    lateHostQueue = []
    lateHostQueueHead = 0
    nextLateHostQueue = []
  }

  const beginPruneCycle = (): void => {
    pruneStage = "roots"
    rootPruneIterator = roots.values()
    knownRootPruneIterator = knownOpenShadowRoots.values()
    lateHostPruneIterator = lateShadowHosts.keys()
  }

  const finishPruneCycle = (): boolean => {
    rootPruneIterator = null
    knownRootPruneIterator = null
    lateHostPruneIterator = null
    stopLateHostRescanIfEmpty()

    if (pruneRestartRequested) {
      pruneRestartRequested = false
      beginPruneCycle()
      return false
    }
    pruneStage = "idle"
    return true
  }

  const runPruneSlice = (): {
    cycleCompleted: boolean
    removedRoots: ShadowRoot[]
  } => {
    let cycleCompleted = false
    const removedRoots: ShadowRoot[] = []
    let visited = 0

    while (
      !disposed &&
      pruneStage !== "idle" &&
      visited < SHADOW_PRUNE_ENTRIES_PER_SLICE
    ) {
      if (pruneStage === "roots") {
        const entry = rootPruneIterator?.next()
        if (!entry || entry.done) {
          pruneStage = "known-roots"
          continue
        }
        visited += 1
        if (!isShadowRootInCurrentDocument(entry.value)) {
          roots.delete(entry.value)
          knownOpenShadowRoots.delete(entry.value)
          removedRoots.push(entry.value)
        }
        continue
      }

      if (pruneStage === "known-roots") {
        const entry = knownRootPruneIterator?.next()
        if (!entry || entry.done) {
          pruneStage = "late-hosts"
          continue
        }
        visited += 1
        // Tracker-owned roots were already checked in this cycle. Avoid a
        // second host connectivity read while still advancing the global set's
        // bounded iterator for roots registered by other discovery paths.
        if (roots.has(entry.value)) continue
        if (!isShadowRootInCurrentDocument(entry.value)) {
          knownOpenShadowRoots.delete(entry.value)
          removedRoots.push(entry.value)
        }
        continue
      }

      const entry = lateHostPruneIterator?.next()
      if (!entry || entry.done) {
        cycleCompleted = finishPruneCycle()
        break
      }
      visited += 1
      if (!isElementInCurrentDocument(entry.value)) {
        lateShadowHosts.delete(entry.value)
      }
    }

    return { cycleCompleted, removedRoots }
  }

  const schedulePrune = (): void => {
    if (disposed || pruneTask !== null || pruneStage === "idle") return

    pruneTask = setTimeout(() => {
      pruneTask = null
      const result = runPruneSlice()
      if (result.removedRoots.length > 0) {
        asyncPrunedAnyRoot = true
        options.onDisconnectedRootsPruned?.({
          cycleCompleted: result.cycleCompleted,
          roots: result.removedRoots
        })
      }
      if (result.cycleCompleted && asyncPrunedAnyRoot) {
        asyncPrunedAnyRoot = false
        if (result.removedRoots.length === 0) {
          options.onDisconnectedRootsPruned?.({
            cycleCompleted: true,
            roots: []
          })
        }
      }
      schedulePrune()
    }, 0)
  }

  enqueue(options.root)
  document.addEventListener?.("visibilitychange", handleVisibilityChange)
  // Inspect one bounded slice immediately so small existing component trees
  // are observed before their next mutation. Large trees continue in timers.
  runSlice()

  return {
    discover(root = options.root) {
      if (disposed) return
      enqueue(root, true)
      schedule()
      scheduleRescan()
    },
    dispose() {
      disposed = true
      pendingRoots = []
      pendingRootHead = 0
      queuedRootFrames = new WeakMap<object, PendingRootFrame>()
      if (scheduledTask !== null) clearTimeout(scheduledTask)
      if (rescanTimer !== null) clearTimeout(rescanTimer)
      if (pruneTask !== null) clearTimeout(pruneTask)
      document.removeEventListener?.("visibilitychange", handleVisibilityChange)
      scheduledTask = null
      rescanTimer = null
      pruneTask = null
      pruneStage = "idle"
      rootPruneIterator = null
      knownRootPruneIterator = null
      lateHostPruneIterator = null
      pruneRestartRequested = false
      asyncPrunedAnyRoot = false
      rescanCycleActive = false
      lateRescanRemaining = 0
      lateHostQueue = []
      lateHostQueueHead = 0
      nextLateHostQueue = []
      lateShadowHosts.clear()
      roots.clear()
    },
    getRoots() {
      // The bounded prune pipeline is the sole owner of deletions so every
      // evicted root is reported to editable-style cleanup. Reconnection only
      // needs a connected snapshot and must not silently mutate the registry.
      return Array.from(roots).filter(isShadowRootInCurrentDocument)
    },
    pruneDisconnected() {
      if (disposed) return false
      if (pruneStage !== "idle" || pruneTask !== null) {
        // A root may have disconnected after the active iterator passed it.
        // Request one fresh bounded cycle rather than restarting every slice.
        pruneRestartRequested = true
        return false
      }

      beginPruneCycle()
      const result = runPruneSlice()
      if (!result.cycleCompleted) {
        if (result.removedRoots.length > 0) {
          asyncPrunedAnyRoot = true
          options.onDisconnectedRootsPruned?.({
            cycleCompleted: false,
            roots: result.removedRoots
          })
        }
      }
      schedulePrune()
      return result.cycleCompleted && result.removedRoots.length > 0
        ? result.removedRoots
        : false
    }
  }
}

export function collectOpenShadowRoots(root: ParentNode): ShadowRoot[] {
  const shadowRoots: ShadowRoot[] = []
  const seen = new WeakSet<ShadowRoot>()
  const pending: ParentNode[] = [root]

  while (pending.length > 0) {
    const currentRoot = pending.pop()
    if (!currentRoot) continue
    const elements = getElementChildren(currentRoot)
    if (isHTMLElement(currentRoot)) {
      const ownShadowRoot = getElementShadowRoot(currentRoot)
      if (ownShadowRoot && !seen.has(ownShadowRoot)) {
        seen.add(ownShadowRoot)
        registerKnownOpenShadowRoot(ownShadowRoot)
        shadowRoots.push(ownShadowRoot)
        pending.push(ownShadowRoot)
      }
    }
    for (const element of elements) {
      if (!isHTMLElement(element)) continue
      const shadowRoot = getElementShadowRoot(element)
      if (shadowRoot && !seen.has(shadowRoot)) {
        seen.add(shadowRoot)
        registerKnownOpenShadowRoot(shadowRoot)
        shadowRoots.push(shadowRoot)
        pending.push(shadowRoot)
      }
      pending.push(element)
    }
  }

  return shadowRoots
}
