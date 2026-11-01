import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  downloadGoogleFontFamilyDraft,
  MAX_GOOGLE_FONT_ASSET_BYTES,
  MAX_GOOGLE_FONT_CSS_BYTES,
  MAX_GOOGLE_FONT_FACE_COUNT,
  MAX_GOOGLE_FONT_FAMILY_BYTES,
  parseGoogleFontFaceCSS
} from "../../src/background/google-font-network"
import {
  createGoogleFontBinaryFamilyKey,
  createGoogleFontRuntimeFamily,
  GoogleFontBinaryError,
  type GoogleFontBinaryErrorCode
} from "../../src/google-font-binary-types"
import { buildGoogleFontsCSS2URLFromFamily } from "../../src/utils/google-font-runtime"

const FAMILY = "Noto Sans Arabic"
const REQUEST = {
  family: FAMILY,
  variants: ["regular", "700", "italic"]
} as const
const REQUEST_URL = buildGoogleFontsCSS2URLFromFamily(
  REQUEST.family,
  REQUEST.variants
)
const FIRST_ASSET_URL =
  "https://fonts.gstatic.com/s/notosansarabic/v31/fontara-a.woff2"
const SECOND_ASSET_URL =
  "https://fonts.gstatic.com/s/notosansarabic/v31/fontara-b.woff2"

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

function createWOFF2Bytes(size = 32, marker = 0x61): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([0x77, 0x4f, 0x46, 0x32])
  bytes.fill(marker, 4)
  return bytes
}

function createResponse(
  url: string,
  body: BodyInit | null,
  options: {
    headers?: HeadersInit
    redirected?: boolean
    status?: number
  } = {}
): Response {
  const response = new Response(body, {
    headers: options.headers,
    status: options.status ?? 200
  })
  Object.defineProperties(response, {
    redirected: { configurable: true, value: options.redirected ?? false },
    url: { configurable: true, value: url }
  })
  return response
}

function createCSSResponse(
  css: string | Uint8Array,
  options: Parameters<typeof createResponse>[2] = {}
): Response {
  return createResponse(
    REQUEST_URL,
    typeof css === "string" ? css : asArrayBuffer(css),
    {
      ...options,
      headers: {
        "content-type": "text/css; charset=utf-8",
        ...options.headers
      }
    }
  )
}

function createAssetResponse(
  url: string,
  bytes: Uint8Array,
  options: Parameters<typeof createResponse>[2] = {}
): Response {
  return createResponse(url, asArrayBuffer(bytes), {
    ...options,
    headers: {
      "content-type": "font/woff2",
      ...options.headers
    }
  })
}

function createFace(
  sourceUrl: string,
  descriptors: {
    family?: string
    stretch?: string
    style?: string
    unicodeRange?: string | null
    weight?: string
  } = {}
): string {
  const unicodeRange =
    descriptors.unicodeRange === null
      ? ""
      : `unicode-range: ${descriptors.unicodeRange ?? "U+0600-06FF"};`
  return `
    @font-face {
      font-family: '${descriptors.family ?? FAMILY}';
      font-display: swap;
      font-style: ${descriptors.style ?? "normal"};
      font-weight: ${descriptors.weight ?? "400"};
      font-stretch: ${descriptors.stretch ?? "normal"};
      src: url(${sourceUrl}) format('woff2');
      ${unicodeRange}
    }
  `
}

function createSuccessfulFetch(
  css: string,
  assets: Readonly<Record<string, Uint8Array>>
): {
  calls: Array<{ init: RequestInit | undefined; url: string }>
  fetch: typeof fetch
} {
  const calls: Array<{ init: RequestInit | undefined; url: string }> = []
  return {
    calls,
    fetch: async (input, init) => {
      const url = String(input)
      calls.push({ init, url })
      if (url === REQUEST_URL) return createCSSResponse(css)

      const bytes = assets[url]
      if (!bytes) throw new Error(`Unexpected URL: ${url}`)
      return createAssetResponse(url, bytes)
    }
  }
}

async function assertRejectsWithCode(
  promise: Promise<unknown>,
  code: GoogleFontBinaryErrorCode
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof GoogleFontBinaryError)
    assert.equal(error.code, code)
    return true
  })
}

