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
  assert.match(
    chatgptCSS,
    /--fontara-chatgpt-body-fallback: var\(--font-sans\);/
  )
  assert.match(
    chatgptCSS,
    /--fontara-chatgpt-html-fallback: var\([\s\S]*--default-font-family/
  )
  assert.match(
    chatgptCSS,
    /--fontara-chatgpt-kbd-fallback: var\([\s\S]*--default-mono-font-family/
  )
  assert.match(
    chatgptCSS,
    /--fontara-chatgpt-font-sans-child-fallback: -apple-system-body,[\s\S]*"Segoe UI Symbol";/
  )
  assert.match(
    chatgptCSS,
    /--fontara-chatgpt-header-wordmark-fallback: "OpenAI Sans", sans-serif;/
  )
  assert.match(
    chatgptCSS,
    /body \{[\s\S]*font-family: var\(--fontara-font\),[\s\S]*var\(--fontara-chatgpt-body-fallback\) !important;/
  )
  assert.match(
    chatgptCSS,
    /html \{[\s\S]*font-family: var\(--fontara-font\),[\s\S]*var\(--fontara-chatgpt-html-fallback\) !important;/
  )
  assert.match(
    chatgptCSS,
    /kbd \{[\s\S]*font-family: var\(--fontara-font\),[\s\S]*var\(--fontara-chatgpt-kbd-fallback\) !important;/
  )
  assert.match(
    chatgptCSS,
    /:is\(\.\\\*\\:font-sans > \*\) \{[\s\S]*font-family: var\(--fontara-font\),[\s\S]*var\(--fontara-chatgpt-font-sans-child-fallback\) !important;/
  )
  assert.match(
    chatgptCSS,
    /\.header-wordmark \{[\s\S]*font-family: var\(--fontara-font\),[\s\S]*var\(--fontara-chatgpt-header-wordmark-fallback\) !important;/
  )
  assert.doesNotMatch(chatgptCSS, /body \*/)
  assert.doesNotMatch(chatgptCSS, /\bpre\b/)
  assert.doesNotMatch(chatgptCSS, /\bcode\b/)
  assert.doesNotMatch(chatgptCSS, /\bsvg\b/)
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

test("Arena custom CSS is driven by matched-selector JSON", () => {
  const arenaCSS = readSource("assets/styles/arena.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/arena\.ai"/)
  assert.match(sitesSource, /siteName: "Arena"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Arena"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /arena\.css/)
  assert.match(siteFixesSource, /"https:\/\/arena\.ai": arena/)
  assert.match(arenaCSS, /--fontara-arena-times-root-fallback/)
  assert.match(arenaCSS, /--fontara-arena-basel-grotesk-ui-fallback/)
  assert.match(arenaCSS, /--fontara-arena-martina-heading-fallback/)
  assert.match(arenaCSS, /--fontara-arena-basel-grotesk-mono-fallback/)
  assert.match(arenaCSS, /--fontara-arena-basel-grotesk-emoji-ui-fallback/)
  assert.match(arenaCSS, /--fontara-arena-inter-prose-fallback/)
  assert.match(arenaCSS, /:root,\nhtml/)
  assert.match(arenaCSS, /\.body-base,/)
  assert.match(arenaCSS, /\.font-heading,/)
  assert.match(arenaCSS, /\.font-mono \{/)
  assert.match(arenaCSS, /\.font-sans \{/)
  assert.match(arenaCSS, /\.prose :where\(p, ul, ol, li, blockquote\)/)
  assert.match(arenaCSS, /baselGrotesk/)
  assert.match(arenaCSS, /martinaPlantijn/)
  assert.doesNotMatch(arenaCSS, /body \*/)
  assert.doesNotMatch(arenaCSS, /\bfont:\s/)
  assert.doesNotMatch(
    arenaCSS,
    /--fontara-arena-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Facebook custom CSS is driven by matched-selector JSON", () => {
  const facebookCSS = readSource("assets/styles/facebook.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.facebook\.com"/)
  assert.match(sitesSource, /siteName: "Facebook"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Facebook"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /facebook\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.facebook\.com": facebook/)
  assert.match(facebookCSS, /--fontara-facebook-system-ui-fallback/)
  assert.match(facebookCSS, /body :where\(/)
  assert.match(facebookCSS, /\[class\*="icon" i\]/)
  assert.match(facebookCSS, /pre \*,/)
  assert.match(facebookCSS, /code, code \*,/)
  assert.match(facebookCSS, /kbd, samp/)
  assert.match(facebookCSS, /\.SFNSText-Regular/)
  assert.doesNotMatch(facebookCSS, /\.x1n0sxbx/)
  assert.doesNotMatch(facebookCSS, /#facebook \.system-fonts--body\.sf/)
  assert.doesNotMatch(facebookCSS, /body \*/)
  assert.doesNotMatch(facebookCSS, /\bfont:\s/)
  assert.doesNotMatch(
    facebookCSS,
    /--fontara-facebook-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("WhatsApp custom CSS is driven by matched-selector JSON", () => {
  const whatsappCSS = readSource("assets/styles/whatsapp.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/web\.whatsapp\.com"/)
  assert.match(sitesSource, /siteName: "WhatsApp"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "WhatsApp"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /whatsapp\.css/)
  assert.match(siteFixesSource, /"https:\/\/web\.whatsapp\.com": whatsapp/)
  assert.match(whatsappCSS, /--fontara-whatsapp-apple-ui-fallback/)
  assert.match(whatsappCSS, /--fontara-whatsapp-segoe-ui-fallback/)
  assert.match(whatsappCSS, /\.os-mac\.font-fix \{/)
  assert.match(whatsappCSS, /body \{/)
  assert.match(whatsappCSS, /SF Pro Text/)
  assert.match(whatsappCSS, /Segoe UI/)
  assert.doesNotMatch(whatsappCSS, /body \*/)
  assert.doesNotMatch(whatsappCSS, /\[dir="rtl"\]/)
  assert.doesNotMatch(whatsappCSS, /\bfont:\s/)
  assert.doesNotMatch(
    whatsappCSS,
    /--fontara-whatsapp-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Telegram custom CSS is driven by matched-selector JSON", () => {
  const telegramCSS = readSource("assets/styles/telegram.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/web\.telegram\.org"/)
  assert.match(sitesSource, /siteName: "Telegram"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Telegram"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /telegram\.css/)
  assert.match(siteFixesSource, /"https:\/\/web\.telegram\.org": telegram/)
  assert.match(telegramCSS, /--fontara-telegram-roboto-ui-fallback/)
  assert.match(telegramCSS, /button,\nhtml,\ninput \{/)
  assert.match(telegramCSS, /Roboto/)
  assert.doesNotMatch(telegramCSS, /\.emoji-native/)
  assert.doesNotMatch(telegramCSS, /\.tgico/)
  assert.doesNotMatch(telegramCSS, /body \*/)
  assert.doesNotMatch(telegramCSS, /\bfont:\s/)
  assert.doesNotMatch(
    telegramCSS,
    /--fontara-telegram-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("DuckDuckGo custom CSS is driven by matched-selector JSON", () => {
  const duckduckgoCSS = readSource("assets/styles/duckduckgo.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/duckduckgo\.com"/)
  assert.match(sitesSource, /siteName: "DuckDuckGo"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "DuckDuckGo"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /duckduckgo\.css/)
  assert.match(siteFixesSource, /"https:\/\/duckduckgo\.com": duckduckgo/)
  assert.match(
    duckduckgoCSS,
    /--fontara-duckduckgo-duck-sans-product-ui-fallback/
  )
  assert.match(duckduckgoCSS, /body :where\(/)
  assert.match(duckduckgoCSS, /\[class\*="icon" i\]/)
  assert.match(duckduckgoCSS, /pre \*,/)
  assert.match(duckduckgoCSS, /code, code \*,/)
  assert.match(duckduckgoCSS, /kbd, samp/)
  assert.match(duckduckgoCSS, /DuckSansProduct/)
  assert.doesNotMatch(
    duckduckgoCSS,
    /--fontara-duckduckgo-duck-sans-product-repeated-ui-fallback/
  )
  assert.doesNotMatch(
    duckduckgoCSS,
    /--fontara-duckduckgo-duck-sans-display-ui-fallback/
  )
  assert.doesNotMatch(duckduckgoCSS, /\.eVNpHGjtxRBq_gLOfGDr/)
  assert.doesNotMatch(duckduckgoCSS, /\.wZ4JdaHxSAhGy1HoNVja/)
  assert.doesNotMatch(duckduckgoCSS, /DuckSansDisplay/)
  assert.doesNotMatch(duckduckgoCSS, /ddg-serp-icons/)
  assert.doesNotMatch(duckduckgoCSS, /\.ddgsi/)
  assert.doesNotMatch(duckduckgoCSS, /::before/)
  assert.doesNotMatch(duckduckgoCSS, /::after/)
  assert.doesNotMatch(duckduckgoCSS, /body \*/)
  assert.doesNotMatch(duckduckgoCSS, /\bfont:\s/)
  assert.doesNotMatch(
    duckduckgoCSS,
    /--fontara-duckduckgo-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Trello custom CSS is driven by matched-selector JSON", () => {
  const trelloCSS = readSource("assets/styles/trello.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/trello\.com"/)
  assert.match(sitesSource, /siteName: "Trello"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Trello"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /trello\.css/)
  assert.match(siteFixesSource, /"https:\/\/trello\.com": trello/)
  assert.match(trelloCSS, /--fontara-trello-atlassian-ui-fallback/)
  assert.match(trelloCSS, /body :where\(/)
  assert.match(trelloCSS, /\[class\*="icon" i\]/)
  assert.match(trelloCSS, /pre \*,/)
  assert.match(trelloCSS, /code, code \*,/)
  assert.match(trelloCSS, /kbd, samp/)
  assert.match(trelloCSS, /Atlassian Sans/)
  assert.doesNotMatch(trelloCSS, /--fontara-trello-atlassian-blink-ui-fallback/)
  assert.doesNotMatch(trelloCSS, /--fontara-trello-system-form-fallback/)
  assert.doesNotMatch(trelloCSS, /--fontara-trello-root-fallback/)
  assert.doesNotMatch(trelloCSS, /\._11c8fhey/)
  assert.doesNotMatch(trelloCSS, /\.lyE6dN0zPcEtwe/)
  assert.doesNotMatch(trelloCSS, /\._11c81d4k/)
  assert.doesNotMatch(trelloCSS, /\._1tn2fhey/)
  assert.doesNotMatch(trelloCSS, /\bfont:\s/)
  assert.doesNotMatch(trelloCSS, /normal 400/)
  assert.doesNotMatch(trelloCSS, /14px\s*\/\s*20px/)
  assert.doesNotMatch(trelloCSS, /body \*/)
  assert.doesNotMatch(
    trelloCSS,
    /--fontara-trello-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Wikipedia custom CSS is driven by matched-selector JSON", () => {
  const wikipediaCSS = readSource("assets/styles/wikipedia.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.wikipedia\.org"/)
  assert.match(sitesSource, /siteName: "Wikipedia"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Wikipedia"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /wikipedia\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.wikipedia\.org": wikipedia/)
  assert.match(wikipediaCSS, /--fontara-wikipedia-sans-ui-fallback/)
  assert.match(wikipediaCSS, /body :where\(/)
  assert.match(wikipediaCSS, /\[class\*="icon" i\]/)
  assert.match(wikipediaCSS, /pre \*,/)
  assert.match(wikipediaCSS, /code, code \*,/)
  assert.match(wikipediaCSS, /kbd, samp/)
  assert.match(wikipediaCSS, /Iranian Sans/)
  assert.doesNotMatch(
    wikipediaCSS,
    /--fontara-wikipedia-serif-heading-fallback/
  )
  assert.doesNotMatch(wikipediaCSS, /--fontara-wikipedia-root-fallback/)
  assert.doesNotMatch(wikipediaCSS, /\.mw-body h1/)
  assert.doesNotMatch(
    wikipediaCSS,
    /\.vector-sticky-header-context-bar-primary/
  )
  assert.doesNotMatch(wikipediaCSS, /\.mw-footer/)
  assert.doesNotMatch(wikipediaCSS, /\.printfooter/)
  assert.doesNotMatch(wikipediaCSS, /Iranian Serif/)
  assert.doesNotMatch(wikipediaCSS, /\* \{/)
  assert.doesNotMatch(wikipediaCSS, /\bfont:\s/)
  assert.doesNotMatch(wikipediaCSS, /@media/)
  assert.doesNotMatch(
    wikipediaCSS,
    /--fontara-wikipedia-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("YouTube custom CSS is driven by matched-selector JSON", () => {
  const youtubeCSS = readSource("assets/styles/youtube.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.youtube\.com"/)
  assert.match(sitesSource, /siteName: "YouTube"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "YouTube"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /youtube\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.youtube\.com": youtube/)
  assert.match(youtubeCSS, /--fontara-youtube-roboto-ui-fallback/)
  assert.match(youtubeCSS, /body :where\(/)
  assert.match(youtubeCSS, /\[class\*="icon" i\]/)
  assert.match(youtubeCSS, /pre \*,/)
  assert.match(youtubeCSS, /code, code \*,/)
  assert.match(youtubeCSS, /kbd, samp/)
  assert.doesNotMatch(youtubeCSS, /--fontara-youtube-roboto-noto-ui-fallback/)
  assert.doesNotMatch(youtubeCSS, /--fontara-youtube-player-ui-fallback/)
  assert.doesNotMatch(youtubeCSS, /\.animatedRollingNumberHost/)
  assert.doesNotMatch(youtubeCSS, /\.ytSearchboxComponentInput/)
  assert.doesNotMatch(youtubeCSS, /#content-text\.ytd-comment-view-model/)
  assert.doesNotMatch(youtubeCSS, /ytd-watch-metadata\[title-headline-xs\]/)
  assert.doesNotMatch(youtubeCSS, /tp-yt-paper-button/)
  assert.doesNotMatch(youtubeCSS, /\.html5-video-player/)
  assert.doesNotMatch(youtubeCSS, /YouTube Noto/)
  assert.doesNotMatch(youtubeCSS, /@media/)
  assert.doesNotMatch(youtubeCSS, /body \*/)
  assert.doesNotMatch(youtubeCSS, /\bfont:\s/)
  assert.doesNotMatch(
    youtubeCSS,
    /--fontara-youtube-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Slack custom CSS is driven by matched-selector JSON", () => {
  const slackCSS = readSource("assets/styles/slack.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/app\.slack\.com"/)
  assert.match(sitesSource, /siteName: "Slack"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Slack"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /slack\.css/)
  assert.match(siteFixesSource, /"https:\/\/app\.slack\.com": slack/)
  assert.match(slackCSS, /--fontara-slack-app-ui-fallback/)
  assert.match(slackCSS, /--fontara-slack-loading-ui-fallback/)
  assert.match(slackCSS, /body,/)
  assert.match(slackCSS, /\.ql-container \{/)
  assert.match(slackCSS, /\.p-trouble_loading \{/)
  assert.match(slackCSS, /Slack-Lato/)
  assert.match(slackCSS, /Slack-Fractions/)
  assert.doesNotMatch(slackCSS, /Slack v2/)
  assert.doesNotMatch(slackCSS, /\.c-icon/)
  assert.doesNotMatch(slackCSS, /\.p-activity_toast_ia2022__link__icon/)
  assert.doesNotMatch(slackCSS, /body \*/)
  assert.doesNotMatch(slackCSS, /\bfont:\s/)
  assert.doesNotMatch(
    slackCSS,
    /--fontara-slack-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Claude custom CSS is driven by matched-selector JSON", () => {
  const claudeCSS = readSource("assets/styles/claude.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/claude\.ai"/)
  assert.match(sitesSource, /siteName: "Claude"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Claude"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /claude\.css/)
  assert.match(siteFixesSource, /"https:\/\/claude\.ai": claude/)
  assert.match(claudeCSS, /--fontara-claude-anthropic-sans-root-fallback/)
  assert.match(claudeCSS, /--fontara-claude-anthropic-sans-ui-fallback/)
  assert.match(claudeCSS, /--fontara-claude-anthropic-serif-display-fallback/)
  assert.match(claudeCSS, /\.cds-root\[data-font\],/)
  assert.match(claudeCSS, /\.font-sans/)
  assert.match(claudeCSS, /\.font-base,/)
  assert.match(claudeCSS, /\.sm\\:font-base,/)
  assert.match(claudeCSS, /\.font-display/)
  assert.doesNotMatch(claudeCSS, /Anthropicons-Variable/)
  assert.doesNotMatch(claudeCSS, /button#_r_/)
  assert.doesNotMatch(claudeCSS, /body \*/)
  assert.doesNotMatch(
    claudeCSS,
    /--fontara-claude-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Copilot custom CSS is driven by matched-selector JSON", () => {
  const copilotCSS = readSource("assets/styles/copilot.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/copilot\.microsoft\.com"/)
  assert.match(sitesSource, /siteName: "Copilot"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Copilot"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /copilot\.css/)
  assert.match(siteFixesSource, /"https:\/\/copilot\.microsoft\.com": copilot/)
  assert.match(copilotCSS, /--fontara-copilot-ginto-ui-fallback/)
  assert.match(copilotCSS, /body,/)
  assert.match(copilotCSS, /html,/)
  assert.match(copilotCSS, /html > body > textarea/)
  assert.match(copilotCSS, /Ginto/)
  assert.doesNotMatch(copilotCSS, /body \*/)
  assert.doesNotMatch(copilotCSS, /\bfont:\s/)
  assert.doesNotMatch(
    copilotCSS,
    /--fontara-copilot-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("DeepSeek custom CSS is driven by matched-selector JSON", () => {
  const deepseekCSS = readSource("assets/styles/deepseek.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/chat\.deepseek\.com"/)
  assert.match(sitesSource, /siteName: "DeepSeek"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "DeepSeek"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /deepseek\.css/)
  assert.match(siteFixesSource, /"https:\/\/chat\.deepseek\.com": deepseek/)
  assert.match(deepseekCSS, /--fontara-deepseek-app-ui-fallback/)
  assert.match(deepseekCSS, /\._9986c0c \.d00ed9c9,/)
  assert.match(deepseekCSS, /\.ds-markdown,/)
  assert.match(deepseekCSS, /\.e37a04e4,/)
  assert.match(deepseekCSS, /body \{/)
  assert.match(deepseekCSS, /quote-cjk-patch/)
  assert.doesNotMatch(deepseekCSS, /body \*/)
  assert.doesNotMatch(deepseekCSS, /\bfont:\s/)
  assert.doesNotMatch(
    deepseekCSS,
    /--fontara-deepseek-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Perplexity custom CSS is driven by matched-selector JSON", () => {
  const perplexityCSS = readSource("assets/styles/perplexity.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.perplexity\.ai"/)
  assert.match(sitesSource, /siteName: "Perplexity"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Perplexity"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /perplexity\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.perplexity\.ai": perplexity/)
  assert.match(perplexityCSS, /--fontara-perplexity-sans-ui-fallback/)
  assert.match(perplexityCSS, /--fontara-perplexity-serif-answer-fallback/)
  assert.match(perplexityCSS, /\.font-sans,/)
  assert.match(perplexityCSS, /\.reset,/)
  assert.match(perplexityCSS, /html \{/)
  assert.match(perplexityCSS, /html\[data-answer-font="serif"\] \.prose/)
  assert.match(perplexityCSS, /pplxSans/)
  assert.match(perplexityCSS, /pplxSerif/)
  assert.doesNotMatch(perplexityCSS, /body \*/)
  assert.doesNotMatch(perplexityCSS, /\bfont:\s/)
  assert.doesNotMatch(
    perplexityCSS,
    /--fontara-perplexity-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Poe custom CSS is driven by matched-selector JSON", () => {
  const poeCSS = readSource("assets/styles/poe.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/poe\.com"/)
  assert.match(sitesSource, /siteName: "Poe"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Poe"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /poe\.css/)
  assert.match(siteFixesSource, /"https:\/\/poe\.com": poe/)
  assert.match(poeCSS, /--fontara-poe-system-ui-fallback/)
  assert.match(
    poeCSS,
    /\[class\*="BotDescriptionDisclaimerSection_disclaimerText__"\],/
  )
  assert.match(poeCSS, /\[class\*="CommandButton_command_action__"\],/)
  assert.match(poeCSS, /\[class\*="Prose_prose__"\],/)
  assert.match(poeCSS, /\[class\*="Tag_tag__"\],/)
  assert.match(poeCSS, /body \{/)
  assert.match(poeCSS, /Oxygen-Sans/)
  assert.doesNotMatch(poeCSS, /__yEe8h/)
  assert.doesNotMatch(poeCSS, /__W3oqt/)
  assert.doesNotMatch(poeCSS, /__qKIED/)
  assert.doesNotMatch(poeCSS, /__H2JH6/)
  assert.doesNotMatch(poeCSS, /\.[A-Za-z][A-Za-z0-9_-]+__[A-Za-z0-9_-]+/)
  assert.doesNotMatch(poeCSS, /body \*/)
  assert.doesNotMatch(poeCSS, /\bfont:\s/)
  assert.doesNotMatch(
    poeCSS,
    /--fontara-poe-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("OpenRouter custom CSS is driven by matched-selector JSON", () => {
  const openRouterCSS = readSource("assets/styles/openrouter.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/openrouter\.ai"/)
  assert.match(sitesSource, /siteName: "OpenRouter"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "OpenRouter"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /openrouter\.css/)
  assert.match(siteFixesSource, /"https:\/\/openrouter\.ai": openrouter/)
  assert.match(openRouterCSS, /--fontara-openrouter-inter-ui-fallback/)
  assert.match(openRouterCSS, /--fontara-openrouter-inter-root-fallback/)
  assert.match(openRouterCSS, /--fontara-openrouter-monospace-fallback/)
  assert.match(openRouterCSS, /\.font-sans,/)
  assert.match(openRouterCSS, /body \{/)
  assert.match(openRouterCSS, /html \{/)
  assert.match(openRouterCSS, /kbd \{/)
  assert.match(openRouterCSS, /Inter Fallback/)
  assert.match(openRouterCSS, /SFMono-Regular/)
  assert.doesNotMatch(openRouterCSS, /body \*/)
  assert.doesNotMatch(openRouterCSS, /\bfont:\s/)
  assert.doesNotMatch(
    openRouterCSS,
    /--fontara-openrouter-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("NotebookLM custom CSS is driven by matched-selector JSON", () => {
  const notebookLMCSS = readSource("assets/styles/notebooklm.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/notebooklm\.google\.com"/)
  assert.match(sitesSource, /siteName: "NotebookLM"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "NotebookLM"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /notebooklm\.css/)
  assert.match(
    siteFixesSource,
    /"https:\/\/notebooklm\.google\.com": notebooklm/
  )
  assert.match(notebookLMCSS, /--fontara-notebooklm-google-sans-text-fallback/)
  assert.match(
    notebookLMCSS,
    /--fontara-notebooklm-google-sans-emoji-picker-fallback/
  )
  assert.match(
    notebookLMCSS,
    /--fontara-notebooklm-google-sans-text-ui-fallback/
  )
  assert.match(
    notebookLMCSS,
    /--fontara-notebooklm-google-sans-display-fallback/
  )
  assert.match(notebookLMCSS, /\.date-separator,/)
  assert.match(notebookLMCSS, /\.query-box-input \{/)
  assert.match(
    notebookLMCSS,
    /\.xap-emoji-keyboard \.emoji-keyboard__search-text/
  )
  assert.match(notebookLMCSS, /\.gb_Eb,/)
  assert.match(notebookLMCSS, /\.mat-headline-medium,/)
  assert.doesNotMatch(notebookLMCSS, /Google Symbols/)
  assert.doesNotMatch(notebookLMCSS, /\.google-symbols/)
  assert.doesNotMatch(notebookLMCSS, /\[_ngcontent-ng-c\d+\]/)
  assert.doesNotMatch(notebookLMCSS, /\[_nghost-ng-c\d+\]/)
  assert.doesNotMatch(notebookLMCSS, /body \*/)
  assert.doesNotMatch(notebookLMCSS, /\bfont:\s/)
  assert.doesNotMatch(
    notebookLMCSS,
    /--fontara-notebooklm-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Qwen custom CSS is driven by matched-selector JSON", () => {
  const qwenCSS = readSource("assets/styles/qwen.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/chat\.qwen\.ai"/)
  assert.match(sitesSource, /siteName: "Qwen"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Qwen"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /qwen\.css/)
  assert.match(siteFixesSource, /"https:\/\/chat\.qwen\.ai": qwen/)
  assert.match(qwenCSS, /--fontara-qwen-ant-ui-fallback/)
  assert.match(qwenCSS, /--fontara-qwen-app-ui-fallback/)
  assert.match(qwenCSS, /:where\(\.css-mncuj7\)\.ant-select,/)
  assert.match(qwenCSS, /:where\(\.css-mncuj7\)\[class\^="ant-select"\]/)
  assert.match(qwenCSS, /\.app,/)
  assert.match(qwenCSS, /\.qwen-thinking-selector/)
  assert.match(qwenCSS, /body \{/)
  assert.match(qwenCSS, /NotoSansHans/)
  assert.doesNotMatch(qwenCSS, /body \*/)
  assert.doesNotMatch(qwenCSS, /\bfont:\s/)
  assert.doesNotMatch(
    qwenCSS,
    /--fontara-qwen-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("X uses site CSS instead of streaming DOM writes", () => {
  const xCSS = readSource("assets/styles/x.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/x\.com"/)
  assert.match(sitesSource, /siteName: "X"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "X"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /x\.css/)
  assert.match(siteFixesSource, /"https:\/\/x\.com": x/)
  assert.match(xCSS, /body \*/)
  assert.match(xCSS, /--fontara-x-fallback/)
  assert.match(xCSS, /--fontara-x-monospace/)
  assert.match(xCSS, /\.css-146c3p1/)
  assert.match(xCSS, /\.css-1jxf684/)
  assert.match(xCSS, /\.r-poiln3/)
})

test("Instagram custom CSS is driven by matched-selector JSON", () => {
  const instagramCSS = readSource("assets/styles/instagram.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.instagram\.com"/)
  assert.match(sitesSource, /siteName: "Instagram"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Instagram"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /instagram\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.instagram\.com": instagram/)
  assert.match(instagramCSS, /--fontara-instagram-system-ui-fallback/)
  assert.match(instagramCSS, /--fontara-instagram-sfns-text-fallback/)
  assert.match(instagramCSS, /--fontara-instagram-helvetica-ui-fallback/)
  assert.match(instagramCSS, /\._ap3a,/)
  assert.match(instagramCSS, /\._ar45,/)
  assert.match(instagramCSS, /\.x1i0vuye,/)
  assert.match(instagramCSS, /body button,/)
  assert.match(instagramCSS, /\.x1n0sxbx/)
  assert.match(instagramCSS, /select \{/)
  assert.doesNotMatch(instagramCSS, /body \*/)
  assert.doesNotMatch(instagramCSS, /\[role=/)
  assert.doesNotMatch(
    instagramCSS,
    /--fontara-instagram-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("AI Studio custom CSS is driven by matched-selector JSON", () => {
  const aiStudioCSS = readSource("assets/styles/aistudio.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/aistudio\.google\.com"/)
  assert.match(sitesSource, /siteName: "AI Studio"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "AI Studio"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /aistudio\.css/)
  assert.match(siteFixesSource, /"https:\/\/aistudio\.google\.com": aistudio/)
  assert.match(aiStudioCSS, /--fontara-aistudio-inter-ui-fallback/)
  assert.match(aiStudioCSS, /:root \.light-theme \.mat-mdc-select/)
  assert.match(aiStudioCSS, /\.account-switcher-container/)
  assert.match(aiStudioCSS, /\.main-text,/)
  assert.match(aiStudioCSS, /\[ms-button\],/)
  assert.match(aiStudioCSS, /ms-cmark-node p,/)
  assert.match(aiStudioCSS, /textarea \{/)
  assert.doesNotMatch(aiStudioCSS, /Google Symbols/)
  assert.doesNotMatch(aiStudioCSS, /material-symbols-outlined/)
  assert.doesNotMatch(aiStudioCSS, /\[_ngcontent-ng-c\d+\]/)
  assert.doesNotMatch(aiStudioCSS, /\[_nghost-ng-c\d+\]/)
  assert.doesNotMatch(aiStudioCSS, /body \*/)
  assert.doesNotMatch(
    aiStudioCSS,
    /--fontara-aistudio-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Gemini custom CSS uses a semantic text whitelist", () => {
  const geminiCSS = readSource("assets/styles/gemini.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/gemini\.google\.com"/)
  assert.match(sitesSource, /siteName: "Gemini"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Gemini"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /gemini\.css/)
  assert.match(siteFixesSource, /"https:\/\/gemini\.google\.com": gemini/)
  assert.match(geminiCSS, /--fontara-gemini-google-sans-flex-ui-fallback/)
  assert.match(geminiCSS, /body :where\(/)
  assert.match(geminiCSS, /h1, h2, h3, h4, h5, h6/)
  assert.match(geminiCSS, /\[role="tab"\]/)
  assert.match(geminiCSS, /\[class\*="icon" i\]/)
  assert.match(geminiCSS, /code, code \*/)
  assert.match(geminiCSS, /kbd, samp/)
  assert.doesNotMatch(geminiCSS, /body \*/)
  assert.doesNotMatch(geminiCSS, /--fontara-gemini-roboto-ui-fallback/)
  assert.doesNotMatch(
    geminiCSS,
    /--fontara-gemini-material-text-button-fallback/
  )
  assert.doesNotMatch(geminiCSS, /--fontara-gemini-gds-body-l-fallback/)
  assert.doesNotMatch(
    geminiCSS,
    /--fontara-gemini-actions-menu-button-wrapper-fallback/
  )
  assert.doesNotMatch(geminiCSS, /\[_ngcontent-ng-c\d+\]/)
  assert.doesNotMatch(geminiCSS, /\[_nghost-ng-c\d+\]/)
  assert.doesNotMatch(geminiCSS, /--fontara-gemini-google-symbols-fallback/)
  assert.doesNotMatch(geminiCSS, /--fontara-gemini-lumi-symbols-fallback/)
  assert.doesNotMatch(geminiCSS, /\.google-symbols/)
  assert.doesNotMatch(geminiCSS, /\.lumi-symbols/)
  assert.doesNotMatch(geminiCSS, /mat-icon\.lm-icon-l/)
  assert.doesNotMatch(geminiCSS, /mat-icon\.lm-icon-m/)
  assert.doesNotMatch(geminiCSS, /mat-icon\.lm-icon-s/)
  assert.doesNotMatch(geminiCSS, /\.gds-body-l/)
  assert.doesNotMatch(geminiCSS, /\.actions-container-v2/)
  assert.doesNotMatch(geminiCSS, /\.markdown-main-panel/)
  assert.doesNotMatch(geminiCSS, /\.markdown,/)
  assert.doesNotMatch(geminiCSS, /\.ql-container/)
  assert.doesNotMatch(geminiCSS, /rich-textarea \.ql-editor\.ql-blank::before/)
  assert.doesNotMatch(geminiCSS, /\.mat-mdc-button/)
  assert.doesNotMatch(geminiCSS, /\.mdc-list-item__primary-text/)
  assert.doesNotMatch(geminiCSS, /\.markdown h3/)
  assert.doesNotMatch(geminiCSS, /\.mat-mdc-button:not/)
  assert.doesNotMatch(geminiCSS, /mat-action-list button/)
  assert.doesNotMatch(geminiCSS, /\bsvg\b/)
  assert.doesNotMatch(geminiCSS, /\bcanvas\b/)
  assert.doesNotMatch(geminiCSS, /\.ql-editor \*/)
  assert.doesNotMatch(geminiCSS, /\.text-input-field \*/)
  assert.doesNotMatch(geminiCSS, /\.markdown \*/)
  assert.doesNotMatch(geminiCSS, /\.response-container \*/)
  assert.doesNotMatch(geminiCSS, /\.single-draft-response-container \*/)
})

test("LinkedIn custom CSS is driven by matched-selector JSON", () => {
  const linkedinCSS = readSource("assets/styles/linkedin.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.linkedin\.com"/)
  assert.match(sitesSource, /siteName: "LinkedIn"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "LinkedIn"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /linkedin\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.linkedin\.com": linkedin/)
  assert.match(linkedinCSS, /--fontara-linkedin-reset-sans-fallback/)
  assert.match(linkedinCSS, /--fontara-linkedin-app-ui-fallback/)
  assert.match(linkedinCSS, /--fontara-linkedin-artdeco-ui-fallback/)
  assert.match(linkedinCSS, /:host/)
  assert.match(linkedinCSS, /--artdeco-reset-typography-font-family-sans/)
  assert.match(linkedinCSS, /:lang\(en\)/)
  assert.match(linkedinCSS, /\._38c8bff9/)
  assert.match(linkedinCSS, /\.artdeco-modal__header h2/)
  assert.match(linkedinCSS, /\.ql-container/)
  assert.doesNotMatch(linkedinCSS, /body \*/)
  assert.doesNotMatch(linkedinCSS, /--fontara-linkedin-host-fallback/)
  assert.doesNotMatch(linkedinCSS, /--fontara-linkedin-body-fallback/)
  assert.doesNotMatch(linkedinCSS, /--fontara-linkedin-monospace/)
  assert.doesNotMatch(linkedinCSS, /\[role="button"\]/)
  assert.doesNotMatch(linkedinCSS, /\[contenteditable="true"\]/)
  assert.doesNotMatch(linkedinCSS, /\bbutton,\b/)
  assert.doesNotMatch(linkedinCSS, /\binput,\b/)
})

test("Gmail custom CSS is driven by matched-selector JSON", () => {
  const gmailCSS = readSource("assets/styles/gmail.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/mail\.google\.com"/)
  assert.match(sitesSource, /siteName: "Gmail"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Gmail"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /gmail\.css/)
  assert.match(siteFixesSource, /"https:\/\/mail\.google\.com": gmail/)
  assert.match(gmailCSS, /--fontara-gmail-message-body-fallback/)
  assert.match(gmailCSS, /--fontara-gmail-google-sans-ui-fallback/)
  assert.match(gmailCSS, /--fontara-gmail-arial-ui-fallback/)
  assert.match(gmailCSS, /\.a3s/)
  assert.match(gmailCSS, /\.FOBRw-anl/)
  assert.match(gmailCSS, /\.zA > \.a4W/)
  assert.match(gmailCSS, /#loading/)
  assert.match(gmailCSS, /body,/)
  assert.match(gmailCSS, /button,/)
  assert.match(gmailCSS, /input \{/)
  assert.doesNotMatch(gmailCSS, /body \*/)
  assert.doesNotMatch(gmailCSS, /--fontara-gmail-amh-dj-fallback/)
  assert.doesNotMatch(gmailCSS, /--fontara-gmail-gb-eb-fallback/)
  assert.doesNotMatch(gmailCSS, /\[role=/)
  assert.doesNotMatch(gmailCSS, /#\\:/)
  assert.doesNotMatch(gmailCSS, /div#m_/)
  assert.doesNotMatch(
    gmailCSS,
    /--fontara-gmail-[^:]+-fallback:[^;]*var\(--fontara-font\)/
  )
})

test("Google custom CSS uses semantic selectors from JSON HTML evidence", () => {
  const googleCSS = readSource("assets/styles/google.css")
  const siteFixesSource = readSource("src/config/site-fixes.ts")
  const sitesSource = readSource("src/config/sites.ts")

  assert.match(sitesSource, /url: "https:\/\/www\.google\.com"/)
  assert.match(sitesSource, /siteName: "Google"[\s\S]*customCss: true/)
  assert.match(sitesSource, /siteName: "Google"[\s\S]*version: "4\.2\.1"/)
  assert.match(siteFixesSource, /google\.css/)
  assert.match(siteFixesSource, /"https:\/\/www\.google\.com": google/)
  assert.match(googleCSS, /--fontara-google-sans-ui-fallback/)
  assert.match(googleCSS, /--fontara-google-arial-ui-fallback/)
  assert.match(
    googleCSS,
    /html\[itemtype="http:\/\/schema\.org\/SearchResultsPage"\]/
  )
  assert.match(googleCSS, /body#gsr/)
  assert.match(googleCSS, /body#gsr form#tsf/)
  assert.match(googleCSS, /body#gsr form#tsf textarea\[name="q"\]/)
  assert.match(googleCSS, /body#gsr #rso/)
  assert.match(googleCSS, /body#gsr #bres/)
  assert.match(googleCSS, /body#gsr #hdtb/)
  assert.match(googleCSS, /body#gsr \[role="button"\]/)
  assert.match(googleCSS, /body#gsr \[role="option"\]/)
  assert.doesNotMatch(googleCSS, /body \*/)
  assert.doesNotMatch(googleCSS, /div#eKIzJc/)
  assert.doesNotMatch(googleCSS, /nth-of-type/)
  assert.doesNotMatch(googleCSS, /--fontara-google-token-/)
  assert.doesNotMatch(googleCSS, /(^|[\s,>+~])\.[A-Za-z][A-Za-z0-9_-]{2,}/m)
  assert.doesNotMatch(
    googleCSS,
    /--fontara-google-[^:]+-fallback:[^;]*var\(--fontara-font\)/
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
