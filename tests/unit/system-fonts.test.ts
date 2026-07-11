import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  createSystemFontValue,
  decodeSystemFontValue,
  getSystemFontList,
  isSafeSystemFontFamily,
  isSystemFontAccessSupported,
  isSystemFontFeatureSupported,
  loadSystemFonts,
  normalizeSystemFontList,
  resetSystemFontLoaderForTesting
} from "../../src/utils/system-fonts"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalChromium = Reflect.get(globalThis, "__CHROMIUM_MV3__") as unknown
const originalFirefox = Reflect.get(globalThis, "__FIREFOX_MV3__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__CHROMIUM_MV3__", originalChromium)
  Reflect.set(globalThis, "__FIREFOX_MV3__", originalFirefox)
  resetSystemFontLoaderForTesting()
})

test("system font values safely encode and decode font families", () => {
  const value = createSystemFontValue("Noto Sans Arabic")

  assert.equal(value, "system-font:Noto%20Sans%20Arabic")
  assert.equal(decodeSystemFontValue(value), "Noto Sans Arabic")
  assert.equal(createSystemFontValue(""), null)
  assert.equal(createSystemFontValue("Bad\nFont"), null)
  assert.equal(decodeSystemFontValue("system-font:%E0%A4%A"), null)
  assert.equal(isSafeSystemFontFamily("SF Pro Display"), true)
})

test("system font list uses font ids, deduplicates, and sorts display names", () => {
  const fonts = normalizeSystemFontList([
    { displayName: "Zed", fontId: "Zed" },
    { displayName: "Arabic UI", fontId: "Noto Sans Arabic" },
    { displayName: "Duplicate Arabic", fontId: "Noto Sans Arabic" },
    { displayName: "Unsafe", fontId: "Bad\nFont" }
  ])

  assert.deepEqual(
    fonts.map((font) => ({
      name: font.name,
      fontFamily: font.fontFamily,
      value: font.value
    })),
    [
      {
        name: "Duplicate Arabic",
        fontFamily: "Noto Sans Arabic",
        value: "system-font:Noto%20Sans%20Arabic"
      },
      {
        name: "Zed",
        fontFamily: "Zed",
        value: "system-font:Zed"
      }
    ]
  )
})

test("Firefox target stays unsupported even if a mock fontSettings API exists", async () => {
  Reflect.set(globalThis, "__CHROMIUM_MV3__", false)
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  Reflect.set(globalThis, "chrome", {
    fontSettings: {
      getFontList(callback: (fonts: chrome.fontSettings.FontName[]) => void) {
        callback([{ displayName: "Fake", fontId: "Fake" }])
      }
    }
  })

  assert.equal(isSystemFontAccessSupported(), false)
  assert.equal(isSystemFontFeatureSupported(), false)
  assert.deepEqual(await getSystemFontList(), [])
  assert.equal((await loadSystemFonts()).status, "unsupported")
})

test("Chromium loader distinguishes an empty installed list from unsupported", async () => {
  let attempts = 0
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    fontSettings: {
      getFontList(callback: (fonts: chrome.fontSettings.FontName[]) => void) {
        attempts += 1
        callback([])
      }
    }
  })

  assert.equal(isSystemFontAccessSupported(), true)
  const state = await loadSystemFonts()
  assert.equal(state.status, "ready")
  assert.deepEqual(state.fonts, [])
  assert.equal(attempts, 1)

  const retried = await loadSystemFonts({ retry: true })
  assert.equal(retried.status, "ready")
  assert.equal(attempts, 2)
})

test("Chromium content contexts preserve known system selections without fontSettings", () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "chrome", { runtime: { lastError: null } })

  assert.equal(isSystemFontAccessSupported(), false)
  assert.equal(isSystemFontFeatureSupported(), true)
})

test("system font loader preserves errors and retries without losing intent", async () => {
  let attempts = 0
  let runtimeError: { message: string } | undefined
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return runtimeError
      }
    },
    fontSettings: {
      getFontList(callback: (fonts: chrome.fontSettings.FontName[]) => void) {
        attempts += 1
        runtimeError =
          attempts === 1 ? { message: "temporary failure" } : undefined
        callback(
          attempts === 1 ? [] : [{ displayName: "Noto", fontId: "Noto Sans" }]
        )
        runtimeError = undefined
      }
    }
  })

  const failed = await loadSystemFonts()
  assert.equal(failed.status, "error")
  assert.match(failed.error?.message ?? "", /temporary failure/)

  const cachedFailure = await loadSystemFonts()
  assert.equal(cachedFailure.status, "error")
  assert.equal(attempts, 1)

  const retried = await loadSystemFonts({ retry: true })
  assert.equal(retried.status, "ready")
  assert.equal(retried.fonts[0]?.fontFamily, "Noto Sans")
  assert.equal(attempts, 2)
})
