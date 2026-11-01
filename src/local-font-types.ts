import type { GoogleFontBinaryFamily } from "./google-font-binary-types"

export type CustomLocalFontReference = {
  revision: number
  source: "custom"
  value: string
}

export type GoogleLocalFontReference = {
  key: string
  revision: number
  source: "google"
}

export type LocalFontFamilyReference =
  | CustomLocalFontReference
  | GoogleLocalFontReference

export type FontaraLocalFontCommand =
  | {
      reference: LocalFontFamilyReference
      state: "ready"
    }
  | {
      selectedValue: string
      source: "google"
      state: "pending"
    }
  | null

export function createGoogleLocalFontReference(
  family: GoogleFontBinaryFamily
): GoogleLocalFontReference {
  return {
    key: family.key,
    revision: family.revision,
    source: "google"
  }
}
