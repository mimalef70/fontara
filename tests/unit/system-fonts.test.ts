import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { getSystemFontsEnabledInitialValue } from "../../src/ui/storage-defaults"
import {
  createSystemFontValue,
  decodeSystemFontValue,
  getCSSGenericSystemFonts,
  getSystemFontList,
  getSystemFontLoadState,
  isSafeSystemFontFamily,
  isSystemFontAccessSupported,
  isSystemFontFeatureSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey,
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

function getFontFamilies(fonts: Awaited<ReturnType<typeof getSystemFontList>>) {
  return fonts.map((font) => font.fontFamily)
}

test("system font values safely encode and decode font families", () => {
  const value = createSystemFontValue("Noto Sans Arabic")

  assert.equal(value, "system-font:Noto%20Sans%20Arabic")
  assert.equal(decodeSystemFontValue(value), "Noto Sans Arabic")
  assert.equal(createSystemFontValue(""), null)
  assert.equal(createSystemFontValue("Bad\nFont"), null)
  assert.equal(createSystemFontValue("Malformed \ud800"), null)
  assert.equal(decodeSystemFontValue("system-font:%E0%A4%A"), null)
  assert.equal(isSafeSystemFontFamily("SF Pro Display"), true)
})

test("system font family keys normalize width and case without folding accents", () => {
  assert.equal(
    normalizeSystemFontFamilyKey("ＮＯＴＯ Ｓａｎｓ"),
    normalizeSystemFontFamilyKey("noto sans")
  )
  assert.notEqual(
    normalizeSystemFontFamilyKey("Fóo"),
    normalizeSystemFontFamilyKey("Foo")
  )
})

test("system font normalization validates runtime values, keeps the original id, and deduplicates case-insensitively", () => {
  const fonts = normalizeSystemFontList([
    { displayName: "Zed", fontId: "Zed" },
    { displayName: "Arabic UI", fontId: "Noto Sans Arabic" },
    { displayName: "Duplicate Arabic", fontId: "noto sans arabic" },
    { displayName: "Safe\u202e Evil\n Name", fontId: "Label Test" },
    { displayName: "Zero\u200bWidth", fontId: "Zero Width Label" },
    { displayName: 42, fontId: "Fallback Label" },
    { displayName: "Unsafe", fontId: "Bad\nFont" },
    { displayName: "Malformed", fontId: "Bad \ud800" },
    { displayName: "Missing id" },
    { displayName: "Wrong id", fontId: 42 },
    null,
    "not-an-object"
  ])

  assert.deepEqual(
    fonts.map((font) => ({
      name: font.name,
      fontFamily: font.fontFamily,
      value: font.value
    })),
    [
      {
        name: "Arabic UI",
        fontFamily: "Noto Sans Arabic",
        value: "system-font:Noto%20Sans%20Arabic"
      },
      {
        name: "Fallback Label",
        fontFamily: "Fallback Label",
        value: "system-font:Fallback%20Label"
      },
      {
        name: "Safe Evil Name",
        fontFamily: "Label Test",
        value: "system-font:Label%20Test"
      },
      {
        name: "Zed",
        fontFamily: "Zed",
        value: "system-font:Zed"
      },
      {
        name: "Zero Width",
        fontFamily: "Zero Width Label",
        value: "system-font:Zero%20Width%20Label"
      }
    ]
  )
})

test("system font display-name limits do not split Unicode characters", () => {
  const longDisplayName = `${"A".repeat(159)}😀trailing`
  const [font] = normalizeSystemFontList([
    { displayName: longDisplayName, fontId: "Emoji Label" }
  ])

  assert.equal(Array.from(font?.name ?? "").length, 160)
  assert.ok(font?.name.endsWith("😀"))
  assert.ok(!font?.name.includes("trailing"))
})

test("the Dark Reader-compatible CSS generic fallback contains six selectable families", () => {
  const fonts = getCSSGenericSystemFonts()

  assert.equal(fonts.length, 6)
  assert.deepEqual(
    new Set(getFontFamilies(fonts)),
    new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui"
    ])
  )
  assert.equal(
    fonts.find((font) => font.fontFamily === "system-ui")?.value,
    "system-font:system-ui"
  )
})

test("Firefox exposes CSS generics while keeping privileged enumeration unsupported", async () => {
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
  assert.equal(isSystemFontFeatureSupported(), true)
  assert.equal(getSystemFontsEnabledInitialValue(true), true)
  assert.deepEqual(
    new Set(getFontFamilies(await getSystemFontList())),
    new Set(getFontFamilies(getCSSGenericSystemFonts()))
  )
  assert.equal((await loadSystemFonts()).status, "ready")
  assert.equal(getSystemFontLoadState().status, "ready")
})

