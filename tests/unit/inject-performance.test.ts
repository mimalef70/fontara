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
  assert.match(domProcessorSource, /applyFontToTreesChunked/)
  assert.match(domProcessorSource, /requestIdleCallback/)
  assert.match(domProcessorSource, /ROOT_COLLECTIONS_PER_TIMEOUT/)
  assert.match(domProcessorSource, /endsWith\("-Fontara"\)/)
  assert.match(domProcessorSource, /hasContentEditableAncestorOrSelf/)
  assert.match(domProcessorSource, /isContentEditableRoot/)
  assert.doesNotMatch(domProcessorSource, /\.closest\(/)
  assert.doesNotMatch(domProcessorSource, /includes\("-Fontara"\)/)
  assert.doesNotMatch(domProcessorSource, /export function processElement/)
  assert.doesNotMatch(domProcessorSource, /export function applyFontToTree\(/)
})

test("contenteditable editors use stylesheet font application", () => {
  const domProcessorSource = readSource("src/inject/dom-processor.ts")
  const editableFontStyleSource = readSource(
    "src/inject/editable-font-style.ts"
  )
  const fontStyleManagerSource = readSource("src/inject/font-style-manager.ts")

  assert.match(domProcessorSource, /contenteditable/)
  assert.match(domProcessorSource, /node\.isContentEditable === true/)
  assert.match(editableFontStyleSource, /refreshEditableFontStyles/)
  assert.match(editableFontStyleSource, /getTopLevelContentEditableElements/)
  assert.match(editableFontStyleSource, /getStaticEditableFontRule/)
  assert.match(editableFontStyleSource, /isInsideContentEditableElement/)
  assert.match(editableFontStyleSource, /removeContentEditableInlineFontStyles/)
  assert.match(editableFontStyleSource, /CONTENT_EDITABLE_INLINE_FONT_SELECTOR/)
  assert.match(
    editableFontStyleSource,
    /window\.getComputedStyle\(getEditableFontSample\(element\)\)/
  )
  assert.match(editableFontStyleSource, /getStableEditableSelector/)
  assert.match(editableFontStyleSource, /MAX_DYNAMIC_EDITABLE_RULES/)
  assert.match(editableFontStyleSource, /\[data-text="true"\]/)
  assert.match(editableFontStyleSource, /"p"/)
  assert.match(editableFontStyleSource, /fontara-editable-font-specificity/)
  assert.match(editableFontStyleSource, /editableFontSignature/)
  assert.match(editableFontStyleSource, /fontara-editable-font-style/)
  assert.match(editableFontStyleSource, /\[contenteditable\]/)
  assert.match(editableFontStyleSource, /var\(--fontara-font\)/)
  assert.doesNotMatch(editableFontStyleSource, /nth-of-type/)
  assert.doesNotMatch(editableFontStyleSource, /parts\.join\(" > "\)/)
  assert.doesNotMatch(editableFontStyleSource, /const EDITABLE_FONT_CSS/)
  assert.match(fontStyleManagerSource, /refreshEditableFontStyles/)
  assert.match(fontStyleManagerSource, /removeEditableFontStyles/)
})

