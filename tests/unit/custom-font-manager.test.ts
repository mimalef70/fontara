import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import {
  BackgroundCustomFontManager,
  registerCustomFontLoadResultListener
} from "../../src/background/custom-font-manager"
import { STORAGE_KEYS } from "../../src/config/storage"
import type {
  CustomFontFamily,
  CustomFontFamilyDraft
} from "../../src/custom-font-types"
import {
  bytesToBase64,
  createCustomFontFileHash
} from "../../src/utils/custom-font-format"
import {
  CUSTOM_FONT_FACE_STORAGE_PREFIX,
  CUSTOM_FONT_TRANSACTION_JOURNAL_KEY,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  readCustomFontFaceBytes,
  writeCustomFontFaceBytes
} from "../../src/utils/custom-font-storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

let localValues: Record<string, unknown>
let fullStorageReadCount: number

beforeEach(() => {
  localValues = {}
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
            callback(structuredClone(localValues))
          } else if (typeof keys === "string") {
            callback({ [keys]: structuredClone(localValues[keys]) })
          } else {
            callback(
              Object.fromEntries(
                keys.map((key) => [key, structuredClone(localValues[key])])
              )
            )
          }
        },
        remove(keys: string | string[], callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete localValues[key]
          }
          callback()
        },
        set(update: Record<string, unknown>, callback: () => void) {
          Object.assign(localValues, structuredClone(update))
          callback()
        }
      }
    }
  })
})

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

async function createFamilyFixture(index: number): Promise<{
  base64: string
  bytes: Uint8Array
  family: CustomFontFamilyDraft
}> {
  const bytes = new TextEncoder().encode(`wOF2fontara-family-${index}`)
  const fileHash = await createCustomFontFileHash(bytes)
  return {
    base64: bytesToBase64(bytes),
    bytes,
    family: {
      value: `FixtureFamily${index}-Fontara`,
      displayName: `Fixture Family ${index}`,
      sourceFamilyKey: `fixture family ${index}`,
      unicodeRange: null,
      faces: [
        {
          id: `fixture-face-${index}`,
          fileHash,
          fileName: `fixture-${index}.woff2`,
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

function createQuotaFamily(index: number): CustomFontFamilyDraft {
  return {
    value: `QuotaFamily${index}-Fontara`,
    displayName: `Quota Family ${index}`,
    sourceFamilyKey: `quota family ${index}`,
    unicodeRange: null,
    faces: Array.from({ length: 4 }, (_, faceIndex) => ({
      id: `quota-face-${index}-${faceIndex}`,
      fileHash: `${index}${faceIndex}`.padEnd(64, String(index)),
      fileName: `quota-${index}-${faceIndex}.woff2`,
      format: "woff2" as const,
      byteLength: MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
      weight: { min: 400, max: 400 },
      style: "normal" as const,
      stretch: { min: 100, max: 100 },
      axes: [],
      validation: "verified" as const
    }))
  }
}

test("replacement imports reserve quota against the new library instead of the current catalog", async () => {
  const currentFamilies = [
    { ...createQuotaFamily(1), revision: 1 },
    { ...createQuotaFamily(2), revision: 1 }
  ] satisfies CustomFontFamily[]
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => ({
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: structuredClone(currentFamilies)
    }),
    writeSettings: async () => undefined
  })
  const firstImportedFamily = createQuotaFamily(3)
  const secondImportedFamily = createQuotaFamily(4)
  const overLimitImportedFamily = createQuotaFamily(5)

  await assert.rejects(
    manager.begin(firstImportedFamily),
    /custom-font-library-size-limit/
  )

  const first = await manager.begin(firstImportedFamily, "replace-library")
  const second = await manager.begin(secondImportedFamily, "replace-library")
  await assert.rejects(
    manager.begin(overLimitImportedFamily, "replace-library"),
    /custom-font-library-size-limit/
  )

  await manager.abort(first.transactionId)
  await manager.abort(second.transactionId)
})

test("custom font manager serializes concurrent commits without losing families", async () => {
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      await new Promise((resolve) => setTimeout(resolve, 2))
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)
  const [firstTransaction, secondTransaction] = await Promise.all([
    manager.begin(first.family),
    manager.begin(second.family)
  ])

  await Promise.all([
    manager.putFace(
      firstTransaction.transactionId,
      first.family.faces[0].id,
      first.base64
    ),
    manager.putFace(
      secondTransaction.transactionId,
      second.family.faces[0].id,
      second.base64
    )
  ])
  await Promise.all([
    manager.commit(firstTransaction.transactionId),
    manager.commit(secondTransaction.transactionId)
  ])

  const families = settings[
    STORAGE_KEYS.CUSTOM_FONT_LIST
  ] as CustomFontFamilyDraft[]
  assert.deepEqual(
    families.map((family) => family.value).sort(),
    [first.family.value, second.family.value].sort()
  )
  assert.deepEqual(
    await readCustomFontFaceBytes(first.family.faces[0].fileHash),
    first.bytes
  )
  assert.deepEqual(
    await readCustomFontFaceBytes(second.family.faces[0].fileHash),
    second.bytes
  )
})

test("custom font delete cannot collect a concurrently committed face", async () => {
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      await new Promise((resolve) => setTimeout(resolve, 2))
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)

  const firstTransaction = await manager.begin(first.family)
  await manager.putFace(
    firstTransaction.transactionId,
    first.family.faces[0].id,
    first.base64
  )
  await manager.commit(firstTransaction.transactionId)

  const secondTransaction = await manager.begin(second.family)
  await manager.putFace(
    secondTransaction.transactionId,
    second.family.faces[0].id,
    second.base64
  )
  await Promise.all([
    manager.commit(secondTransaction.transactionId),
    manager.delete(first.family.value)
  ])

  const families = settings[
    STORAGE_KEYS.CUSTOM_FONT_LIST
  ] as CustomFontFamilyDraft[]
  assert.deepEqual(
    families.map((family) => family.value),
    [second.family.value]
  )
  assert.deepEqual(
    await readCustomFontFaceBytes(second.family.faces[0].fileHash),
    second.bytes
  )
})

test("custom font batch import publishes all families in one settings write", async () => {
  let writeCount = 0
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      writeCount += 1
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)
  const firstTransaction = await manager.begin(first.family)
  const secondTransaction = await manager.begin(second.family)
  await manager.putFace(
    firstTransaction.transactionId,
    first.family.faces[0].id,
    first.base64
  )
  await manager.putFace(
    secondTransaction.transactionId,
    second.family.faces[0].id,
    second.base64
  )

  const committed = await manager.commitBatch(
    [firstTransaction.transactionId, secondTransaction.transactionId],
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
        { ...first.family, revision: 1 },
        { ...second.family, revision: 1 }
      ]
    }
  )

  assert.equal(writeCount, 1)
  assert.deepEqual(
    committed.map((family) => family.value),
    [first.family.value, second.family.value]
  )
  assert.deepEqual(
    (settings[STORAGE_KEYS.CUSTOM_FONT_LIST] as CustomFontFamilyDraft[]).map(
      (family) => family.value
    ),
    [first.family.value, second.family.value]
  )
})

