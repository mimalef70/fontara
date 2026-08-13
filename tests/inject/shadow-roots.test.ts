import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

const originalGlobals = {
  clearTimeout: Reflect.get(globalThis, "clearTimeout") as unknown,
  document: Reflect.get(globalThis, "document") as unknown,
  HTMLElement: Reflect.get(globalThis, "HTMLElement") as unknown,
  setTimeout: Reflect.get(globalThis, "setTimeout") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

class FakeElement {
  children: FakeElement[] = []
  static isConnectedReads = 0
  static shadowRootReads = 0
  localName: string
  ownerDocument: object | null = null
  private connected = true
  private openShadowRoot: FakeShadowRoot | null = null
  tagName: string

  constructor(localName = "div") {
    this.localName = localName
    this.tagName = localName.toUpperCase()
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    return child
  }

  get isConnected(): boolean {
    FakeElement.isConnectedReads += 1
    return this.connected
  }

  set isConnected(value: boolean) {
    this.connected = value
  }

  get shadowRoot(): FakeShadowRoot | null {
    FakeElement.shadowRootReads += 1
    return this.openShadowRoot
  }

  set shadowRoot(root: FakeShadowRoot | null) {
    this.openShadowRoot = root
    if (root) root.host = this
  }
}

class FakeShadowRoot {
  children: FakeElement[] = []
  host?: FakeElement

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    return child
  }

  querySelectorAll(): FakeElement[] {
    return []
  }
}

type TimerTask = {
  callback: () => void
  delay: number
  id: number
}

function setupShadowTrackerGlobals(): {
  dispatchVisibilityChange: (visibilityState: "hidden" | "visible") => void
  runImmediateTasks: () => void
  runNextImmediateTask: () => boolean
  runNextRescan: () => void
  timers: TimerTask[]
} {
  const timers: TimerTask[] = []
  const visibilityListeners = new Set<() => void>()
  let nextTimerId = 1

  Reflect.set(globalThis, "HTMLElement", FakeElement)
  const fakeDocument = {
    addEventListener(event: string, listener: () => void) {
      if (event === "visibilitychange") visibilityListeners.add(listener)
    },
    removeEventListener(event: string, listener: () => void) {
      if (event === "visibilitychange") visibilityListeners.delete(listener)
    },
    visibilityState: "visible" as "hidden" | "visible"
  }
  Reflect.set(globalThis, "document", fakeDocument)
  const clearTimer = (timerId: number) => {
    const index = timers.findIndex((timer) => timer.id === timerId)
    if (index >= 0) timers.splice(index, 1)
  }
  const scheduleTimer = (callback: () => void, delay = 0) => {
    const id = nextTimerId
    nextTimerId += 1
    timers.push({ callback, delay, id })
    return id
  }
  Reflect.set(globalThis, "clearTimeout", clearTimer)
  Reflect.set(globalThis, "setTimeout", scheduleTimer)
  Reflect.set(globalThis, "window", {
    clearTimeout: clearTimer,
    setTimeout: scheduleTimer
  })

  return {
    dispatchVisibilityChange(visibilityState) {
      fakeDocument.visibilityState = visibilityState
      for (const listener of visibilityListeners) listener()
    },
    runImmediateTasks() {
      let safety = 1_000
      while (safety > 0) {
        const index = timers.findIndex((timer) => timer.delay === 0)
        if (index < 0) break
        safety -= 1
        timers.splice(index, 1)[0]?.callback()
      }
      assert.ok(
        safety > 0,
        "Shadow discovery did not settle in bounded slices."
      )
    },
    runNextImmediateTask() {
      const index = timers.findIndex((timer) => timer.delay === 0)
      if (index < 0) return false
      timers.splice(index, 1)[0]?.callback()
      return true
    },
    runNextRescan() {
      const index = timers.findIndex((timer) => timer.delay > 0)
      assert.ok(
        index >= 0,
        "Shadow tracker did not schedule its bounded rescan."
      )
      timers.splice(index, 1)[0]?.callback()
    },
    timers
  }
}

afterEach(() => {
  FakeElement.isConnectedReads = 0
  FakeElement.shadowRootReads = 0
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }
})

