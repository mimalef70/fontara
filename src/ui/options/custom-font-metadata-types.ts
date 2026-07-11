import type { CustomFontAxis } from "../../custom-font-types"

export type CustomFontExtractedMetadata = {
  familyName: string
  familyGroupName: string
  sourceFamilyKey: string
  subfamilyName: string
  postscriptName: string | null
  weight: { min: number; max: number }
  style: "normal" | "italic" | "oblique"
  stretch: { min: number; max: number }
  axes: CustomFontAxis[]
  hasCombinedItalAxis: boolean
}

export type CustomFontMetadataWorkerRequest = {
  id: string
  bytes: ArrayBuffer
  fileName: string
}

export type CustomFontMetadataWorkerResponse =
  | {
      id: string
      ok: true
      metadata: CustomFontExtractedMetadata
    }
  | {
      id: string
      ok: false
      error: string
    }
