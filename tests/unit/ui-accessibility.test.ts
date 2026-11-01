import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf8")
}

function getRelativeLuminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )

  assert.ok(channels)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function getContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

test("popup waits for extension data and semantically disables inactive controls", () => {
  const popupSource = readSource("src/ui/popup/index.tsx")
  const headerSource = readSource("src/ui/components/layout/Header.tsx")
  const footerSource = readSource("src/ui/components/layout/Footer.tsx")

  assert.match(popupSource, /useExtensionData\(\)/)
  assert.match(
    popupSource,
    /requestAnimationFrame\(\(\) => setUiReady\(true\)\)/
  )
  assert.match(popupSource, /<Skeleton/)
  assert.match(popupSource, /t\("common\.loading"\)/)
  assert.match(popupSource, /<fieldset[\s\S]*disabled=\{!extensionActive\}/)
  assert.match(popupSource, /aria-disabled=\{!extensionActive\}/)
  assert.doesNotMatch(popupSource, /"opacity-50 pointer-events-none"/)
  assert.match(headerSource, /disabled=\{disabled\}/)
  assert.match(headerSource, /aria-busy=\{disabled\}/)
  assert.doesNotMatch(footerSource, /opacity-30/)
})

test("options navigation exposes selection and closes its mobile sheet", () => {
  const optionsSource = readSource("src/ui/options/index.tsx")
  const sidebarSource = readSource("src/ui/components/ui/sidebar.tsx")

  assert.match(optionsSource, /role="tablist"/)
  assert.match(optionsSource, /role="tab"/)
  assert.match(optionsSource, /aria-selected=\{active\}/)
  assert.match(optionsSource, /aria-current=\{active \? "page" : undefined\}/)
  assert.match(optionsSource, /setOpenMobile\(false\)/)
  assert.match(optionsSource, /role="tabpanel"/)
  assert.match(optionsSource, /fontara-sites-tab-access/)
  assert.match(optionsSource, /fontara-sites-tab-profiles/)
  assert.match(optionsSource, /fontara-sites-tab-optimized/)
  assert.match(optionsSource, /<OptionsLoadingState/)
  assert.match(optionsSource, /options\.customFonts\.deleteTitle/)
  assert.match(optionsSource, /options\.customFonts\.deleteDescription/)
  assert.match(optionsSource, /options\.sidebar\.mobileTitle/)
  assert.match(optionsSource, /options\.sidebar\.mobileDescription/)
  assert.match(sidebarSource, /aria-expanded=\{isMobile \? openMobile : open\}/)
})

test("font choices, popular sites, shortcut editor, and toasts expose state", () => {
  const fontSelectorSource = readSource("src/ui/components/FontSelector.tsx")
  const perSiteSource = readSource("src/ui/components/PerSiteSettings.tsx")
  const popularSource = readSource("src/ui/components/PopularSection.tsx")
  const shortcutSource = readSource("src/ui/components/ShortcutControl.tsx")
  const dialogSource = readSource("src/ui/components/ui/dialog.tsx")
  const toasterSource = readSource("src/ui/components/ui/toaster.tsx")

  assert.match(fontSelectorSource, /aria-expanded=\{isOpen\}/)
  assert.match(fontSelectorSource, /role="listbox"/)
  assert.match(
    fontSelectorSource,
    /aria-selected=\{selectedFont === font\.value\}/
  )
  assert.match(fontSelectorSource, /fontSelector\.searchLabel/)
  assert.match(fontSelectorSource, /useIsMobile\(\)/)
  assert.match(fontSelectorSource, /<Dialog\b/)
  assert.match(fontSelectorSource, /<Drawer\b/)
  assert.match(fontSelectorSource, /closeLabel=\{t\("common\.close"\)\}/)
  assert.match(dialogSource, /\{closeLabel\}/)
  assert.match(perSiteSource, /aria-expanded=\{drawerOpen\}/)
  assert.match(perSiteSource, /fontara-per-site-settings-drawer/)
  assert.match(popularSource, /aria-pressed=\{active\}/)
  assert.match(popularSource, /popular\.disableSite/)
  assert.match(
    shortcutSource,
    /aria-pressed=\{isFirefox \? editing : undefined\}/
  )
  assert.match(shortcutSource, /isShortcutEditingExitKey\(event\.key\)/)
  assert.ok(
    shortcutSource.indexOf("if (!nextShortcut) return") <
      shortcutSource.indexOf("event.preventDefault()")
  )
  assert.match(toasterSource, /<ToastClose aria-label=\{t\("common\.close"\)\}/)
})

test("extension surfaces retain visible, contrasting scrollbars", () => {
  const skeletonSource = readSource("src/ui/components/ui/skeleton.tsx")
  const styleSource = readSource("src/style.css")

  assert.match(styleSource, /--sb-thumb-color: #64748b/)
  assert.match(styleSource, /scrollbar-width: thin/)
  assert.match(styleSource, /\*::-webkit-scrollbar-thumb/)
  assert.doesNotMatch(styleSource, /scrollbar-width: none/)
  assert.doesNotMatch(styleSource, /\*::-webkit-scrollbar[\s\S]{0,80}width: 0/)
  assert.match(skeletonSource, /motion-reduce:animate-none/)
})

test("UI text and interactive state colors meet their WCAG contrast targets", () => {
  assert.ok(getContrastRatio("#667085", "#ffffff") >= 4.5)
  assert.ok(getContrastRatio("#64748b", "#ffffff") >= 4.5)
  assert.ok(getContrastRatio("#175cd3", "#eaf2ff") >= 4.5)
  assert.ok(getContrastRatio("#64748b", "#eef2f7") >= 3)
  assert.ok(getContrastRatio("#059669", "#ffffff") >= 3)
})
