import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getGoogleFontDataConsentState,
  requestGoogleFontNetworkConsent
} from "../../src/utils/google-font-consent"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalFirefox = Reflect.get(globalThis, "__FIREFOX_MV3__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__FIREFOX_MV3__", originalFirefox)
})

function installPermissions(
  dataCollection: string[] | undefined,
  requestResult = false
) {
  let requestedPermissions: unknown = null

  Reflect.set(globalThis, "chrome", {
    permissions: {
      getAll(callback: (permissions: unknown) => void) {
        callback(
          dataCollection === undefined
            ? { permissions: [] }
            : { data_collection: dataCollection, permissions: [] }
        )
      },
      request(permissions: unknown, callback: (granted: boolean) => void) {
        requestedPermissions = permissions
        callback(requestResult)
      }
    },
    runtime: {
      get lastError() {
        return undefined
      }
    }
  })

  return () => requestedPermissions
}

test("non-Firefox builds do not ask for Firefox data permission", async () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  const getRequestedPermissions = installPermissions(undefined)

  assert.equal(await getGoogleFontDataConsentState(), "granted")
  assert.equal(await requestGoogleFontNetworkConsent(), true)
  assert.equal(getRequestedPermissions(), null)
})

test("older Firefox versions without data_collection stay unsupported", async () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  installPermissions(undefined)

  assert.equal(await getGoogleFontDataConsentState(), "unsupported")
})

test("Firefox requests the narrow optional data permission", async () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  const getRequestedPermissions = installPermissions([], true)

  assert.equal(await getGoogleFontDataConsentState(), "not-granted")
  assert.equal(await requestGoogleFontNetworkConsent(), true)
  assert.deepEqual(getRequestedPermissions(), {
    data_collection: ["technicalAndInteraction"]
  })
})

test("Firefox detects an already granted data permission", async () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  installPermissions(["technicalAndInteraction"])

  assert.equal(await getGoogleFontDataConsentState(), "granted")
})
