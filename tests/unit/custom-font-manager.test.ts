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
  readCustomFontFaceBytes,
  writeCustomFontFaceBytes
} from "../../src/utils/custom-font-storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

let localValues: Record<string, unknown>

beforeEach(() => {
  localValues = {}
  Reflect.set(globalThis, "chrome", {
    runtime: { lastError: null },
    storage: {
      local: {
        get(
          keys: string | string[] | null,
          callback: (result: Record<string, unknown>) => void
        ) {
          if (keys === null) callback({ ...localValues })
          else if (typeof keys === "string") {
            callback({ [keys]: localValues[keys] })
          } else {
            callback(
              Object.fromEntries(keys.map((key) => [key, localValues[key]]))
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
          Object.assign(localValues, update)
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
})

test("custom font manager initializes storage and validates a complete library", async () => {
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
  await manager.validateLibrary([family])

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
