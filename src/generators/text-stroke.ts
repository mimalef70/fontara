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

  const protectedScope = `:is(${GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS.join(", ")})`
  return [
    `*:not(${protectedScope}):not(${protectedScope} *) {`,
    `  -webkit-text-stroke: ${config.widthPx}px !important;`,
    "}",
    // Text stroke inherits. Exclusion alone would still pass the body's
    // stroke to code and icon fonts, including their unmarked descendants.
    `${protectedScope}, ${protectedScope} * {`,
    "  -webkit-text-stroke: 0 !important;",
    "}"
  ].join("\n")
}