function assertThrowsWithCode(
  callback: () => unknown,
  code: GoogleFontBinaryErrorCode
): void {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof GoogleFontBinaryError)
    assert.equal(error.code, code)
    return true
  })
}

test("downloads strict WOFF2 faces, preserves descriptors, and deduplicates URLs and hashes", async () => {
  const sharedBytes = createWOFF2Bytes(48)
  const css = [
    "/* arabic */",
    createFace(FIRST_ASSET_URL),
    createFace(FIRST_ASSET_URL, {
      style: "italic",
      unicodeRange: null,
      weight: "700"
    }),
    createFace(SECOND_ASSET_URL, {
      stretch: "75% 125%",
      unicodeRange: "u+0000-00ff, u+0600-06ff",
      weight: "100 900"
    })
  ].join("\n")
  const mock = createSuccessfulFetch(css, {
    [FIRST_ASSET_URL]: sharedBytes,
    [SECOND_ASSET_URL]: sharedBytes
  })

  const result = await downloadGoogleFontFamilyDraft(REQUEST, {
    fetch: mock.fetch,
    requestUrl: REQUEST_URL
  })

  const expectedAssetHash = createHash("sha256")
    .update(sharedBytes)
    .digest("hex")
  const expectedCSSHash = createHash("sha256").update(css).digest("hex")
  const expectedKey = await createGoogleFontBinaryFamilyKey(FAMILY)

  assert.equal(mock.calls.length, 3)
  assert.deepEqual(
    mock.calls.map((call) => call.url),
    [REQUEST_URL, FIRST_ASSET_URL, SECOND_ASSET_URL]
  )
  for (const call of mock.calls) {
    assert.equal(call.init?.cache, "no-store")
    assert.equal(call.init?.credentials, "omit")
    assert.equal(call.init?.redirect, "error")
    assert.equal(call.init?.referrerPolicy, "no-referrer")
    assert.ok(call.init?.signal instanceof AbortSignal)
  }

  assert.equal(result.family.fontFamily, FAMILY)
  assert.equal(result.family.requestUrl, REQUEST_URL)
  assert.equal(result.family.key, expectedKey)
  assert.equal(result.family.cssHash, expectedCSSHash)
  assert.equal(
    result.family.runtimeFamily,
    createGoogleFontRuntimeFamily(expectedCSSHash)
  )
  assert.equal(result.family.totalBytes, sharedBytes.byteLength)
  assert.equal(result.assets.size, 1)
  assert.deepEqual(result.assets.get(expectedAssetHash), sharedBytes)
  assert.equal(result.family.faces.length, 3)
  assert.ok(
    result.family.faces.every(
      (face) =>
        face.assetHash === expectedAssetHash &&
        face.byteLength === sharedBytes.byteLength &&
        /^google-[a-f0-9]{32}$/.test(face.id)
    )
  )
  assert.equal(new Set(result.family.faces.map((face) => face.id)).size, 3)
  assert.deepEqual(result.family.faces[1], {
    assetHash: expectedAssetHash,
    byteLength: sharedBytes.byteLength,
    id: result.family.faces[1].id,
    sourceUrl: FIRST_ASSET_URL,
    stretch: "normal",
    style: "italic",
    unicodeRange: null,
    weight: "700"
  })
  assert.equal(result.family.faces[2].stretch, "75% 125%")
  assert.equal(result.family.faces[2].unicodeRange, "U+0000-00FF, U+0600-06FF")
  assert.equal(result.family.faces[2].weight, "100 900")
})

test("requires the supplied CSS2 URL to exactly match the canonical builder URL", async () => {
  let fetchCalls = 0
  const fetch = async () => {
    fetchCalls += 1
    throw new Error("must not fetch")
  }

  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(REQUEST, {
      fetch,
      requestUrl: `${REQUEST_URL}&subset=latin`
    }),
    "google-font-invalid-request"
  )
  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(
      { family: "Material Symbols Outlined", variants: ["regular"] },
      { fetch }
    ),
    "google-font-invalid-request"
  )
  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(
      { family: FAMILY, variants: ["variable"] },
      { fetch }
    ),
    "google-font-invalid-request"
  )
  assert.equal(fetchCalls, 0)
})

