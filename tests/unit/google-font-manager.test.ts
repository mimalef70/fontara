import assert from "node:assert/strict"
import test from "node:test"

import {
  BackgroundGoogleFontManager,
  BackgroundGoogleFontManagerError,
  GOOGLE_FONT_BINARY_STALE_TTL_MS
} from "../../src/background/google-font-manager"
import type { GoogleFontMetadata } from "../../src/config/google-fonts"
import { STORAGE_KEYS } from "../../src/config/storage"
import {
  createGoogleFontBinaryFamilyKey,
  createGoogleFontRuntimeFamily,
  GOOGLE_FONT_BINARY_SCHEMA_VERSION,
  GoogleFontBinaryError,
  type GoogleFontBinaryFamily,
  type GoogleFontBinaryFamilyDraft,
  type GoogleFontBinaryPruneOptions
} from "../../src/google-font-binary-types"
import { createGoogleFontValue } from "../../src/utils/google-fonts"

const NOW = 2_000_000_000_000
const INTER: GoogleFontMetadata = {
  category: "sans-serif",
  fallback: "sans-serif",
  family: "Inter",
  recommended: true,
  subsets: ["latin"],
  variants: ["regular", "700"]
}
const ROBOTO: GoogleFontMetadata = {
  ...INTER,
  family: "Roboto"
}

