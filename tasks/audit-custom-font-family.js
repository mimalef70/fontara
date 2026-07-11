#!/usr/bin/env node

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const {
  extractCustomFontMetadataFromBytes
} = require("../src/ui/options/custom-font-metadata")
const {
  MAX_CUSTOM_FONT_FAMILY_SIZE_BYTES,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES
} = require("../src/utils/custom-font-storage")
const {
  getFontFileExtension,
  isFontFileSignatureSupported,
  isSupportedFontExtension
} = require("../src/utils/font-data")

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath]
  })
}

function getSelectionKey(filePath) {
  return `${path.dirname(filePath)}|${path.extname(filePath).toLowerCase()}`
}

const inputArgument = process.argv
  .slice(2)
  .find((argument) => argument !== "--")
const inputDirectory = path.resolve(inputArgument ?? "")
assert.ok(inputArgument, "Usage: pnpm audit:font-family -- <directory>")
assert.ok(
  fs.statSync(inputDirectory).isDirectory(),
  "Font path is not a directory"
)

const supportedFiles = collectFiles(inputDirectory).filter((filePath) => {
  const extension = getFontFileExtension(filePath)
  return isSupportedFontExtension(extension)
})
assert.ok(supportedFiles.length > 0, "No supported font files were found")

const selections = new Map()
for (const filePath of supportedFiles) {
  const bytes = fs.readFileSync(filePath)
  const extension = getFontFileExtension(filePath)
  assert.ok(bytes.byteLength <= MAX_CUSTOM_FONT_FILE_SIZE_BYTES)
  assert.ok(isFontFileSignatureSupported(extension, bytes))
  const metadata = extractCustomFontMetadataFromBytes(bytes)
  const slot = [
    metadata.style,
    metadata.weight.min,
    metadata.weight.max,
    metadata.stretch.min,
    metadata.stretch.max
  ].join(":")
  const selectionKey = getSelectionKey(filePath)
  const selection = selections.get(selectionKey) ?? []
  selection.push({
    filePath,
    sourceFamilyKey: metadata.sourceFamilyKey,
    familyGroupName: metadata.familyGroupName,
    slot,
    weight:
      metadata.weight.min === metadata.weight.max
        ? String(metadata.weight.min)
        : `${metadata.weight.min}–${metadata.weight.max}`
  })
  selections.set(selectionKey, selection)
}

console.log(`Audited ${supportedFiles.length} supported font files.`)
for (const [selectionKey, fonts] of [...selections].sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  const totalBytes = fonts.reduce(
    (sum, font) => sum + fs.statSync(font.filePath).size,
    0
  )
  assert.ok(fonts.length <= 20, `${selectionKey} exceeds the 20-face limit`)
  assert.ok(
    totalBytes <= MAX_CUSTOM_FONT_FAMILY_SIZE_BYTES,
    `${selectionKey} exceeds the 20 MiB family limit`
  )
  assert.equal(
    new Set(fonts.map((font) => font.sourceFamilyKey)).size,
    1,
    `${selectionKey} contains multiple detected families`
  )
  assert.equal(
    new Set(fonts.map((font) => font.slot)).size,
    fonts.length,
    `${selectionKey} contains conflicting face descriptors`
  )

  const directory =
    path.relative(inputDirectory, path.dirname(fonts[0].filePath)) || "."
  const format = path.extname(fonts[0].filePath).slice(1).toUpperCase()
  const weights = fonts
    .map((font) => Number(font.weight))
    .sort((a, b) => a - b)
    .join(", ")
  console.log(
    `✓ ${directory} · ${format} · ${fonts[0].familyGroupName} · ${fonts.length} faces · ${weights}`
  )
}

console.log(`All ${selections.size} import selections passed.`)
