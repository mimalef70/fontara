import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test, { afterEach } from "node:test"

import { STORAGE_KEYS } from "../../src/config/storage"
import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  CustomFontLoadResult
} from "../../src/custom-font-types"
import { CUSTOM_FONT_FACE_STORAGE_PREFIX } from "../../src/utils/custom-font-storage"

const originalGlobals = {
  chrome: Reflect.get(globalThis, "chrome") as unknown,
  document: Reflect.get(globalThis, "document") as unknown,
  FontFace: Reflect.get(globalThis, "FontFace") as unknown
}

class FakeFontFace {
  static readonly loadCounts = new Map<string, number>()
  static readonly loadFailures = new Set<string>()
  static readonly loadGates = new Map<string, Promise<void>>()

  readonly family: string
  status: FontFaceLoadStatus = "unloaded"

  constructor(
    family: string,
    readonly source: string | ArrayBuffer,
    readonly descriptors: FontFaceDescriptors = {}
  ) {
    this.family = family
  }

  async load(): Promise<FakeFontFace> {
    const key = `${this.family}:${this.descriptors.weight}`
    FakeFontFace.loadCounts.set(
      key,
      (FakeFontFace.loadCounts.get(key) ?? 0) + 1
    )
    await FakeFontFace.loadGates.get(key)
    if (FakeFontFace.loadFailures.has(key)) {
      this.status = "error"
      throw new Error("simulated-font-load-failure")
    }
    this.status = "loaded"
    return this
  }
}

class FakeFontFaceSet {
  readonly faces = new Set<FakeFontFace>()
  rejectedFamily: string | null = null

  add(face: FakeFontFace): FakeFontFaceSet {
    if (face.family === this.rejectedFamily) {
      throw new Error("simulated-font-registration-failure")
    }
    this.faces.add(face)
    return this
  }

  delete(face: FakeFontFace): boolean {
    return this.faces.delete(face)
  }

  has(face: FakeFontFace): boolean {
    return this.faces.has(face)
  }
}

function createFace(
  id: string,
  fileName: string,
  weight: number,
  marker: number
): { bytes: Uint8Array; meta: CustomFontFaceMeta } {
  const bytes = Uint8Array.from([0x77, 0x4f, 0x46, 0x46, marker, weight])
  const fileHash = createHash("sha256").update(bytes).digest("hex")
  return {
    bytes,
    meta: {
      id,
      fileHash,
      fileName,
      format: "woff",
      byteLength: bytes.byteLength,
      weight: { min: weight, max: weight },
      style: "normal",
      stretch: { min: 100, max: 100 },
      axes: [],
      validation: "verified"
    }
  }
}

function createFamily(
  value: string,
  revision: number,
  regularMarker: number,
  boldMarker: number
): {
  blobs: Array<{ bytes: Uint8Array; meta: CustomFontFaceMeta }>
  family: CustomFontFamily
} {
  const blobs = [
    createFace(`${value}-regular`, `${value}-Regular.woff`, 400, regularMarker),
    createFace(`${value}-bold`, `${value}-Bold.woff`, 700, boldMarker)
  ]
  return {
    blobs,
    family: {
      value,
      displayName: value,
      sourceFamilyKey: value,
      unicodeRange: null,
      revision,
      faces: blobs.map((blob) => blob.meta)
    }
  }
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      if (condition()) {
        resolve()
        return
      }
      attempts += 1
      if (attempts >= 100) {
        reject(new Error("timed out waiting for test condition"))
        return
      }
      setTimeout(check, 1)
    }
    check()
  })
}

afterEach(() => {
  FakeFontFace.loadCounts.clear()
  FakeFontFace.loadFailures.clear()
  FakeFontFace.loadGates.clear()
  Reflect.set(globalThis, "chrome", originalGlobals.chrome)
  Reflect.set(globalThis, "document", originalGlobals.document)
  Reflect.set(globalThis, "FontFace", originalGlobals.FontFace)
})

