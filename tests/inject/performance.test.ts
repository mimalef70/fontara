import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { FONTARA_TEXT_UNICODE_RANGE } from "../../src/config/font-unicode-range"

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
  assert.match(domProcessorSource, /splitFontFamilies/)
  assert.match(domProcessorSource, /endsWith\("-Fontara"\)/)
  assert.match(domProcessorSource, /hasContentEditableAncestorOrSelf/)
  assert.match(domProcessorSource, /isContentEditableRoot/)
  assert.doesNotMatch(domProcessorSource, /\.closest\(/)
  assert.doesNotMatch(domProcessorSource, /fontFamily\.split\(","\)/)
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
  assert.match(editableFontStyleSource, /CODE_EDITABLE_GUARD_SELECTORS/)
  assert.match(editableFontStyleSource, /\.cm-editor/)
  assert.match(editableFontStyleSource, /\.monaco-editor/)
  assert.match(editableFontStyleSource, /\[class~="code" i\]/)
  assert.match(editableFontStyleSource, /\[class\*="code-block" i\]/)
  assert.match(editableFontStyleSource, /function isCodeEditableElement/)
  assert.match(
    editableFontStyleSource,
    /for \(const editableElement of editableElements\)/
  )
  assert.match(
    editableFontStyleSource,
    /if \(isCodeEditableElement\(element\)\) return null/
  )
  assert.match(editableFontStyleSource, /High-churn selector attributes/)
  assert.doesNotMatch(editableFontStyleSource, /\[class\*="code" i\]/)
  assert.doesNotMatch(
    editableFontStyleSource,
    /Array\.from\(\s*element\.querySelectorAll/
  )
  assert.doesNotMatch(editableFontStyleSource, /nth-of-type/)
  assert.doesNotMatch(editableFontStyleSource, /parts\.join\(" > "\)/)
  assert.doesNotMatch(editableFontStyleSource, /const EDITABLE_FONT_CSS/)
  assert.match(fontStyleManagerSource, /refreshEditableFontStyles/)
  assert.match(fontStyleManagerSource, /removeEditableFontStyles/)
  assert.match(fontStyleManagerSource, /from "\.\/style-utils"/)
  assert.match(editableFontStyleSource, /from "\.\/style-utils"/)
})

test("mutation observer coalesces added nodes before processing", () => {
  const observerSource = readSource("src/inject/observer.ts")
  const domProcessorSource = readSource("src/inject/dom-processor.ts")
  const fontStyleManagerSource = readSource("src/inject/font-style-manager.ts")

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
  assert.match(observerSource, /EDITABLE_OBSERVER_ATTRIBUTES/)
  assert.match(observerSource, /attributeFilter: EDITABLE_OBSERVER_ATTRIBUTES/)
  assert.match(observerSource, /collectOpenShadowRoots/)
  assert.match(observerSource, /observedShadowRoots/)
  assert.match(domProcessorSource, /collectOpenShadowRoots/)
  assert.match(domProcessorSource, /type FontaraFontRoot/)
  assert.match(fontStyleManagerSource, /getDocumentAndShadowStyleRoots/)
  assert.doesNotMatch(observerSource, /EDITABLE_SELECTOR_ATTRIBUTES/)
  assert.doesNotMatch(observerSource, /attributeFilter:[\s\S]*aria-label/)
  assert.doesNotMatch(observerSource, /attributeFilter:[\s\S]*role/)
  assert.doesNotMatch(observerSource, /applyFontToTree\(/)
})

test("storage changes schedule the active injection pipeline", () => {
  const schedulerSource = readSource("src/inject/content-theme-scheduler.ts")
  const storageSource = readSource("src/inject/content-storage.ts")
  const runtimeSource = readSource("src/inject/content-runtime.ts")

  assert.match(schedulerSource, /function scheduleLocalThemeApply/)
  assert.match(schedulerSource, /function scheduleStorageFallbackApply/)
  assert.match(schedulerSource, /function activateLocalFallback/)
  assert.match(schedulerSource, /function markBackgroundCommandsEnabled/)
  assert.match(schedulerSource, /createFontaraPageThemeData/)
  assert.match(schedulerSource, /function readLocalThemeSettings/)
  assert.doesNotMatch(schedulerSource, /injectFontStyles/)
  assert.doesNotMatch(schedulerSource, /injectTextStrokeStyle/)
  assert.doesNotMatch(schedulerSource, /scheduleApplyRtlIfActive/)
  assert.match(schedulerSource, /let backgroundCommandsEnabled = false/)
  assert.match(
    schedulerSource,
    /requestResolvedPageThemeOrFallback\(\s*MESSAGE_TYPES_CS_TO_BG\.DOCUMENT_UPDATE,\s*scheduledMode\s*\)/
  )
  assert.match(schedulerSource, /BACKGROUND_STORAGE_UPDATE_GRACE_MS/)
  assert.match(
    schedulerSource,
    /type ContentApplyMode = "font-styles" \| "full"/
  )
  assert.match(schedulerSource, /queueMicrotask/)
  assert.match(schedulerSource, /localApplyRunning/)
  assert.match(schedulerSource, /localApplyQueuedMode/)
  assert.match(schedulerSource, /let localFallbackActive = false/)
  assert.match(schedulerSource, /options\.onLocalFallbackActivated/)
  assert.match(runtimeSource, /from "\.\/content-theme-scheduler"/)
  assert.match(runtimeSource, /from "\.\/content-storage"/)
  assert.match(runtimeSource, /function ensureStorageFallbackWatcher/)
  assert.match(
    runtimeSource,
    /onLocalFallbackActivated: ensureStorageFallbackWatcher/
  )
  assert.match(
    runtimeSource,
    /watchContentThemeStorageChanges\(themeScheduler\)/
  )
  assert.match(
    runtimeSource,
    /themeScheduler = createContentThemeScheduler[\s\S]*?ensureStorageFallbackWatcher\(\)[\s\S]*?stopWaitingForBody = runWhenBodyIsReady/
  )
  assert.match(runtimeSource, /stopWatchingUrlChanges/)
  assert.match(storageSource, /watchLocalStorage/)
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\("font-styles"\)/
  )
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.WEBSITE_LIST\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\(\)/
  )
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.ENABLED_BY_DEFAULT\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\(\)/
  )
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.ENABLED_FOR\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\(\)/
  )
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.DISABLED_FOR\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\(\)/
  )
  assert.match(
    storageSource,
    /\[STORAGE_KEYS\.SITE_PROFILES\]: \(\) =>\s*scheduler\.scheduleStorageFallbackApply\("font-styles"\)/
  )
  assert.doesNotMatch(
    schedulerSource,
    /\[STORAGE_KEYS\.SELECTED_FONT\]:[\s\S]*?applyFontToTreeChunked/
  )
  assert.doesNotMatch(runtimeSource, /STORAGE_KEYS\.SELECTED_FONT/)
  assert.doesNotMatch(runtimeSource, /watchLocalStorage/)
  assert.doesNotMatch(runtimeSource, /function scheduleApplyFontsIfActive/)
  assert.doesNotMatch(runtimeSource, /applyFontsQueuedMode/)
  assert.doesNotMatch(runtimeSource, /resolvedThemeRevision/)
})

