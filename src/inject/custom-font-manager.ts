import { STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  CustomFontLoadResult
} from "../custom-font-types"
import { isCustomFontFaceSignatureValid } from "../utils/custom-font-format"
import { readCustomFontFaceBytes } from "../utils/custom-font-storage"
import { getLocalValue } from "../utils/storage"
import { isExtensionContextInvalidated } from "./content-messaging"

export type CustomFontFamilyReference = {
  value: string
  revision: number
}

type LoadedFace = {
  fontFace: FontFace
  meta: CustomFontFaceMeta
}

type PreparedFamily = {
  family: CustomFontFamily
  faces: LoadedFace[]
}

type ActiveFamily = {
  family: CustomFontFamily
  faces: LoadedFace[]
}

type PendingPreparation = {
  key: string
  promise: Promise<boolean>
}

const FACE_LOAD_CONCURRENCY = 2

let activeFamily: ActiveFamily | null = null
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
  if (typeof chrome === "undefined") return
  if (chrome.runtime?.id) return

  throw new Error("Extension context invalidated")
}

function getWeightDistance(face: CustomFontFaceMeta): number {
  if (face.weight.min <= 400 && face.weight.max >= 400) return 0
  return Math.min(
    Math.abs(face.weight.min - 400),
    Math.abs(face.weight.max - 400)
  )
}

function choosePrimaryFace(
  faces: CustomFontFaceMeta[]
): CustomFontFaceMeta | null {
  return (
    [...faces]
      .filter((face) => face.validation !== "failed")
      .sort((first, second) => {
        const styleDistance = (face: CustomFontFaceMeta) =>
          face.style === "normal" ? 0 : 1
        return (
          styleDistance(first) - styleDistance(second) ||
          getWeightDistance(first) - getWeightDistance(second) ||
          first.fileName.localeCompare(second.fileName)
        )
      })[0] ?? null
  )
}

function getReferenceKey(reference: CustomFontFamilyReference): string {
  return `${reference.value.length}:${reference.value}:${reference.revision}`
}

function isSameFamily(
  family: CustomFontFamily,
  reference: CustomFontFamilyReference
): boolean {
  return (
    family.value === reference.value && family.revision === reference.revision
  )
}

function getFontFaceDescriptors(
  face: CustomFontFaceMeta,
  unicodeRange: string | null
): FontFaceDescriptors {
  const weight =
    face.weight.min === face.weight.max
      ? String(face.weight.min)
      : `${face.weight.min} ${face.weight.max}`
  const stretch =
    face.stretch.min === face.stretch.max
      ? `${face.stretch.min}%`
      : `${face.stretch.min}% ${face.stretch.max}%`

  return {
    display: "swap",
    style: face.style,
    stretch,
    weight,
    ...(unicodeRange ? { unicodeRange } : {})
  }
}

async function loadFace(
  family: CustomFontFamily,
  face: CustomFontFaceMeta
): Promise<LoadedFace> {
  let bytes: Uint8Array | null
  try {
    bytes = await readCustomFontFaceBytes(face.fileHash)
  } catch (error) {
    if (isExtensionContextInvalidated(error)) throw error
    // Some browsers report a generic storage error after an extension update.
    // Confirm runtime health so that a detached content script tears down
    // instead of silently replacing the last-known-good font.
    throwIfExtensionContextInvalidated()
    throw error
  }
  if (
    !bytes ||
    bytes.byteLength !== face.byteLength ||
    !isCustomFontFaceSignatureValid(face.format, bytes)
  ) {
    throw new Error("invalid-custom-font-face-blob")
  }
  if (typeof FontFace !== "function") {
    throw new Error("font-face-api-unavailable")
  }

  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const fontFace = new FontFace(
    family.value,
    source,
    getFontFaceDescriptors(face, family.unicodeRange)
  )
  await fontFace.load()
  return { fontFace, meta: face }
}

async function readFamily(
  reference: CustomFontFamilyReference
): Promise<CustomFontFamily | null> {
  const families = await getLocalValue<CustomFontFamily[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST
  )
  if (!Array.isArray(families)) return null
  return (
    families.find(
      (family) =>
        family.value === reference.value &&
        family.revision === reference.revision
    ) ?? null
  )
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
        throw new Error("custom-font-face-not-loaded")
      }
      if (fontSet.has?.(face.fontFace)) continue
      fontSet.add(face.fontFace)
      added.push(face)
      if (typeof fontSet.has === "function" && !fontSet.has(face.fontFace)) {
        throw new Error("custom-font-face-registration-failed")
      }
    }
    return true
  } catch {
    removeLoadedFaces(added)
    return false
  }
}

function reportLoadResult(result: CustomFontLoadResult): void {
  try {
    chrome.runtime.sendMessage(
      {
        type: "fontara-cs-bg-custom-font-load-result",
        data: result
      },
      () => void chrome.runtime.lastError
    )
  } catch {
    // A detached frame cannot report its result; loading remains local.
  }
}

