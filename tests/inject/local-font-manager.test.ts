import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test, { afterEach } from "node:test"

import { STORAGE_KEYS } from "../../src/config/storage"
import type {
  CustomFontFaceMeta,
  CustomFontFamily
} from "../../src/custom-font-types"
import type {
  FontaraFontThemeCommandData,
  FontaraPageThemeCommandData
} from "../../src/definitions"
import {
  GOOGLE_FONT_BINARY_SCHEMA_VERSION,
  type GoogleFontBinaryFace,
  type GoogleFontBinaryFamily
} from "../../src/google-font-binary-types"
import type { LocalFontFamilyReference } from "../../src/local-font-types"
import { CUSTOM_FONT_FACE_STORAGE_PREFIX } from "../../src/utils/custom-font-storage"
import {
  GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX,
  GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX
} from "../../src/utils/google-font-binary-storage"

const originalGlobals = [
  "chrome",
  "document",
  "FontFace",
  "HTMLElement",
  "HTMLStyleElement",
  "MutationObserver",
  "requestAnimationFrame",
  "cancelAnimationFrame"
].map((key) => ({
  exists: key in globalThis,
  key,
  value: Reflect.get(globalThis, key)
}))

class FakeFontFace {
  static readonly constructorFamilies: string[] = []
  static readonly gates = new Map<string, Promise<void>>()
  static readonly loadCounts = new Map<string, number>()
  static rejectDigitLeadingRawFamily = false

  readonly family: string
  status: FontFaceLoadStatus = "unloaded"

