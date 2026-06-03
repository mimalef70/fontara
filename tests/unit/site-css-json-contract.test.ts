import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

type FontRuleFixture = {
  cssFile: string
  fallbackPrefix: string
  groups: Array<{
    fallbackName: string
    fontFamily: string
    matchedSelector: string
  }>
  ignoredSelectors?: Array<{
    fontFamily: string
    matchedSelector: string
    reason: string
  }>
  site: string
}

const VOLATILE_ANGULAR_SCOPE_ATTRIBUTE_PATTERN =
  /\[_ng(?:content|host)-ng-c\d+\]/

function readText(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8")
}

function readJSON<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeCSSValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ",")
    .trim()
}

function getCustomPropertyValue(css: string, customProperty: string): string {
  const match = new RegExp(
    `${escapeRegExp(customProperty)}:\\s*([\\s\\S]*?);`
  ).exec(css)

  assert.ok(match, `Missing ${customProperty}`)
  return normalizeCSSValue(match[1])
}

function getRuleBlock(css: string, selector: string): string {
  const match = new RegExp(
    `${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`
  ).exec(css)

  assert.ok(match, `Missing selector rule: ${selector}`)
  return normalizeCSSValue(match[1])
}

function getFontFamilyRuleSelectors(css: string): string[] {
  const selectors: string[] = []
  const rulePattern = /(?:^|})\s*([^{}]+)\s*\{[^{}]*font-family\s*:/g
  let match = rulePattern.exec(css)

  while (match !== null) {
    selectors.push(match[1].trim())
    match = rulePattern.exec(css)
  }

  return selectors
}

const fixturePaths = fs
  .readdirSync(path.resolve("tests/fixtures"))
  .filter((fileName) => fileName.endsWith("-font-rules.json"))
  .map((fileName) => path.join("tests/fixtures", fileName))

for (const fixturePath of fixturePaths) {
  const fixture = readJSON<FontRuleFixture>(fixturePath)

  test(`${fixture.site} CSS follows the matched-selector JSON contract`, () => {
    const css = readText(fixture.cssFile)
    const expectedSelectors = fixture.groups.map(
      (group) => group.matchedSelector
    )

    assert.doesNotMatch(css, VOLATILE_ANGULAR_SCOPE_ATTRIBUTE_PATTERN)

    assert.deepEqual(
      getFontFamilyRuleSelectors(css).sort(),
      expectedSelectors.sort()
    )

    const appliedSelectors = getFontFamilyRuleSelectors(css)
    for (const ignoredSelector of fixture.ignoredSelectors ?? []) {
      assert.equal(
        appliedSelectors.includes(ignoredSelector.matchedSelector),
        false,
        `Ignored selector must not get a font-family rule: ${ignoredSelector.matchedSelector}`
      )
    }

    for (const group of fixture.groups) {
      const fallbackProperty = `${fixture.fallbackPrefix}-${group.fallbackName}-fallback`
      assert.equal(
        getCustomPropertyValue(css, fallbackProperty),
        normalizeCSSValue(group.fontFamily)
      )

      const ruleBlock = getRuleBlock(css, group.matchedSelector)
      assert.equal(
        ruleBlock,
        normalizeCSSValue(
          `font-family: var(--fontara-font), var(${fallbackProperty}) !important;`
        )
      )
    }
  })
}
