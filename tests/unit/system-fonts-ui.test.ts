import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

function readSource(path: string): string {
  return fs.readFileSync(path, "utf8")
}

test("disabling system fonts preserves dormant global and per-site selections", () => {
  const optionsSource = readSource("src/ui/options/index.tsx")
  const handlerStart = optionsSource.indexOf("const handleSystemFontsToggle")
  const handlerEnd = optionsSource.indexOf(
    "const handleGoogleFontsToggle",
    handlerStart
  )
  const handler = optionsSource.slice(handlerStart, handlerEnd)

  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart)
  assert.match(handler, /setSystemFontsEnabled\(false\)/)
  assert.doesNotMatch(handler, /STORAGE_KEYS\.SELECTED_FONT/)
  assert.doesNotMatch(handler, /STORAGE_KEYS\.SITE_PROFILES/)
})

test("system font intent is saved before a temporary fontSettings load error", () => {
  const optionsSource = readSource("src/ui/options/index.tsx")
  const handlerStart = optionsSource.indexOf("const handleSystemFontsToggle")
  const handlerEnd = optionsSource.indexOf(
    "const handleGoogleFontsToggle",
    handlerStart
  )
  const handler = optionsSource.slice(handlerStart, handlerEnd)

  assert.ok(
    handler.indexOf("setSystemFontsEnabled(true)") <
      handler.indexOf("loadSystemFonts({ forceRefresh: true })")
  )
  assert.match(handler, /state\.status === "error"/)
})

test("popup removes the complete system-font group while the option is off", () => {
  const selectorSource = readSource("src/ui/components/FontSelector.tsx")
  const perSiteSource = readSource("src/ui/components/PerSiteSettings.tsx")

  assert.match(
    selectorSource,
    /if \(!systemFontsEnabled\) \{[\s\S]*setSystemFonts\(\[\]\)/
  )
  assert.match(selectorSource, /systemFontsEnabled && systemFontsLoading/)
  assert.match(
    perSiteSource,
    /if \(!systemFontsEnabled \|\| !drawerOpen\) \{[\s\S]*setSystemFonts\(\[\]\)/
  )
  assert.match(perSiteSource, /group\.options\.length > 0/)
})

test("system font failures expose an actionable retry and preserve fallback labels", () => {
  const selectorSource = readSource("src/ui/components/FontSelector.tsx")
  const optionsSource = readSource("src/ui/options/index.tsx")
  const perSiteSource = readSource("src/ui/components/PerSiteSettings.tsx")

  assert.match(selectorSource, /fontSelector\.systemRetry/)
  assert.match(selectorSource, /refreshSystemFonts\(true\)/)
  assert.match(selectorSource, /fontSelector\.sourcePaused/)
  assert.match(selectorSource, /fontSelector\.sourceUnavailable/)
  assert.match(optionsSource, /fontSelector\.sourcePaused/)
  assert.match(optionsSource, /fontSelector\.sourceUnavailable/)
  assert.match(perSiteSource, /fontSelector\.sourcePaused/)
  assert.match(perSiteSource, /fontSelector\.sourceUnavailable/)
})