type Deferred<T> = {
  promise: Promise<T>
  reject: (error: unknown) => void
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

async function createDraft(
  metadata: GoogleFontMetadata
): Promise<GoogleFontBinaryFamilyDraft> {
  const hash = metadata.family === "Inter" ? "a".repeat(64) : "b".repeat(64)
  return {
    cssHash: hash,
    faces: [
      {
        assetHash: "c".repeat(64),
        byteLength: 8,
        id: `google-${metadata.family.toLowerCase()}`,
        sourceUrl: `https://fonts.gstatic.com/s/${metadata.family.toLowerCase()}/v1/font.woff2`,
        stretch: "normal",
        style: "normal",
        unicodeRange: "U+0000-00FF",
        weight: "400"
      }
    ],
    fontFamily: metadata.family,
    key: await createGoogleFontBinaryFamilyKey(metadata.family),
    requestUrl: `https://fonts.googleapis.com/css2?family=${metadata.family}`,
    runtimeFamily: createGoogleFontRuntimeFamily(hash),
    totalBytes: 8
  }
}

function publishDraft(
  draft: GoogleFontBinaryFamilyDraft,
  updatedAt = NOW
): GoogleFontBinaryFamily {
  return {
    ...structuredClone(draft),
    createdAt: updatedAt,
    lastAccessedAt: updatedAt,
    pinned: false,
    revision: 1,
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION,
    updatedAt
  }
}

function createHarness(
  options: {
    cached?: GoogleFontBinaryFamily | null
    clear?: ReturnType<typeof deferred<void>>
    consent?: boolean
    consentCheck?: ReturnType<typeof deferred<boolean>>
    download?: ReturnType<
      typeof deferred<{
        assets: Map<string, Uint8Array>
        family: GoogleFontBinaryFamilyDraft
      }>
    >
    enabled?: boolean
    getLatestError?: unknown
    getStatsError?: unknown
    readAsset?: ReturnType<typeof deferred<Uint8Array | null>>
    readAssetError?: unknown
    missingAsset?: boolean
    ready?: ReturnType<typeof deferred<void>>
    settings?: Record<string, unknown>
  } = {}
) {
  let cached = options.cached ?? null
  let getLatestError = options.getLatestError
  let getStatsError = options.getStatsError
  let downloadCount = 0
  let publishCount = 0
  let recoverCount = 0
  let readyCount = 0
  let deleteCount = 0
  let consentCheckCount = 0
  let readAssetCount = 0
  const downloadSignals: AbortSignal[] = []
  const pruneCalls: GoogleFontBinaryPruneOptions[] = []
  const pendingDownload = options.download
  const settings = options.settings ?? {
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: options.enabled ?? true,
    [STORAGE_KEYS.SELECTED_FONT]: createGoogleFontValue(INTER.family),
    [STORAGE_KEYS.SITE_PROFILES]: []
  }

  const manager = new BackgroundGoogleFontManager({
    dependencies: {
      clearCache: async () => {
        if (options.clear) await options.clear.promise
        cached = null
      },
      download: async (font, networkOptions) => {
        downloadCount += 1
        if (networkOptions?.signal) {
          downloadSignals.push(networkOptions.signal)
        }
        if (pendingDownload) return pendingDownload.promise
        if (!("category" in font)) throw new Error("expected catalog metadata")
        const family = await createDraft(font)
        return {
          assets: new Map([["c".repeat(64), new Uint8Array(8)]]),
          family
        }
      },
      deleteFamily: async () => {
        deleteCount += 1
        cached = null
      },
      getLatest: async () => {
        if (getLatestError) {
          const error = getLatestError
          getLatestError = undefined
          throw error
        }
        return cached
      },
      getStats: async () => {
        if (getStatsError) {
          const error = getStatsError
          getStatsError = undefined
          throw error
        }
        return {
          familyCount: cached ? 1 : 0,
          pinnedFamilyCount: 0,
          totalBytes: cached?.totalBytes ?? 0
        }
      },
      hasNetworkConsent: async () => {
        consentCheckCount += 1
        return options.consentCheck
          ? options.consentCheck.promise
          : (options.consent ?? true)
      },
      loadCatalog: async () =>
        [INTER, ROBOTO].map((font) => ({
          ...font,
          fontFamily: font.family,
          name: font.family,
          value: createGoogleFontValue(font.family)
        })),
      now: () => NOW,
      prune: async (pruneOptions) => {
        pruneCalls.push(pruneOptions ?? {})
        return {
          evictedFamilyKeys: [],
          removedAssetHashes: [],
          totalBytes: cached?.totalBytes ?? 0
        }
      },
      publish: async (draft) => {
        publishCount += 1
        cached = publishDraft(draft)
        return cached
      },
      readAsset: async () => {
        readAssetCount += 1
        if (options.readAssetError) throw options.readAssetError
        if (options.readAsset) return options.readAsset.promise
        return options.missingAsset ? null : new Uint8Array(8)
      },
      recover: async () => {
        recoverCount += 1
        cached = null
      }
    },
    onFamilyReady: async () => {
      readyCount += 1
      if (options.ready) await options.ready.promise
    },
    readSettings: async () => settings
  })

  return {
    get downloadCount() {
      return downloadCount
    },
    downloadSignals,
    get deleteCount() {
      return deleteCount
    },
    get consentCheckCount() {
      return consentCheckCount
    },
    get publishCount() {
      return publishCount
    },
    get readyCount() {
      return readyCount
    },
    get readAssetCount() {
      return readAssetCount
    },
    get recoverCount() {
      return recoverCount
    },
    manager,
    pruneCalls
  }
}

test("cache misses schedule one trackable, deduplicated background preparation", async () => {
  const pendingDownload = deferred<{
    assets: Map<string, Uint8Array>
    family: GoogleFontBinaryFamilyDraft
  }>()
  const harness = createHarness({ download: pendingDownload })
  const tracked: Promise<GoogleFontBinaryFamily>[] = []

  const [first, second] = await Promise.all([
    harness.manager.resolve(createGoogleFontValue(INTER.family), {
      allowNetwork: true,
      track: (task) => tracked.push(task)
    }),
    harness.manager.resolve(createGoogleFontValue(INTER.family), {
      allowNetwork: true,
      track: (task) => tracked.push(task)
    })
  ])
  assert.equal(first, null)
  assert.equal(second, null)
  assert.equal(harness.downloadCount, 1)
  assert.equal(tracked.length, 2)
  assert.equal(tracked[0], tracked[1])

  const draft = await createDraft(INTER)
  pendingDownload.resolve({
    assets: new Map([["c".repeat(64), new Uint8Array(8)]]),
    family: draft
  })
  const family = await tracked[0]
  assert.equal(family.fontFamily, INTER.family)
  assert.equal(harness.publishCount, 1)
  assert.equal(harness.readyCount, 1)
})

test("stale-while-revalidate returns the LKG immediately when revalidation fails", async () => {
  const draft = await createDraft(INTER)
  const stale = publishDraft(draft, NOW - GOOGLE_FONT_BINARY_STALE_TTL_MS)
  const pendingDownload = deferred<{
    assets: Map<string, Uint8Array>
    family: GoogleFontBinaryFamilyDraft
  }>()
  const harness = createHarness({ cached: stale, download: pendingDownload })
  let tracked: Promise<GoogleFontBinaryFamily> | null = null

  const resolved = await harness.manager.resolve(
    createGoogleFontValue(INTER.family),
    {
      allowNetwork: true,
      track: (task) => {
        tracked = task
      }
    }
  )
  assert.equal(resolved, stale)
  assert.ok(tracked)

  pendingDownload.reject(new Error("offline"))
  await assert.rejects(tracked, /offline/)
  assert.equal(harness.publishCount, 0)
})

test("network access is opt-in and consent denial never discards a cached family", async () => {
  const draft = await createDraft(INTER)
  const stale = publishDraft(draft, NOW - GOOGLE_FONT_BINARY_STALE_TTL_MS - 1)
  const harness = createHarness({ cached: stale, consent: false })

  assert.equal(
    await harness.manager.resolve(createGoogleFontValue(INTER.family)),
    stale
  )
  assert.equal(
    await harness.manager.resolve(createGoogleFontValue(INTER.family), {
      allowNetwork: true
    }),
    stale
  )
  assert.equal(harness.downloadCount, 0)
  await assert.rejects(
    harness.manager.prepare(createGoogleFontValue(INTER.family)),
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-consent-required"
  )
})

test("the default-off setting blocks cache use and explicit preparation", async () => {
  const harness = createHarness({ enabled: false })
  assert.equal(
    await harness.manager.resolve(createGoogleFontValue(INTER.family), {
      allowNetwork: true
    }),
    null
  )
  assert.equal(harness.downloadCount, 0)
  await assert.rejects(
    harness.manager.prepare(createGoogleFontValue(INTER.family)),
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-feature-disabled"
  )
})

test("corrupt metadata is recovered without hiding unrelated storage failures", async () => {
  const corrupt = createHarness({
    getLatestError: new GoogleFontBinaryError("google-font-cache-corrupt")
  })
  assert.equal(
    await corrupt.manager.resolve(createGoogleFontValue(INTER.family)),
    null
  )
  assert.equal(corrupt.recoverCount, 1)

  const readFailure = createHarness({
    getLatestError: new GoogleFontBinaryError("google-font-storage-read-failed")
  })
  await assert.rejects(
    readFailure.manager.resolve(createGoogleFontValue(INTER.family)),
    /google-font-storage-read-failed/
  )
  assert.equal(readFailure.recoverCount, 0)
})

test("cached assets are verified once per worker and missing bytes are redownloaded", async () => {
  const draft = await createDraft(INTER)
  const cached = publishDraft(draft)
  const healthy = createHarness({ cached })

  assert.equal(
    await healthy.manager.resolve(createGoogleFontValue(INTER.family)),
    cached
  )
  assert.equal(
    await healthy.manager.resolve(createGoogleFontValue(INTER.family)),
    cached
  )
  assert.equal(healthy.readAssetCount, 1)

  const missing = createHarness({ cached, missingAsset: true })
  assert.equal(
    await missing.manager.resolve(createGoogleFontValue(INTER.family)),
    null
  )
  assert.equal(missing.deleteCount, 1)
})

test("clear waits out obsolete work so an in-flight download cannot resurrect cache", async () => {
  const pendingDownload = deferred<{
    assets: Map<string, Uint8Array>
    family: GoogleFontBinaryFamilyDraft
  }>()
  const harness = createHarness({ download: pendingDownload })
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )
  while (harness.downloadCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const clearing = harness.manager.clear()
  pendingDownload.resolve({
    assets: new Map([["c".repeat(64), new Uint8Array(8)]]),
    family: await createDraft(INTER)
  })

  await assert.rejects(
    preparation,
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-cache-cleared"
  )
  await clearing
  assert.deepEqual(await harness.manager.getStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
})

test("pausing the source aborts pending network work without deleting the cache", async () => {
  const pendingDownload = deferred<{
    assets: Map<string, Uint8Array>
    family: GoogleFontBinaryFamilyDraft
  }>()
  const harness = createHarness({ download: pendingDownload })
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )
  while (harness.downloadCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  assert.equal(harness.downloadSignals[0]?.aborted, false)
  harness.manager.cancelPendingNetwork()
  assert.equal(harness.downloadSignals[0]?.aborted, true)

  pendingDownload.reject(
    new GoogleFontBinaryError("google-font-network-failed")
  )
  await assert.rejects(preparation, /google-font-network-failed/)
  assert.deepEqual(await harness.manager.getStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
})

test("a paused manager cannot start a replacement request until resumed", async () => {
  const harness = createHarness()
  harness.manager.cancelPendingNetwork()

  await assert.rejects(
    harness.manager.prepare(createGoogleFontValue(INTER.family), {
      force: true
    }),
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-consent-required"
  )
  assert.equal(harness.downloadCount, 0)

  harness.manager.resumeNetwork()
  await harness.manager.prepare(createGoogleFontValue(INTER.family), {
    force: true
  })
  assert.equal(harness.downloadCount, 1)
})

test("revocation during a pending consent check cannot start new network work", async () => {
  const consentCheck = deferred<boolean>()
  const harness = createHarness({ consentCheck })
  const resolution = harness.manager.resolve(
    createGoogleFontValue(INTER.family),
    { allowNetwork: true }
  )
  while (harness.consentCheckCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  harness.manager.cancelPendingNetwork()
  consentCheck.resolve(true)
  assert.equal(await resolution, null)
  assert.equal(harness.downloadCount, 0)
})

test("new preparation waits until a concurrent cache clear is durable", async () => {
  const clearGate = deferred<void>()
  const harness = createHarness({ clear: clearGate })
  const clearing = harness.manager.clear()
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(harness.downloadCount, 0)
  clearGate.resolve()
  await clearing
  await preparation
  assert.equal(harness.downloadCount, 1)
})

test("clear rejects a preparation admitted before its network task was registered", async () => {
  const consentCheck = deferred<boolean>()
  const harness = createHarness({ consentCheck })
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )
  while (harness.consentCheckCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  await harness.manager.clear()
  consentCheck.resolve(true)
  await assert.rejects(
    preparation,
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-cache-cleared"
  )
  assert.equal(harness.downloadCount, 0)
  assert.deepEqual(await harness.manager.getStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
})

test("a stale asset verifier cannot delete a family republished after clear", async () => {
  const assetRead = deferred<Uint8Array | null>()
  const cached = publishDraft(await createDraft(INTER))
  const harness = createHarness({ cached, readAsset: assetRead })
  const resolution = harness.manager.resolve(
    createGoogleFontValue(INTER.family)
  )
  while (harness.readAssetCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const clearing = harness.manager.clear()
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(harness.downloadCount, 0)

  assetRead.resolve(null)
  assert.equal(await resolution, null)
  await clearing
  await preparation

  assert.equal(harness.deleteCount, 0)
  assert.equal(harness.publishCount, 1)
  assert.deepEqual(await harness.manager.getStats(), {
    familyCount: 1,
    pinnedFamilyCount: 0,
    totalBytes: 8
  })
})

test("cache clear cannot deadlock with a reentrant ready notification", async () => {
  const readyGate = deferred<void>()
  const harness = createHarness({ ready: readyGate })
  const preparation = harness.manager.prepare(
    createGoogleFontValue(INTER.family),
    { force: true }
  )
  while (harness.readyCount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  await harness.manager.clear()
  readyGate.resolve()
  await assert.rejects(
    preparation,
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-cache-cleared"
  )
})

test("runtime resolution degrades safely for a family removed from the catalog", async () => {
  const harness = createHarness()
  assert.equal(
    await harness.manager.resolve(createGoogleFontValue("Noto Sans JP"), {
      allowNetwork: true
    }),
    null
  )
  assert.equal(harness.downloadCount, 0)
})

test("startup recovers corrupt cache metadata and runs bounded cleanup", async () => {
  const harness = createHarness({
    getStatsError: new GoogleFontBinaryError("google-font-cache-corrupt")
  })
  await harness.manager.initialize()
  assert.equal(harness.recoverCount, 1)
  assert.equal(harness.pruneCalls.length, 1)
})

test("pre-publication LRU pruning protects global and per-site selections", async () => {
  const settings = {
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: createGoogleFontValue(INTER.family),
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        font: createGoogleFontValue(ROBOTO.family),
        pattern: "example.com"
      }
    ]
  }
  const harness = createHarness({ settings })
  await harness.manager.prepare(createGoogleFontValue(INTER.family), {
    force: true
  })

  assert.equal(harness.pruneCalls.length, 2)
  const protectedKeys = new Set(harness.pruneCalls[0].protectedFamilyKeys ?? [])
  assert.deepEqual(
    protectedKeys,
    new Set([
      await createGoogleFontBinaryFamilyKey(INTER.family),
      await createGoogleFontBinaryFamilyKey(ROBOTO.family)
    ])
  )
  assert.equal(harness.pruneCalls[0].maxFamilies, 15)
})

test("families outside the packaged catalog are rejected before networking", async () => {
  const harness = createHarness()
  await assert.rejects(
    harness.manager.prepare(createGoogleFontValue("Unlisted Family")),
    (error: unknown) =>
      error instanceof BackgroundGoogleFontManagerError &&
      error.code === "google-font-manager-selection-not-in-catalog"
  )
  assert.equal(harness.downloadCount, 0)
})
