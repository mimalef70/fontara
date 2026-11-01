import { STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  CustomFontLoadResult
} from "../custom-font-types"
import type {
  GoogleFontBinaryFace,
  GoogleFontBinaryFamily
} from "../google-font-binary-types"
import type { LocalFontFamilyReference } from "../local-font-types"
import { isCustomFontFaceSignatureValid } from "../utils/custom-font-format"
import { readCustomFontFaceBytes } from "../utils/custom-font-storage"
import { formatFontFamilyForCSS } from "../utils/font-data"
import {
  readGoogleFontBinaryAsset,
  readGoogleFontBinaryFamilyReference
} from "../utils/google-font-binary-storage"
import { getLocalValue } from "../utils/storage"
import { isExtensionContextInvalidated } from "./content-messaging"

type LoadableFace = {
  byteLength: number
  id: string
  readBytes: () => Promise<Uint8Array | null>
  stretch: string
  style: "italic" | "normal" | "oblique"
  unicodeRange: string | null
  validateSignature: (bytes: Uint8Array) => boolean
  weight: string
}

type LoadableFamily = {
  faces: LoadableFace[]
  fontFamily: string
  reference: LocalFontFamilyReference
}

type LoadedFace = {
  fontFace: FontFace
  meta: LoadableFace
}

type PreparedFamily = {
  family: LoadableFamily
  faces: LoadedFace[]
}

type PendingPreparation = {
  key: string
  promise: Promise<boolean>
}

const FACE_LOAD_CONCURRENCY = 2

let activeFamily: PreparedFamily | null = null
let preparedFamily: PreparedFamily | null = null
let pendingPreparation: PendingPreparation | null = null
let latestRequestKey: string | null = null
let requestedGeneration = 0

function getFontFaceSet(): FontFaceSet | null {
  return typeof document !== "undefined" && document.fonts
    ? document.fonts
    : null
}

function throwIfExtensionContextInvalidated(): void {
  if (typeof chrome === "undefined" || chrome.runtime?.id) return
  throw new Error("Extension context invalidated")
}

function referenceKey(reference: LocalFontFamilyReference): string {
  return reference.source === "custom"
    ? `custom:${reference.value.length}:${reference.value}:${reference.revision}`
    : `google:${reference.key.length}:${reference.key}:${reference.revision}`
}

function sameReference(
  first: LocalFontFamilyReference,
  second: LocalFontFamilyReference
): boolean {
  return referenceKey(first) === referenceKey(second)
}

function customFaceWeight(face: CustomFontFaceMeta): string {
  return face.weight.min === face.weight.max
    ? String(face.weight.min)
    : `${face.weight.min} ${face.weight.max}`
}

function customFaceStretch(face: CustomFontFaceMeta): string {
  return face.stretch.min === face.stretch.max
    ? `${face.stretch.min}%`
    : `${face.stretch.min}% ${face.stretch.max}%`
}

function customWeightDistance(face: CustomFontFaceMeta): number {
  if (face.weight.min <= 400 && face.weight.max >= 400) return 0
  return Math.min(
    Math.abs(face.weight.min - 400),
    Math.abs(face.weight.max - 400)
  )
}

function normalizeCustomFamily(
  family: CustomFontFamily,
  reference: Extract<LocalFontFamilyReference, { source: "custom" }>
): LoadableFamily | null {
  const faces = [...family.faces]
    .filter((face) => face.validation !== "failed")
    .sort(
      (first, second) =>
        Number(first.style !== "normal") - Number(second.style !== "normal") ||
        customWeightDistance(first) - customWeightDistance(second) ||
        first.fileName.localeCompare(second.fileName)
    )
    .map<LoadableFace>((face) => ({
      byteLength: face.byteLength,
      id: face.id,
      readBytes: () => readCustomFontFaceBytes(face.fileHash),
      stretch: customFaceStretch(face),
      style: face.style,
      unicodeRange: family.unicodeRange,
      validateSignature: (bytes) =>
        isCustomFontFaceSignatureValid(face.format, bytes),
      weight: customFaceWeight(face)
    }))

  return faces.length > 0
    ? { faces, fontFamily: family.value, reference }
    : null
}

function normalizeGoogleFace(face: GoogleFontBinaryFace): LoadableFace {
  return {
    byteLength: face.byteLength,
    id: face.id,
    readBytes: () => readGoogleFontBinaryAsset(face.assetHash, face.byteLength),
    stretch: face.stretch,
    style: face.style,
    unicodeRange: face.unicodeRange,
    validateSignature: (bytes) =>
      bytes.byteLength >= 4 &&
      bytes[0] === 0x77 &&
      bytes[1] === 0x4f &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x32,
    weight: face.weight
  }
}

