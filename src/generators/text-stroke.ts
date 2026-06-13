import { GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS } from "../config/selectors"
import { normalizeTextStrokeValue } from "../config/text-stroke"
import type { SiteProfile, WebsiteItem } from "../definitions"

export type TextStrokeConfig = {
  widthPx: number
}

// Keep site context in this boundary so per-site profiles can override the
// global text stroke setting without leaking storage details into callers.
export function getTextStrokeConfig(
  value: unknown,
  _matchingWebsite: WebsiteItem | null,
  siteProfile: SiteProfile | null
): TextStrokeConfig {
  return {
    widthPx: normalizeTextStrokeValue(siteProfile?.textStroke ?? value)
  }
}

export function createTextStrokeCSS(config: TextStrokeConfig): string {
  if (config.widthPx <= 0) return ""

  return [
    `*:not(${GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS.join(", ")}) {`,
    `  -webkit-text-stroke: ${config.widthPx}px !important;`,
    "}"
  ].join("\n")
}