async function loadFamilyFaces(
  family: CustomFontFamily,
  faces: CustomFontFaceMeta[]
): Promise<{ loaded: LoadedFace[]; failedFaceIds: string[] }> {
  const loaded = new Array<LoadedFace | undefined>(faces.length)
  const failedFaceIds: string[] = []
  let fatalError: unknown = null
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < faces.length && !fatalError) {
      const index = cursor
      const face = faces[cursor]
      cursor += 1
      try {
        loaded[index] = await loadFace(family, face)
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          fatalError = error
          return
        }
        failedFaceIds.push(face.id)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FACE_LOAD_CONCURRENCY, faces.length) }, () =>
      worker()
    )
  )
  if (fatalError) throw fatalError
  return {
    loaded: loaded.filter((face): face is LoadedFace => Boolean(face)),
    failedFaceIds
  }
}

async function prepareFamily(
  reference: CustomFontFamilyReference,
  generation: number
): Promise<boolean> {
  let family: CustomFontFamily | null
  try {
    family = await readFamily(reference)
  } catch (error) {
    if (isExtensionContextInvalidated(error)) throw error
    return false
  }
  if (!family || generation !== requestedGeneration) return false

  const primaryMeta = choosePrimaryFace(family.faces)
  if (!primaryMeta) return false
  const loadableFaces = [
    primaryMeta,
    ...family.faces.filter(
      (face) => face.id !== primaryMeta.id && face.validation !== "failed"
    )
  ]
  const result = await loadFamilyFaces(family, loadableFaces)
  if (generation !== requestedGeneration) return false

  if (
    result.failedFaceIds.length > 0 ||
    result.loaded.length !== loadableFaces.length
  ) {
    reportLoadResult({
      familyValue: family.value,
      familyRevision: family.revision,
      loadedFaceIds: result.loaded.map((face) => face.meta.id),
      failedFaceIds: result.failedFaceIds
    })
    return false
  }

  preparedFamily = { family, faces: result.loaded }
  return true
}

export function prepareCustomFontFamily(
  reference: CustomFontFamilyReference | null
): Promise<boolean> {
  if (!reference) {
    if (latestRequestKey !== null) requestedGeneration += 1
    latestRequestKey = null
    discardPreparedFamily()
    pendingPreparation = null
    return Promise.resolve(true)
  }

  const key = getReferenceKey(reference)
  if (latestRequestKey !== key) {
    latestRequestKey = key
    requestedGeneration += 1
    discardPreparedFamily()
  }

  if (
    activeFamily &&
    isSameFamily(activeFamily.family, reference) &&
    registerLoadedFaces(activeFamily.faces)
  ) {
    discardPreparedFamily()
    return Promise.resolve(true)
  }
  if (preparedFamily && isSameFamily(preparedFamily.family, reference)) {
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

export function activatePreparedCustomFontFamily(
  reference: CustomFontFamilyReference | null
): boolean {
  if (!reference) {
    clearCustomFontFaces()
    return true
  }
  if (!preparedFamily || !isSameFamily(preparedFamily.family, reference)) {
    if (activeFamily && isSameFamily(activeFamily.family, reference)) {
      return registerLoadedFaces(activeFamily.faces)
    }
    return false
  }

  const previous = activeFamily
  const next: ActiveFamily = {
    family: preparedFamily.family,
    faces: preparedFamily.faces
  }
  if (!registerLoadedFaces(next.faces)) {
    reportLoadResult({
      familyValue: next.family.value,
      familyRevision: next.family.revision,
      loadedFaceIds: [],
      failedFaceIds: next.faces.map((face) => face.meta.id)
    })
    return false
  }

  activeFamily = next
  preparedFamily = null
  if (previous) removeLoadedFaces(previous.faces)
  reportLoadResult({
    familyValue: next.family.value,
    familyRevision: next.family.revision,
    loadedFaceIds: next.faces.map((face) => face.meta.id),
    failedFaceIds: []
  })
  return true
}

/**
 * Registers every prepared face before CSS is allowed to point at the family.
 * Activation performs the same check again, making the two-step handoff safe
 * if a page removes a face between preparation and commit.
 */
export function registerPreparedCustomFontFamily(
  reference: CustomFontFamilyReference
): boolean {
  if (preparedFamily && isSameFamily(preparedFamily.family, reference)) {
    return registerLoadedFaces(preparedFamily.faces)
  }
  return Boolean(
    activeFamily &&
      isSameFamily(activeFamily.family, reference) &&
      registerLoadedFaces(activeFamily.faces)
  )
}

export function getActiveCustomFontFamilyReference(): CustomFontFamilyReference | null {
  if (!activeFamily) return null
  return {
    value: activeFamily.family.value,
    revision: activeFamily.family.revision
  }
}

export function clearCustomFontFaces(): void {
  requestedGeneration += 1
  latestRequestKey = null
  pendingPreparation = null
  discardPreparedFamily()
  if (activeFamily) removeLoadedFaces(activeFamily.faces)
  activeFamily = null
}
