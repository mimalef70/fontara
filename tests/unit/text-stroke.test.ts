import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_ACTIVE_TEXT_STROKE,
  normalizeTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../src/config/text-stroke"
import {
  createTextStrokeCSS,
  getTextStrokeConfig
} from "../../src/inject/text-stroke-style"

test("text stroke CSS follows the protected text selector", () => {
  const css = createTextStrokeCSS(
    getTextStrokeConfig(
      0.2,
      {
        regex: "^https://example\\.com/.*$",
        url: "https://example.com"
      },
      null
    )
  )

  assert.match(css, /^\*:not\(pre, pre \*, code,/)
  assert.match(css, /\[aria-hidden="true"\]/)
  assert.match(css, /\[class\*="fa-"\]/)
  assert.match(css, /\[class\*="material-symbol"\]/)
  assert.match(css, /\[class\*="vjs-"\]/)
  assert.match(css, /-webkit-text-stroke: 0\.2px !important;/)
  assert.doesNotMatch(css, /(^|\n)\s*text-stroke:/)
})

test("text stroke CSS stays empty when the global setting is off", () => {
  assert.equal(createTextStrokeCSS(getTextStrokeConfig(0, null, null)), "")
})

test("text stroke config lets per-site profiles override the global value", () => {
  assert.deepEqual(
    getTextStrokeConfig(0.1, null, {
      pattern: "chatgpt.com",
      textStroke: 0.5
    }),
    {
      widthPx: 0.5
    }
  )
})

test("text stroke values normalize to the 0..1 step scale", () => {
  assert.equal(normalizeTextStrokeValue(-1), TEXT_STROKE_MIN)
  assert.equal(normalizeTextStrokeValue(2), TEXT_STROKE_MAX)
  assert.equal(normalizeTextStrokeValue(0.24), 0.2)
  assert.equal(normalizeTextStrokeValue(0.26), 0.3)
  assert.equal(TEXT_STROKE_STEP, 0.1)
  assert.equal(DEFAULT_ACTIVE_TEXT_STROKE, 0.3)
})