test("custom font batch import keeps a durably published catalog after a follow-up error", async () => {
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      settings = { ...settings, ...structuredClone(update) }
      throw new Error("post-persist-broadcast-failed")
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)
  const firstTransaction = await manager.begin(first.family)
  const secondTransaction = await manager.begin(second.family)
  await manager.putFace(
    firstTransaction.transactionId,
    first.family.faces[0].id,
    first.base64
  )
  await manager.putFace(
    secondTransaction.transactionId,
    second.family.faces[0].id,
    second.base64
  )

  const committed = await manager.commitBatch(
    [firstTransaction.transactionId, secondTransaction.transactionId],
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
        { ...first.family, revision: 1 },
        { ...second.family, revision: 1 }
      ],
      [STORAGE_KEYS.EXTENSION_ENABLED]: false
    }
  )

  assert.deepEqual(settings[STORAGE_KEYS.CUSTOM_FONT_LIST], committed)
  assert.equal(settings[STORAGE_KEYS.EXTENSION_ENABLED], false)
  assert.deepEqual(
    await readCustomFontFaceBytes(first.family.faces[0].fileHash),
    first.bytes
  )
  assert.deepEqual(
    await readCustomFontFaceBytes(second.family.faces[0].fileHash),
    second.bytes
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font batch import rejects an empty batch when no settings were persisted", async () => {
  const settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async () => {
      throw new Error("settings-write-failed")
    }
  })

  await assert.rejects(
    manager.commitBatch([], {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: false
    }),
    /settings-write-failed/
  )

  assert.equal(settings[STORAGE_KEYS.EXTENSION_ENABLED], true)
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font batch import preserves a partially published catalog for retry", async () => {
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true
  }
  let persistOnlyCatalog = true
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      if (persistOnlyCatalog) {
        settings = {
          ...settings,
          [STORAGE_KEYS.CUSTOM_FONT_LIST]: structuredClone(
            update[STORAGE_KEYS.CUSTOM_FONT_LIST]
          )
        }
        throw new Error("post-catalog-import-failed")
      }
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  const fixture = await createFamilyFixture(1)
  const transaction = await manager.begin(fixture.family)
  await manager.putFace(
    transaction.transactionId,
    fixture.family.faces[0].id,
    fixture.base64
  )
  const importSettings = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
      { ...fixture.family, revision: 1 } satisfies CustomFontFamily
    ],
    [STORAGE_KEYS.EXTENSION_ENABLED]: false
  }

  await assert.rejects(
    manager.commitBatch([transaction.transactionId], importSettings),
    /post-catalog-import-failed/
  )

  assert.equal(settings[STORAGE_KEYS.EXTENSION_ENABLED], true)
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, true)
  assert.deepEqual(
    await readCustomFontFaceBytes(fixture.family.faces[0].fileHash),
    fixture.bytes
  )

  await assert.rejects(
    manager.commitBatch([transaction.transactionId], importSettings),
    /post-catalog-import-failed/
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, true)

  persistOnlyCatalog = false
  const committed = await manager.commitBatch(
    [transaction.transactionId],
    importSettings
  )
  assert.deepEqual(settings[STORAGE_KEYS.CUSTOM_FONT_LIST], committed)
  assert.equal(settings[STORAGE_KEYS.EXTENSION_ENABLED], false)
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font batch import rolls back promoted blobs when one family fails", async () => {
  let writeCount = 0
  const settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async () => {
      writeCount += 1
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)
  const firstTransaction = await manager.begin(first.family)
  const secondTransaction = await manager.begin(second.family)
  await manager.putFace(
    firstTransaction.transactionId,
    first.family.faces[0].id,
    first.base64
  )

  await assert.rejects(
    manager.commitBatch(
      [firstTransaction.transactionId, secondTransaction.transactionId],
      {
        [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
          { ...first.family, revision: 1 },
          { ...second.family, revision: 1 }
        ]
      }
    ),
    /custom-font-transaction-incomplete/
  )
  assert.equal(writeCount, 0)
  assert.equal(
    await readCustomFontFaceBytes(first.family.faces[0].fileHash),
    null
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font batch finalizes multiple transaction journals without resurrection", async () => {
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  const first = await createFamilyFixture(1)
  const second = await createFamilyFixture(2)
  const firstTransaction = await manager.begin(first.family)
  const secondTransaction = await manager.begin(second.family)
  await manager.putFace(
    firstTransaction.transactionId,
    first.family.faces[0].id,
    first.base64
  )
  await manager.putFace(
    secondTransaction.transactionId,
    second.family.faces[0].id,
    second.base64
  )

  await manager.commitBatch(
    [firstTransaction.transactionId, secondTransaction.transactionId],
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
        { ...first.family, revision: 1 },
        { ...second.family, revision: 1 }
      ]
    }
  )

  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font manager preserves unknown blobs during fail-safe startup", async () => {
  const fixture = await createFamilyFixture(1)
  const family: CustomFontFamily = { ...fixture.family, revision: 1 }
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [family]
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      settings = { ...settings, ...structuredClone(update) }
    }
  })
  await writeCustomFontFaceBytes(family.faces[0], fixture.bytes)
  localValues[`${CUSTOM_FONT_FACE_STORAGE_PREFIX}orphan`] = {
    encoding: "base64",
    byteLength: 1,
    format: "woff2",
    hash: "orphan",
    data: "AA=="
  }

  await manager.initialize()
  assert.equal(fullStorageReadCount, 0)
  await manager.validateLibrary([family])

  // Startup settings may have passed through a normalizer that omitted a
  // recoverable family. Unknown blobs therefore remain untouched until an
  // explicit delete/import operation identifies their exact hashes.
  assert.equal(`${CUSTOM_FONT_FACE_STORAGE_PREFIX}orphan` in localValues, true)
  await manager.collectUnusedAfterCatalogReplacement()
  assert.equal(`${CUSTOM_FONT_FACE_STORAGE_PREFIX}orphan` in localValues, false)
  await assert.rejects(
    manager.validateLibrary([family, family]),
    /invalid-custom-font-library/
  )
  await assert.rejects(
    manager.validateLibrary([
      family,
      {
        ...family,
        value: "Another-Fontara"
      }
    ]),
    /custom-font-family-name-duplicate/
  )
  await assert.rejects(
    manager.validateLibrary([
      {
        ...family,
        faces: [
          {
            ...family.faces[0],
            fileHash: "a".repeat(64)
          }
        ]
      }
    ]),
    /invalid-custom-font-library-face/
  )
})

