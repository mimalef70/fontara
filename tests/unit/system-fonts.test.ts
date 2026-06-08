import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  createSystemFontValue,
  decodeSystemFontValue,
  getGenericSystemFontList,
  getSystemFontList,
  isSafeSystemFontFamily,
  isSystemFontAccessSupported,
  normalizeSystemFontList
} from "../../src/utils/system-fonts"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
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

test("system font list falls back to generic families when fontSettings is unavailable", async () => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL() {
        return "moz-extension://fontara/"
      }
    },
    permissions: {
      contains() {},
      request() {}
    }
  })

  assert.equal(isSystemFontAccessSupported(), true)
  assert.deepEqual(
    (await getSystemFontList()).map((font) => font.fontFamily),
    ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]
  )
})

test("generic system font fallbacks cover cross-browser families", () => {
  assert.deepEqual(
    getGenericSystemFontList().map((font) => font.fontFamily),
    ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]
  )
})

test("system font list reads chrome fontSettings when available", async () => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    fontSettings: {
      getFontList(callback: (fonts: chrome.fontSettings.FontName[]) => void) {
        callback([{ displayName: "Noto", fontId: "Noto Sans" }])
      }
    }
  })

  assert.deepEqual(await getSystemFontList(), [
    {
      name: "Noto",
      fontFamily: "Noto Sans",
      value: "system-font:Noto%20Sans"
    }
  ])
})