test("custom font preparation is deduplicated, atomic, fail-sticky, and self-healing", async () => {
  const first = createFamily("Atomic-Fontara", 1, 1, 2)
  const broken = createFamily("Broken-Fontara", 1, 3, 4)
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [first.family, broken.family]
  }
  for (const blob of [...first.blobs, ...broken.blobs]) {
    values[`${CUSTOM_FONT_FACE_STORAGE_PREFIX}${blob.meta.fileHash}`] = {
      encoding: "base64",
      byteLength: blob.bytes.byteLength,
      format: blob.meta.format,
      hash: blob.meta.fileHash,
      data: Buffer.from(blob.bytes).toString("base64")
    }
  }

  const storageReads = new Map<string, number>()
  const loadResults: CustomFontLoadResult[] = []
  const fontSet = new FakeFontFaceSet()
  Reflect.set(globalThis, "document", { fonts: fontSet })
  Reflect.set(globalThis, "FontFace", FakeFontFace)
  Reflect.set(globalThis, "chrome", {
    runtime: {
      lastError: undefined,
      sendMessage(
        message: { data?: CustomFontLoadResult },
        callback?: () => void
      ) {
        if (message.data) loadResults.push(message.data)
        callback?.()
      }
    },
    storage: {
      local: {
        get(
          keys: string | string[],
          callback: (items: Record<string, unknown>) => void
        ) {
          const requestedKeys = Array.isArray(keys) ? keys : [keys]
          const result: Record<string, unknown> = {}
          for (const key of requestedKeys) {
            storageReads.set(key, (storageReads.get(key) ?? 0) + 1)
            if (key in values) result[key] = values[key]
          }
          callback(result)
        }
      }
    }
  })

  let releaseBold = () => {}
  FakeFontFace.loadGates.set(
    "Atomic-Fontara:700",
    new Promise<void>((resolve) => {
      releaseBold = resolve
    })
  )

  const manager = await import("../../src/inject/custom-font-manager")
  const firstReference = { value: first.family.value, revision: 1 }
  const firstPreparation = manager.prepareCustomFontFamily(firstReference)
  const duplicatePreparation = manager.prepareCustomFontFamily(firstReference)

  assert.strictEqual(
    duplicatePreparation,
    firstPreparation,
    "the same family revision should share one in-flight preparation"
  )
  await waitFor(
    () =>
      FakeFontFace.loadCounts.get("Atomic-Fontara:400") === 1 &&
      FakeFontFace.loadCounts.get("Atomic-Fontara:700") === 1
  )
  assert.equal(fontSet.faces.size, 0, "no partial family should be registered")

  releaseBold()
  assert.equal(await firstPreparation, true)
  assert.equal(await duplicatePreparation, true)
  assert.equal(fontSet.faces.size, 0, "prepare must not activate the family")

  assert.equal(manager.registerPreparedCustomFontFamily(firstReference), true)
  assert.equal(manager.activatePreparedCustomFontFamily(firstReference), true)
  assert.equal(fontSet.faces.size, 2)
  assert.deepEqual(
    Array.from(fontSet.faces, (face) => face.descriptors.weight).sort(),
    ["400", "700"]
  )
  assert.equal(
    storageReads.get(STORAGE_KEYS.CUSTOM_FONT_LIST),
    1,
    "a duplicate request should not reread family metadata"
  )

  FakeFontFace.loadFailures.add("Broken-Fontara:700")
  const brokenReference = { value: broken.family.value, revision: 1 }
  assert.equal(await manager.prepareCustomFontFamily(brokenReference), false)
  assert.equal(
    fontSet.faces.size,
    2,
    "a failed replacement must leave the last-known-good family registered"
  )
  assert.ok(
    Array.from(fontSet.faces).every(
      (face) => face.family === first.family.value
    )
  )
  assert.deepEqual(loadResults[loadResults.length - 1], {
    familyValue: broken.family.value,
    familyRevision: 1,
    loadedFaceIds: [`${broken.family.value}-regular`],
    failedFaceIds: [`${broken.family.value}-bold`]
  })

  FakeFontFace.loadFailures.delete("Broken-Fontara:700")
  assert.equal(await manager.prepareCustomFontFamily(brokenReference), true)
  fontSet.rejectedFamily = broken.family.value
  assert.equal(manager.registerPreparedCustomFontFamily(brokenReference), false)
  assert.equal(manager.activatePreparedCustomFontFamily(brokenReference), false)
  assert.deepEqual(
    Array.from(fontSet.faces, (face) => face.family),
    [first.family.value, first.family.value],
    "registration failure must preserve the last-known-good active family"
  )
  fontSet.rejectedFamily = null

  const activeFaces = Array.from(fontSet.faces)
  const activeBold = activeFaces.find(
    (face) => face.descriptors.weight === "700"
  )
  assert.ok(activeBold)
  fontSet.delete(activeBold)
  const readsBeforeHealing = Array.from(storageReads.values()).reduce(
    (sum, count) => sum + count,
    0
  )

  assert.equal(await manager.prepareCustomFontFamily(firstReference), true)
  assert.equal(manager.activatePreparedCustomFontFamily(firstReference), true)
  assert.equal(
    fontSet.faces.size,
    2,
    "a removed active face should be re-added"
  )
  assert.equal(
    Array.from(storageReads.values()).reduce((sum, count) => sum + count, 0),
    readsBeforeHealing,
    "self-healing should reuse already validated and loaded FontFace objects"
  )
  assert.equal(FakeFontFace.loadCounts.get("Atomic-Fontara:400"), 1)
  assert.equal(FakeFontFace.loadCounts.get("Atomic-Fontara:700"), 1)

  assert.equal(await manager.prepareCustomFontFamily(brokenReference), true)
  assert.equal(manager.registerPreparedCustomFontFamily(brokenReference), true)
  assert.equal(
    fontSet.faces.size,
    4,
    "a pre-registered replacement temporarily coexists with the active family"
  )
  manager.clearCustomFontFaces()
  assert.equal(
    fontSet.faces.size,
    0,
    "cleanup must remove registered prepared faces as well as active faces"
  )
})