  constructor(
    family: string,
    readonly source: string | ArrayBuffer,
    readonly descriptors: FontFaceDescriptors = {}
  ) {
    FakeFontFace.constructorFamilies.push(family)
    if (FakeFontFace.rejectDigitLeadingRawFamily && /^\d/.test(family)) {
      throw new DOMException(
        "An invalid or illegal string was specified",
        "SyntaxError"
      )
    }
    this.family = family.replace(/^(["'])|(["'])$/g, "")
  }

  async load(): Promise<FakeFontFace> {
    const key = `${this.family}:${this.descriptors.weight}`
    FakeFontFace.loadCounts.set(
      key,
      (FakeFontFace.loadCounts.get(key) ?? 0) + 1
    )
    await FakeFontFace.gates.get(key)
    this.status = "loaded"
    return this
  }
}

class FakeFontFaceSet {
  readonly faces = new Set<FakeFontFace>()

  add(face: FakeFontFace): FakeFontFaceSet {
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

class FakeElement {
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  disabled = false
  id = ""
  parentElement: FakeElement | null = null
  tagName: string
  textContent = ""

  constructor(readonly localName: string) {
    this.tagName = localName.toUpperCase()
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.remove()
    child.parentElement = this
    this.children.push(child)
    return child
  }

  contains(candidate: FakeElement | null): boolean {
    return Boolean(
      candidate &&
        (candidate === this ||
          this.children.some((child) => child.contains(candidate)))
    )
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  querySelectorAll(): FakeElement[] {
    return []
  }

  remove(): void {
    if (!this.parentElement) return
    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this
    )
    this.parentElement = null
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }
}

class FakeMutationObserver {
  disconnect(): void {}
  observe(): void {}
}

type Fixture = {
  customFamilies: CustomFontFamily[]
  fontSet: FakeFontFaceSet
  googleFamilies: GoogleFontBinaryFamily[]
  values: Record<string, unknown>
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function storedBlob(hash: string, bytes: Uint8Array): Record<string, unknown> {
  return {
    byteLength: bytes.byteLength,
    data: Buffer.from(bytes).toString("base64"),
    encoding: "base64",
    hash,
    mimeType: "font/woff2",
    schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION
  }
}

function createCustomFamily(
  value: string,
  revision: number,
  markers: readonly number[]
): {
  blobs: Array<{ bytes: Uint8Array; meta: CustomFontFaceMeta }>
  family: CustomFontFamily
} {
  const blobs = markers.map((marker, index) => {
    const weight = index === 0 ? 400 : 700
    const bytes = Uint8Array.from([
      0x77,
      0x4f,
      0x46,
      0x32,
      marker,
      weight & 0xff
    ])
    return {
      bytes,
      meta: {
        axes: [],
        byteLength: bytes.byteLength,
        fileHash: sha256(bytes),
        fileName: `${value}-${weight}.woff2`,
        format: "woff2" as const,
        id: `${value}-${weight}`,
        stretch: { max: 100, min: 100 },
        style: "normal" as const,
        validation: "verified" as const,
        weight: { max: weight, min: weight }
      }
    }
  })
  return {
    blobs,
    family: {
      displayName: value,
      faces: blobs.map(({ meta }) => meta),
      revision,
      sourceFamilyKey: value,
      unicodeRange: null,
      value
    }
  }
}

function createGoogleFamily(
  fontFamily: string,
  revision: number,
  markers: readonly number[]
): {
  assets: Array<{ bytes: Uint8Array; face: GoogleFontBinaryFace }>
  family: GoogleFontBinaryFamily
} {
  const key = sha256(fontFamily)
  const cssHash = sha256(`${fontFamily}-css-${revision}`)
  const runtimeFamily = `FontAraGoogle-${cssHash.slice(0, 24)}`
  const assets = markers.map((marker, index) => {
    const weight = index === 0 ? "400" : "700"
    const bytes = Uint8Array.from([0x77, 0x4f, 0x46, 0x32, marker, index])
    const assetHash = sha256(bytes)
    return {
      bytes,
      face: {
        assetHash,
        byteLength: bytes.byteLength,
        id: `face-${index}-${assetHash.slice(0, 12)}`,
        sourceUrl: `https://fonts.gstatic.com/s/${fontFamily.toLowerCase()}/v1/${assetHash}.woff2`,
        stretch: "100%",
        style: "normal" as const,
        unicodeRange: index === 0 ? "U+0000-00FF" : null,
        weight
      }
    }
  })
  const now = 1_700_000_000_000
  return {
    assets,
    family: {
      createdAt: now,
      cssHash,
      faces: assets.map(({ face }) => face),
      fontFamily,
      key,
      lastAccessedAt: now,
      pinned: false,
      requestUrl: `https://fonts.googleapis.com/css2?family=${fontFamily}`,
      revision,
      runtimeFamily,
      schemaVersion: GOOGLE_FONT_BINARY_SCHEMA_VERSION,
      totalBytes: assets.reduce(
        (total, { bytes }) => total + bytes.byteLength,
        0
      ),
      updatedAt: now
    }
  }
}

function installFixture(options: {
  custom?: ReturnType<typeof createCustomFamily>[]
  google?: ReturnType<typeof createGoogleFamily>[]
}): Fixture {
  const custom = options.custom ?? []
  const google = options.google ?? []
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: custom.map(({ family }) => family)
  }
  for (const { blobs } of custom) {
    for (const { bytes, meta } of blobs) {
      values[`${CUSTOM_FONT_FACE_STORAGE_PREFIX}${meta.fileHash}`] = {
        byteLength: bytes.byteLength,
        data: Buffer.from(bytes).toString("base64"),
        encoding: "base64",
        format: meta.format,
        hash: meta.fileHash
      }
    }
  }
  for (const { assets, family } of google) {
    values[
      `${GOOGLE_FONT_BINARY_FAMILY_STORAGE_PREFIX}${family.key}:${family.revision}`
    ] = family
    for (const { bytes, face } of assets) {
      values[`${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${face.assetHash}`] =
        storedBlob(face.assetHash, bytes)
    }
  }

  const fontSet = new FakeFontFaceSet()
  Reflect.set(globalThis, "FontFace", FakeFontFace)
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "test-extension",
      lastError: undefined,
      sendMessage: () => undefined
    },
    storage: {
      local: {
        get(
          keys: string | string[],
          callback: (items: Record<string, unknown>) => void
        ) {
          const requested = Array.isArray(keys) ? keys : [keys]
          callback(
            Object.fromEntries(
              requested.flatMap((key) =>
                key in values ? [[key, structuredClone(values[key])]] : []
              )
            )
          )
        }
      }
    }
  })
  Reflect.set(globalThis, "document", { fonts: fontSet })
  return {
    customFamilies: custom.map(({ family }) => family),
    fontSet,
    googleFamilies: google.map(({ family }) => family),
    values
  }
}

function reference(family: GoogleFontBinaryFamily): LocalFontFamilyReference {
  return { key: family.key, revision: family.revision, source: "google" }
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      if (condition()) return resolve()
      attempts += 1
      if (attempts >= 100) return reject(new Error("test wait timed out"))
      setTimeout(check, 1)
    }
    check()
  })
}

function findById(root: FakeElement, id: string): FakeElement | null {
  if (root.id === id) return root
  for (const child of root.children) {
    const match = findById(child, id)
    if (match) return match
  }
  return null
}

function installThemeDom(fontSet: FakeFontFaceSet): FakeElement {
  const documentElement = new FakeElement("html")
  const head = documentElement.appendChild(new FakeElement("head"))
  const body = documentElement.appendChild(new FakeElement("body"))
  const documentValue = {
    body,
    createElement: (name: string) => new FakeElement(name),
    documentElement,
    fonts: fontSet,
    getElementById: (id: string) => findById(documentElement, id),
    head,
    querySelectorAll: () => []
  }
  Reflect.set(globalThis, "HTMLElement", FakeElement)
  Reflect.set(globalThis, "HTMLStyleElement", FakeElement)
  Reflect.set(globalThis, "MutationObserver", FakeMutationObserver)
  Reflect.set(
    globalThis,
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }
  )
  Reflect.set(globalThis, "cancelAnimationFrame", () => undefined)
  Reflect.set(globalThis, "document", documentValue)
  return head
}