test("mutation observer coalesces added nodes before processing", () => {
  const observerSource = readSource("src/inject/observer.ts")

  assert.match(observerSource, /pendingNodes = new Set<HTMLElement>\(\)/)
  assert.match(observerSource, /requestAnimationFrame\(flushPendingNodes\)/)
  assert.match(observerSource, /cancelAnimationFrame\(scheduledFrame\)/)
  assert.match(observerSource, /getTopLevelPendingNodes/)
  assert.match(observerSource, /node\.isConnected/)
  assert.match(observerSource, /applyFontToTreesChunked\(connectedNodes\)/)
  assert.match(observerSource, /refreshEditableFontStyles/)
  assert.match(observerSource, /editableFontStylesDirty/)
  assert.match(observerSource, /addPendingNodeIfOutsideContentEditable/)
  assert.match(observerSource, /isInsideContentEditableElement/)
  assert.match(observerSource, /containsContentEditableElement/)
  assert.match(observerSource, /removedNodes/)
  assert.match(observerSource, /EDITABLE_SELECTOR_ATTRIBUTES/)
  assert.match(
    observerSource,
    /attributeFilter: \["contenteditable", \.\.\.EDITABLE_SELECTOR_ATTRIBUTES\]/
  )
  assert.doesNotMatch(observerSource, /applyFontToTree\(/)
})

test("storage changes schedule the active injection pipeline", () => {
  const injectSource = readSource("src/inject/index.ts")

  assert.match(injectSource, /function scheduleApplyFontsIfActive/)
  assert.match(injectSource, /type ApplyMode = "font-styles" \| "full"/)
  assert.match(injectSource, /queueMicrotask/)
  assert.match(injectSource, /applyFontsRunning/)
  assert.match(injectSource, /applyFontsQueuedMode/)
  assert.match(
    injectSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]: \(\) =>\s*scheduleApplyFontsIfActive\("font-styles"\)/
  )
  assert.match(
    injectSource,
    /\[STORAGE_KEYS\.WEBSITE_LIST\]: \(\) => scheduleApplyFontsIfActive\(\)/
  )
  assert.doesNotMatch(
    injectSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]:[\s\S]*?applyFontToTreeChunked/
  )
})

test("ChatGPT uses site CSS instead of streaming DOM writes", () => {
  const chatgptCSS = readSource("assets/styles/chatgpt.css")
  const fontStyleManagerSource = readSource("src/inject/font-style-manager.ts")
  const injectSource = readSource("src/inject/index.ts")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/chatgpt\.com"/)
  assert.match(sitesSource, /siteName: "ChatGPT"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "ChatGPT"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /chatgpt\.css/)
  assert.match(siteFixesSource, /"https:\/\/chatgpt\.com": chatgpt/)
  assert.match(chatgptCSS, /body \*/)
  assert.match(chatgptCSS, /--fontara-chatgpt-fallback/)
  assert.match(chatgptCSS, /--fontara-chatgpt-monospace/)
  assert.match(fontStyleManagerSource, /export function removeInlineFontStyles/)
  assert.match(
    fontStyleManagerSource,
    /removeEditableFontStyles\(\)[\s\S]*removeInlineFontStyles\(\)[\s\S]*upsertStyle\(CUSTOM_CSS_ID, customCSS\)/
  )
  assert.match(
    injectSource,
    /if \(hasCustomCSS\) \{[\s\S]*stopObserving\(\)[\s\S]*resetProcessedElements\(\)/
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
  assert.match(fontStyleManagerSource, /BUNDLED_FONT_VALUES/)
  assert.match(
    fontStyleManagerSource,
    /BUNDLED_FONT_VALUES\.has\(selectedFont\)/
  )
  assert.match(fontStyleManagerSource, /font\.value === selectedFont/)
  assert.match(fontStyleManagerSource, /getSelectedCustomFonts\(selectedFont\)/)
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
  const aradPath = path.resolve("assets/fonts/arad/Arad-VF.woff2")
  const azarmehrFont = fs.readFileSync(azarmehrPath)
  const aradFont = fs.readFileSync(aradPath)

  assert.ok(fontFaceBlocks.length > 0)
  assert.equal(
    fontFaceBlocks.filter((block) => block.includes("font-display: swap;"))
      .length,
    fontFaceBlocks.length
  )
  assert.doesNotMatch(fontsCSS, /data:font/)
  assert.match(fontsCSS, /assets\/fonts\/azarmehr\/AzarMehr\[wght\]\.woff2/)
  assert.match(fontsCSS, /assets\/fonts\/arad\/Arad-VF\.woff2/)
  assert.equal(azarmehrFont.subarray(0, 4).toString("ascii"), "wOF2")
  assert.equal(aradFont.subarray(0, 4).toString("ascii"), "wOF2")
})