test("family keys stay stable across request variants and canonical family spelling", async () => {
  const regularCSS = createFace(FIRST_ASSET_URL)
  const boldRequest = {
    family: `  ${FAMILY.normalize("NFKC")}  `,
    variants: ["700"]
  }
  const boldRequestUrl = buildGoogleFontsCSS2URLFromFamily(
    boldRequest.family.trim(),
    boldRequest.variants
  )

  const regular = await downloadGoogleFontFamilyDraft(REQUEST, {
    fetch: createSuccessfulFetch(regularCSS, {
      [FIRST_ASSET_URL]: createWOFF2Bytes()
    }).fetch
  })
  const bold = await downloadGoogleFontFamilyDraft(boldRequest, {
    fetch: async (input) => {
      const url = String(input)
      if (url === boldRequestUrl) {
        return createResponse(boldRequestUrl, regularCSS, {
          headers: { "content-type": "text/css" }
        })
      }
      return createAssetResponse(FIRST_ASSET_URL, createWOFF2Bytes())
    }
  })

  assert.notEqual(regular.family.requestUrl, bold.family.requestUrl)
  assert.equal(regular.family.key, bold.family.key)
})

test("parser rejects non-face CSS, unexpected families, unsafe descriptors, and non-WOFF2 sources", () => {
  const invalidFixtures: Array<{
    code: GoogleFontBinaryErrorCode
    css: string
  }> = [
    {
      code: "google-font-css-invalid",
      css: `${createFace(FIRST_ASSET_URL)} body { color: red; }`
    },
    {
      code: "google-font-css-invalid",
      css: createFace(FIRST_ASSET_URL, { family: "Roboto" })
    },
    {
      code: "google-font-asset-url-invalid",
      css: createFace("https://example.com/font.woff2")
    },
    {
      code: "google-font-asset-url-invalid",
      css: createFace("http://fonts.gstatic.com/s/test/font.woff2")
    },
    {
      code: "google-font-asset-url-invalid",
      css: createFace("https://fonts.gstatic.com.evil.test/font.woff2")
    },
    {
      code: "google-font-asset-url-invalid",
      css: createFace("https://fonts.gstatic.com/s/test/font.woff")
    },
    {
      code: "google-font-css-invalid",
      css: createFace(FIRST_ASSET_URL).replace(
        "format('woff2')",
        "format('truetype')"
      )
    },
    {
      code: "google-font-css-invalid",
      css: createFace(FIRST_ASSET_URL).replace(
        "font-display: swap;",
        "font-display: swap; color: red;"
      )
    },
    {
      code: "google-font-css-invalid",
      css: createFace(FIRST_ASSET_URL, { weight: "0" })
    },
    {
      code: "google-font-css-invalid",
      css: createFace(FIRST_ASSET_URL, { unicodeRange: "U+110000" })
    }
  ]

  for (const fixture of invalidFixtures) {
    assertThrowsWithCode(
      () => parseGoogleFontFaceCSS(fixture.css, FAMILY),
      fixture.code
    )
  }
})

test("parser caps the number of source face blocks before any asset request", () => {
  const css = Array.from(
    { length: MAX_GOOGLE_FONT_FACE_COUNT + 1 },
    (_, index) =>
      createFace(`https://fonts.gstatic.com/s/test/v1/font-${index}.woff2`, {
        unicodeRange: `U+${index.toString(16).padStart(4, "0")}`
      })
  ).join("\n")

  assertThrowsWithCode(
    () => parseGoogleFontFaceCSS(css, FAMILY),
    "google-font-face-count-limit"
  )
})