function fontTheme(
  fontName: string,
  localFont: FontaraFontThemeCommandData["localFont"]
): FontaraFontThemeCommandData {
  return {
    active: true,
    applyMode: "font-styles",
    customCSS: "html { color: inherit; }",
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontFaceCSS: "",
    fontName,
    googleFontCSS: null,
    localFont,
    textStrokeCSS: ""
  }
}

function pageTheme(
  font: FontaraFontThemeCommandData
): FontaraPageThemeCommandData {
  return { font, rtl: { active: false, siteId: null } }
}

afterEach(async () => {
  const manager = await import("../../src/inject/local-font-manager")
  manager.clearLocalFontFaces()
  FakeFontFace.gates.clear()
  FakeFontFace.loadCounts.clear()
  FakeFontFace.constructorFamilies.length = 0
  FakeFontFace.rejectDigitLeadingRawFamily = false
  for (const { exists, key, value } of originalGlobals) {
    if (exists) Reflect.set(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test("Google byte-backed multi-face loading is atomic and rejects missing or corrupt assets", async () => {
  const good = createGoogleFamily("Vazirmatn", 1, [1, 2])
  const missing = createGoogleFamily("Missing", 1, [3])
  const corrupt = createGoogleFamily("Corrupt", 1, [4])
  const fixture = installFixture({ google: [good, missing, corrupt] })
  delete fixture.values[
    `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${missing.family.faces[0].assetHash}`
  ]
  const corruptKey = `${GOOGLE_FONT_BINARY_ASSET_STORAGE_PREFIX}${corrupt.family.faces[0].assetHash}`
  ;(fixture.values[corruptKey] as { data: string }).data =
    Buffer.from("wOF2wrong").toString("base64")

  let releaseBold: () => void = () => {}
  FakeFontFace.gates.set(
    `${good.family.runtimeFamily}:700`,
    new Promise<void>((resolve) => {
      releaseBold = resolve
    })
  )
  const manager = await import("../../src/inject/local-font-manager")
  const preparation = manager.prepareLocalFontFamily(reference(good.family))
  await waitFor(
    () => FakeFontFace.loadCounts.get(`${good.family.runtimeFamily}:700`) === 1
  )
  assert.equal(
    fixture.fontSet.faces.size,
    0,
    "a partially loaded family must not be registered"
  )
  releaseBold()
  assert.equal(await preparation, true)
  assert.equal(
    fixture.fontSet.faces.size,
    0,
    "prepare must remain separate from activation"
  )
  assert.equal(
    manager.registerPreparedLocalFontFamily(reference(good.family)),
    true
  )
  assert.equal(
    manager.activatePreparedLocalFontFamily(reference(good.family)),
    true
  )
  assert.equal(fixture.fontSet.faces.size, 2)

  assert.equal(
    await manager.prepareLocalFontFamily(reference(missing.family)),
    false
  )
  assert.equal(
    await manager.prepareLocalFontFamily(reference(corrupt.family)),
    false
  )
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([good.family.runtimeFamily]),
    "failed replacements must preserve the active family"
  )
})

test("custom and Google families replace each other without leaving cross-source faces", async () => {
  const custom = createCustomFamily("User-Fontara", 1, [1, 2])
  const google = createGoogleFamily("Noto Sans Arabic", 1, [3, 4])
  const fixture = installFixture({ custom: [custom], google: [google] })
  const manager = await import("../../src/inject/local-font-manager")
  const customReference = {
    revision: custom.family.revision,
    source: "custom" as const,
    value: custom.family.value
  }
  const googleReference = reference(google.family)

  assert.equal(await manager.prepareLocalFontFamily(customReference), true)
  assert.equal(manager.registerPreparedLocalFontFamily(customReference), true)
  assert.equal(manager.activatePreparedLocalFontFamily(customReference), true)
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([custom.family.value])
  )

  assert.equal(await manager.prepareLocalFontFamily(googleReference), true)
  assert.equal(manager.registerPreparedLocalFontFamily(googleReference), true)
  assert.equal(manager.activatePreparedLocalFontFamily(googleReference), true)
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([google.family.runtimeFamily])
  )

  assert.equal(await manager.prepareLocalFontFamily(customReference), true)
  assert.equal(manager.registerPreparedLocalFontFamily(customReference), true)
  assert.equal(manager.activatePreparedLocalFontFamily(customReference), true)
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([custom.family.value])
  )
})

