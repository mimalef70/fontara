import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { POPULAR_WEBSITES } from "../../src/config/sites"

const SITE_STYLES_DIR = path.resolve("assets/styles")
const SITE_FIXES_SOURCE = fs.readFileSync(
  path.resolve("src/config/site-fixes.ts"),
  "utf8"
)

function getSiteStyleFiles(): string[] {
  return fs
    .readdirSync(SITE_STYLES_DIR)
    .filter((fileName) => fileName.endsWith(".css"))
    .sort()
}

function getImportedStyleMap(): Map<string, string> {
  return new Map(
    [
      ...SITE_FIXES_SOURCE.matchAll(
        /^import\s+([a-zA-Z_$][\w$]*)\s+from\s+"..\/..\/assets\/styles\/([^"]+\.css)"$/gm
      )
    ].map((match) => [match[1], match[2]])
  )
}

function getMappedStyleVariables(): Set<string> {
  const objectMatch = SITE_FIXES_SOURCE.match(
    /CUSTOM_CSS_BY_SITE:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\}/
  )
  assert.ok(objectMatch, "CUSTOM_CSS_BY_SITE mapping was not found.")

  return new Set(
    [
      ...objectMatch[1].matchAll(/"https?:\/\/[^"]+":\s*([a-zA-Z_$][\w$]*)/g)
    ].map((match) => match[1])
  )
}

function getFontFamilyDeclarations(css: string): string[] {
  return [...css.matchAll(/font-family\s*:\s*[^;]+;/gs)].map((match) =>
    match[0].trim()
  )
}

function stripNotBlocks(selector: string): string {
  let nextSelector = selector
  let previousSelector = ""

  while (nextSelector !== previousSelector) {
    previousSelector = nextSelector
    nextSelector = nextSelector.replace(/:not\((?:[^()]|\([^()]*\))*\)/gs, "")
  }

  return nextSelector
}

function getFontRuleSelectors(css: string): string[] {
  return [...css.matchAll(/([^{}]+)\{\s*font-family\s*:/gs)].map((match) =>
    match[1].trim()
  )
}

test("site CSS files are all mapped through site-fixes and website config", () => {
  const styleFiles = getSiteStyleFiles()
  const importedStyleMap = getImportedStyleMap()
  const importedStyleFiles = [...importedStyleMap.values()].sort()
  const mappedStyleVariables = getMappedStyleVariables()
  const customCssSites = POPULAR_WEBSITES.filter((site) => site.customCss)

  assert.deepEqual(importedStyleFiles, styleFiles)

  for (const [variableName, fileName] of importedStyleMap) {
    assert.ok(
      mappedStyleVariables.has(variableName),
      `${fileName} is imported but not exposed by CUSTOM_CSS_BY_SITE.`
    )
  }

  assert.equal(
    mappedStyleVariables.size,
    styleFiles.length,
    "CUSTOM_CSS_BY_SITE should expose each imported style exactly once."
  )
  assert.equal(
    customCssSites.length,
    styleFiles.length,
    "Every site CSS file should correspond to a customCss website entry."
  )
})

test("site CSS fallback variables stay clean and consistently referenced", () => {
  for (const fileName of getSiteStyleFiles()) {
    const css = fs.readFileSync(path.join(SITE_STYLES_DIR, fileName), "utf8")
    const fallbackDefinitions = [
      ...css.matchAll(/(--fontara-[\w-]+-fallback)\s*:\s*([^;]+);/gs)
    ]
    const definedFallbacks = new Set(
      fallbackDefinitions.map((match) => match[1])
    )
    const referencedFallbacks = new Set(
      [...css.matchAll(/var\((--fontara-[\w-]+-fallback)\)/g)].map(
        (match) => match[1]
      )
    )

    assert.ok(
      fallbackDefinitions.length > 0,
      `${fileName} should define fallback custom properties.`
    )

    for (const [fallbackName, fallbackValue] of fallbackDefinitions.map(
      (match) => [match[1], match[2]] as const
    )) {
      assert.doesNotMatch(
        fallbackValue,
        /var\(--fontara-font\)/,
        `${fileName} ${fallbackName} must not use FontARA's selected font as its fallback.`
      )
    }

    for (const referencedFallback of referencedFallbacks) {
      assert.ok(
        definedFallbacks.has(referencedFallback),
        `${fileName} references ${referencedFallback} without defining it.`
      )
    }

    for (const declaration of getFontFamilyDeclarations(css)) {
      assert.match(
        declaration,
        /^font-family\s*:\s*var\(--fontara-font\)\s*,\s*var\(--fontara-[\w-]+-fallback\)\s*!important\s*;$/s,
        `${fileName} has a non-standard FontARA font-family declaration: ${declaration}`
      )
    }
  }
})

test("site CSS avoids volatile selectors and positive icon font targets", () => {
  const volatileSelectorPattern =
    /_ng(?:content|host)-ng-c|_ng(?:content|host)-|^\s*\.[A-Za-z][\w-]+_[A-Za-z][\w-]+(?:__|___)(?=[A-Za-z0-9_-]*[A-Z0-9])[A-Za-z0-9_-]{4,}/m
  const positiveIconSelectorPattern =
    /\b(?:mat-icon|google-symbols|lumi-symbols|material-symbols|symbols?)\b|\[class[*^$|~]?=["'][^"']*(?:icon|Icon|symbol|Symbol)[^"']*["']\]|\.glyphicon/

  for (const fileName of getSiteStyleFiles()) {
    const css = fs.readFileSync(path.join(SITE_STYLES_DIR, fileName), "utf8")

    assert.doesNotMatch(
      css,
      volatileSelectorPattern,
      `${fileName} contains volatile framework selector output.`
    )

    for (const selector of getFontRuleSelectors(css)) {
      const positiveSelector = stripNotBlocks(selector)
      assert.doesNotMatch(
        positiveSelector,
        positiveIconSelectorPattern,
        `${fileName} positively targets an icon/symbol selector: ${selector}`
      )
    }
  }
})
