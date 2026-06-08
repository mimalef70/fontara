import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { SiteProfile, WebsiteItem } from "../definitions"
import {
  createTextStrokeCSS,
  getTextStrokeConfig,
  type TextStrokeConfig
} from "../generators/text-stroke"
import { getLocalValue } from "../utils/storage"
import { removeStyle, upsertStyle } from "./style-utils"

const TEXT_STROKE_STYLE_ID = "fontara-text-stroke-style"

export { createTextStrokeCSS, getTextStrokeConfig, type TextStrokeConfig }

export async function injectTextStrokeStyle(
  matchingWebsite: WebsiteItem | null,
  siteProfile: SiteProfile | null
): Promise<void> {
  let textStroke: unknown

  try {
    textStroke = await getLocalValue<number>(STORAGE_KEYS.TEXT_STROKE)
  } catch {
    textStroke = DEFAULT_VALUES.TEXT_STROKE
  }

  const css = createTextStrokeCSS(
    getTextStrokeConfig(textStroke, matchingWebsite, siteProfile)
  )
  if (css) {
    upsertStyle(TEXT_STROKE_STYLE_ID, css)
  } else {
    removeTextStrokeStyle()
  }
}

export function removeTextStrokeStyle(): void {
  removeStyle(TEXT_STROKE_STYLE_ID)
}

export function injectResolvedTextStrokeStyle(css: string): void {
  if (css) {
    upsertStyle(TEXT_STROKE_STYLE_ID, css)
    return
  }

  removeTextStrokeStyle()
}