test("digit-leading persisted custom aliases are quoted for Firefox ESR", async () => {
  FakeFontFace.rejectDigitLeadingRawFamily = true
  const custom = createCustomFamily("1Legacy-Fontara", 1, [1])
  const fixture = installFixture({ custom: [custom] })
  const manager = await import("../../src/inject/local-font-manager")
  const customReference = {
    revision: custom.family.revision,
    source: "custom" as const,
    value: custom.family.value
  }

  assert.equal(await manager.prepareLocalFontFamily(customReference), true)
  assert.deepEqual(FakeFontFace.constructorFamilies, [
    "1Legacy-Fontara",
    '"1Legacy-Fontara"'
  ])
  assert.equal(manager.registerPreparedLocalFontFamily(customReference), true)
  assert.equal(manager.activatePreparedLocalFontFamily(customReference), true)
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([custom.family.value])
  )
})

test("Chromium keeps digit-leading custom aliases raw", async () => {
  const custom = createCustomFamily("1Legacy-Fontara", 1, [1])
  installFixture({ custom: [custom] })
  const manager = await import("../../src/inject/local-font-manager")
  const customReference = {
    revision: custom.family.revision,
    source: "custom" as const,
    value: custom.family.value
  }

  assert.equal(await manager.prepareLocalFontFamily(customReference), true)
  assert.deepEqual(FakeFontFace.constructorFamilies, ["1Legacy-Fontara"])
})

test("a newer request wins an A to B race and clear invalidates in-flight loads", async () => {
  const first = createGoogleFamily("First", 1, [1])
  const second = createGoogleFamily("Second", 1, [2])
  const clearing = createGoogleFamily("Clearing", 1, [3])
  const fixture = installFixture({ google: [first, second, clearing] })
  const manager = await import("../../src/inject/local-font-manager")

  let releaseFirst: () => void = () => {}
  FakeFontFace.gates.set(
    `${first.family.runtimeFamily}:400`,
    new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
  )
  const firstPreparation = manager.prepareLocalFontFamily(
    reference(first.family)
  )
  await waitFor(
    () => FakeFontFace.loadCounts.get(`${first.family.runtimeFamily}:400`) === 1
  )
  const secondPreparation = manager.prepareLocalFontFamily(
    reference(second.family)
  )
  releaseFirst()
  assert.equal(await firstPreparation, false)
  assert.equal(await secondPreparation, true)
  assert.equal(
    manager.registerPreparedLocalFontFamily(reference(second.family)),
    true
  )
  assert.equal(
    manager.activatePreparedLocalFontFamily(reference(second.family)),
    true
  )
  assert.deepEqual(
    new Set(Array.from(fixture.fontSet.faces, ({ family }) => family)),
    new Set([second.family.runtimeFamily])
  )

  let releaseClearing: () => void = () => {}
  FakeFontFace.gates.set(
    `${clearing.family.runtimeFamily}:400`,
    new Promise<void>((resolve) => {
      releaseClearing = resolve
    })
  )
  const clearingPreparation = manager.prepareLocalFontFamily(
    reference(clearing.family)
  )
  await waitFor(
    () =>
      FakeFontFace.loadCounts.get(`${clearing.family.runtimeFamily}:400`) === 1
  )
  manager.clearLocalFontFaces()
  releaseClearing()
  assert.equal(await clearingPreparation, false)
  assert.equal(
    fixture.fontSet.faces.size,
    0,
    "clear must remove active and invalidate orphan candidates"
  )
  assert.equal(manager.getActiveLocalFontFamilyReference(), null)
})

test("a pending Google command preserves the last-known-good local family and CSS variable", async () => {
  const custom = createCustomFamily("Stable-Fontara", 1, [1])
  const fixture = installFixture({ custom: [custom] })
  const head = installThemeDom(fixture.fontSet)
  const manager = await import("../../src/inject/local-font-manager")
  const customReference = {
    revision: custom.family.revision,
    source: "custom" as const,
    value: custom.family.value
  }
  assert.equal(await manager.prepareLocalFontFamily(customReference), true)
  assert.equal(manager.registerPreparedLocalFontFamily(customReference), true)
  assert.equal(manager.activatePreparedLocalFontFamily(customReference), true)

  const { applyResolvedPageTheme, cleanupFontTheme } = await import(
    "../../src/inject/theme-applier"
  )
  const pending = fontTheme("sans-serif", {
    selectedValue: "google:Vazirmatn",
    source: "google",
    state: "pending"
  })
  assert.equal(await applyResolvedPageTheme(pageTheme(pending)), false)
  assert.equal(manager.getActiveLocalFontFamilyName(), custom.family.value)
  assert.equal(fixture.fontSet.faces.size, 1)
  const variableStyle = findById(head, "fontara-dynamic-font")
  assert.match(variableStyle?.textContent ?? "", /Stable-Fontara/)
  cleanupFontTheme()
})
