import assert from "node:assert/strict"
import test from "node:test"

import { rewriteFontFaceAssetUrls } from "../../src/generators/font-face-url"

test("rewriteFontFaceAssetUrls rewrites quoted and unquoted extension asset URLs", () => {
  const css = [
    '@font-face { src: url("assets/fonts/a.woff2"); }',
    "@font-face { src: url('assets/fonts/b.woff'); }",
    "@font-face { src: url(assets/fonts/c.ttf); }"
  ].join("\n")

  assert.equal(
    rewriteFontFaceAssetUrls(css, (path) => `chrome-extension://id/${path}`),
    [
      '@font-face { src: url("chrome-extension://id/assets/fonts/a.woff2"); }',
      '@font-face { src: url("chrome-extension://id/assets/fonts/b.woff"); }',
      '@font-face { src: url("chrome-extension://id/assets/fonts/c.ttf"); }'
    ].join("\n")
  )
})
