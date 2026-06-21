import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

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

test("sendDocumentLifecycleMessage retries transient MV3 service worker errors", async () => {
  let sendAttempts = 0
  let lastError: { message: string } | undefined

  Reflect.set(globalThis, "window", {
    location: { href: "https://github.com/" },
    setTimeout
  })

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return lastError
      },
      sendMessage(_message: unknown, callback: () => void) {
        sendAttempts += 1
        if (sendAttempts < 3) {
          lastError = {
            message:
              "Could not establish connection. Receiving end does not exist."
          }
        } else {
          lastError = undefined
        }
        callback()
      }
    }
  })

  const { sendDocumentLifecycleMessage } = await import(
    "../../src/inject/content-messaging"
  )

  const delivered = sendDocumentLifecycleMessage(
    MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
    {
      isDisposed: () => false,
      onExtensionContextInvalidated: () => {
        assert.fail("transient send errors must not dispose the runtime")
      },
      scriptId: "test-script"
    }
  )

  assert.equal(delivered, true)
  assert.equal(sendAttempts, 1)

  await new Promise((resolve) => setTimeout(resolve, 600))

  assert.equal(sendAttempts, 3)
})

test("sendDocumentLifecycleMessage stays silent after transient MV3 send failures", async () => {
  let sendAttempts = 0
  let warnCalls = 0

  Reflect.set(globalThis, "window", {
    location: { href: "https://github.com/" },
    setTimeout
  })

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return {
          message:
            "Could not establish connection. Receiving end does not exist."
        }
      },
      sendMessage(_message: unknown, callback: () => void) {
        sendAttempts += 1
        callback()
      }
    }
  })

  const { sendDocumentLifecycleMessage } = await import(
    "../../src/inject/content-messaging"
  )

  sendDocumentLifecycleMessage(MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE, {
    isDisposed: () => false,
    onExtensionContextInvalidated: () => {
      assert.fail("transient send errors must not dispose the runtime")
    },
    scriptId: "test-script",
    warn: () => {
      warnCalls += 1
    }
  })

  await new Promise((resolve) => setTimeout(resolve, 1500))

  assert.equal(sendAttempts, 5)
  assert.equal(warnCalls, 0)
})
