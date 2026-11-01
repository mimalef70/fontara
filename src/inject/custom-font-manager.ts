import type {
  CustomLocalFontReference,
  LocalFontFamilyReference
} from "../local-font-types"
import {
  activatePreparedLocalFontFamily,
  clearLocalFontFaces,
  getActiveLocalFontFamilyReference,
  prepareLocalFontFamily,
  registerPreparedLocalFontFamily
} from "./local-font-manager"

export type CustomFontFamilyReference = Omit<CustomLocalFontReference, "source">

function toLocalReference(
  reference: CustomFontFamilyReference | null
): CustomLocalFontReference | null {
  return reference ? { ...reference, source: "custom" } : null
}

export function prepareCustomFontFamily(
  reference: CustomFontFamilyReference | null
): Promise<boolean> {
  return prepareLocalFontFamily(toLocalReference(reference))
}

export function registerPreparedCustomFontFamily(
  reference: CustomFontFamilyReference
): boolean {
  return registerPreparedLocalFontFamily(
    toLocalReference(reference) as LocalFontFamilyReference
  )
}

export function activatePreparedCustomFontFamily(
  reference: CustomFontFamilyReference | null
): boolean {
  return activatePreparedLocalFontFamily(toLocalReference(reference))
}

export function getActiveCustomFontFamilyReference(): CustomFontFamilyReference | null {
  const reference = getActiveLocalFontFamilyReference()
  return reference?.source === "custom"
    ? { revision: reference.revision, value: reference.value }
    : null
}

export function clearCustomFontFaces(): void {
  clearLocalFontFaces()
}
