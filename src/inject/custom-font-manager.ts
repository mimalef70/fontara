import { STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFaceMeta,
  CustomFontFamily,
  CustomFontLoadResult
} from "../custom-font-types"
import {
  createCustomFontFileHash,
  isCustomFontFaceSignatureValid
} from "../utils/custom-font-format"
import { readCustomFontFaceBytes } from "../utils/custom-font-storage"
import { getLocalValue } from "../utils/storage"

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
  primary: LoadedFace
  remaining: CustomFontFaceMeta[]
}

type ActiveFamily = {
  family: CustomFontFamily
  faces: LoadedFace[]
}

const FACE_LOAD_CONCURRENCY = 2

let activeFamily: ActiveFamily | null = null
let preparedFamily: PreparedFamily | null = null
let requestedGeneration = 0

function getFontFaceSet(): FontFaceSet | null {
  return typeof document !== "undefined" && document.fonts
    ? document.fonts
    : null
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
  const bytes = await readCustomFontFaceBytes(face.fileHash)
  if (
    !bytes ||
    bytes.byteLength !== face.byteLength ||
    !isCustomFontFaceSignatureValid(face.format, bytes) ||
    (await createCustomFontFileHash(bytes)) !== face.fileHash
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

async function loadRemainingFaces(
  target: ActiveFamily,
  faces: CustomFontFaceMeta[],
  generation: number
): Promise<void> {
  const loadedFaceIds = [target.faces[0].meta.id]
  const failedFaceIds: string[] = []
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < faces.length) {
      const face = faces[cursor]
      cursor += 1
      try {
        const loaded = await loadFace(target.family, face)
        if (generation !== requestedGeneration || activeFamily !== target) {
          removeLoadedFaces([loaded])
          return
        }
        getFontFaceSet()?.add(loaded.fontFace)
        target.faces.push(loaded)
        loadedFaceIds.push(face.id)
      } catch {
        failedFaceIds.push(face.id)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FACE_LOAD_CONCURRENCY, faces.length) }, () =>
      worker()
    )
  )
  if (generation === requestedGeneration && activeFamily === target) {
    reportLoadResult({
      familyValue: target.family.value,
      familyRevision: target.family.revision,
      loadedFaceIds,
      failedFaceIds
    })
  }
}

export async function prepareCustomFontFamily(
  reference: CustomFontFamilyReference | null
): Promise<boolean> {
  const generation = ++requestedGeneration
  if (!reference) {
    preparedFamily = null
    return true
  }
  if (
    activeFamily?.family.value === reference.value &&
    activeFamily.family.revision === reference.revision
  ) {
    preparedFamily = null
    return true
  }

  const family = await readFamily(reference)
  if (!family || generation !== requestedGeneration) return false
  const primaryMeta = choosePrimaryFace(family.faces)
  if (!primaryMeta) return false

  try {
    const primary = await loadFace(family, primaryMeta)
    if (generation !== requestedGeneration) return false
    preparedFamily = {
      family,
      primary,
      remaining: family.faces.filter(
        (face) => face.id !== primaryMeta.id && face.validation !== "failed"
      )
    }
    return true
  } catch {
    if (generation === requestedGeneration) {
      reportLoadResult({
        familyValue: family.value,
        familyRevision: family.revision,
        loadedFaceIds: [],
        failedFaceIds: [primaryMeta.id]
      })
    }
    return false
  }
}

export function activatePreparedCustomFontFamily(
  reference: CustomFontFamilyReference | null
): void {
  if (!reference) {
    clearCustomFontFaces()
    return
  }
  if (
    activeFamily?.family.value === reference.value &&
    activeFamily.family.revision === reference.revision
  ) {
    return
  }
  if (
    !preparedFamily ||
    preparedFamily.family.value !== reference.value ||
    preparedFamily.family.revision !== reference.revision
  ) {
    return
  }

  const previous = activeFamily
  const next: ActiveFamily = {
    family: preparedFamily.family,
    faces: [preparedFamily.primary]
  }
  getFontFaceSet()?.add(preparedFamily.primary.fontFace)
  activeFamily = next
  const remaining = preparedFamily.remaining
  preparedFamily = null
  if (previous) removeLoadedFaces(previous.faces)
  void loadRemainingFaces(next, remaining, requestedGeneration)
}

export function clearCustomFontFaces(): void {
  requestedGeneration += 1
  preparedFamily = null
  if (activeFamily) removeLoadedFaces(activeFamily.faces)
  activeFamily = null
}
