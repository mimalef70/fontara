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
  CustomFontTransactionStore,
  createCustomFontFaceBackupMap,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  readCustomFontFaceBytes,
  writeCustomFontFaceBytes
} from "../../src/utils/custom-font-storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

let values: Record<string, unknown>

beforeEach(() => {
  values = {}
  Reflect.set(globalThis, "chrome", {
    runtime: { lastError: null },
    storage: {
      local: {
        get(
          keys: string | string[] | null,
          callback: (result: Record<string, unknown>) => void
        ) {
          if (keys === null) callback({ ...values })
          else if (typeof keys === "string") callback({ [keys]: values[keys] })
          else
            callback(Object.fromEntries(keys.map((key) => [key, values[key]])))
        },
        remove(keys: string | string[], callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys])
            delete values[key]
          callback()
        },
        set(update: Record<string, unknown>, callback: () => void) {
          Object.assign(values, update)
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

test("custom font transaction commits a verified content-addressed face", async () => {
  const { bytes, family } = await createFixture()
  const store = new CustomFontTransactionStore()
  const { transactionId } = await store.begin(family, [])

  await store.putFace(transactionId, family.faces[0].id, bytesToBase64(bytes))
  const committed = await store.commit(transactionId, [])

  assert.equal(committed.revision, 1)
  assert.deepEqual(
    await readCustomFontFaceBytes(family.faces[0].fileHash),
    bytes
  )
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

test("custom font transaction enforces the per-face quota before upload", async () => {
  const { family } = await createFixture()
  family.faces[0].byteLength = MAX_CUSTOM_FONT_FILE_SIZE_BYTES + 1

  const store = new CustomFontTransactionStore()
  await assert.rejects(store.begin(family, []), /custom-font-face-size-limit/)
})

test("live custom font transactions reserve the total library quota", async () => {
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

  await store.begin(createLargeFamily(1), [])
  await store.begin(createLargeFamily(2), [])
  await assert.rejects(
    store.begin(createLargeFamily(3), []),
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
      [family.faces[0].id]: bytesToBase64(bytes)
    }
  )

  delete values[`${CUSTOM_FONT_FACE_STORAGE_PREFIX}${family.faces[0].fileHash}`]
  await assert.rejects(
    createCustomFontFaceBackupMap([{ ...family, revision: 1 }]),
    /missing-custom-font-face-blob/
  )
})
