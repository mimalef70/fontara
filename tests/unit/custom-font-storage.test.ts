import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import type { CustomFontFamilyDraft } from "../../src/custom-font-types"
import {
  bytesToBase64,
  createCustomFontFileHash
} from "../../src/utils/custom-font-format"
import {
  CUSTOM_FONT_FACE_STORAGE_PREFIX,
  CUSTOM_FONT_STAGING_STORAGE_PREFIX,
  CUSTOM_FONT_TRANSACTION_JOURNAL_KEY,
  CUSTOM_FONT_TRANSACTION_RECOVERY_KEY,
  CustomFontTransactionStore,
  clearCustomFontTransactionRecovery,
  createCustomFontFaceBackupMap,
  deleteUnusedCustomFontFaceBlobs,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  readCustomFontFaceBytes,
  writeCustomFontFaceBytes
} from "../../src/utils/custom-font-storage"
import {
  createSettingsBackup,
  parseSettingsBackupText,
  prepareSettingsBackupImport
} from "../../src/utils/settings-backup"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

let values: Record<string, unknown>
let fullStorageReadCount: number

beforeEach(() => {
  values = {}
  fullStorageReadCount = 0
  Reflect.set(globalThis, "chrome", {
    runtime: { lastError: null },
    storage: {
      local: {
        get(
          keys: string | string[] | null,
          callback: (result: Record<string, unknown>) => void
        ) {
          if (keys === null) {
            fullStorageReadCount += 1
            callback(structuredClone(values))
          } else if (typeof keys === "string")
            callback({ [keys]: structuredClone(values[keys]) })
          else
            callback(
              Object.fromEntries(
                keys.map((key) => [key, structuredClone(values[key])])
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
})

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

async function createFixture(): Promise<{
  bytes: Uint8Array
  family: CustomFontFamilyDraft
}> {
  const bytes = new TextEncoder().encode("wOF2valid-font-fixture")
  const fileHash = await createCustomFontFileHash(bytes)
  return {
    bytes,
    family: {
      value: "FixtureFamily-Fontara",
      displayName: "Fixture Family",
      sourceFamilyKey: "fixture family",
      unicodeRange: null,
      faces: [
        {
          id: "fixture-face",
          fileHash,
          fileName: "fixture.woff2",
          format: "woff2",
          byteLength: bytes.byteLength,
          weight: { min: 400, max: 400 },
          style: "normal",
          stretch: { min: 100, max: 100 },
          axes: [],
          validation: "verified"
        }
      ]
    }
  }
}

test("custom font transaction keeps promoted blobs recoverable until catalog publication", async () => {
  const { bytes, family } = await createFixture()
  const store = new CustomFontTransactionStore()
  const { transactionId } = await store.begin(family, [])

  await store.putFace(transactionId, family.faces[0].id, bytesToBase64(bytes))
  const committed = await store.commit(transactionId, [])
  const retried = await new CustomFontTransactionStore().commit(
    transactionId,
    []
  )

  assert.equal(committed.revision, 1)
  assert.deepEqual(retried, committed)
  assert.deepEqual(
    await readCustomFontFaceBytes(family.faces[0].fileHash),
    bytes
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in values, true)
  assert.equal(
    Object.keys(values).some((key) =>
      key.startsWith(CUSTOM_FONT_STAGING_STORAGE_PREFIX)
    ),
    true
  )

  // A broad cleanup between blob promotion and catalog publication must not
  // delete the transaction's only recoverable copy.
  await deleteUnusedCustomFontFaceBlobs([])
  assert.deepEqual(
    await readCustomFontFaceBytes(family.faces[0].fileHash),
    bytes
  )

  // Simulate a service-worker restart after the catalog write. Startup can now
  // retire the journal and staging data without touching the published blob.
  await new CustomFontTransactionStore().finalizePublished([committed])
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in values, false)
  assert.equal(
    Object.keys(values).some((key) =>
      key.startsWith(CUSTOM_FONT_STAGING_STORAGE_PREFIX)
    ),
    false
  )
  assert.equal(
    `${CUSTOM_FONT_FACE_STORAGE_PREFIX}${family.faces[0].fileHash}` in values,
    true
  )
})

test("starting upload transactions avoids whole-storage blob scans", async () => {
  const first = await createFixture()
  const second = await createFixture()
  second.family.value = "SecondFixtureFamily-Fontara"
  second.family.displayName = "Second Fixture Family"
  second.family.sourceFamilyKey = "second fixture family"
  second.family.faces[0].id = "second-fixture-face"
  const store = new CustomFontTransactionStore()

  await store.begin(first.family, [])
  await store.begin(second.family, [])

  assert.equal(fullStorageReadCount, 0)
  await store.collectGarbage(Date.now(), true)
  assert.equal(fullStorageReadCount, 1)
})

test("custom font transaction rejects tampered face bytes and can abort", async () => {
  const { family } = await createFixture()
  const store = new CustomFontTransactionStore()
  const { transactionId } = await store.begin(family, [])

  await assert.rejects(
    store.putFace(
      transactionId,
      family.faces[0].id,
      bytesToBase64(new TextEncoder().encode("wOF2tampered"))
    ),
    /invalid-custom-font-face-size|invalid-custom-font-face/
  )
  await store.abort(transactionId)
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in values, false)
})

test("malformed transaction journal entries are quarantined without collecting their blobs", async () => {
  const { bytes, family } = await createFixture()
  await writeCustomFontFaceBytes(family.faces[0], bytes)
  values[CUSTOM_FONT_TRANSACTION_JOURNAL_KEY] = {
    "broken-transaction": {
      id: "broken-transaction",
      createdAt: 1,
      expiresAt: "not-a-timestamp",
      family,
      receivedFaceIds: [family.faces[0].id],
      phase: "promoted",
      committedRevision: 1,
      promotedAt: 1
    }
  }

  const store = new CustomFontTransactionStore()
  await store.collectGarbage()

  assert.deepEqual(values[CUSTOM_FONT_TRANSACTION_JOURNAL_KEY], {})
  const recovery = values[CUSTOM_FONT_TRANSACTION_RECOVERY_KEY] as {
    entries: Record<string, unknown>
  }
  assert.ok(recovery.entries["broken-transaction"])

  await deleteUnusedCustomFontFaceBlobs([])
  assert.deepEqual(
    await readCustomFontFaceBytes(family.faces[0].fileHash),
    bytes
  )

  // Quarantine is not allowed to brick future transactions.
  const next = await store.begin(family, [])
  assert.equal(typeof next.transactionId, "string")
  await store.abort(next.transactionId)

  await clearCustomFontTransactionRecovery()
  await deleteUnusedCustomFontFaceBlobs([])
  assert.equal(await readCustomFontFaceBytes(family.faces[0].fileHash), null)
})

test("custom font transaction enforces the per-face quota before upload", async () => {
  const { family } = await createFixture()
  family.faces[0].byteLength = MAX_CUSTOM_FONT_FILE_SIZE_BYTES + 1

  const store = new CustomFontTransactionStore()
  await assert.rejects(store.begin(family, []), /custom-font-face-size-limit/)
})

test("replacement transactions ignore the outgoing catalog but reserve the new library quota", async () => {
  const createLargeFamily = (index: number): CustomFontFamilyDraft => ({
    value: `ReservedFamily${index}-Fontara`,
    displayName: `Reserved Family ${index}`,
    sourceFamilyKey: `reserved family ${index}`,
    unicodeRange: null,
    faces: Array.from({ length: 4 }, (_, faceIndex) => ({
      id: `reserved-face-${index}-${faceIndex}`,
      fileHash: `${index}${faceIndex}`.padEnd(64, String(index)),
      fileName: `reserved-${index}-${faceIndex}.woff2`,
      format: "woff2" as const,
      byteLength: MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
      weight: { min: 400, max: 400 },
      style: "normal" as const,
      stretch: { min: 100, max: 100 },
      axes: [],
      validation: "verified" as const
    }))
  })
  const store = new CustomFontTransactionStore()
  const outgoingFamilies = [
    { ...createLargeFamily(1), revision: 1 },
    { ...createLargeFamily(2), revision: 1 }
  ]

  await assert.rejects(
    store.begin(createLargeFamily(3), outgoingFamilies),
    /custom-font-library-size-limit/
  )
  await store.begin(createLargeFamily(3), outgoingFamilies, "replace-library")
  await store.begin(createLargeFamily(4), outgoingFamilies, "replace-library")
  await assert.rejects(
    store.begin(createLargeFamily(5), outgoingFamilies, "replace-library"),
    /custom-font-library-size-limit/
  )
})

test("backup preflight preserves explicit failed faces and rejects missing blobs", async () => {
  const { bytes, family } = await createFixture()
  family.faces[0].validation = "failed"
  await writeCustomFontFaceBytes(family.faces[0], bytes)

  assert.deepEqual(
    await createCustomFontFaceBackupMap([{ ...family, revision: 1 }]),
    {
      [family.faces[0].fileHash]: bytesToBase64(bytes)
    }
  )

  delete values[`${CUSTOM_FONT_FACE_STORAGE_PREFIX}${family.faces[0].fileHash}`]
  await assert.rejects(
    createCustomFontFaceBackupMap([{ ...family, revision: 1 }]),
    /missing-custom-font-face-blob/
  )
})

test("backup blobs are deduplicated by file hash across duplicate face ids", async () => {
  const { bytes, family } = await createFixture()
  await writeCustomFontFaceBytes(family.faces[0], bytes)
  const secondFamily = structuredClone(family)
  secondFamily.value = "SecondFixtureFamily-Fontara"
  secondFamily.displayName = "Second Fixture Family"
  secondFamily.sourceFamilyKey = "second fixture family"
  // Duplicate ids are valid across families and must not overwrite unrelated
  // blobs. Here both faces intentionally reference the same content hash.
  secondFamily.faces[0].id = family.faces[0].id

  const backup = await createCustomFontFaceBackupMap([
    { ...family, revision: 1 },
    { ...secondFamily, revision: 1 }
  ])

  assert.deepEqual(Object.keys(backup), [family.faces[0].fileHash])
  assert.equal(backup[family.faces[0].fileHash], bytesToBase64(bytes))
})

test("hash-keyed backup round-trips families that reuse a face id", async () => {
  const first = await createFixture()
  const secondBytes = new TextEncoder().encode("wOF2second-valid-font-fixture")
  const secondHash = await createCustomFontFileHash(secondBytes)
  const secondFamily = structuredClone(first.family)
  secondFamily.value = "SecondFixtureFamily-Fontara"
  secondFamily.displayName = "Second Fixture Family"
  secondFamily.sourceFamilyKey = "second fixture family"
  secondFamily.faces[0] = {
    ...secondFamily.faces[0],
    fileHash: secondHash,
    fileName: "second-fixture.woff2",
    byteLength: secondBytes.byteLength
  }
  await writeCustomFontFaceBytes(first.family.faces[0], first.bytes)
  await writeCustomFontFaceBytes(secondFamily.faces[0], secondBytes)
  const families = [
    { ...first.family, revision: 1 },
    { ...secondFamily, revision: 1 }
  ]

  const customFontFaces = await createCustomFontFaceBackupMap(families)
  const prepared = await prepareSettingsBackupImport(
    parseSettingsBackupText(
      JSON.stringify(
        createSettingsBackup({ customFontList: families }, { customFontFaces })
      )
    )
  )

  assert.deepEqual(
    Object.keys(customFontFaces).sort(),
    [first.family.faces[0].fileHash, secondHash].sort()
  )
  assert.equal(prepared.customFontFamilies.length, 2)
  assert.equal(
    prepared.customFontFamilies[0].faceData[first.family.faces[0].id],
    bytesToBase64(first.bytes)
  )
  assert.equal(
    prepared.customFontFamilies[1].faceData[secondFamily.faces[0].id],
    bytesToBase64(secondBytes)
  )
})
