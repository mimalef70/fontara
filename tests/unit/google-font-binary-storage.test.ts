import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import {
  createGoogleFontBinaryFamilyKey,
  type GoogleFontBinaryFamilyDraft
} from "../../src/google-font-binary-types"
import { createCustomFontFileHash } from "../../src/utils/custom-font-format"
import {
  clearGoogleFontBinaryCache,
  deleteGoogleFontBinaryFamily,
  GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX,
  GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX,
  getGoogleFontBinaryCacheStats,
  getLatestGoogleFontBinaryFamily,
  listGoogleFontBinaryFamilies,
  pruneGoogleFontBinaryCache,
  publishGoogleFontBinaryFamily,
  readGoogleFontBinaryAsset,
  readGoogleFontBinaryFamilyReference,
  recoverGoogleFontBinaryCache,
  resetGoogleFontBinaryStorageForTesting,
  setGoogleFontBinaryFamilyPinned
} from "../../src/utils/google-font-binary-storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
let values: Record<string, unknown>
let wholeStorageReads: number

beforeEach(() => {
  values = {}
  wholeStorageReads = 0
  Reflect.set(globalThis, "chrome", {
    runtime: { lastError: null },
    storage: {
      local: {
        get(
          keys: string | string[] | null,
          callback: (result: Record<string, unknown>) => void
        ) {
          if (keys === null) {
            wholeStorageReads += 1
            callback(structuredClone(values))
            return
          }
          const requestedKeys = Array.isArray(keys) ? keys : [keys]
          callback(
            Object.fromEntries(
              requestedKeys
                .filter((key) => key in values)
                .map((key) => [key, structuredClone(values[key])])
            )
          )
        },
        remove(keys: string | string[], callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys])
            delete values[key]
          callback()
        },
        set(update: Record<string, unknown>, callback: () => void) {
          Object.assign(values, structuredClone(update))
          callback()
        }
      }
    }
  })
  resetGoogleFontBinaryStorageForTesting()
})

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  resetGoogleFontBinaryStorageForTesting()
})

async function hash(value: string | Uint8Array): Promise<string> {
  return createCustomFontFileHash(
    typeof value === "string" ? new TextEncoder().encode(value) : value
  )
}

async function createFixture(
  family: string,
  suffix: string
): Promise<{
  assets: Map<string, Uint8Array>
  draft: GoogleFontBinaryFamilyDraft
}> {
  const requestUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family
  )}`
  const bytes = new TextEncoder().encode(`wOF2fixture-${suffix}`)
  const assetHash = await hash(bytes)
  const cssHash = await hash(`css-${suffix}`)
  return {
    assets: new Map([[assetHash, bytes]]),
    draft: {
      cssHash,
      faces: [
        {
          assetHash,
          byteLength: bytes.byteLength,
          id: `google-${suffix}`,
          sourceUrl: `https://fonts.gstatic.com/s/${family.toLowerCase()}/v1/${suffix}.woff2`,
          stretch: "100%",
          style: "normal",
          unicodeRange: "U+0000-00FF",
          weight: "400"
        }
      ],
      fontFamily: family,
      key: await createGoogleFontBinaryFamilyKey(family),
      requestUrl,
      runtimeFamily: `FontAraGoogle-${cssHash.slice(0, 24)}`,
      totalBytes: bytes.byteLength
    }
  }
}

test("binary storage publishes idempotently and preserves exact old revisions", async () => {
  const first = await createFixture("Inter", "first")
  const revisionOne = await publishGoogleFontBinaryFamily(
    first.draft,
    first.assets,
    { now: 10 }
  )
  const retried = await publishGoogleFontBinaryFamily(
    first.draft,
    first.assets,
    { now: 20 }
  )
  assert.equal(revisionOne.revision, 1)
  assert.equal(retried.revision, 1)

  const second = await createFixture("Inter", "second")
  second.draft.key = first.draft.key
  second.draft.requestUrl = first.draft.requestUrl
  const revisionTwo = await publishGoogleFontBinaryFamily(
    second.draft,
    second.assets,
    { now: 30 }
  )
  assert.equal(revisionTwo.revision, 2)
  assert.equal(
    (await getLatestGoogleFontBinaryFamily(first.draft.key, { touch: false }))
      ?.revision,
    2
  )
  assert.equal(
    (await readGoogleFontBinaryFamilyReference(revisionOne, { touch: false }))
      ?.cssHash,
    first.draft.cssHash
  )
  assert.deepEqual(
    await readGoogleFontBinaryAsset(
      revisionOne.faces[0].assetHash,
      revisionOne.faces[0].byteLength
    ),
    first.assets.get(revisionOne.faces[0].assetHash)
  )
  assert.equal((await listGoogleFontBinaryFamilies()).length, 1)
  assert.equal((await getGoogleFontBinaryCacheStats()).familyCount, 1)
  assert.equal(wholeStorageReads, 0)
})

test("binary reads reject a blob whose bytes no longer match its hash", async () => {
  const fixture = await createFixture("Roboto", "tamper")
  const family = await publishGoogleFontBinaryFamily(
    fixture.draft,
    fixture.assets
  )
  const storageKey = `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${family.faces[0].assetHash}`
  const blob = values[storageKey] as { data: string }
  blob.data = btoa("wOF2tampered")

  await assert.rejects(
    readGoogleFontBinaryAsset(
      family.faces[0].assetHash,
      family.faces[0].byteLength
    ),
    /google-font-asset-invalid/
  )
})