test("custom font manager rejects duplicate names and preserves a replaced family revision", async () => {
  const first = await createFamilyFixture(1)
  const replacement = await createFamilyFixture(2)
  replacement.family.value = first.family.value
  replacement.family.displayName = first.family.displayName
  replacement.family.sourceFamilyKey = first.family.sourceFamilyKey
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
      { ...first.family, revision: 3 } satisfies CustomFontFamily
    ]
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      settings = { ...settings, ...structuredClone(update) }
    }
  })

  const duplicate = await createFamilyFixture(3)
  duplicate.family.displayName = first.family.displayName
  await assert.rejects(
    manager.begin(duplicate.family),
    /custom-font-family-name-duplicate/
  )

  const transaction = await manager.begin(replacement.family)
  await manager.putFace(
    transaction.transactionId,
    replacement.family.faces[0].id,
    replacement.base64
  )
  const committed = await manager.commit(transaction.transactionId)

  assert.equal(committed.revision, 4)
  assert.deepEqual(settings[STORAGE_KEYS.CUSTOM_FONT_LIST], [committed])
  await manager.delete("missing-family")
})

test("custom font manager aborts staged transactions and rolls back failed writes", async () => {
  const fixture = await createFamilyFixture(1)
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => ({ [STORAGE_KEYS.CUSTOM_FONT_LIST]: [] }),
    writeSettings: async () => {
      throw new Error("settings-write-failed")
    }
  })

  const aborted = await manager.begin(fixture.family)
  await manager.putFace(
    aborted.transactionId,
    fixture.family.faces[0].id,
    fixture.base64
  )
  await manager.abort(aborted.transactionId)
  await assert.rejects(
    manager.commit(aborted.transactionId),
    /custom-font-transaction-expired/
  )

  const failed = await manager.begin(fixture.family)
  await manager.putFace(
    failed.transactionId,
    fixture.family.faces[0].id,
    fixture.base64
  )
  await assert.rejects(
    manager.commit(failed.transactionId),
    /settings-write-failed/
  )
  assert.equal(
    await readCustomFontFaceBytes(fixture.family.faces[0].fileHash),
    null
  )
})

