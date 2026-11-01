import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { sendDocumentLifecycleMessage } from "../../src/inject/content-messaging"
import { MESSAGE_TYPES_CS_TO_BG } from "../../src/utils/message"

const originalGlobals = {
  chrome: Reflect.get(globalThis, "chrome") as unknown,
  window: Reflect.get(globalThis, "window") as unknown
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    Reflect.set(globalThis, key, value)
  }
})

function installMessagingMock(errors: Array<string | Error | null>): {
  options: Parameters<typeof sendDocumentLifecycleMessage>[1]
  attempts: unknown[]
  timers: Array<() => void>
  warnings: unknown[]
  dispose: () => void
  invalidations: () => number
} {
  const attempts: unknown[] = []
  const timers: Array<() => void> = []
  const warnings: unknown[] = []
  let disposed = false
  let invalidations = 0
  let lastError: { message: string } | undefined

  Reflect.set(globalThis, "window", {
    location: { href: "https://github.com/" },
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 250)
      timers.push(callback)
      return timers.length
    }
  })
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return lastError
      },
      sendMessage(message: unknown, callback: () => void) {
        attempts.push(message)
        const error = errors.shift()
        if (error instanceof Error) throw error
        lastError = error ? { message: error } : undefined
        callback()
        lastError = undefined
      }
    }
  })

  return {
    attempts,
    timers,
    warnings,
    dispose() {
      disposed = true
    },
    invalidations: () => invalidations,
    options: {
      isDisposed: () => disposed,
      onExtensionContextInvalidated: () => {
        invalidations += 1
        disposed = true
      },
      scriptId: "test-script",
      warn: (_message, error) => warnings.push(error)
    }
  }
}

function runNextRetry(timers: Array<() => void>): void {
  const retry = timers.shift()
  assert.ok(retry, "expected a scheduled retry")
  retry()
}

test("document lifecycle messages recover from transient MV3 send failures", () => {
  const runtime = installMessagingMock([
    "Could not establish connection. Receiving end does not exist.",
    "The message port closed before a response was received.",
    null
  ])
  const sent = sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT,
    runtime.options
  )

  assert.equal(sent, true)
  assert.equal(runtime.attempts.length, 1)
  runNextRetry(runtime.timers)
  runNextRetry(runtime.timers)
  assert.equal(runtime.attempts.length, 3)
  assert.deepEqual(runtime.attempts, Array(3).fill(runtime.attempts[0]))
  assert.equal(runtime.timers.length, 0)
  assert.equal(runtime.invalidations(), 0)
  assert.deepEqual(runtime.warnings, [])
})

test("transient send retries are bounded and stop after disposal", () => {
  const runtime = installMessagingMock(
    Array(8).fill("Receiving end does not exist")
  )
  sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
    runtime.options
  )
  for (let attempt = 0; attempt < 4; attempt += 1) runNextRetry(runtime.timers)
  assert.equal(runtime.attempts.length, 5)
  assert.equal(runtime.timers.length, 0)
  assert.deepEqual(runtime.warnings, [])

  sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
    runtime.options
  )
  runtime.dispose()
  runNextRetry(runtime.timers)
  assert.equal(runtime.attempts.length, 6)
  assert.equal(runtime.timers.length, 0)
})

test("a missing runtime returns false so local fallback starts immediately", () => {
  const runtime = installMessagingMock([])
  for (const chromeMock of [undefined, {}, { runtime: {} }]) {
    Reflect.set(globalThis, "chrome", chromeMock)
    assert.equal(
      sendDocumentLifecycleMessage(
        MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
        runtime.options
      ),
      false
    )
  }
  assert.deepEqual(runtime.warnings, [])
  assert.equal(runtime.timers.length, 0)
})

test("synchronously thrown transient errors trigger retries and local fallback", () => {
  const runtime = installMessagingMock([
    new Error("Could not establish connection. Receiving end does not exist."),
    null
  ])
  assert.equal(
    sendDocumentLifecycleMessage(
      MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME,
      runtime.options
    ),
    false
  )
  runNextRetry(runtime.timers)
  assert.equal(runtime.attempts.length, 2)
  assert.deepEqual(runtime.warnings, [])
})

test("invalidated contexts dispose once without a retry", () => {
  for (const error of [
    "Extension context invalidated.",
    new Error("Extension context invalidated.")
  ]) {
    const runtime = installMessagingMock([error])
    sendDocumentLifecycleMessage(
      MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
      runtime.options
    )
    assert.equal(runtime.invalidations(), 1)
    assert.equal(runtime.timers.length, 0)
    assert.equal(
      sendDocumentLifecycleMessage(
        MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
        runtime.options
      ),
      false
    )
    assert.equal(runtime.attempts.length, 1)
    assert.deepEqual(runtime.warnings, [])
  }
})

test("unexpected send errors are reported without retrying", () => {
  const runtime = installMessagingMock(["Unexpected runtime failure"])
  sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
    runtime.options
  )
  assert.equal(runtime.warnings.length, 1)
  assert.equal(runtime.timers.length, 0)
})

test("FORGET is never retried after a document could have resumed", () => {
  const runtime = installMessagingMock(["Receiving end does not exist"])
  sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET,
    runtime.options
  )
  assert.equal(runtime.attempts.length, 1)
  assert.equal(runtime.timers.length, 0)
})

test("new lifecycle requests supersede pending retries including before BFCache", () => {
  for (const nextType of [
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
  ]) {
    const runtime = installMessagingMock(["Receiving end does not exist", null])
    sendDocumentLifecycleMessage(
      MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT,
      runtime.options
    )
    assert.equal(runtime.timers.length, 1)
    sendDocumentLifecycleMessage(nextType, runtime.options)
    runNextRetry(runtime.timers)
    assert.equal(
      runtime.attempts.length,
      2,
      "a stale retry must not supersede a newer update or re-register a frozen document"
    )
    assert.equal(runtime.timers.length, 0)
  }
})
