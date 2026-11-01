import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test, { afterEach } from "node:test"

import { getGoogleFontsEnabledInitialValue } from "../../src/ui/storage-defaults"
import {
  buildGoogleFontsCSS2URL,
  createGoogleFontValue,
  decodeGoogleFontValue,
  getGoogleFontByFamily,
  getGoogleFontByValue,
  getGoogleFontList,
  isGoogleFontFeatureSupported,
  isGoogleFontValue,
  loadGoogleFontFaceCSS,
  loadGoogleFontList,
  resetGoogleFontCatalogForTesting,
  sanitizeGoogleFontFaceCSS
} from "../../src/utils/google-fonts"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalChromium = Reflect.get(globalThis, "__CHROMIUM_MV3__") as unknown
const originalFirefox = Reflect.get(globalThis, "__FIREFOX_MV3__") as unknown
const originalFetch = Reflect.get(globalThis, "fetch") as unknown
const originalDateNow = Date.now
const catalog = JSON.parse(
  fs.readFileSync(path.resolve("assets/data/google-fonts.json"), "utf8")
) as { fonts: unknown[]; source: string }

async function loadCatalog() {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(assetPath: string) {
        return `chrome-extension://fontara/${assetPath}`
      }
    }
  })
  Reflect.set(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify(catalog), {
        headers: { "content-type": "application/json" },
        status: 200
      })
  )

  return loadGoogleFontList()
}

function installLocalStorage(initialValues: Record<string, unknown> = {}) {
  const values = { ...initialValues }
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      getURL(assetPath: string) {
        return `chrome-extension://fontara/${assetPath}`
      }
    },
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: values[key] })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(values, items)
          callback()
        }
      }
    }
  })

  return values
}

function createFontFaceCSS(fontFamily: string, fileName = "test.woff2") {
  return `
    @font-face {
      font-family: '${fontFamily}';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/test/v1/${fileName}) format('woff2');
    }
  `
}

function createCSSResponse(css: string, headers: Record<string, string> = {}) {
  return new Response(css, {
    headers: { "content-type": "text/css; charset=utf-8", ...headers },
    status: 200
  })
}

afterEach(() => {
  resetGoogleFontCatalogForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__CHROMIUM_MV3__", originalChromium)
  Reflect.set(globalThis, "__FIREFOX_MV3__", originalFirefox)
  Reflect.set(globalThis, "fetch", originalFetch)
  Date.now = originalDateNow
})

test("Google Font values encode safe catalog families", async () => {
  await loadCatalog()
  const value = createGoogleFontValue("Noto Sans Arabic")

  assert.equal(value, "google-font:Noto%20Sans%20Arabic")
  assert.equal(decodeGoogleFontValue(value), "Noto Sans Arabic")
  assert.equal(isGoogleFontValue(value), true)
  assert.equal(getGoogleFontByValue(value)?.family, "Noto Sans Arabic")
  assert.equal(
    getGoogleFontByFamily("noto sans arabic")?.family,
    "Noto Sans Arabic"
  )
  assert.equal(
    getGoogleFontByValue(createGoogleFontValue("Missing Font")),
    null
  )
})

test("Google Font display list is lazy and exposes safe selectable data", async () => {
  assert.deepEqual(getGoogleFontList(), [])
  const fonts = await loadCatalog()

  assert.equal(catalog.source, "google-fonts-developer-api-v1")
  assert.ok(catalog.fonts.length > 1000)
  assert.ok(fonts.length < catalog.fonts.length)
  assert.ok(fonts.some((font) => font.family === "Vazirmatn"))
  assert.ok(fonts.some((font) => font.family === "Inter"))
  assert.ok(fonts.some((font) => font.recommended))
  assert.equal(
    fonts.some((font) => font.family === "Material Icons"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Material Symbols Outlined"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Libre Barcode 128"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Color Emoji"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Sans JP"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Sans KR"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Sans SC"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Sans HK"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Google Sans"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Music"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Noto Sans Symbols 2"),
    false
  )
  assert.equal(getGoogleFontByFamily("Material Icons"), null)
  assert.equal(
    getGoogleFontByValue(createGoogleFontValue("Material Symbols Outlined")),
    null
  )
  assert.ok(
    fonts.every(
      (font) =>
        font.value.startsWith("google-font:") &&
        font.name === font.family &&
        font.fontFamily === font.family &&
        Array.isArray(font.subsets) &&
        Array.isArray(font.variants)
    )
  )
  assert.equal(new Set(fonts.map((font) => font.family)).size, fonts.length)
})