test("LRU pruning protects pinned families and clear removes indexed data", async () => {
  const pinnedFixture = await createFixture("Inter", "pinned")
  const evictableFixture = await createFixture("Roboto", "evictable")
  const pinned = await publishGoogleFontBinaryFamily(
    pinnedFixture.draft,
    pinnedFixture.assets,
    { now: 10 }
  )
  const evictable = await publishGoogleFontBinaryFamily(
    evictableFixture.draft,
    evictableFixture.assets,
    { now: 20 }
  )
  await setGoogleFontBinaryFamilyPinned(pinned, true)

  const pruned = await pruneGoogleFontBinaryCache({ maxFamilies: 1 })
  assert.deepEqual(pruned.evictedFamilyKeys, [evictable.key])
  assert.ok(await readGoogleFontBinaryFamilyReference(pinned, { touch: false }))
  assert.equal(
    await readGoogleFontBinaryFamilyReference(evictable, { touch: false }),
    null
  )
  assert.equal((await getGoogleFontBinaryCacheStats()).pinnedFamilyCount, 1)

  await clearGoogleFontBinaryCache()
  assert.deepEqual(await listGoogleFontBinaryFamilies(), [])
  assert.deepEqual(await getGoogleFontBinaryCacheStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
  assert.equal(wholeStorageReads, 1)
})

test("recovery resets corrupt metadata without scanning or deleting unknown data", async () => {
  const unknownBlobKey = `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${"a".repeat(64)}`
  values[unknownBlobKey] = { futureSchemaData: true }
  values.__fontara_google_font_binary_index__ = { broken: true }
  values.__fontara_google_font_binary_catalog__ = { broken: true }

  await assert.rejects(
    getGoogleFontBinaryCacheStats(),
    /google-font-cache-corrupt/
  )
  await recoverGoogleFontBinaryCache()

  assert.deepEqual(await getGoogleFontBinaryCacheStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
  assert.deepEqual(values[unknownBlobKey], { futureSchemaData: true })
  assert.equal(wholeStorageReads, 0)
})

test("explicit clear removes orphaned Google font data after recovery", async () => {
  const orphanAssetKey = `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${"a".repeat(64)}`
  const orphanFamilyKey = `${GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX}${"b".repeat(64)}:99`
  const unrelatedKey = `customFontFace:${"c".repeat(64)}`
  values[orphanAssetKey] = { futureSchemaData: true }
  values[orphanFamilyKey] = { futureSchemaData: true }
  values.googleFontCssCache = { legacySelectionMetadata: true }
  values[unrelatedKey] = { mustRemain: true }
  values.__fontara_google_font_binary_index__ = { broken: true }
  values.__fontara_google_font_binary_catalog__ = { broken: true }

  await recoverGoogleFontBinaryCache()
  await clearGoogleFontBinaryCache()

  assert.equal(orphanAssetKey in values, false)
  assert.equal(orphanFamilyKey in values, false)
  assert.equal("googleFontCssCache" in values, false)
  assert.deepEqual(values[unrelatedKey], { mustRemain: true })
  assert.deepEqual(await getGoogleFontBinaryCacheStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
  assert.equal(wholeStorageReads, 1)
})

test("family deletion preserves assets still referenced by another family", async () => {
  const first = await createFixture("Inter", "shared")
  const second = await createFixture("Roboto", "second-family")
  const sharedFace = first.draft.faces[0]
  second.draft.faces.push({
    ...sharedFace,
    id: "google-shared-second-family"
  })
  const sharedBytes = first.assets.get(sharedFace.assetHash)
  assert.ok(sharedBytes)
  second.assets.set(sharedFace.assetHash, sharedBytes)
  second.draft.totalBytes += sharedFace.byteLength

  const firstFamily = await publishGoogleFontBinaryFamily(
    first.draft,
    first.assets
  )
  const secondFamily = await publishGoogleFontBinaryFamily(
    second.draft,
    second.assets
  )
  const firstOnlyHash = firstFamily.faces[0].assetHash
  const secondOnlyHash = secondFamily.faces[0].assetHash

  await deleteGoogleFontBinaryFamily(firstFamily.key)
  await deleteGoogleFontBinaryFamily(firstFamily.key)

  assert.equal(
    await readGoogleFontBinaryFamilyReference(firstFamily, { touch: false }),
    null
  )
  assert.ok(
    await readGoogleFontBinaryFamilyReference(secondFamily, { touch: false })
  )
  assert.ok(await readGoogleFontBinaryAsset(firstOnlyHash))
  assert.ok(await readGoogleFontBinaryAsset(secondOnlyHash))

  await deleteGoogleFontBinaryFamily(secondFamily.key)
  assert.equal(await readGoogleFontBinaryAsset(firstOnlyHash), null)
  assert.equal(await readGoogleFontBinaryAsset(secondOnlyHash), null)
  assert.deepEqual(await getGoogleFontBinaryCacheStats(), {
    familyCount: 0,
    pinnedFamilyCount: 0,
    totalBytes: 0
  })
  assert.equal(wholeStorageReads, 0)
})