test("shadow tracker reaches hosts beyond its first bounded slice", async () => {
  const { runImmediateTasks } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  for (let index = 0; index < 450; index += 1) {
    body.appendChild(new FakeElement())
  }
  const tailHost = body.appendChild(new FakeElement())
  const tailShadowRoot = new FakeShadowRoot()
  tailHost.shadowRoot = tailShadowRoot
  const discoveredRoots: FakeShadowRoot[] = []

  const tracker = createOpenShadowRootTracker({
    onRoot: (root) => discoveredRoots.push(root as unknown as FakeShadowRoot),
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  assert.deepEqual(discoveredRoots, [tailShadowRoot])
  assert.deepEqual(tracker.getRoots(), [tailShadowRoot])
  tracker.dispose()
})

test("shadow tracker caps every discovery slice for a 10k flat tree", async () => {
  const { runNextImmediateTask } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  for (let index = 0; index < 10_000; index += 1) {
    body.appendChild(new FakeElement())
  }
  const tailRoot = new FakeShadowRoot()
  const tailHost = body.children[body.children.length - 1]
  assert.ok(tailHost)
  tailHost.shadowRoot = tailRoot
  const discoveredRoots: FakeShadowRoot[] = []

  const tracker = createOpenShadowRootTracker({
    onRoot: (root) => discoveredRoots.push(root as unknown as FakeShadowRoot),
    root: body as unknown as ParentNode
  })
  assert.ok(
    FakeElement.shadowRootReads <= 400,
    "The initial synchronous discovery exceeded its per-slice budget."
  )

  let readsBeforeSlice = FakeElement.shadowRootReads
  while (runNextImmediateTask()) {
    const readsInSlice = FakeElement.shadowRootReads - readsBeforeSlice
    assert.ok(
      readsInSlice <= 400,
      `A discovery callback inspected ${readsInSlice} elements.`
    )
    readsBeforeSlice = FakeElement.shadowRootReads
  }

  assert.deepEqual(discoveredRoots, [tailRoot])
  tracker.dispose()
})

test("discover requests one fresh pass when its root is already active", async () => {
  const { runImmediateTasks } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  for (let index = 0; index < 450; index += 1) {
    body.appendChild(new FakeElement())
  }
  const shiftedHost = body.children[399]
  assert.ok(shiftedHost)
  const shiftedRoot = new FakeShadowRoot()
  shiftedHost.shadowRoot = shiftedRoot
  const discoveredRoots: FakeShadowRoot[] = []
  const tracker = createOpenShadowRootTracker({
    onRoot: (root) => discoveredRoots.push(root as unknown as FakeShadowRoot),
    root: body as unknown as ParentNode
  })

  assert.deepEqual(discoveredRoots, [])
  body.children.shift()
  body.appendChild(new FakeElement())
  tracker.discover(body as unknown as ParentNode)
  runImmediateTasks()

  assert.deepEqual(discoveredRoots, [shiftedRoot])
  tracker.dispose()
})

test("shadow tracker discovers a root attached after the host was connected", async () => {
  const { runImmediateTasks, runNextRescan, timers } =
    setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const host = body.appendChild(new FakeElement("fontara-late-shadow"))
  const discoveredRoots: FakeShadowRoot[] = []
  const tracker = createOpenShadowRootTracker({
    onRoot: (root) => discoveredRoots.push(root as unknown as FakeShadowRoot),
    root: body as unknown as ParentNode
  })

  runImmediateTasks()
  assert.deepEqual(discoveredRoots, [])

  const lateShadowRoot = new FakeShadowRoot()
  host.shadowRoot = lateShadowRoot
  runNextRescan()
  runImmediateTasks()

  assert.deepEqual(discoveredRoots, [lateShadowRoot])
  assert.deepEqual(tracker.getRoots(), [lateShadowRoot])

  tracker.discover(host as unknown as ParentNode)
  runImmediateTasks()
  assert.deepEqual(discoveredRoots, [lateShadowRoot])
  assert.equal(
    timers.some((timer) => timer.delay > 0),
    false,
    "The tracker kept polling after all late hosts were resolved."
  )

  tracker.dispose()
  assert.equal(timers.length, 0)
})

test("shadow tracker stops polling disconnected late hosts while hidden", async () => {
  const { dispatchVisibilityChange, runImmediateTasks, timers } =
    setupShadowTrackerGlobals()
  dispatchVisibilityChange("hidden")
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const lateHost = body.appendChild(new FakeElement("fontara-late-shadow"))
  const tracker = createOpenShadowRootTracker({
    onRoot: () => {},
    root: body as unknown as ParentNode
  })

  runImmediateTasks()
  assert.equal(
    timers.some((timer) => timer.delay > 0),
    true,
    "A connected custom-element host should be polled for a late shadow root."
  )

  lateHost.isConnected = false
  tracker.pruneDisconnected()

  assert.equal(
    timers.length,
    0,
    "A disconnected late shadow host should cancel its pending poll."
  )
  tracker.dispose()
})

test("visibility recovery discovers a root attached while hidden", async () => {
  const { dispatchVisibilityChange, runImmediateTasks, runNextRescan } =
    setupShadowTrackerGlobals()
  dispatchVisibilityChange("hidden")
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const host = body.appendChild(new FakeElement("fontara-late-shadow"))
  const discoveredRoots: FakeShadowRoot[] = []
  const tracker = createOpenShadowRootTracker({
    onRoot: (root) => discoveredRoots.push(root as unknown as FakeShadowRoot),
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  const lateRoot = new FakeShadowRoot()
  host.shadowRoot = lateRoot
  runNextRescan()
  assert.deepEqual(discoveredRoots, [])

  dispatchVisibilityChange("visible")
  runImmediateTasks()
  assert.deepEqual(discoveredRoots, [lateRoot])
  tracker.dispose()
})

test("late-host rescans stay bounded for 10k pending hosts", async () => {
  const { runImmediateTasks, runNextRescan, timers } =
    setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  for (let index = 0; index < 10_000; index += 1) {
    body.appendChild(new FakeElement(`fontara-late-${index}`))
  }
  const tracker = createOpenShadowRootTracker({
    onRoot: () => {},
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  const readsBeforeRescan = FakeElement.shadowRootReads
  runNextRescan()
  const rescanReads = FakeElement.shadowRootReads - readsBeforeRescan
  assert.ok(
    rescanReads <= 400,
    `A late-host rescan inspected ${rescanReads} hosts in one callback.`
  )
  assert.equal(
    timers.some((timer) => timer.delay === 0),
    true,
    "A large late-host pass should continue in another bounded callback."
  )

  tracker.dispose()
  assert.equal(timers.length, 0)
})

test("shadow tracker prunes disconnected roots and releases its timers", async () => {
  const { runImmediateTasks, timers } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const host = body.appendChild(new FakeElement())
  const root = new FakeShadowRoot()
  host.shadowRoot = root
  const tracker = createOpenShadowRootTracker({
    onRoot: () => {},
    root: body as unknown as ParentNode
  })
  runImmediateTasks()
  assert.deepEqual(tracker.getRoots(), [root])

  host.isConnected = false
  assert.deepEqual(tracker.pruneDisconnected(), [root])
  assert.deepEqual(tracker.getRoots(), [])

  tracker.dispose()
  assert.equal(timers.length, 0)
})

test("shadow tracker evicts a connected root adopted by another document", async (t) => {
  const { runImmediateTasks } = setupShadowTrackerGlobals()
  const {
    clearKnownOpenShadowRoots,
    createOpenShadowRootTracker,
    getKnownOpenShadowRoots,
    registerKnownOpenShadowRoot
  } = await import("../../src/inject/shadow-roots")
  clearKnownOpenShadowRoots()
  t.after(clearKnownOpenShadowRoots)

  const sourceDocument = Reflect.get(globalThis, "document") as object
  const body = new FakeElement("body")
  body.ownerDocument = sourceDocument
  const host = body.appendChild(new FakeElement("fontara-adopted-shell"))
  host.ownerDocument = sourceDocument
  const root = new FakeShadowRoot()
  host.shadowRoot = root
  const discoveredRoots: FakeShadowRoot[] = []
  const tracker = createOpenShadowRootTracker({
    onRoot: (discoveredRoot) => {
      discoveredRoots.push(discoveredRoot as unknown as FakeShadowRoot)
    },
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  assert.deepEqual(discoveredRoots, [root])
  assert.deepEqual(getKnownOpenShadowRoots(), [root])

  host.ownerDocument = {}
  host.isConnected = true

  assert.deepEqual(tracker.pruneDisconnected(), [root])
  assert.deepEqual(tracker.getRoots(), [])
  assert.deepEqual(getKnownOpenShadowRoots(), [])

  registerKnownOpenShadowRoot(root as unknown as ShadowRoot)
  tracker.discover(host as unknown as ParentNode)
  runImmediateTasks()

  assert.deepEqual(discoveredRoots, [root])
  assert.deepEqual(tracker.getRoots(), [])
  assert.deepEqual(getKnownOpenShadowRoots(), [])
  tracker.dispose()
})

test("shadow root pruning is bounded and preserves hosts reconnected before their slice", async () => {
  const { runImmediateTasks, timers } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const hosts: FakeElement[] = []
  const roots: FakeShadowRoot[] = []
  let asynchronousPruneNotifications = 0
  const asynchronouslyPrunedRoots: FakeShadowRoot[][] = []
  let reconnectedRootNotifications = 0

  for (let index = 0; index < 350; index += 1) {
    const host = body.appendChild(new FakeElement())
    const root = new FakeShadowRoot()
    host.shadowRoot = root
    hosts.push(host)
    roots.push(root)
  }

  const tracker = createOpenShadowRootTracker({
    onDisconnectedRootsPruned: ({ roots: prunedRoots }) => {
      asynchronousPruneNotifications += 1
      asynchronouslyPrunedRoots.push(
        prunedRoots.map((prunedRoot) => prunedRoot as unknown as FakeShadowRoot)
      )
    },
    onRoot: () => {},
    onRootReconnected: () => {
      reconnectedRootNotifications += 1
    },
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  const tailHost = hosts[hosts.length - 1]
  const tailRoot = roots[roots.length - 1]
  assert.ok(tailHost)
  assert.ok(tailRoot)
  tailHost.isConnected = false
  FakeElement.isConnectedReads = 0

  assert.equal(tracker.pruneDisconnected(), false)
  assert.ok(
    FakeElement.isConnectedReads <= 100,
    `A synchronous prune inspected ${FakeElement.isConnectedReads} roots.`
  )

  // A same-task move can reconnect the host before its incremental slice.
  tailHost.isConnected = true
  runImmediateTasks()
  assert.equal(
    tracker.getRoots().includes(tailRoot as unknown as ShadowRoot),
    true
  )
  assert.equal(asynchronousPruneNotifications, 0)
  assert.equal(reconnectedRootNotifications, 0)

  tailHost.isConnected = false
  FakeElement.isConnectedReads = 0
  assert.equal(tracker.pruneDisconnected(), false)
  assert.ok(FakeElement.isConnectedReads <= 100)
  runImmediateTasks()

  assert.equal(
    tracker.getRoots().includes(tailRoot as unknown as ShadowRoot),
    false
  )
  assert.equal(asynchronousPruneNotifications, 2)
  assert.deepEqual(asynchronouslyPrunedRoots, [[tailRoot], []])

  tracker.pruneDisconnected()
  assert.equal(
    timers.some((timer) => timer.delay === 0),
    true,
    "A large prune should continue in a bounded timer."
  )
  tracker.dispose()
  assert.equal(timers.length, 0)
})

test("a nested root discovered after eviction signals reconnect before normal discovery", async () => {
  const { runImmediateTasks } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const wrapper = body.appendChild(new FakeElement("section"))
  const host = wrapper.appendChild(new FakeElement("fontara-editor"))
  const root = new FakeShadowRoot()
  host.shadowRoot = root
  const events: string[] = []
  let initialDiscoveryComplete = false

  const tracker = createOpenShadowRootTracker({
    onRoot: (discoveredRoot) => {
      if (
        initialDiscoveryComplete &&
        discoveredRoot === (root as unknown as ShadowRoot)
      ) {
        events.push("root")
      }
    },
    onRootReconnected: (reconnectedRoot) => {
      if (reconnectedRoot === (root as unknown as ShadowRoot)) {
        events.push("reconnected")
      }
    },
    root: body as unknown as ParentNode
  })
  runImmediateTasks()
  initialDiscoveryComplete = true

  host.isConnected = false
  // The shared known-root registry may keep this prune cycle asynchronous;
  // the local root is still evicted in the first bounded slice.
  tracker.pruneDisconnected()
  assert.equal(
    tracker.getRoots().includes(root as unknown as ShadowRoot),
    false
  )

  host.isConnected = true
  tracker.discover(wrapper as unknown as ParentNode)
  runImmediateTasks()

  assert.deepEqual(events, ["reconnected", "root"])
  assert.deepEqual(tracker.getRoots(), [root])
  tracker.dispose()
})

test("a root reconnected after per-slice eviction is rediscovered after cleanup", async () => {
  const { runImmediateTasks, runNextImmediateTask } =
    setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const hosts: FakeElement[] = []
  const roots: FakeShadowRoot[] = []
  const callbackRoots: FakeShadowRoot[][] = []
  const events: string[] = []

  for (let index = 0; index < 350; index += 1) {
    const host = body.appendChild(new FakeElement("fontara-editor"))
    const root = new FakeShadowRoot()
    host.shadowRoot = root
    hosts.push(host)
    roots.push(root)
  }

  const targetRoot = roots[150]
  const tracker = createOpenShadowRootTracker({
    onDisconnectedRootsPruned: ({ roots: prunedRoots }) => {
      callbackRoots.push(
        prunedRoots.map((root) => root as unknown as FakeShadowRoot)
      )
    },
    onRoot: (root) => {
      if (root === (targetRoot as unknown as ShadowRoot)) events.push("root")
    },
    onRootReconnected: (root) => {
      if (root === (targetRoot as unknown as ShadowRoot)) {
        events.push("reconnected")
      }
    },
    root: body as unknown as ParentNode
  })
  runImmediateTasks()
  events.length = 0

  const targetHost = hosts[150]
  assert.ok(targetHost)
  assert.ok(targetRoot)
  targetHost.isConnected = false
  assert.equal(tracker.pruneDisconnected(), false)

  // The second prune slice evicts index 150 and leaves the aggregate callback
  // pending while later local/global entries are still being inspected.
  assert.equal(runNextImmediateTask(), true)
  assert.equal(
    tracker.getRoots().includes(targetRoot as unknown as ShadowRoot),
    false
  )

  targetHost.isConnected = true
  tracker.discover(targetHost as unknown as ParentNode)
  // Advance the queued prune continuation, then the discovery slice.
  assert.equal(runNextImmediateTask(), true)
  assert.equal(runNextImmediateTask(), true)
  assert.deepEqual(events, ["reconnected", "root"])

  runImmediateTasks()
  assert.deepEqual(callbackRoots, [[targetRoot], []])
  assert.equal(
    tracker.getRoots().includes(targetRoot as unknown as ShadowRoot),
    true
  )
  tracker.dispose()
})

test("a large prune reports bounded eviction batches before one completion signal", async () => {
  const { runImmediateTasks } = setupShadowTrackerGlobals()
  const { createOpenShadowRootTracker } = await import(
    "../../src/inject/shadow-roots"
  )
  const body = new FakeElement()
  const hosts: FakeElement[] = []
  const roots: FakeShadowRoot[] = []
  const callbackRoots: FakeShadowRoot[][] = []

  for (let index = 0; index < 350; index += 1) {
    const host = body.appendChild(new FakeElement())
    const root = new FakeShadowRoot()
    host.shadowRoot = root
    hosts.push(host)
    roots.push(root)
  }

  const tracker = createOpenShadowRootTracker({
    onDisconnectedRootsPruned: ({ roots: prunedRoots }) => {
      callbackRoots.push(
        prunedRoots.map((root) => root as unknown as FakeShadowRoot)
      )
    },
    onRoot: () => {},
    root: body as unknown as ParentNode
  })
  runImmediateTasks()

  const firstRoot = roots[0]
  const tailRoot = roots[roots.length - 1]
  const firstHost = hosts[0]
  const tailHost = hosts[hosts.length - 1]
  assert.ok(firstRoot)
  assert.ok(tailRoot)
  assert.ok(firstHost)
  assert.ok(tailHost)
  firstHost.isConnected = false
  tailHost.isConnected = false

  // The first bounded batch is available synchronously for style cleanup;
  // observer reconnection remains deferred until the cycle-complete signal.
  assert.equal(tracker.pruneDisconnected(), false)
  assert.deepEqual(callbackRoots, [[firstRoot]])
  runImmediateTasks()

  assert.deepEqual(callbackRoots, [[firstRoot], [tailRoot], []])
  tracker.dispose()
})

test("shadow root collection visits elements once and reaches nested roots", async () => {
  setupShadowTrackerGlobals()
  const { collectOpenShadowRoots } = await import(
    "../../src/inject/shadow-roots"
  )
  const documentRoot = new FakeShadowRoot()
  const outerHost = documentRoot.appendChild(new FakeElement())
  const outerRoot = new FakeShadowRoot()
  outerHost.shadowRoot = outerRoot
  const nestedHost = outerRoot.appendChild(new FakeElement())
  const nestedRoot = new FakeShadowRoot()
  nestedHost.shadowRoot = nestedRoot

  let outerHostChildrenReads = 0
  Object.defineProperty(outerHost, "children", {
    configurable: true,
    get() {
      outerHostChildrenReads += 1
      assert.ok(
        outerHostChildrenReads <= 2,
        "Shadow collection re-queued the element it was already visiting."
      )
      return []
    }
  })

  assert.deepEqual(
    collectOpenShadowRoots(documentRoot as unknown as ParentNode),
    [outerRoot, nestedRoot]
  )
  assert.ok(outerHostChildrenReads <= 1)
})