test("Chromium merges CSS generics with installed fonts and force-refreshes a non-empty cache", async () => {
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
        callback([
          { displayName: "Noto", fontId: "Noto Sans" },
          { displayName: "Fake generic", fontId: "SYSTEM-UI" }
        ])
      }
    }
  })

  assert.equal(isSystemFontAccessSupported(), true)
  const state = await loadSystemFonts()
  assert.equal(state.status, "ready")
  assert.equal(state.fonts.length, 7)
  assert.ok(getFontFamilies(state.fonts).includes("Noto Sans"))
  assert.ok(getFontFamilies(state.fonts).includes("system-ui"))
  assert.ok(!getFontFamilies(state.fonts).includes("SYSTEM-UI"))
  assert.equal(attempts, 1)

  await loadSystemFonts()
  assert.equal(attempts, 1)

  const refreshed = await loadSystemFonts({ forceRefresh: true })
  assert.equal(refreshed.status, "ready")
  assert.equal(attempts, 2)
})

test("Chromium content contexts preserve known selections and expose generic choices without fontSettings", async () => {
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "chrome", { runtime: { lastError: null } })

  assert.equal(isSystemFontAccessSupported(), false)
  assert.equal(isSystemFontFeatureSupported(), true)
  assert.equal((await getSystemFontList()).length, 6)
})

test("concurrent refreshes deduplicate in flight and preserve the last-known-good list after failure", async () => {
  const callbacks: Array<(fonts: chrome.fontSettings.FontName[]) => void> = []
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
        callbacks.push(callback)
      }
    }
  })

  const initialLoad = loadSystemFonts()
  callbacks.shift()?.([{ displayName: "Noto", fontId: "Noto Sans" }])
  const initialState = await initialLoad
  assert.equal(initialState.status, "ready")
  assert.ok(getFontFamilies(initialState.fonts).includes("Noto Sans"))

  const firstRefresh = loadSystemFonts({ forceRefresh: true })
  const duplicateRefresh = loadSystemFonts({ forceRefresh: true })
  assert.strictEqual(firstRefresh, duplicateRefresh)
  assert.equal(callbacks.length, 1)

  runtimeError = { message: "temporary failure" }
  callbacks.shift()?.([])
  runtimeError = undefined

  const failedRefresh = await firstRefresh
  assert.equal(failedRefresh.status, "error")
  assert.match(failedRefresh.error?.message ?? "", /temporary failure/)
  assert.ok(getFontFamilies(failedRefresh.fonts).includes("Noto Sans"))
  assert.ok(getFontFamilies(await getSystemFontList()).includes("Noto Sans"))

  const recovered = loadSystemFonts({ forceRefresh: true })
  callbacks.shift()?.([{ displayName: "Inter", fontId: "Inter" }])
  assert.ok(getFontFamilies((await recovered).fonts).includes("Inter"))
})

test("a timed-out font list refresh preserves the last-known-good list", async () => {
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
        if (attempts === 1) {
          callback([{ displayName: "Noto", fontId: "Noto Sans" }])
        }
      }
    }
  })

  const initialState = await loadSystemFonts({ timeoutMs: 10 })
  assert.equal(initialState.status, "ready")
  assert.ok(getFontFamilies(initialState.fonts).includes("Noto Sans"))

  const timedOutState = await loadSystemFonts({
    forceRefresh: true,
    timeoutMs: 1
  })
  assert.equal(timedOutState.status, "error")
  assert.match(timedOutState.error?.message ?? "", /system-fonts-timeout/)
  assert.ok(getFontFamilies(timedOutState.fonts).includes("Noto Sans"))
  assert.equal(attempts, 2)
})

test("an initial fontSettings failure degrades to CSS generics and the retry alias remains compatible", async () => {
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
  assert.equal(failed.fonts.length, 6)
  assert.match(failed.error?.message ?? "", /temporary failure/)

  const cachedFonts = await getSystemFontList()
  assert.equal(cachedFonts.length, 6)
  assert.equal(attempts, 1)

  const retried = await loadSystemFonts({ retry: true })
  assert.equal(retried.status, "ready")
  assert.ok(getFontFamilies(retried.fonts).includes("Noto Sans"))
  assert.equal(attempts, 2)
})
