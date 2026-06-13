#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")

const ROOT_DIR = process.cwd()
const SOURCE_DIRS = ["src", "tests"]
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"])
const SHOULD_WRITE = process.argv.includes("--write")
const CSS_VAR_ARBITRARY_VALUE_PATTERN =
  /(?<utility>[!_-]?[A-Za-z0-9:/.[\]=_-]+)-\[(?:var\((?<wrappedVariable>--[A-Za-z0-9_-]+)\)|(?<bareVariable>--[A-Za-z0-9_-]+))\]/g
const THEME_SPACING_PATTERN = /theme\(spacing\.(?<token>-?\d+(?:\.\d+)?|px)\)/g
const CALC_ESCAPED_OPERATOR_PATTERN =
  /\[(?<value>calc\([^\]\n]*_[+\-*/][^\]\n]*\))\]/g

function formatCssNumber(value) {
  return Number(value.toFixed(6)).toString()
}

function resolveSpacingToken(token) {
  if (token === "px") return "1px"

  const numericToken = Number(token)
  if (!Number.isFinite(numericToken)) return null

  return `${formatCssNumber(numericToken * 0.25)}rem`
}

function walkFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "build") {
        walkFiles(entryPath, files)
      }
      continue
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath)
    }
  }

  return files
}

function getLineAndColumn(text, index) {
  const before = text.slice(0, index)
  const lines = before.split("\n")

  return {
    column: lines.at(-1).length + 1,
    line: lines.length
  }
}

function main() {
  const files = SOURCE_DIRS.flatMap((directory) =>
    walkFiles(path.join(ROOT_DIR, directory))
  )
  const findings = []
  let fixedCount = 0

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8")
    let nextContent = content

    for (const match of content.matchAll(CSS_VAR_ARBITRARY_VALUE_PATTERN)) {
      const groups = match.groups
      if (!groups || match.index === undefined) continue

      const variable = groups.wrappedVariable ?? groups.bareVariable
      const replacement = `${groups.utility}-(${variable})`
      const location = getLineAndColumn(content, match.index)
      const relativePath = path.relative(ROOT_DIR, file)
      findings.push(
        `${relativePath}:${location.line}:${location.column} ${match[0]} -> ${replacement}`
      )
      nextContent = nextContent.replaceAll(match[0], replacement)
    }

    for (const match of content.matchAll(THEME_SPACING_PATTERN)) {
      const groups = match.groups
      if (!groups || match.index === undefined) continue

      const replacement = resolveSpacingToken(groups.token)
      const location = getLineAndColumn(content, match.index)
      const relativePath = path.relative(ROOT_DIR, file)

      if (!replacement) {
        findings.push(
          `${relativePath}:${location.line}:${location.column} ${match[0]} uses an unsupported theme spacing token`
        )
        continue
      }

      findings.push(
        `${relativePath}:${location.line}:${location.column} ${match[0]} -> ${replacement}`
      )
      nextContent = nextContent.replaceAll(match[0], replacement)
    }

    for (const match of nextContent.matchAll(CALC_ESCAPED_OPERATOR_PATTERN)) {
      if (match.index === undefined) continue

      const replacement = match[0]
        .replace(/_([+\-*/])_/g, "$1")
        .replace(/_([+\-*/])/g, "$1")
        .replace(/([+\-*/])_/g, "$1")

      if (replacement === match[0]) continue

      const location = getLineAndColumn(nextContent, match.index)
      const relativePath = path.relative(ROOT_DIR, file)
      findings.push(
        `${relativePath}:${location.line}:${location.column} ${match[0]} -> ${replacement}`
      )
      nextContent = nextContent.replaceAll(match[0], replacement)
    }

    if (SHOULD_WRITE && nextContent !== content) {
      fs.writeFileSync(file, nextContent)
      fixedCount += 1
    }
  }

  if (findings.length === 0) {
    console.log("No non-canonical Tailwind CSS variable classes found.")
    return
  }

  if (SHOULD_WRITE) {
    console.log(
      `Fixed ${findings.length} non-canonical Tailwind CSS variable class${
        findings.length === 1 ? "" : "es"
      } in ${fixedCount} file${fixedCount === 1 ? "" : "s"}.`
    )
    return
  }

  console.error(
    `Found ${findings.length} non-canonical Tailwind CSS variable class${
      findings.length === 1 ? "" : "es"
    }:\n`
  )
  console.error(findings.join("\n"))
  process.exitCode = 1
}

main()
