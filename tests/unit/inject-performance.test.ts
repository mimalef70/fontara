import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

function readSource(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8")
}

test("font injection keeps computed-style reads separated from writes", () => {
  const domProcessorSource = readSource("src/inject/dom-processor.ts")

  assert.match(domProcessorSource, /function collectFontWork/)
  assert.match(domProcessorSource, /function collectNextFontWork/)
  assert.match(domProcessorSource, /function createFontWorkCollection/)
  assert.match(domProcessorSource, /function writeFontWorkBatch/)
  assert.match(domProcessorSource, /function hasDirectText/)
  assert.match(domProcessorSource, /NodeFilter\.FILTER_REJECT/)
  assert.match(domProcessorSource, /new WeakSet<HTMLElement>\(\)/)
  assert.match(domProcessorSource, /applyFontToTreeChunked/)
  assert.match(domProcessorSource, /requestIdleCallback/)
  assert.match(domProcessorSource, /endsWith\("-Fontara"\)/)
  assert.doesNotMatch(domProcessorSource, /\.closest\(/)
  assert.doesNotMatch(domProcessorSource, /includes\("-Fontara"\)/)
  assert.doesNotMatch(domProcessorSource, /export function processElement/)
  assert.doesNotMatch(domProcessorSource, /export function applyFontToTree\(/)
})

test("mutation observer coalesces added nodes before processing", () => {
  const observerSource = readSource("src/inject/observer.ts")

  assert.match(observerSource, /pendingNodes = new Set<HTMLElement>\(\)/)
  assert.match(observerSource, /requestAnimationFrame\(flushPendingNodes\)/)
  assert.match(observerSource, /cancelAnimationFrame\(scheduledFrame\)/)
  assert.match(observerSource, /getTopLevelPendingNodes/)
  assert.match(observerSource, /node\.isConnected/)
  assert.match(observerSource, /collectFontWork/)
  assert.match(observerSource, /writeFontWorkBatch\(work\)/)
  assert.match(observerSource, /shouldChunkFontWork\(work\)/)
  assert.match(observerSource, /writeFontWorkBatchChunked\(work\)/)
  assert.doesNotMatch(observerSource, /applyFontToTree/)
})

test("storage changes schedule the active injection pipeline", () => {
  const injectSource = readSource("src/inject/index.ts")

  assert.match(injectSource, /function scheduleApplyFontsIfActive/)
  assert.match(injectSource, /queueMicrotask/)
  assert.match(injectSource, /applyFontsRunning/)
  assert.match(injectSource, /applyFontsQueued/)
  assert.match(
    injectSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]: scheduleApplyFontsIfActive/
  )
  assert.doesNotMatch(
    injectSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]:[\s\S]*?updateFontVariable/
  )
})

test("hot selector lookups use Sets", () => {
  const selectorsSource = readSource("src/config/selectors.ts")

  assert.match(selectorsSource, /EXCLUDED_TAGS = new Set\(/)
  assert.match(selectorsSource, /ICON_CLASSES = new Set\(/)
})

test("custom font injection only emits the selected custom font", () => {
  const fontStyleManagerSource = readSource("src/inject/font-style-manager.ts")

  assert.match(fontStyleManagerSource, /function getSelectedCustomFonts/)
  assert.match(fontStyleManagerSource, /Promise\.all/)
  assert.match(fontStyleManagerSource, /font\.value === selectedFont/)
  assert.match(
    fontStyleManagerSource,
    /createCustomFontFaces\(await getSelectedCustomFonts\(\)\)/
  )
  assert.doesNotMatch(
    fontStyleManagerSource,
    /createCustomFontFaces\(customFontList\)/
  )
})

test("bundled font faces avoid FOIT and keep Azarmehr as an asset", () => {
  const fontsCSS = readSource("src/fonts.css")
  const fontFaceBlocks = fontsCSS.match(/@font-face \{[\s\S]*?\n\}/g) ?? []
  const azarmehrPath = path.resolve(
    "assets/fonts/azarmehr/AzarMehr[wght].woff2"
  )
  const azarmehrFont = fs.readFileSync(azarmehrPath)

  assert.ok(fontFaceBlocks.length > 0)
  assert.equal(
    fontFaceBlocks.filter((block) => block.includes("font-display: swap;"))
      .length,
    fontFaceBlocks.length
  )
  assert.doesNotMatch(fontsCSS, /data:font/)
  assert.match(fontsCSS, /assets\/fonts\/azarmehr\/AzarMehr\[wght\]\.woff2/)
  assert.equal(azarmehrFont.subarray(0, 4).toString("ascii"), "wOF2")
})
