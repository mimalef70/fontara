import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import type {
  FontaraExtensionData,
  FontaraMessageResponse,
  FontaraUIMessage
} from "../../src/definitions"
import { fontaraConnector } from "../../src/ui/connect/connector"
import {
  createFontaraBackgroundChangesMessage,
  MESSAGE_TYPES_UI_TO_BG
} from "../../src/utils/message"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
type Subscriber = (data: FontaraExtensionData) => void
type Request = {
  message: FontaraUIMessage
  respond: (response: FontaraMessageResponse<unknown>) => void
}
let listeners: Set<(message: unknown) => void>
let requests: Request[]
let subscribers: Set<Subscriber>

beforeEach(() => {
  listeners = new Set()
  requests = []
  subscribers = new Set()
  Reflect.set(globalThis, "chrome", {
    runtime: {
      onMessage: {
        addListener: (listener: (message: unknown) => void) =>
          listeners.add(listener),
        removeListener: (listener: (message: unknown) => void) =>
          listeners.delete(listener)
      },
      sendMessage(message: FontaraUIMessage, respond: Request["respond"]) {
        if (message.type === MESSAGE_TYPES_UI_TO_BG.UNSUBSCRIBE_FROM_CHANGES) {
          respond({ data: true })
        } else {
          requests.push({ message, respond })
        }
      }
    }
  })
})

afterEach(() => {
  for (const subscriber of subscribers) {
    fontaraConnector.unsubscribeFromChanges(subscriber)
  }
  Reflect.set(globalThis, "chrome", originalChrome)
})

function subscribe(callback: Subscriber): void {
  subscribers.add(callback)
  fontaraConnector.subscribeToChanges(callback)
}

function takeRequest(type: FontaraUIMessage["type"]): Request {
  const index = requests.findIndex((request) => request.message.type === type)
  assert.notEqual(index, -1, `No pending ${type} request.`)
  return requests.splice(index, 1)[0]
}

function snapshot(revision: number, tabId = 1): FontaraExtensionData {
  return {
    activeTab: {
      id: tabId,
      isActive: true,
      isSupported: true,
      url: `https://example.com/${tabId}`
    },
    isReady: true,
    settings: { selectedFont: `font-${revision}` },
    settingsRevision: revision,
    shortcuts: { toggle: "Alt+Shift+F" }
  }
}

function broadcast(data: FontaraExtensionData): void {
  for (const listener of listeners) {
    listener(createFontaraBackgroundChangesMessage(data))
  }
}

function flushResponses(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

test("a delayed subscription response cannot undo a newer settings broadcast", async () => {
  const received: FontaraExtensionData[] = []
  subscribe((data) => received.push(data))
  const initialRequest = takeRequest(
    MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES
  )
  const latest = snapshot(2)
  broadcast(latest)
  initialRequest.respond({ data: snapshot(1) })
  await flushResponses()
  broadcast(snapshot(0))

  assert.deepEqual(received, [latest])

  // Revisions are persisted across worker restarts. A fresh worker may send
  // the same settings revision with a different tab or keyboard shortcut.
  const changedTab = {
    ...snapshot(2, 3),
    shortcuts: { toggle: "Ctrl+Shift+F" }
  }
  broadcast(changedTab)
  assert.deepEqual(received, [latest, changedTab])
})

test("getData returns the latest snapshot when an older response arrives late", async () => {
  const received: FontaraExtensionData[] = []
  subscribe((data) => received.push(data))
  takeRequest(MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES).respond({
    data: snapshot(1)
  })
  await flushResponses()

  const result = fontaraConnector.getData()
  const request = takeRequest(MESSAGE_TYPES_UI_TO_BG.GET_DATA)
  const latest = snapshot(3)
  broadcast(latest)
  request.respond({ data: snapshot(2) })
  assert.equal(await result, latest)

  const newSubscriber: FontaraExtensionData[] = []
  subscribe((data) => newSubscriber.push(data))
  await flushResponses()
  assert.deepEqual(newSubscriber, [latest])
  assert.deepEqual(
    received.map((data) => data.settingsRevision),
    [1, 3]
  )
})

test("queued subscriber notifications read the latest snapshot at delivery", async () => {
  subscribe(() => {})
  takeRequest(MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES).respond({
    data: snapshot(1)
  })
  await flushResponses()

  const received: FontaraExtensionData[] = []
  subscribe((data) => received.push(data))
  const latest = snapshot(2)
  broadcast(latest)
  await flushResponses()
  assert.ok(received.length > 0)
  assert.ok(received.every((data) => data === latest))
})

test("concurrent getData calls preserve ordering without active subscribers", async () => {
  const older = fontaraConnector.getData()
  const olderRequest = takeRequest(MESSAGE_TYPES_UI_TO_BG.GET_DATA)
  const newer = fontaraConnector.getData()
  const newerRequest = takeRequest(MESSAGE_TYPES_UI_TO_BG.GET_DATA)
  const latest = snapshot(4)
  newerRequest.respond({ data: latest })
  assert.equal(await newer, latest)
  olderRequest.respond({ data: snapshot(3) })
  assert.equal(await older, latest)

  // Once all readers leave, retain neither settings nor stale UI state.
  const fresh = fontaraConnector.getData()
  const freshSnapshot = snapshot(1)
  takeRequest(MESSAGE_TYPES_UI_TO_BG.GET_DATA).respond({ data: freshSnapshot })
  assert.equal(await fresh, freshSnapshot)
})

test("a previous subscription cannot publish into a new subscription session", async () => {
  const callback: Subscriber = () => {}
  subscribe(callback)
  const oldRequest = takeRequest(MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES)
  fontaraConnector.unsubscribeFromChanges(callback)
  subscribers.delete(callback)

  const received: FontaraExtensionData[] = []
  subscribe((data) => received.push(data))
  const current = snapshot(5)
  takeRequest(MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES).respond({
    data: current
  })
  await flushResponses()
  oldRequest.respond({ data: snapshot(6) })
  await flushResponses()
  assert.deepEqual(received, [current])
})

test("duplicate subscription registration opens only one background request", async () => {
  const received: FontaraExtensionData[] = []
  const callback: Subscriber = (data) => received.push(data)
  subscribe(callback)
  subscribe(callback)
  assert.equal(requests.length, 1)
  const initial = snapshot(1)
  takeRequest(MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES).respond({
    data: initial
  })
  await flushResponses()
  assert.deepEqual(received, [initial])
})