test("Google Fonts CSS2 URLs request at most regular, bold, and italic faces", async () => {
  await loadCatalog()
  const font = getGoogleFontByFamily("Inter")
  assert.ok(font)

  const url = new URL(buildGoogleFontsCSS2URL(font))

  assert.equal(url.origin, "https://fonts.googleapis.com")
  assert.equal(url.pathname, "/css2")
  assert.equal(
    url.searchParams.get("family"),
    "Inter:ital,wght@0,400;0,700;1,400;1,700"
  )
  assert.equal(url.searchParams.get("display"), "swap")
})

test("Google Fonts CSS2 URLs preserve families without a regular variant", async () => {
  await loadCatalog()
  const weightedOnlyFont = getGoogleFontByFamily("Buda")
  const italicOnlyFont = getGoogleFontByFamily("Molle")
  assert.ok(weightedOnlyFont)
  assert.ok(italicOnlyFont)

  assert.equal(
    new URL(buildGoogleFontsCSS2URL(weightedOnlyFont)).searchParams.get(
      "family"
    ),
    "Buda:wght@300"
  )
  assert.equal(
    new URL(buildGoogleFontsCSS2URL(italicOnlyFont)).searchParams.get("family"),
    "Molle:ital,wght@1,400"
  )
})

test("Google Font CSS sanitizer keeps only matching gstatic font-face rules", () => {
  const sanitizedCSS = sanitizeGoogleFontFaceCSS(
    `
      /* latin */
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/inter/v20/test.woff2) format('woff2');
        unicode-range: U+0000-00FF;
      }
    `,
    "Inter"
  )

  assert.ok(sanitizedCSS)
  assert.match(sanitizedCSS, /@font-face/)
  assert.match(sanitizedCSS, /font-family: 'Inter';/)
  assert.match(
    sanitizedCSS,
    /https:\/\/fonts\.gstatic\.com\/s\/inter\/v20\/test\.woff2/
  )
  assert.doesNotMatch(sanitizedCSS, /\/\*/)

  assert.ok(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Inter';
          src: url(https://fonts.gstatic.com/s/inter/v20/test.ttf) format('truetype');
        }
      `,
      "Inter"
    )
  )
})

test("Google Font CSS sanitizer rejects unexpected selectors and unsafe URLs", () => {
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @import url(https://example.com/font.css);
        @font-face {
          font-family: 'Inter';
          src: url(https://fonts.gstatic.com/s/inter/v20/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Inter';
          src: url(https://example.com/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Roboto';
          src: url(https://fonts.gstatic.com/s/roboto/v30/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
})

test("Google Font CSS loader skips network when cache-only mode has no cached CSS", async () => {
  let fetchCalls = 0

  installLocalStorage({ googleFontCssCache: {} })
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("unexpected network request")
  })

  assert.equal(
    await loadGoogleFontFaceCSS(createGoogleFontValue("Inter"), {
      allowNetwork: false
    }),
    null
  )
  assert.equal(fetchCalls, 0)
})

test("Google Font CSS cache-only loading does not fetch the packaged catalog", async () => {
  const selectedFont = createGoogleFontValue("Inter")
  const css = sanitizeGoogleFontFaceCSS(
    createFontFaceCSS("Inter", "cached.woff2"),
    "Inter"
  )
  assert.ok(css)
  installLocalStorage({
    googleFontCssCache: {
      inter: {
        css,
        createdAt: Date.now(),
        fontFamily: "Inter",
        requestUrl: "https://fonts.googleapis.com/css2?family=Inter",
        version: 2
      }
    }
  })
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("unexpected catalog or font request")
  })

  assert.equal(
    await loadGoogleFontFaceCSS(selectedFont, { allowNetwork: false }),
    css
  )
  assert.equal(fetchCalls, 0)
})

test("Google Font CSS loader preserves a sanitized v1 cache entry during upgrade", async () => {
  const selectedFont = createGoogleFontValue("Inter")
  const css = sanitizeGoogleFontFaceCSS(
    createFontFaceCSS("Inter", "legacy-cache.woff2"),
    "Inter"
  )
  assert.ok(css)
  installLocalStorage({
    googleFontCssCache: {
      inter: {
        css,
        createdAt: Date.now(),
        requestUrl: "https://fonts.googleapis.com/css2?family=Inter",
        version: 1
      }
    }
  })
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("unexpected catalog or font request")
  })

  assert.equal(
    await loadGoogleFontFaceCSS(selectedFont, { allowNetwork: false }),
    css
  )
  assert.equal(fetchCalls, 0)
})

test("Google Font CSS loader preserves cached CSS when catalog loading fails", async () => {
  const selectedFont = createGoogleFontValue("Inter")
  const css = sanitizeGoogleFontFaceCSS(
    createFontFaceCSS("Inter", "last-known-good.woff2"),
    "Inter"
  )
  assert.ok(css)
  installLocalStorage({
    googleFontCssCache: {
      inter: {
        css,
        createdAt: Date.now(),
        fontFamily: "Inter",
        requestUrl: "https://fonts.googleapis.com/css2?family=Inter",
        version: 2
      }
    }
  })
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("packaged catalog unavailable")
  })

  assert.equal(await loadGoogleFontFaceCSS(selectedFont), css)
  assert.equal(fetchCalls, 1)
})

test("Google Font CSS loader rejects families outside the packaged catalog", async () => {
  let fetchCalls = 0
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    return createCSSResponse(createFontFaceCSS("Missing Font"))
  })

  assert.equal(
    await loadGoogleFontFaceCSS(createGoogleFontValue("Missing Font")),
    null
  )
  assert.equal(fetchCalls, 0)
})

test("Google Font CSS loader deduplicates concurrent network requests", async () => {
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    await Promise.resolve()
    return createCSSResponse(createFontFaceCSS("Inter"))
  })

  const selectedFont = createGoogleFontValue("Inter")
  const [firstCSS, secondCSS] = await Promise.all([
    loadGoogleFontFaceCSS(selectedFont),
    loadGoogleFontFaceCSS(selectedFont)
  ])

  assert.ok(firstCSS)
  assert.equal(secondCSS, firstCSS)
  assert.equal(fetchCalls, 1)
})

test("Google Font CSS loader serializes cache writes for different families", async () => {
  await loadCatalog()
  const storage = installLocalStorage({ googleFontCssCache: {} })
  Reflect.set(globalThis, "fetch", async (input: string | URL | Request) => {
    const requestFamily = new URL(String(input)).searchParams.get("family")
    const fontFamily = requestFamily?.split(":", 1)[0]
    assert.ok(fontFamily)
    return createCSSResponse(createFontFaceCSS(fontFamily))
  })

  await Promise.all([
    loadGoogleFontFaceCSS(createGoogleFontValue("Inter")),
    loadGoogleFontFaceCSS(createGoogleFontValue("Roboto"))
  ])

  const cache = storage.googleFontCssCache as Record<string, unknown>
  assert.ok(cache.inter)
  assert.ok(cache.roboto)
})

test("Google Font CSS loader refreshes an expired in-memory entry", async () => {
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  let now = 2_000_000_000_000
  Date.now = () => now
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    return createCSSResponse(
      createFontFaceCSS("Inter", `refresh-${fetchCalls}.woff2`)
    )
  })

  const selectedFont = createGoogleFontValue("Inter")
  const firstCSS = await loadGoogleFontFaceCSS(selectedFont)
  now += 1000 * 60 * 60 * 24 * 31
  const staleCSS = await loadGoogleFontFaceCSS(selectedFont)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const refreshedCSS = await loadGoogleFontFaceCSS(selectedFont)

  assert.match(firstCSS ?? "", /refresh-1\.woff2/)
  assert.match(staleCSS ?? "", /refresh-1\.woff2/)
  assert.match(refreshedCSS ?? "", /refresh-2\.woff2/)
  assert.equal(fetchCalls, 2)
})

test("Google Font CSS loader times out and aborts a stalled request", async () => {
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  let aborted = false
  Reflect.set(
    globalThis,
    "fetch",
    (_url: string, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          aborted = true
          reject(new DOMException("Aborted", "AbortError"))
        })
      })
  )

  assert.equal(
    await loadGoogleFontFaceCSS(createGoogleFontValue("Inter"), {
      timeoutMs: 1
    }),
    null
  )
  assert.equal(aborted, true)
})

test("Google Font CSS loader serves stale last-known-good CSS while refreshing", async () => {
  await loadCatalog()
  const font = getGoogleFontByFamily("Inter")
  assert.ok(font)
  const selectedFont = createGoogleFontValue(font.family)
  const css = sanitizeGoogleFontFaceCSS(
    createFontFaceCSS(font.family, "stale.woff2"),
    font.family
  )
  assert.ok(css)

  const now = 2_000_000_000_000
  Date.now = () => now
  installLocalStorage({
    googleFontCssCache: {
      inter: {
        css,
        createdAt: now - 1000 * 60 * 60 * 24 * 31,
        fontFamily: font.family,
        requestUrl: buildGoogleFontsCSS2URL(font),
        version: 2
      }
    }
  })
  let fetchCalls = 0
  let resolveRefresh: (() => void) | undefined
  Reflect.set(globalThis, "fetch", () => {
    fetchCalls += 1
    return new Promise<Response>((resolve) => {
      resolveRefresh = () =>
        resolve(
          createCSSResponse(createFontFaceCSS(font.family, "fresh.woff2"))
        )
    })
  })

  assert.equal(await loadGoogleFontFaceCSS(selectedFont), css)
  assert.equal(fetchCalls, 1)
  assert.equal(
    await loadGoogleFontFaceCSS(selectedFont, { allowNetwork: false }),
    css
  )
  assert.equal(fetchCalls, 1)
  resolveRefresh?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
})

test("Google Font CSS loader rejects oversized and non-CSS responses", async () => {
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  const selectedFont = createGoogleFontValue("Inter")
  Reflect.set(
    globalThis,
    "fetch",
    async () =>
      new Response(createFontFaceCSS("Inter"), {
        headers: { "content-type": "text/html" },
        status: 200
      })
  )
  assert.equal(await loadGoogleFontFaceCSS(selectedFont), null)

  resetGoogleFontCatalogForTesting()
  await loadCatalog()
  installLocalStorage({ googleFontCssCache: {} })
  Reflect.set(globalThis, "fetch", async () =>
    createCSSResponse(createFontFaceCSS("Inter"), {
      "content-length": String(512 * 1024 + 1)
    })
  )
  assert.equal(await loadGoogleFontFaceCSS(selectedFont), null)
})

test("Firefox supports local Google fonts but never uses legacy remote CSS", async () => {
  Reflect.set(globalThis, "__CHROMIUM_MV3__", false)
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  let fetchCalls = 0
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("unexpected network request")
  })

  assert.equal(isGoogleFontFeatureSupported(), true)
  assert.equal(
    await loadGoogleFontFaceCSS(createGoogleFontValue("Inter")),
    null
  )
  assert.equal(fetchCalls, 0)
})

test("Google Fonts storage defaults honor the build capability", () => {
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  assert.equal(isGoogleFontFeatureSupported(), true)
  assert.equal(getGoogleFontsEnabledInitialValue(true), true)
  assert.equal(getGoogleFontsEnabledInitialValue(false), false)
  assert.equal(getGoogleFontsEnabledInitialValue(undefined), false)

  Reflect.set(globalThis, "__CHROMIUM_MV3__", false)
  Reflect.set(globalThis, "__FIREFOX_MV3__", true)
  assert.equal(isGoogleFontFeatureSupported(), true)
  assert.equal(getGoogleFontsEnabledInitialValue(true), true)

  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  assert.equal(isGoogleFontFeatureSupported(), false)
  assert.equal(getGoogleFontsEnabledInitialValue(true), false)
})