test("content lifecycle helpers own body and URL observers", () => {
  const lifecycleSource = readSource("src/inject/content-lifecycle.ts")
  const runtimeSource = readSource("src/inject/content-runtime.ts")

  assert.match(lifecycleSource, /export function runWhenBodyIsReady/)
  assert.match(lifecycleSource, /export function watchUrlChanges/)
  assert.match(lifecycleSource, /export function isTopFrame/)
  assert.match(lifecycleSource, /observer\.observe\(document\.documentElement/)
  assert.match(lifecycleSource, /historyObject\[methodName\] = wrappedMethod/)
  assert.match(lifecycleSource, /addEventListener\("popstate"/)
  assert.match(lifecycleSource, /addEventListener\("hashchange"/)
  assert.match(lifecycleSource, /window\.setInterval\(handlePossibleUrlChange/)
  assert.match(lifecycleSource, /queueMicrotask\(handlePossibleUrlChange\)/)
  assert.doesNotMatch(runtimeSource, /function runWhenBodyIsReady/)
  assert.doesNotMatch(runtimeSource, /function watchUrlChanges/)
  assert.doesNotMatch(runtimeSource, /function isTopFrame/)
  assert.doesNotMatch(
    runtimeSource,
    /historyObject\[methodName\] = wrappedMethod/
  )
})

test("content page lifecycle owns page event handlers", () => {
  const pageLifecycleSource = readSource("src/inject/content-page-lifecycle.ts")
  const runtimeSource = readSource("src/inject/content-runtime.ts")

  assert.match(pageLifecycleSource, /export function watchContentPageLifecycle/)
  assert.match(pageLifecycleSource, /function handlePageHide/)
  assert.match(pageLifecycleSource, /function handlePageShow/)
  assert.match(pageLifecycleSource, /function handleFreeze/)
  assert.match(pageLifecycleSource, /function handleResume/)
  assert.match(pageLifecycleSource, /addEventListener\("pagehide"/)
  assert.match(pageLifecycleSource, /removeEventListener\("pagehide"/)
  assert.match(pageLifecycleSource, /pauseRtlSupport/)
  assert.match(runtimeSource, /watchContentPageLifecycle/)
  assert.doesNotMatch(runtimeSource, /function handlePageHide/)
  assert.doesNotMatch(runtimeSource, /function handlePageShow/)
  assert.doesNotMatch(runtimeSource, /addEventListener\("pagehide"/)
})

test("content messaging helpers own runtime messaging and teardown errors", () => {
  const messagingSource = readSource("src/inject/content-messaging.ts")
  const runtimeSource = readSource("src/inject/content-runtime.ts")

  assert.match(messagingSource, /export function sendDocumentLifecycleMessage/)
  assert.match(messagingSource, /export function getRuntimeMessageEvent/)
  assert.match(messagingSource, /export function isExtensionContextInvalidated/)
  assert.match(
    messagingSource,
    /export function isExpectedRuntimeTeardownError/
  )
  assert.match(messagingSource, /runtime\.sendMessage\(message/)
  assert.match(messagingSource, /chrome\.runtime\?\.lastError/)
  assert.match(messagingSource, /onExtensionContextInvalidated/)
  assert.match(runtimeSource, /from "\.\/content-messaging"/)
  assert.match(runtimeSource, /sendDocumentLifecycleMessage/)
  assert.doesNotMatch(runtimeSource, /function getErrorMessage/)
  assert.doesNotMatch(runtimeSource, /function getRuntimeMessageEvent/)
  assert.doesNotMatch(runtimeSource, /function isExtensionContextInvalidated/)
  assert.doesNotMatch(runtimeSource, /chrome\.runtime/)
})

test("content runtime command routing is separated from runtime wiring", () => {
  const commandSource = readSource("src/inject/content-runtime-commands.ts")
  const runtimeSource = readSource("src/inject/content-runtime.ts")

  assert.match(commandSource, /handleContentRuntimeCommandMessage/)
  assert.match(commandSource, /MESSAGE_TYPES_BG_TO_CS\.APPLY_THEME/)
  assert.match(commandSource, /MESSAGE_TYPES_BG_TO_CS\.CLEAN_UP/)
  assert.match(commandSource, /MESSAGE_TYPES_BG_TO_CS\.SETTINGS_CHANGED/)
  assert.match(commandSource, /isMessageForScript/)
  assert.match(commandSource, /scheduler\.applyThemeCommand/)
  assert.match(commandSource, /scheduler\.cleanUpThemeCommand/)
  assert.match(commandSource, /scheduler\.scheduleLocalThemeApply\("full"\)/)
  assert.match(runtimeSource, /handleContentRuntimeCommandMessage/)
  assert.doesNotMatch(runtimeSource, /MESSAGE_TYPES_BG_TO_CS/)
  assert.doesNotMatch(runtimeSource, /applyThemeCommand\(message\.data\)/)
  assert.doesNotMatch(runtimeSource, /cleanUpThemeCommand\(\)/)
})

test("debug browser test bridge is isolated from production runtime", () => {
  const runtimeSource = readSource("src/inject/content-runtime.ts")
  const bridgeSource = readSource("src/inject/content-test-bridge.ts")
  const messengerSource = readSource("src/background/messenger.ts")

  assert.match(runtimeSource, /startContentTestBridge\(\)/)
  assert.match(bridgeSource, /__DEBUG__/)
  assert.match(bridgeSource, /window\.addEventListener\("message"/)
  assert.match(bridgeSource, /isFontaraBrowserTestPagePing/)
  assert.match(bridgeSource, /createFontaraBrowserTestRelayMessage/)
  assert.match(messengerSource, /isDebugBuild\(\)/)
  assert.match(messengerSource, /isContentScriptSender/)
  assert.match(messengerSource, /isFontaraBrowserTestRelayMessage/)
})

test("content script entrypoint delegates to runtime bootstrap", () => {
  const injectSource = readSource("src/inject/index.ts")

  assert.match(injectSource, /from "\.\/content-runtime"/)
  assert.match(injectSource, /startContentRuntime\(\)/)
  assert.doesNotMatch(injectSource, /watchLocalStorage/)
  assert.doesNotMatch(injectSource, /createFontaraPageThemeData/)
  assert.doesNotMatch(injectSource, /MESSAGE_TYPES_/)
  assert.doesNotMatch(injectSource, /addEventListener/)
})

test("content theme executor is separated from lifecycle wiring", () => {
  const runtimeSource = readSource("src/inject/content-runtime.ts")
  const themeApplierSource = readSource("src/inject/theme-applier.ts")
  const fontStyleManagerSource = readSource("src/inject/font-style-manager.ts")
  const textStrokeStyleSource = readSource("src/inject/text-stroke-style.ts")

  assert.match(
    themeApplierSource,
    /export async function applyResolvedPageTheme/
  )
  assert.match(themeApplierSource, /export function cleanupResolvedPageTheme/)
  assert.match(themeApplierSource, /export function cleanupFontTheme/)
  assert.match(themeApplierSource, /applyFontToTreeChunked/)
  assert.match(themeApplierSource, /injectResolvedFontStyles/)
  assert.match(themeApplierSource, /injectResolvedTextStrokeStyle/)
  assert.match(themeApplierSource, /applyResolvedRtlSupport/)
  assert.match(themeApplierSource, /startObserving/)
  assert.doesNotMatch(fontStyleManagerSource, /getLocalValue/)
  assert.doesNotMatch(fontStyleManagerSource, /resolveFontSelection/)
  assert.doesNotMatch(fontStyleManagerSource, /export async function/)
  assert.doesNotMatch(textStrokeStyleSource, /getLocalValue/)
  assert.doesNotMatch(textStrokeStyleSource, /injectTextStrokeStyle/)
  assert.match(runtimeSource, /from "\.\/theme-applier"/)
  assert.doesNotMatch(runtimeSource, /from "\.\/font-style-manager"/)
  assert.doesNotMatch(runtimeSource, /from "\.\/text-stroke-style"/)
  assert.doesNotMatch(runtimeSource, /from "\.\/dom-processor"/)
  assert.doesNotMatch(runtimeSource, /applyFontToTreeChunked/)
  assert.doesNotMatch(runtimeSource, /injectResolvedFontStyles/)
  assert.doesNotMatch(runtimeSource, /applyResolvedRtlSupport/)
})

test("hot selector lookups use Sets", () => {
  const selectorsSource = readSource("src/config/selectors.ts")
  const domProcessorSource = readSource("src/inject/dom-processor.ts")

  assert.match(selectorsSource, /EXCLUDED_TAGS = new Set\(/)
  assert.match(selectorsSource, /ICON_CLASSES = new Set\(/)
  assert.match(selectorsSource, /ICON_CLASS_PREFIXES/)
  assert.match(selectorsSource, /ICON_CLASS_SUBSTRINGS/)
  assert.match(selectorsSource, /EXCLUDED_INLINE_FONT_STYLE_PATTERN/)
  assert.match(selectorsSource, /font\(\?:-family\)\?/)
  assert.match(domProcessorSource, /function hasAriaHidden/)
  assert.match(domProcessorSource, /function hasExcludedInlineFontStyle/)
  assert.match(domProcessorSource, /EXCLUDED_INLINE_FONT_STYLE_PATTERN\.test/)
  assert.match(domProcessorSource, /className\.startsWith\(prefix\)/)
  assert.match(domProcessorSource, /className\.includes\(substring\)/)
})

test("custom font injection only emits the selected custom font", () => {
  const fontSelectionSource = readSource("src/generators/font-selection.ts")

  assert.match(fontSelectionSource, /function getSelectedCustomFonts/)
  assert.match(fontSelectionSource, /BUNDLED_FONT_VALUES/)
  assert.match(fontSelectionSource, /BUNDLED_FONT_VALUES\.has\(value\)/)
  assert.match(fontSelectionSource, /font\.value === selectedFont/)
  assert.match(fontSelectionSource, /resolveFontSelection/)
  assert.match(
    fontSelectionSource,
    /createCustomFontFaces\(selectedCustomFonts\)/
  )
  assert.doesNotMatch(
    fontSelectionSource,
    /createCustomFontFaces\(customFontList\)/
  )
})

test("bundled font face CSS is memoized after URL rewriting", () => {
  const fontFaceSource = readSource("src/generators/font-face.ts")

  assert.match(fontFaceSource, /let cachedFontFaceCSS: string \| null = null/)
  assert.match(
    fontFaceSource,
    /cachedFontFaceCSS \?\?= rewriteFontFaceAssetUrls/
  )
  assert.match(fontFaceSource, /return cachedFontFaceCSS/)
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
  assert.equal(
    fontFaceBlocks.filter((block) => block.includes('format("woff2')).length,
    fontFaceBlocks.length
  )
  assert.equal(
    fontFaceBlocks.filter((block) =>
      block.includes(`unicode-range: ${FONTARA_TEXT_UNICODE_RANGE};`)
    ).length,
    fontFaceBlocks.length
  )
  assert.match(fontsCSS, /U\+200B-200F/)
  assert.match(fontsCSS, /U\+202A-202F/)
  assert.match(fontsCSS, /U\+0870-089F/)
  assert.match(fontsCSS, /U\+08A0-08FF/)
  assert.doesNotMatch(fontsCSS, /data:font/)
  assert.match(fontsCSS, /assets\/fonts\/azarmehr\/AzarMehr\[wght\]\.woff2/)
  assert.match(fontsCSS, /assets\/fonts\/arad\/Arad-VF\.woff2/)
  assert.equal(azarmehrFont.subarray(0, 4).toString("ascii"), "wOF2")
  assert.equal(aradFont.subarray(0, 4).toString("ascii"), "wOF2")
})