test("rejects invalid CSS status, final URL, redirects, MIME, declared size, actual size, and encoding", async () => {
  const cases: Array<{
    code: GoogleFontBinaryErrorCode
    response: () => Response
  }> = [
    {
      code: "google-font-css-request-failed",
      response: () => createCSSResponse("unavailable", { status: 503 })
    },
    {
      code: "google-font-css-response-invalid",
      response: () =>
        createResponse(
          "https://fonts.googleapis.com/css?family=Noto+Sans+Arabic",
          createFace(FIRST_ASSET_URL),
          { headers: { "content-type": "text/css" } }
        )
    },
    {
      code: "google-font-css-response-invalid",
      response: () =>
        createCSSResponse(createFace(FIRST_ASSET_URL), { redirected: true })
    },
    {
      code: "google-font-css-response-invalid",
      response: () =>
        createCSSResponse(createFace(FIRST_ASSET_URL), {
          headers: { "content-type": "text/html" }
        })
    },
    {
      code: "google-font-css-too-large",
      response: () =>
        createCSSResponse(createFace(FIRST_ASSET_URL), {
          headers: {
            "content-length": String(MAX_GOOGLE_FONT_CSS_BYTES + 1)
          }
        })
    },
    {
      code: "google-font-css-too-large",
      response: () =>
        createCSSResponse("a".repeat(MAX_GOOGLE_FONT_CSS_BYTES + 1))
    },
    {
      code: "google-font-css-invalid",
      response: () => createCSSResponse(new Uint8Array([0xff, 0xfe]))
    }
  ]

  for (const fixture of cases) {
    await assertRejectsWithCode(
      downloadGoogleFontFamilyDraft(REQUEST, {
        fetch: async () => fixture.response()
      }),
      fixture.code
    )
  }
})

test("rejects invalid font status, final URL, redirects, MIME, declared size, actual size, and signature", async () => {
  const css = createFace(FIRST_ASSET_URL)
  const validBytes = createWOFF2Bytes()
  const cases: Array<{
    code: GoogleFontBinaryErrorCode
    response: () => Response
  }> = [
    {
      code: "google-font-asset-request-failed",
      response: () =>
        createAssetResponse(FIRST_ASSET_URL, validBytes, { status: 404 })
    },
    {
      code: "google-font-asset-response-invalid",
      response: () =>
        createAssetResponse(
          "https://fonts.gstatic.com/s/test/redirected.woff2",
          validBytes
        )
    },
    {
      code: "google-font-asset-response-invalid",
      response: () =>
        createAssetResponse(FIRST_ASSET_URL, validBytes, { redirected: true })
    },
    {
      code: "google-font-asset-response-invalid",
      response: () =>
        createAssetResponse(FIRST_ASSET_URL, validBytes, {
          headers: { "content-type": "application/octet-stream" }
        })
    },
    {
      code: "google-font-asset-too-large",
      response: () =>
        createAssetResponse(FIRST_ASSET_URL, validBytes, {
          headers: {
            "content-length": String(MAX_GOOGLE_FONT_ASSET_BYTES + 1)
          }
        })
    },
    {
      code: "google-font-asset-too-large",
      response: () =>
        createAssetResponse(
          FIRST_ASSET_URL,
          createWOFF2Bytes(MAX_GOOGLE_FONT_ASSET_BYTES + 1)
        )
    },
    {
      code: "google-font-asset-invalid",
      response: () =>
        createAssetResponse(
          FIRST_ASSET_URL,
          new TextEncoder().encode("not-a-woff2")
        )
    }
  ]

  for (const fixture of cases) {
    let callCount = 0
    await assertRejectsWithCode(
      downloadGoogleFontFamilyDraft(REQUEST, {
        fetch: async () => {
          callCount += 1
          return callCount === 1 ? createCSSResponse(css) : fixture.response()
        }
      }),
      fixture.code
    )
    assert.equal(callCount, 2)
  }
})

test("enforces the 12 MiB unique family limit", async () => {
  const assetUrls = [
    FIRST_ASSET_URL,
    SECOND_ASSET_URL,
    "https://fonts.gstatic.com/s/notosansarabic/v31/fontara-c.woff2"
  ]
  const css = assetUrls.map((url) => createFace(url)).join("\n")
  const perAssetSize = Math.floor(MAX_GOOGLE_FONT_FAMILY_BYTES / 3) + 1
  const assets = Object.fromEntries(
    assetUrls.map((url, index) => [
      url,
      createWOFF2Bytes(perAssetSize, 0x61 + index)
    ])
  )
  const mock = createSuccessfulFetch(css, assets)

  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(REQUEST, { fetch: mock.fetch }),
    "google-font-family-size-limit"
  )
})

