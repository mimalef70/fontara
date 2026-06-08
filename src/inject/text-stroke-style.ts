import {
  createTextStrokeCSS,
  getTextStrokeConfig,
  type TextStrokeConfig
} from "../generators/text-stroke"
import { removeStyle, upsertStyle } from "./style-utils"

const TEXT_STROKE_STYLE_ID = "fontara-text-stroke-style"

export { createTextStrokeCSS, getTextStrokeConfig, type TextStrokeConfig }

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
