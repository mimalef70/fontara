import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const { buildSiteCSS, extractFontFamilyFromShorthand, normalizeSelector } =
  require("../../tasks/site-css.js") as {
    buildSiteCSS(value: unknown): {
      css: string
      highChurnSelectors: string[]
      ruleCount: number
    }
    extractFontFamilyFromShorthand(value: string): string | null
    normalizeSelector(value: string): string
  }

test("site CSS generator mechanically normalizes and groups captured selectors", () => {
  const result = buildSiteCSS([
    {
      matchedSelector: ".message[_ngcontent-ng-c123] .body",
      declarations: [{ property: "font-family", value: "Arial, sans-serif" }]
    },
    {
      matchedSelector: ".MessageDate_container__HJE_V time",
      fontFamily: "Arial, sans-serif"
    },
    {
      matchedSelector: ".material-symbols-outlined",
      fontFamily: '"Material Symbols Outlined"'
    },
    {
      matchedSelector: ".already-modified",
      fontFamily: "var(--fontara-font), serif"
    },
    {
      matchedSelector: ".editor p",
      font: '400 14px/20px "Google Sans", Arial, sans-serif'
    }
  ])

  assert.equal(result.ruleCount, 3)
  assert.match(
    result.css,
    /--fontara-site-arial-ui-fallback: Arial, sans-serif;/
  )
  assert.match(
    result.css,
    /\.message \.body,[\s\S]*\[class\*="MessageDate_container__"\] time/
  )
  assert.match(
    result.css,
    /font-family: var\(--fontara-font\), var\(--fontara-site-arial-ui-fallback\) !important;/
  )
  assert.match(result.css, /"Google Sans", Arial, sans-serif/)
  assert.doesNotMatch(result.css, /material-symbols/)
  assert.doesNotMatch(result.css, /already-modified/)
  assert.doesNotMatch(result.css, /body \*/)
})

test("site CSS generator preserves captured structure and detects high churn", () => {
  assert.equal(
    normalizeSelector(
      "body > app-root[_nghost-ng-c77] > .Pane_body___a1B2c > p:nth-child(2)"
    ),
    'body > app-root > [class*="Pane_body__"] > p:nth-child(2)'
  )

  const result = buildSiteCSS({
    matchedSelector: "body > main > section > div > .a1b > span:nth-child(2)",
    "font-family": "system-ui, sans-serif"
  })
  assert.equal(result.highChurnSelectors.length, 1)
})

test("site CSS generator extracts only the family portion of font shorthand", () => {
  assert.equal(
    extractFontFamilyFromShorthand(
      'italic 600 1rem/1.5 "Noto Sans Arabic", sans-serif'
    ),
    '"Noto Sans Arabic", sans-serif'
  )
  assert.equal(extractFontFamilyFromShorthand("inherit"), null)
})

test("normalized duplicate selectors retain original cascade precedence", () => {
  const result = buildSiteCSS([
    { matchedSelector: ".title[_ngcontent-ng-c1]", fontFamily: "Arial" },
    { matchedSelector: ".title", fontFamily: "Georgia" },
    { matchedSelector: ".body[_ngcontent-ng-c1]", fontFamily: "Arial" },
    { matchedSelector: ".body[_ngcontent-ng-c2]", fontFamily: "Georgia" }
  ])
  assert.equal(result.ruleCount, 2)
  assert.match(result.css, /\.title \{\s*font-family:.*arial-ui-fallback/)
  assert.match(result.css, /\.body \{\s*font-family:.*georgia-ui-fallback/)
})

test("important declarations win before specificity without entering fallbacks", () => {
  const result = buildSiteCSS([
    { matchedSelector: ".title", fontFamily: "Georgia !important" },
    { matchedSelector: ".title[_ngcontent-ng-c1]", fontFamily: "Arial" },
    {
      matchedSelector: ".body",
      declarations: [
        { property: "font-family", value: "Georgia", important: true }
      ]
    },
    { matchedSelector: ".body[_ngcontent-ng-c2]", fontFamily: "Arial" }
  ])
  assert.equal(result.ruleCount, 2)
  assert.match(result.css, /\.title,\s*\.body \{/)
  assert.doesNotMatch(result.css, /Arial|fallback:.*!important/)
})

test("duplicate declarations retain importance before their source order", () => {
  const result = buildSiteCSS([
    {
      matchedSelector: ".important-first",
      declarations: [
        { property: "font-family", value: "Arial", important: true },
        { property: "font-family", value: "Georgia" }
      ]
    },
    {
      matchedSelector: ".important-last",
      declarations: [
        { property: "font-family", value: "Arial !important" },
        { property: "font-family", value: "Georgia", priority: "important" }
      ]
    },
    {
      matchedSelector: ".normal-last",
      declarations: [
        { property: "font-family", value: "Arial" },
        { property: "font-family", value: "Georgia" }
      ]
    },
    {
      matchedSelector: ".shorthand-important-first",
      declarations: [
        { property: "font", value: "400 14px Arial !important" },
        { property: "font", value: "400 14px Georgia" }
      ]
    }
  ])

  assert.equal(result.ruleCount, 4)
  assert.match(
    result.css,
    /\.important-first,\s*\.shorthand-important-first \{\s*font-family:.*arial-ui-fallback/
  )
  assert.match(
    result.css,
    /\.important-last,\s*\.normal-last \{\s*font-family:.*georgia-ui-fallback/
  )
  assert.doesNotMatch(result.css, /fallback:.*!important/)
})

test("selector lists and functional pseudo classes preserve source specificity", () => {
  const result = buildSiteCSS([
    {
      matchedSelector:
        ".title[_ngcontent-ng-c1], :where(.body[_ngcontent-ng-c1])",
      fontFamily: "Arial"
    },
    { matchedSelector: ".title, :where(.body)", fontFamily: "Georgia" },
    {
      matchedSelector: ":is(.card, #card)[_ngcontent-ng-c1]",
      fontFamily: "Arial"
    },
    { matchedSelector: ":is(.card, #card)", fontFamily: "Georgia" }
  ])
  assert.equal(result.ruleCount, 3)
  assert.match(
    result.css,
    /\.title,\s*:is\(\.card, #card\) \{\s*font-family:.*arial-ui-fallback/
  )
  assert.match(
    result.css,
    /:where\(\.body\) \{\s*font-family:.*georgia-ui-fallback/
  )
})