test("custom font manager recovers when catalog persistence succeeds before a follow-up error", async () => {
  const fixture = await createFamilyFixture(1)
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => structuredClone(settings),
    writeSettings: async (update) => {
      settings = { ...settings, ...structuredClone(update) }
      throw new Error("post-persist-notification-failed")
    }
  })

  const transaction = await manager.begin(fixture.family)
  await manager.putFace(
    transaction.transactionId,
    fixture.family.faces[0].id,
    fixture.base64
  )
  const committed = await manager.commit(transaction.transactionId)

  assert.equal(committed.revision, 1)
  assert.deepEqual(settings[STORAGE_KEYS.CUSTOM_FONT_LIST], [committed])
  assert.deepEqual(
    await readCustomFontFaceBytes(fixture.family.faces[0].fileHash),
    fixture.bytes
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font manager retains an uncertain promoted transaction for retry", async () => {
  const fixture = await createFamilyFixture(1)
  let settings: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  let readFails = false
  let writeFails = true
  const manager = new BackgroundCustomFontManager({
    readSettings: async () => {
      if (readFails) throw new Error("catalog-read-failed")
      return structuredClone(settings)
    },
    writeSettings: async (update) => {
      if (writeFails) {
        readFails = true
        throw new Error("catalog-write-failed")
      }
      settings = { ...settings, ...structuredClone(update) }
    }
  })

  const transaction = await manager.begin(fixture.family)
  await manager.putFace(
    transaction.transactionId,
    fixture.family.faces[0].id,
    fixture.base64
  )
  await assert.rejects(
    manager.commit(transaction.transactionId),
    /catalog-write-failed/
  )
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, true)
  assert.deepEqual(
    await readCustomFontFaceBytes(fixture.family.faces[0].fileHash),
    fixture.bytes
  )

  readFails = false
  writeFails = false
  const committed = await manager.commit(transaction.transactionId)
  assert.equal(committed.revision, 1)
  assert.deepEqual(settings[STORAGE_KEYS.CUSTOM_FONT_LIST], [committed])
  assert.equal(CUSTOM_FONT_TRANSACTION_JOURNAL_KEY in localValues, false)
})

test("custom font load acknowledgements accept only sender-backed result messages", () => {
  let listener:
    | ((
        message: unknown,
        sender: { tab?: { id?: number } },
        sendResponse: (response: unknown) => void
      ) => boolean)
    | undefined
  Reflect.set(globalThis, "chrome", {
    runtime: {
      lastError: null,
      onMessage: {
        addListener(value: typeof listener) {
          listener = value
        }
      }
    },
    storage: { local: {} }
  })

  registerCustomFontLoadResultListener()
  assert.ok(listener)
  assert.equal(
    listener({ type: "wrong" }, { tab: { id: 1 } }, () => {}),
    false
  )

  let response: unknown
  const accepted = listener(
    {
      type: "fontara-cs-bg-custom-font-load-result",
      data: {
        familyValue: "FixtureFamily-Fontara",
        familyRevision: 1,
        loadedFaceIds: ["regular"],
        failedFaceIds: []
      }
    },
    { tab: { id: 1 } },
    (value) => {
      response = value
    }
  )
  assert.equal(accepted, false)
  assert.deepEqual(response, { data: true })
})
