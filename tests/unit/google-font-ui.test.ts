import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

function readSource(filePath: string): string {
  return fs.readFileSync(filePath, "utf8")
}

test("Firefox consent is requested directly from the Google Fonts toggle gesture", () => {
  const source = readSource("src/ui/options/index.tsx")
  const start = source.indexOf("const handleGoogleFontsToggle")
  const end = source.indexOf("const handleClearGoogleFontCache", start)
  const handler = source.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.doesNotMatch(handler, /await getGoogleFontDataConsentState\(\)/)
  assert.ok(
    handler.indexOf("requestGoogleFontNetworkConsent()") <
      handler.lastIndexOf("setGoogleFontsEnabled(true)")
  )
  assert.match(handler, /options\.toast\.googleFontsConsentDenied/)
  assert.match(handler, /googleFontConsentState === "unsupported"/)
})

test("global and per-site Google choices commit only after preparation", () => {
  const selector = readSource("src/ui/components/FontSelector.tsx")
  const popupPerSite = readSource("src/ui/components/PerSiteSettings.tsx")
  const options = readSource("src/ui/options/index.tsx")

  const selectorHandler = selector.slice(
    selector.indexOf("const handleFontSelect"),
    selector.indexOf("const selectedFontItem")
  )
  assert.ok(
    selectorHandler.indexOf("prepareGoogleFont(fontValue)") <
      selectorHandler.indexOf("setSelectedFont(fontValue)")
  )
  assert.match(selector, /fontSelector\.googleDownloading/)
  assert.match(selector, /fontSelector\.googleDownloadFailed/)
  assert.match(selector, /fontSelector\.googleRetry/)

  const popupHandler = popupPerSite.slice(
    popupPerSite.indexOf("const selectPerSiteFont"),
    popupPerSite.indexOf("const handleFontChange")
  )
  assert.ok(
    popupHandler.indexOf("prepareGoogleFont(nextFont)") <
      popupHandler.indexOf("saveProfilePatch")
  )

  const optionsHandler = options.slice(
    options.indexOf("const handleSaveSiteProfile"),
    options.indexOf("const handleSiteProfileEnabledToggle")
  )
  assert.ok(
    optionsHandler.indexOf("prepareGoogleFont(siteProfileFontInput)") <
      optionsHandler.indexOf("fontaraConnector.changeSettings")
  )
})

test("Google cache controls expose stats and an explicit clear action", () => {
  const source = readSource("src/ui/options/index.tsx")

  assert.match(source, /getGoogleFontCacheStats\(\)/)
  assert.match(source, /clearGoogleFontCache\(\)/)
  assert.match(source, /options\.googleFonts\.cacheUsage/)
  assert.match(source, /options\.googleFonts\.clearCache/)
})