function normalizeGoogleFamily(
  family: GoogleFontBinaryFamily,
  reference: Extract<LocalFontFamilyReference, { source: "google" }>
): LoadableFamily | null {
  const faces = family.faces.map(normalizeGoogleFace)
  return faces.length > 0
    ? { faces, fontFamily: family.runtimeFamily, reference }
    : null
}

async function readFamily(
  reference: LocalFontFamilyReference
): Promise<LoadableFamily | null> {
  if (reference.source === "google") {
    const family = await readGoogleFontBinaryFamilyReference(reference, {
      touch: false
    })
    return family ? normalizeGoogleFamily(family, reference) : null
  }

  const families = await getLocalValue<CustomFontFamily[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST
  )
  const family = Array.isArray(families)
    ? families.find(
        (candidate) =>
          candidate.value === reference.value &&
          candidate.revision === reference.revision
      )
    : null
  return family ? normalizeCustomFamily(family, reference) : null
}

function descriptors(face: LoadableFace): FontFaceDescriptors {
  return {
    display: "swap",
    stretch: face.stretch,
    style: face.style,
    weight: face.weight,
    ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {})
  }
}

function isFontFamilySyntaxError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "SyntaxError"
  )
}

async function createAndLoadFontFace(
  family: LoadableFamily,
  source: ArrayBuffer,
  face: LoadableFace
): Promise<FontFace> {
  const faceDescriptors = descriptors(face)
  try {
    const fontFace = new FontFace(family.fontFamily, source, faceDescriptors)
    await fontFace.load()
    return fontFace
  } catch (error) {
    // Older FontARA releases generated hexadecimal aliases that could start
    // with a digit. Chromium accepts the raw alias, while Firefox ESR rejects
    // it as CSS syntax. Retry only that parse failure with a quoted family so
    // both browsers keep matching the same persisted CSS family name.
    if (
      family.reference.source !== "custom" ||
      !/^\d/.test(family.fontFamily) ||
      !isFontFamilySyntaxError(error)
    ) {
      throw error
    }

    const fontFace = new FontFace(
      formatFontFamilyForCSS(family.fontFamily),
      source,
      faceDescriptors
    )
    await fontFace.load()
    return fontFace
  }
}

async function loadFace(
  family: LoadableFamily,
  face: LoadableFace
): Promise<LoadedFace> {
  let bytes: Uint8Array | null
  try {
    bytes = await face.readBytes()
  } catch (error) {
    if (isExtensionContextInvalidated(error)) throw error
    throwIfExtensionContextInvalidated()
    throw error
  }
  if (
    !bytes ||
    bytes.byteLength !== face.byteLength ||
    !face.validateSignature(bytes)
  ) {
    throw new Error("invalid-local-font-face-blob")
  }
  if (typeof FontFace !== "function") {
    throw new Error("font-face-api-unavailable")
  }

  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const fontFace = await createAndLoadFontFace(family, source, face)
  return { fontFace, meta: face }
}

function removeLoadedFaces(faces: LoadedFace[]): void {
  const fontSet = getFontFaceSet()
  if (!fontSet) return
  for (const face of faces) fontSet.delete(face.fontFace)
}

function discardPreparedFamily(): void {
  const prepared = preparedFamily
  preparedFamily = null
  if (!prepared) return
  const activeFaces = activeFamily
    ? new Set(activeFamily.faces.map((face) => face.fontFace))
    : null
  removeLoadedFaces(
    activeFaces
      ? prepared.faces.filter((face) => !activeFaces.has(face.fontFace))
      : prepared.faces
  )
}

function registerLoadedFaces(faces: LoadedFace[]): boolean {
  const fontSet = getFontFaceSet()
  if (!fontSet) return false
  const added: LoadedFace[] = []
  try {
    for (const face of faces) {
      if (face.fontFace.status !== "loaded") {
        throw new Error("local-font-face-not-loaded")
      }
      if (fontSet.has?.(face.fontFace)) continue
      fontSet.add(face.fontFace)
      added.push(face)
      if (typeof fontSet.has === "function" && !fontSet.has(face.fontFace)) {
        throw new Error("local-font-face-registration-failed")
      }
    }
    return true
  } catch {
    removeLoadedFaces(added)
    return false
  }
}

function reportCustomLoadResult(
  family: LoadableFamily,
  loadedFaceIds: string[],
  failedFaceIds: string[]
): void {
  if (family.reference.source !== "custom") return
  const result: CustomFontLoadResult = {
    failedFaceIds,
    familyRevision: family.reference.revision,
    familyValue: family.reference.value,
    loadedFaceIds
  }
  try {
    chrome.runtime.sendMessage(
      { data: result, type: "fontara-cs-bg-custom-font-load-result" },
      () => void chrome.runtime.lastError
    )
  } catch {
    // Detached frames cannot report diagnostics; loading remains local.
  }
}