test("times out CSS requests even when the injected fetch does not settle", async () => {
  let observedSignal: AbortSignal | undefined
  const fetch = (_input: RequestInfo | URL, init?: RequestInit) => {
    observedSignal = init?.signal ?? undefined
    return new Promise<Response>(() => undefined)
  }

  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(REQUEST, {
      cssTimeoutMs: 5,
      fetch
    }),
    "google-font-request-timeout"
  )
  assert.equal(observedSignal?.aborted, true)
})

test("the timeout remains active while a response body is stalled", async () => {
  let observedSignal: AbortSignal | undefined
  const stalledBody = new ReadableStream<Uint8Array>({
    start() {
      // Deliberately leave the stream open without producing a chunk.
    }
  })

  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(REQUEST, {
      cssTimeoutMs: 5,
      fetch: async (_input, init) => {
        observedSignal = init?.signal ?? undefined
        return createResponse(REQUEST_URL, stalledBody, {
          headers: { "content-type": "text/css" }
        })
      }
    }),
    "google-font-request-timeout"
  )
  assert.equal(observedSignal?.aborted, true)
})

test("downloads distinct assets with bounded parallelism", async () => {
  const assetUrls = Array.from(
    { length: 6 },
    (_, index) =>
      `https://fonts.gstatic.com/s/notosansarabic/v31/parallel-${index}.woff2`
  )
  const css = assetUrls
    .map((url, index) =>
      createFace(url, {
        unicodeRange: `U+${(0x600 + index).toString(16)}`
      })
    )
    .join("\n")
  let activeAssetRequests = 0
  let maximumActiveAssetRequests = 0

  const result = await downloadGoogleFontFamilyDraft(REQUEST, {
    fetch: async (input) => {
      const url = String(input)
      if (url === REQUEST_URL) return createCSSResponse(css)
      const index = assetUrls.indexOf(url)
      assert.notEqual(index, -1)
      activeAssetRequests += 1
      maximumActiveAssetRequests = Math.max(
        maximumActiveAssetRequests,
        activeAssetRequests
      )
      await new Promise((resolve) => setTimeout(resolve, 2))
      activeAssetRequests -= 1
      return createAssetResponse(url, createWOFF2Bytes(32, 0x61 + index))
    }
  })

  assert.equal(result.family.faces.length, assetUrls.length)
  assert.equal(result.assets.size, assetUrls.length)
  assert.ok(maximumActiveAssetRequests > 1)
  assert.ok(maximumActiveAssetRequests <= 4)
})

test("the aggregate family deadline aborts stalled asset requests", async () => {
  const observedSignals: AbortSignal[] = []
  let callCount = 0

  await assertRejectsWithCode(
    downloadGoogleFontFamilyDraft(REQUEST, {
      // Leave enough time for instrumented/slow CI to finish CSS parsing and
      // enter the asset request; the stalled body must still hit one aggregate
      // family deadline rather than the much longer per-file timeout.
      familyTimeoutMs: 100,
      fetch: async (input, init) => {
        callCount += 1
        if (String(input) === REQUEST_URL) {
          return createCSSResponse(createFace(FIRST_ASSET_URL))
        }
        if (init?.signal) observedSignals.push(init.signal)
        return new Promise<Response>(() => undefined)
      },
      fontTimeoutMs: 1_000
    }),
    "google-font-request-timeout"
  )

  assert.equal(callCount, 2)
  assert.equal(observedSignals.length, 1)
  assert.equal(observedSignals[0]?.aborted, true)
})

test("an external cancellation aborts the active request immediately", async () => {
  const abortController = new AbortController()
  let observedSignal: AbortSignal | undefined
  const download = downloadGoogleFontFamilyDraft(REQUEST, {
    cssTimeoutMs: 1_000,
    fetch: (_input, init) => {
      observedSignal = init?.signal ?? undefined
      return new Promise<Response>(() => undefined)
    },
    signal: abortController.signal
  })

  await Promise.resolve()
  abortController.abort()
  await assertRejectsWithCode(download, "google-font-network-failed")
  assert.equal(observedSignal?.aborted, true)
})
