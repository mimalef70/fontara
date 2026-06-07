import { GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS } from "../config/selectors"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { normalizeTextStrokeValue } from "../config/text-stroke"
import type { WebsiteItem } from "../definitions"
import { getLocalValue } from "../utils/storage"
import { removeStyle, upsertStyle } from "./style-utils"

const TEXT_STROKE_STYLE_ID = "fontara-text-stroke-style"

export type TextStrokeConfig = {
  widthPx: number
}

// Keep site context in this boundary so V5 per-site profiles can override the
// global text stroke setting without changing the content-script wiring.
export function getTextStrokeConfig(
  value: unknown,
  _matchingWebsite: WebsiteItem | null
): TextStrokeConfig {
  return {
    widthPx: normalizeTextStrokeValue(value)
  }
}

export function createTextStrokeCSS(config: TextStrokeConfig): string {
  if (config.widthPx <= 0) return ""

  return [
    `*:not(${GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS.join(", ")}) {`,
    `  -webkit-text-stroke: ${config.widthPx}px !important;`,
    `  text-stroke: ${config.widthPx}px !important;`,
    "}"
  ].join("\n")
}

export async function injectTextStrokeStyle(
  matchingWebsite: WebsiteItem | null
): Promise<void> {
  let textStroke: unknown

  try {
    textStroke = await getLocalValue<number>(STORAGE_KEYS.TEXT_STROKE)
  } catch {
    textStroke = DEFAULT_VALUES.TEXT_STROKE
  }

  const css = createTextStrokeCSS(
    getTextStrokeConfig(textStroke, matchingWebsite)
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
