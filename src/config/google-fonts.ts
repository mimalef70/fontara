import { GENERATED_GOOGLE_FONTS } from "./generated/google-fonts"

export type GoogleFontCategory =
  | "display"
  | "handwriting"
  | "monospace"
  | "sans-serif"
  | "serif"

export type GoogleFontAxis = {
  end: number
  start: number
  tag: string
}

export type GoogleFontMetadata = {
  category: GoogleFontCategory
  family: string
  fallback: "cursive" | "monospace" | "sans-serif" | "serif"
  recommended: boolean
  subsets: string[]
  variants: string[]
  axes?: GoogleFontAxis[]
}

export const GOOGLE_FONTS = GENERATED_GOOGLE_FONTS
