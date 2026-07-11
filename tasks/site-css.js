#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")

const ICON_PATTERN =
  /(?:^|[-_\s"'=])(icon|icons|symbol|symbols|glyph|pictogram|material-symbols?|material-icons?|google-symbols|lumi-symbols)(?:$|[-_\s"'])/i
const CSS_MODULE_CLASS_PATTERN =
  /\.([A-Za-z][\w-]*_[A-Za-z][\w-]*?__)_?[A-Za-z0-9_-]{4,}/g
const ANGULAR_SCOPE_PATTERN =
  /\[_(?:ngcontent|nghost)-ng-c[^\]\s=]*(?:=(?:"[^"]*"|'[^']*'|[^\]]+))?\]/gi

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeWhitespace(value) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
}

function extractFontFamilyFromShorthand(value) {
  const normalized = normalizeWhitespace(value)
  const sizePattern =
    /(?:^|\s)(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger|(?:\d*\.)?\d+(?:px|pt|pc|em|rem|ex|ch|vw|vh|vmin|vmax|%))(?:\s*\/\s*[^\s]+)?\s+(.+)$/i
  return normalized.match(sizePattern)?.[1]?.trim() || null
}

function getDeclaration(record, property) {
  const directKeys =
    property === "font-family" ? ["font-family", "fontFamily"] : [property]
  for (const key of directKeys) {
    if (typeof record[key] === "string") return record[key]
    if (isRecord(record.style) && typeof record.style[key] === "string") {
      return record.style[key]
    }
  }

  if (Array.isArray(record.declarations)) {
    for (let index = record.declarations.length - 1; index >= 0; index -= 1) {
      const declaration = record.declarations[index]
      if (!isRecord(declaration)) continue
      const name = declaration.property || declaration.name
      if (
        typeof name === "string" &&
        name.toLowerCase() === property &&
        typeof declaration.value === "string"
      ) {
        return declaration.value
      }
    }
  }

  return null
}

function collectCapturedRules(value, rules = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCapturedRules(item, rules)
    return rules
  }
  if (!isRecord(value)) return rules

  const selectors = Array.isArray(value.matchedSelector)
    ? value.matchedSelector
    : [value.matchedSelector]
  const fontFamily = getDeclaration(value, "font-family")
  const fontShorthand = fontFamily ? null : getDeclaration(value, "font")
  const fallback =
    fontFamily ||
    (fontShorthand ? extractFontFamilyFromShorthand(fontShorthand) : null)

  if (fallback) {
    for (const selector of selectors) {
      if (typeof selector === "string" && selector.trim()) {
        rules.push({ fallback, selector, sourceIndex: rules.length })
      }
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if (
      key === "matchedSelector" ||
      key === "declarations" ||
      key === "style"
    ) {
      continue
    }
    if (Array.isArray(nested) || isRecord(nested)) {
      collectCapturedRules(nested, rules)
    }
  }

  return rules
}

function normalizeSelector(selector) {
  return selector
    .replace(ANGULAR_SCOPE_PATTERN, "")
    .replace(CSS_MODULE_CLASS_PATTERN, '[class*="$1"]')
    .replace(/\s+/g, " ")
    .replace(/\s+([>+~])/g, " $1")
    .replace(/([>+~])\s+/g, "$1 ")
    .trim()
}

function shouldSkipRule(selector, fallback) {
  return (
    fallback.includes("var(--fontara-font)") ||
    ICON_PATTERN.test(selector) ||
    ICON_PATTERN.test(fallback)
  )
}

function createVariableSlug(fallback) {
  const firstFamily = fallback.split(",")[0] || "site"
  const slug = firstFamily
    .replace(/["']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${slug || "site"}-ui`
}

function uniquifyVariableSlugs(fallbacks) {
  const used = new Map()
  return new Map(
    fallbacks.map((fallback) => {
      const base = createVariableSlug(fallback)
      const count = (used.get(base) || 0) + 1
      used.set(base, count)
      return [fallback, count === 1 ? base : `${base}-${count}`]
    })
  )
}

function looksHighChurn(selector) {
  const shortGeneratedClass = /\.[A-Za-z0-9_-]{1,4}(?=[\s>+~.#:[,]|$)/
  const combinatorCount = (selector.match(/[>+~]/g) || []).length
  return (
    shortGeneratedClass.test(selector) ||
    /:nth-(?:child|of-type)\(/.test(selector) ||
    combinatorCount >= 4
  )
}

function buildSiteCSS(payload) {
  const capturedRules = collectCapturedRules(payload)
  const winningRuleBySelector = new Map()

  for (const rule of capturedRules) {
    const selector = normalizeSelector(rule.selector)
    const fallback = normalizeWhitespace(rule.fallback)
    if (!selector || !fallback || shouldSkipRule(selector, fallback)) continue
    winningRuleBySelector.set(selector, { ...rule, fallback, selector })
  }

  const groups = new Map()
  const winningRules = [...winningRuleBySelector.values()].sort(
    (first, second) => first.sourceIndex - second.sourceIndex
  )
  for (const rule of winningRules) {
    const selectors = groups.get(rule.fallback) || []
    selectors.push(rule.selector)
    groups.set(rule.fallback, selectors)
  }

  const fallbacks = [...groups.keys()]
  const slugs = uniquifyVariableSlugs(fallbacks)
  const rootLines = fallbacks.map(
    (fallback) =>
      `  --fontara-site-${slugs.get(fallback)}-fallback: ${fallback};`
  )
  const ruleBlocks = fallbacks.map((fallback) => {
    const variable = `--fontara-site-${slugs.get(fallback)}-fallback`
    const selectorList = groups
      .get(fallback)
      .map((selector) => `  ${selector}`)
      .join(",\n")
    return `${selectorList} {\n  font-family: var(--fontara-font), var(${variable}) !important;\n}`
  })

  const css = [
    ":root {",
    ...rootLines,
    "}",
    "",
    ruleBlocks.join("\n\n"),
    ""
  ].join("\n")
  const highChurnSelectors = winningRules
    .map((rule) => rule.selector)
    .filter(looksHighChurn)

  return {
    css,
    highChurnSelectors,
    ruleCount: winningRules.length
  }
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"))
}

function main() {
  const [, , command, inputPath, outputPath] = process.argv
  if (!command || !inputPath || !outputPath) {
    throw new Error(
      "Usage: node tasks/site-css.js <generate|validate> <capture.json> <site.css>"
    )
  }

  const result = buildSiteCSS(readJSON(inputPath))
  const resolvedOutputPath = path.resolve(outputPath)
  if (command === "generate") {
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, result.css)
  } else if (command === "validate") {
    const currentCSS = fs.readFileSync(resolvedOutputPath, "utf8")
    if (currentCSS !== result.css) {
      throw new Error(
        `${outputPath} does not match its captured selector JSON.`
      )
    }
  } else {
    throw new Error(`Unknown site CSS command: ${command}`)
  }

  if (result.highChurnSelectors.length > 0) {
    console.warn(
      `High-churn selector warning (${result.highChurnSelectors.length}): capture is valid, but a separately approved semantic review may be more stable.`
    )
  }
  console.log(`${command}d ${result.ruleCount} captured text selectors.`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

module.exports = {
  buildSiteCSS,
  collectCapturedRules,
  extractFontFamilyFromShorthand,
  normalizeSelector
}