async function loadFaces(
  family: LoadableFamily
): Promise<{ failedFaceIds: string[]; loaded: LoadedFace[] }> {
  const loaded = new Array<LoadedFace | undefined>(family.faces.length)
  const failedFaceIds: string[] = []
  let fatalError: unknown = null
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < family.faces.length && !fatalError) {
      const index = cursor++
      try {
        loaded[index] = await loadFace(family, family.faces[index])
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          fatalError = error
          return
        }
        failedFaceIds.push(family.faces[index].id)
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(FACE_LOAD_CONCURRENCY, family.faces.length) },
      () => worker()
    )
  )
  if (fatalError) throw fatalError
  return {
    failedFaceIds,
    loaded: loaded.filter((face): face is LoadedFace => Boolean(face))
  }
}

async function prepareFamily(
  reference: LocalFontFamilyReference,
  generation: number
): Promise<boolean> {
  let family: LoadableFamily | null
  try {
    family = await readFamily(reference)
  } catch (error) {
    if (isExtensionContextInvalidated(error)) throw error
    return false
  }
  if (!family || generation !== requestedGeneration) return false
  const result = await loadFaces(family)
  if (
    result.failedFaceIds.length > 0 ||
    result.loaded.length !== family.faces.length ||
    generation !== requestedGeneration
  ) {
    reportCustomLoadResult(
      family,
      result.loaded.map((face) => face.meta.id),
      result.failedFaceIds
    )
    return false
  }
  preparedFamily = { family, faces: result.loaded }
  return true
}

export function prepareLocalFontFamily(
  reference: LocalFontFamilyReference | null
): Promise<boolean> {
  if (!reference) {
    if (latestRequestKey !== null) requestedGeneration += 1
    latestRequestKey = null
    discardPreparedFamily()
    pendingPreparation = null
    return Promise.resolve(true)
  }

  const key = referenceKey(reference)
  if (latestRequestKey !== key) {
    latestRequestKey = key
    requestedGeneration += 1
    discardPreparedFamily()
  }
  if (
    activeFamily &&
    sameReference(activeFamily.family.reference, reference) &&
    registerLoadedFaces(activeFamily.faces)
  ) {
    discardPreparedFamily()
    return Promise.resolve(true)
  }
  if (
    preparedFamily &&
    sameReference(preparedFamily.family.reference, reference)
  ) {
    return Promise.resolve(true)
  }
  if (pendingPreparation?.key === key) return pendingPreparation.promise

  const generation = requestedGeneration
  const promise = prepareFamily(reference, generation).finally(() => {
    if (pendingPreparation?.promise === promise) pendingPreparation = null
  })
  pendingPreparation = { key, promise }
  return promise
}

export function registerPreparedLocalFontFamily(
  reference: LocalFontFamilyReference
): boolean {
  if (
    preparedFamily &&
    sameReference(preparedFamily.family.reference, reference)
  ) {
    return registerLoadedFaces(preparedFamily.faces)
  }
  return Boolean(
    activeFamily &&
      sameReference(activeFamily.family.reference, reference) &&
      registerLoadedFaces(activeFamily.faces)
  )
}

export function activatePreparedLocalFontFamily(
  reference: LocalFontFamilyReference | null
): boolean {
  if (!reference) {
    clearLocalFontFaces()
    return true
  }
  if (
    !preparedFamily ||
    !sameReference(preparedFamily.family.reference, reference)
  ) {
    return Boolean(
      activeFamily &&
        sameReference(activeFamily.family.reference, reference) &&
        registerLoadedFaces(activeFamily.faces)
    )
  }
  if (!registerLoadedFaces(preparedFamily.faces)) {
    reportCustomLoadResult(
      preparedFamily.family,
      [],
      preparedFamily.faces.map((face) => face.meta.id)
    )
    return false
  }

  const previous = activeFamily
  activeFamily = preparedFamily
  preparedFamily = null
  if (previous) removeLoadedFaces(previous.faces)
  reportCustomLoadResult(
    activeFamily.family,
    activeFamily.faces.map((face) => face.meta.id),
    []
  )
  return true
}

export function getActiveLocalFontFamilyReference(): LocalFontFamilyReference | null {
  return activeFamily ? activeFamily.family.reference : null
}

export function getActiveLocalFontFamilyName(): string | null {
  return activeFamily?.family.fontFamily ?? null
}

export function clearLocalFontFaces(): void {
  requestedGeneration += 1
  latestRequestKey = null
  pendingPreparation = null
  discardPreparedFamily()
  if (activeFamily) removeLoadedFaces(activeFamily.faces)
  activeFamily = null
}
