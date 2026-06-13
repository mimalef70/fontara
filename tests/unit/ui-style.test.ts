import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const require = createRequire(import.meta.url)

test("UI follows the selected extension font", () => {
  const tailwindConfig = require("../../tailwind.config.js") as {
    theme?: {
      extend?: {
        fontFamily?: Record<string, string[]>
      }
    }
  }
  const estedadFontFamily = tailwindConfig.theme?.extend?.fontFamily?.estedad
  const styleCSS = fs.readFileSync(path.resolve("src/style.css"), "utf8")
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )
  const fontSelectorSource = fs.readFileSync(
    path.resolve("src/ui/components/FontSelector.tsx"),
    "utf8"
  )

  assert.equal(
    estedadFontFamily?.[0],
    'var(--fontara-ui-font, "Vazirmatn-Fontara")'
  )
  assert.match(
    styleCSS,
    /font-family: var\(--fontara-ui-font, "Vazirmatn-Fontara"\)/
  )
  assert.match(
    styleCSS,
    /#root \* \{[\s\S]*font-family: var\(--fontara-ui-font, "Vazirmatn-Fontara"\)[\s\S]*!important;/
  )
  assert.match(popupSource, /useSelectedUIFont\(\)/)
  assert.match(optionsSource, /useSelectedUIFont\(\)/)
  assert.match(
    styleCSS,
    /#root \.fontara-font-preview \{[\s\S]*font-family: var\(--fontara-preview-font\)[\s\S]*!important;/
  )
  assert.match(fontSelectorSource, /"--fontara-preview-font"/)
  assert.match(fontSelectorSource, /fontSelector\.previewText/)
  assert.match(fontSelectorSource, /fontSelector\.previewTextLatin/)
  assert.match(fontSelectorSource, /shouldUseLatinFontPreview/)
  assert.match(fontSelectorSource, /subsets\.has\("latin"\)/)
  assert.match(fontSelectorSource, /fontSelector\.groupTitlePrefix/)
  assert.match(fontSelectorSource, /fontSelector\.systemGroup/)
  assert.match(fontSelectorSource, /from "react-window"/)
  assert.match(fontSelectorSource, /<List/)
  assert.match(fontSelectorSource, /rowComponent=\{FontListRow\}/)
  assert.match(fontSelectorSource, /rowCount=\{fontListRows\.length\}/)
  assert.match(fontSelectorSource, /style=\{\{ height: FONT_LIST_HEIGHT \}\}/)
  assert.match(
    fontSelectorSource,
    /style=\{\{ height: "100%", width: "100%" \}\}/
  )
  assert.match(fontSelectorSource, /getGoogleFontList\(\)/)
  assert.doesNotMatch(fontSelectorSource, /GOOGLE_FONT_SEARCH_RESULT_LIMIT/)
  assert.doesNotMatch(fontSelectorSource, /GOOGLE_FONT_RECOMMENDED_LIMIT/)
  assert.match(fontSelectorSource, /getSystemFontList/)
  assert.match(fontSelectorSource, /decodeSystemFontValue/)
  assert.match(fontSelectorSource, /getFontFamily/)
  assert.match(fontSelectorSource, /<DrawerContent dir=\{direction\}/)
  assert.match(fontSelectorSource, /isFontRowActive/)
  assert.match(fontSelectorSource, /RTL_TEXT_PATTERN/)
  assert.match(fontSelectorSource, /isFontNameRtl/)
  assert.match(
    fontSelectorSource,
    /grid-cols-\[1\.25rem_minmax\(0,1fr\)_minmax\(4\.5rem,7rem\)\]/
  )
  assert.match(
    fontSelectorSource,
    /grid-cols-\[minmax\(4\.5rem,7rem\)_minmax\(0,1fr\)_1\.25rem\]/
  )
  assert.doesNotMatch(
    fontSelectorSource,
    /fontara-font-preview[^\n]*mx-auto[^\n]*text-center/
  )
  assert.match(fontSelectorSource, /localizedName/)
  assert.match(fontSelectorSource, /localizedAuthor/)
  assert.match(fontSelectorSource, /getFontDisplayName/)
  assert.match(
    fontSelectorSource,
    /groupTitle = `\$\{t\("fontSelector\.groupTitlePrefix"\)\} \$\{author\}`/
  )
  assert.match(fontSelectorSource, /<h3[\s\S]*dir=\{direction\}/)
  assert.match(fontSelectorSource, /dir="auto"[\s\S]*\{fontName\}/)
  assert.match(fontSelectorSource, /dir="auto"[\s\S]*\{fontSampleText\}/)
})

test("drawer keeps focus out of aria-hidden popup content", () => {
  const drawerSource = fs.readFileSync(
    path.resolve("src/ui/components/ui/drawer.tsx"),
    "utf8"
  )

  assert.match(drawerSource, /autoFocus = true/)
  assert.match(drawerSource, /document\.getElementById\("root"\)/)
  assert.match(drawerSource, /container=\{container \?\? defaultContainer\}/)
})

test("extension pages render inside error boundaries", () => {
  const errorBoundarySource = fs.readFileSync(
    path.resolve("src/ui/components/ErrorBoundary.tsx"),
    "utf8"
  )
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )

  assert.match(errorBoundarySource, /componentDidCatch/)
  assert.match(errorBoundarySource, /getDerivedStateFromError/)
  assert.match(errorBoundarySource, /description: string/)
  assert.match(errorBoundarySource, /direction: TextDirection/)
  assert.match(popupSource, /<I18nProvider>/)
  assert.match(optionsSource, /<I18nProvider>/)
  assert.match(popupSource, /<ExtensionDataProvider>[\s\S]*<I18nProvider>/)
  assert.match(optionsSource, /<ExtensionDataProvider>[\s\S]*<I18nProvider>/)
  assert.match(popupSource, /waitForI18nBootstrap/)
  assert.match(optionsSource, /waitForI18nBootstrap/)
  assert.match(popupSource, /title=\{t\("popup\.errorTitle"\)\}/)
  assert.match(optionsSource, /title=\{t\("options\.errorTitle"\)\}/)
  assert.match(popupSource, /direction=\{direction\}/)
  assert.match(optionsSource, /direction=\{direction\}/)
})

test("extension pages bootstrap language direction before React renders", () => {
  const popupHTML = fs.readFileSync(
    path.resolve("src/ui/popup/index.html"),
    "utf8"
  )
  const optionsHTML = fs.readFileSync(
    path.resolve("src/ui/options/index.html"),
    "utf8"
  )
  const bootstrapSource = fs.readFileSync(
    path.resolve("src/ui/i18n/bootstrap.ts"),
    "utf8"
  )
  const i18nProviderSource = fs.readFileSync(
    path.resolve("src/ui/i18n/index.tsx"),
    "utf8"
  )

  assert.match(popupHTML, /<script src="\.\.\/i18n\/bootstrap\.js"><\/script>/)
  assert.match(
    optionsHTML,
    /<script src="\.\.\/i18n\/bootstrap\.js"><\/script>/
  )
  assert.match(bootstrapSource, /document\.documentElement\.dir/)
  assert.match(bootstrapSource, /chrome\.storage\.local\.get/)
  assert.match(bootstrapSource, /__FONTARA_I18N_BOOTSTRAP__/)
  assert.match(i18nProviderSource, /__FONTARA_INITIAL_I18N__/)
  assert.match(i18nProviderSource, /waitForI18nBootstrap/)
})

test("options page uses the local shadcn sidebar layout", () => {
  const agentsSource = fs.readFileSync(path.resolve("AGENTS.md"), "utf8")
  const componentsConfig = fs.readFileSync(
    path.resolve("components.json"),
    "utf8"
  )
  const packageSource = fs.readFileSync(path.resolve("package.json"), "utf8")
  const styleSource = fs.readFileSync(path.resolve("src/style.css"), "utf8")
  const tailwindSource = fs.readFileSync(
    path.resolve("tailwind.config.js"),
    "utf8"
  )
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )
  const sidebarSource = fs.readFileSync(
    path.resolve("src/ui/components/ui/sidebar.tsx"),
    "utf8"
  )

  assert.match(agentsSource, /shadcn\/ui primitives/)
  assert.match(agentsSource, /pnpm dlx shadcn@latest add <component>/)
  assert.match(agentsSource, /src\/ui\/components\/ui/)
  assert.match(agentsSource, /DeepWiki/)
  assert.match(agentsSource, /shadcn RTL guidance/)
  assert.match(agentsSource, /text-start/)
  assert.match(componentsConfig, /"ui": "@\/ui\/components\/ui"/)
  assert.match(componentsConfig, /"hooks": "@\/ui\/hooks"/)
  assert.match(packageSource, /"@radix-ui\/react-dialog"/)
  assert.match(packageSource, /"@radix-ui\/react-alert-dialog"/)
  assert.match(packageSource, /"@radix-ui\/react-separator"/)
  assert.match(styleSource, /--sidebar-background/)
  assert.match(tailwindSource, /sidebar:\s*{[\s\S]*--sidebar-background/)
  assert.match(optionsSource, /from "..\/components\/ui\/sidebar"/)
  assert.match(optionsSource, /<SidebarProvider>/)
  assert.match(
    optionsSource,
    /<Sidebar collapsible="icon" dir=\{direction\} side=\{sidebarSide\}>/
  )
  assert.match(optionsSource, /direction === "rtl" \? "right" : "left"/)
  assert.match(optionsSource, /options\.nav\.general/)
  assert.match(optionsSource, /options\.nav\.fonts/)
  assert.match(optionsSource, /options\.nav\.sites/)
  assert.match(optionsSource, /options\.nav\.rtl/)
  assert.match(optionsSource, /options\.nav\.hotkeys/)
  assert.match(optionsSource, /options\.nav\.advanced/)
  assert.match(optionsSource, /languageOptions\.map/)
  assert.match(optionsSource, /RTL_SUPPORTED_SITES\.map/)
  assert.match(optionsSource, /STORAGE_KEYS\.RTL_ENABLED/)
  assert.match(optionsSource, /STORAGE_KEYS\.RTL_SITE_SETTINGS/)
  assert.match(optionsSource, /STORAGE_KEYS\.SYSTEM_FONTS_ENABLED/)
  assert.match(optionsSource, /STORAGE_KEYS\.GOOGLE_FONTS_ENABLED/)
  assert.match(optionsSource, /STORAGE_KEYS\.TEXT_STROKE/)
  assert.match(optionsSource, /STORAGE_KEYS\.ENABLED_BY_DEFAULT/)
  assert.match(optionsSource, /STORAGE_KEYS\.ENABLED_FOR/)
  assert.match(optionsSource, /STORAGE_KEYS\.DISABLED_FOR/)
  assert.match(optionsSource, /STORAGE_KEYS\.PINNED_WEBSITE_URLS/)
  assert.match(optionsSource, /STORAGE_KEYS\.SITE_PROFILES/)
  assert.match(optionsSource, /STORAGE_KEYS\.SYNC_SETTINGS/)
  assert.match(optionsSource, /STORAGE_KEYS\.CONTEXT_MENUS_ENABLED/)
  assert.match(optionsSource, /options\.systemFonts\.title/)
  assert.match(optionsSource, /options\.googleFonts\.title/)
  assert.match(optionsSource, /options\.googleFonts\.privacyNotice/)
  assert.match(optionsSource, /options\.textStroke\.title/)
  assert.match(optionsSource, /options\.siteList\.title/)
  assert.match(optionsSource, /options\.siteProfiles\.title/)
  assert.match(optionsSource, /SiteProfileTargetOption/)
  assert.match(optionsSource, /siteProfileTargetOptions/)
  assert.match(optionsSource, /new Map<string, SiteProfileTargetOption>/)
  assert.match(optionsSource, /siteProfileTargetOpen/)
  assert.match(optionsSource, /<Popover/)
  assert.match(optionsSource, /<CommandInput/)
  assert.match(optionsSource, /<CommandGroup/)
  assert.match(optionsSource, /fontara-site-profile-target-trigger/)
  assert.match(optionsSource, /fontara-site-profile-target-search/)
  assert.match(optionsSource, /fontara-site-profile-target-add/)
  assert.match(optionsSource, /options\.siteProfiles\.targetLabel/)
  assert.match(optionsSource, /STORAGE_KEYS\.SITE_PROFILES/)
  assert.doesNotMatch(optionsSource, /siteProfileRuleTargetOptions/)
  assert.doesNotMatch(optionsSource, /siteProfilePopularTargetOptions/)
  assert.doesNotMatch(optionsSource, /fontara-site-profile-patterns/)
  assert.doesNotMatch(optionsSource, /fontara-site-profile-advanced-toggle/)
  assert.match(optionsSource, /createSettingsBackup/)
  assert.match(optionsSource, /parseSettingsBackupText/)
  assert.match(optionsSource, /fontaraConnector\.changeSettings/)
  assert.match(optionsSource, /fontaraConnector\.importSettings/)
  assert.match(optionsSource, /fontaraConnector\.resetSettings/)
  assert.match(optionsSource, /FONTARA_SETTINGS_STORAGE_KEYS/)
  assert.match(
    optionsSource,
    /type="file"[\s\S]*accept="application\/json,\.json"/
  )
  assert.match(optionsSource, /options\.backup\.importWarningTitle/)
  assert.match(optionsSource, /options\.backup\.resetWarningTitle/)
  assert.match(optionsSource, /options\.sync\.title/)
  assert.match(optionsSource, /options\.sync\.customFontsExcluded/)
  assert.match(optionsSource, /handleSyncSettingsToggle/)
  assert.match(optionsSource, /options\.contextMenus\.title/)
  assert.match(optionsSource, /requestContextMenusPermission/)
  assert.match(optionsSource, /handleContextMenusToggle/)
  assert.match(optionsSource, /<HotkeysSettings \/>/)
  assert.match(optionsSource, /from "..\/components\/ui\/alert-dialog"/)
  assert.match(optionsSource, /<AlertDialog/)
  assert.match(optionsSource, /<AlertDialogContent dir=\{direction\}/)
  assert.match(optionsSource, /<AlertDialogAction/)
  assert.match(optionsSource, /options\.toast\.settingsImported/)
  assert.match(optionsSource, /options\.toast\.settingsExported/)
  assert.match(optionsSource, /options\.toast\.settingsReset/)
  assert.match(optionsSource, /options\.toast\.syncEnabled/)
  assert.match(optionsSource, /createSiteListPatternAddUpdate/)
  assert.match(optionsSource, /createWebsiteSiteListToggleUpdate/)
  assert.match(optionsSource, /upsertSiteProfile/)
  assert.match(optionsSource, /isSiteProfileEnabled/)
  assert.match(optionsSource, /handleSiteProfileEnabledToggle/)
  assert.match(optionsSource, /fontara-site-profile-enabled-/)
  assert.match(optionsSource, /options\.siteProfiles\.applyProfile/)
  assert.match(optionsSource, /options\.siteProfiles\.active/)
  assert.match(optionsSource, /options\.siteProfiles\.inactive/)
  assert.match(optionsSource, /removeSiteProfileFontOverrides/)
  assert.match(optionsSource, /normalizeSitePattern/)
  assert.match(optionsSource, /normalizeSiteProfiles/)
  assert.match(optionsSource, /isSiteListUrlEnabled/)
  assert.match(optionsSource, /isURLMatched/)
  assert.match(
    optionsSource,
    /const defaultWebsiteList = DEFAULT_VALUES\.WEBSITE_LIST/
  )
  assert.doesNotMatch(optionsSource, /effectiveWebsiteList/)
  assert.match(optionsSource, /normalizedSitePatternInput/)
  assert.match(optionsSource, /normalizeSitePatternForScope/)
  assert.match(optionsSource, /inferSitePatternScopeFromInput/)
  assert.match(optionsSource, /handleSitePatternInputChange/)
  assert.match(optionsSource, /getMatchingSiteListPattern/)
  assert.match(optionsSource, /getWebsiteCardPattern/)
  assert.match(optionsSource, /getWebsiteCardTitle/)
  assert.match(optionsSource, /getSitePatternScope/)
  assert.match(optionsSource, /<SiteScopeBadge/)
  assert.match(optionsSource, /<SiteModeBadge/)
  assert.match(optionsSource, /createCustomCssProbeUrl/)
  assert.match(optionsSource, /hasCustomCssForSitePattern/)
  assert.match(optionsSource, /normalizePinnedWebsiteUrls/)
  assert.match(optionsSource, /getPinnedWebsiteUrlsInitialValue/)
  assert.match(optionsSource, /handleWebsitePinToggle/)
  assert.match(optionsSource, /options\.sites\.pinToPopup/)
  assert.match(optionsSource, /options\.sites\.unpinFromPopup/)
  assert.match(optionsSource, /<Pin/)
  assert.match(optionsSource, /aria-pressed=\{pinned\}/)
  assert.match(optionsSource, /pinned && "fill-current"/)
  assert.doesNotMatch(optionsSource, /modeLabel/)
  assert.match(optionsSource, /websiteTitle/)
  assert.match(optionsSource, /sitePatternScopeOptions/)
  assert.match(optionsSource, /options\.siteList\.scopeDomain/)
  assert.match(optionsSource, /options\.siteList\.scopePath/)
  assert.match(optionsSource, /options\.siteList\.scopeRegex/)
  assert.match(optionsSource, /options\.siteList\.pathPlaceholder/)
  assert.match(optionsSource, /options\.siteList\.wildcardPlaceholder/)
  assert.match(optionsSource, /options\.siteList\.useCurrentDomain/)
  assert.match(optionsSource, /options\.siteList\.useCurrentPath/)
  assert.doesNotMatch(optionsSource, /fillSitePatternFromWebsite/)
  assert.doesNotMatch(optionsSource, /options\.siteList\.customizeRule/)
  assert.match(optionsSource, /getSettingsSectionFromHash/)
  assert.match(optionsSource, /window\.addEventListener\("hashchange"/)
  assert.match(optionsSource, /handleSectionChange\(item\.id\)/)
  assert.match(optionsSource, /aria-live="polite"/)
  assert.match(optionsSource, /options\.siteList\.previewExclude/)
  assert.match(optionsSource, /options\.siteList\.previewInclude/)
  assert.match(optionsSource, /options\.siteList\.previewInvalid/)
  assert.match(optionsSource, /getGoogleFontList/)
  assert.match(optionsSource, /getSystemFontList/)
  assert.match(optionsSource, /TEXT_STROKE_MIN/)
  assert.match(optionsSource, /TEXT_STROKE_MAX/)
  assert.match(optionsSource, /TEXT_STROKE_STEP/)
  assert.match(optionsSource, /type="range"/)
  assert.match(optionsSource, /languageOptions\.map/)
  assert.match(optionsSource, /dir=\{direction\}[\s\S]*aria-pressed=\{active\}/)
  assert.doesNotMatch(optionsSource, /getLanguageOptionDirection/)
  assert.match(optionsSource, /<SidebarMenuButton/)
  assert.match(optionsSource, /<SidebarInset>/)
  assert.match(
    optionsSource,
    /<header className="[^"]*gap-3[\s\S]*<SidebarTrigger className="shrink-0" \/>[\s\S]*<h2/
  )
  assert.match(sidebarSource, /const SidebarProvider = React\.forwardRef/)
  assert.match(sidebarSource, /const SidebarTrigger = React\.forwardRef/)
  assert.match(sidebarSource, /children,\s+dir,\s+\.\.\.props/)
  assert.match(sidebarSource, /<SheetContent\s+dir={dir}/)
  assert.match(sidebarSource, /data-\[side=right\]:right-0/)
  assert.match(sidebarSource, /after:start-1\/2/)
  assert.match(sidebarSource, /<PanelLeft className="rtl:rotate-180" \/>/)
  assert.match(sidebarSource, /text-start/)
  assert.match(
    sidebarSource,
    /group-has-\[\[data-sidebar=menu-action\]\]\/menu-item:pe-8/
  )
  assert.match(sidebarSource, /absolute end-1/)
  assert.match(sidebarSource, /from "\.\/sheet"/)
  assert.match(sidebarSource, /from "\.\/separator"/)
  assert.match(sidebarSource, /from "\.\/input"/)
  assert.match(sidebarSource, /from "\.\/skeleton"/)
  assert.match(sidebarSource, /from "\.\.\/\.\.\/hooks\/use-mobile"/)
  assert.match(sidebarSource, /SidebarMenuAction/)
  assert.match(sidebarSource, /SidebarSeparator/)
  assert.match(sidebarSource, /w-\(--sidebar-width\)/)
  assert.doesNotMatch(sidebarSource, /w-\[var\(--sidebar-width\)\]/)
  assert.doesNotMatch(sidebarSource, /w-\[--sidebar-width/)
  assert.doesNotMatch(sidebarSource, /after:left-1\/2/)
  assert.doesNotMatch(sidebarSource, /text-left/)
  assert.doesNotMatch(sidebarSource, /menu-item:pr-8/)
})

test("options page exposes extension hotkey controls", () => {
  const hotkeysSource = fs.readFileSync(
    path.resolve("src/ui/components/HotkeysSettings.tsx"),
    "utf8"
  )
  const shortcutSource = fs.readFileSync(
    path.resolve("src/ui/components/ShortcutControl.tsx"),
    "utf8"
  )
  const backgroundSource = fs.readFileSync(
    path.resolve("src/background/command-manager.ts"),
    "utf8"
  )
  const extensionDataHookSource = fs.readFileSync(
    path.resolve("src/ui/hooks/use-extension-data.ts"),
    "utf8"
  )
  const commandSettingsSource = fs.readFileSync(
    path.resolve("src/background/command-settings.ts"),
    "utf8"
  )
  const customUrlToggleSource = fs.readFileSync(
    path.resolve("src/ui/components/CustomUrlToggle.tsx"),
    "utf8"
  )
  const extensionSource = fs.readFileSync(
    path.resolve("src/background/extension.ts"),
    "utf8"
  )
  const extensionDataSource = fs.readFileSync(
    path.resolve("src/background/extension-data.ts"),
    "utf8"
  )
  const iconManagerSource = fs.readFileSync(
    path.resolve("src/background/icon-manager.ts"),
    "utf8"
  )

  assert.match(hotkeysSource, /chrome\.commands\.getAll/)
  assert.match(hotkeysSource, /commandName: "toggle"/)
  assert.match(hotkeysSource, /commandName: "addSite"/)
  assert.match(hotkeysSource, /defaultShortcut: "Alt\+Shift\+F"/)
  assert.match(hotkeysSource, /defaultShortcut: "Alt\+Shift\+S"/)
  assert.match(hotkeysSource, /options\.hotkeys\.defaultLabel/)
  assert.match(hotkeysSource, /options\.hotkeys\.missingDefaultHint/)
  assert.match(shortcutSource, /browser\.commands\.update/)
  assert.match(shortcutSource, /browser\.commands\.getAll/)
  assert.match(shortcutSource, /formatShortcutForDisplay/)
  assert.match(shortcutSource, /⌥/)
  assert.match(shortcutSource, /⇧/)
  assert.match(shortcutSource, /chrome:\/\/extensions\/configureCommands/)
  assert.match(shortcutSource, /edge:\/\/extensions\/shortcuts/)
  assert.match(backgroundSource, /chrome\.commands/)
  assert.match(backgroundSource, /onCommand\.addListener/)
  assert.match(backgroundSource, /COMMAND_DEBOUNCE_DELAY_MS = 75/)
  assert.match(backgroundSource, /commandRunner\(command, details\)/)
  assert.doesNotMatch(backgroundSource, /getLocalValues/)
  assert.doesNotMatch(backgroundSource, /setLocalValues/)
  assert.doesNotMatch(backgroundSource, /createToggleCurrentSiteSettings/)
  assert.doesNotMatch(backgroundSource, /getCommandURL/)
  assert.doesNotMatch(backgroundSource, /createSiteListToggleUpdate/)
  assert.doesNotMatch(backgroundSource, /getMatchingWebsite/)
  assert.match(extensionSource, /createToggleCurrentSiteSettings/)
  assert.match(extensionSource, /getCommandURL/)
  assert.doesNotMatch(extensionSource, /createSiteListToggleUpdate/)
  assert.doesNotMatch(extensionSource, /getMatchingWebsite/)
  assert.match(commandSettingsSource, /createSiteListToggleUpdate/)
  assert.match(commandSettingsSource, /normalizeFontaraSiteManagerSettings/)
  assert.match(customUrlToggleSource, /from "\.\.\/\.\.\/config\/site-manager"/)
  assert.doesNotMatch(
    customUrlToggleSource,
    /getMatchingWebsite } from "\.\.\/\.\.\/utils\/url"/
  )
  assert.match(extensionDataSource, /collectActiveTabInfo/)
  assert.match(extensionDataSource, /getFontaraSiteActivationState/)
  assert.doesNotMatch(extensionDataSource, /getUrlActivationStateFromSettings/)
  assert.doesNotMatch(extensionDataSource, /isUrlActive/)
  assert.match(iconManagerSource, /getBackgroundSettings/)
  assert.match(iconManagerSource, /getFontaraSiteActivationState/)
  assert.doesNotMatch(iconManagerSource, /getUrlActivationStateFromSettings/)
  assert.doesNotMatch(iconManagerSource, /isUrlActive/)
  assert.doesNotMatch(iconManagerSource, /watchLocalStorage/)
  assert.match(extensionSource, /updateIconStatus\(data\.settings\)/)
  assert.match(
    extensionSource,
    /private static async publishSettingsChange\([\s\S]*?notifyContentScriptsAboutSettingsChange\(\s*settings\s*\)[\s\S]*?scheduleReportChanges\(\)/
  )
  assert.match(
    extensionSource,
    /private static async writeSettingsChange\([\s\S]*?const \{ settings: updatedSettings, syncSnapshot \} =[\s\S]*?writeBackgroundSettingsWithSyncSnapshot\(settings\)[\s\S]*?publishSettingsChange\(updatedSettings\)[\s\S]*?if \(options\.flushSync\)[\s\S]*?flushPendingSettingsSync\(syncSnapshot\)[\s\S]*?schedulePendingSettingsSync\(syncSnapshot\)/
  )
  assert.match(
    extensionSource,
    /const settings = await syncBackgroundSettingsCacheFromLocalChanges\(changes\)[\s\S]*?publishSettingsChange\(settings\)/
  )
  assert.match(
    extensionSource,
    /changeSettings[\s\S]*writeSettingsChange\(settings\)/
  )
  assert.match(
    extensionSource,
    /importSettings[\s\S]*writeSettingsChange\(normalizedBackup\.settings,\s*\{\s*flushSync: true\s*\}\)/
  )
  assert.match(
    extensionSource,
    /resetSettings[\s\S]*writeSettingsChange\(\s*await createSettingsResetValues\(\),\s*\{\s*flushSync: true\s*\}\s*\)/
  )
  assert.match(extensionDataHookSource, /ExtensionDataContext/)
  assert.match(extensionDataHookSource, /ExtensionDataProvider/)
  assert.match(extensionDataHookSource, /fontaraConnector\.subscribeToChanges/)
  assert.match(
    extensionDataHookSource,
    /fontaraConnector\.unsubscribeFromChanges/
  )
})

test("popup settings action opens the options page", () => {
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )

  assert.match(popupSource, /<FontSelector \/>[\s\S]*<TooltipProvider/)
  assert.match(popupSource, /flex flex-col gap-3 mb-3/)
  assert.match(popupSource, /<div dir=\{direction\}>[\s\S]*<PopularSection \/>/)
  assert.match(popupSource, /<RtlSiteToggle \/>/)
  assert.match(popupSource, /<PerSiteSettings \/>/)
  assert.match(popupSource, /<TextStrokeToggle \/>/)
  assert.doesNotMatch(popupSource, /direction: "rtl"/)
  assert.match(popupSource, /aria-label=\{t\("common\.settings"\)\}/)
  assert.match(
    popupSource,
    /onClick=\{\(\) => void openOptionsPageSafely\(\)\}/
  )
  assert.match(popupSource, /className="[^"]*size-\[3rem\]/)
  assert.match(popupSource, /<Settings className="size-5" \/>/)
  assert.doesNotMatch(popupSource, /section: "fonts"/)
  assert.doesNotMatch(popupSource, /popup\.manageFonts/)
  assert.doesNotMatch(popupSource, /<PlusCircle/)
  assert.doesNotMatch(popupSource, /popup\.addCustomFont/)
})

test("popup header uses a quieter version badge and green toggle", () => {
  const headerSource = fs.readFileSync(
    path.resolve("src/ui/components/layout/Header.tsx"),
    "utf8"
  )
  const switchSource = fs.readFileSync(
    path.resolve("src/ui/components/ui/Switch.tsx"),
    "utf8"
  )

  assert.match(headerSource, /!bg-gray-100/)
  assert.match(headerSource, /!text-\[9px\]/)
  assert.match(headerSource, /!text-gray-500/)
  assert.match(headerSource, /direction === "ltr" && "flex-row-reverse"/)
  assert.doesNotMatch(headerSource, /chrome\.tabs\.query/)
  assert.doesNotMatch(headerSource, /chrome\.tabs\.sendMessage/)
  assert.doesNotMatch(headerSource, /action: "toggle"/)
  assert.doesNotMatch(headerSource, /!bg-red-500/)
  assert.match(switchSource, /data-\[state=checked\]:bg-emerald-500/)
})

test("popup footer wraps localized credits cleanly", () => {
  const footerSource = fs.readFileSync(
    path.resolve("src/ui/components/layout/Footer.tsx"),
    "utf8"
  )

  assert.match(footerSource, /max-w-full/)
  assert.match(footerSource, /dir=\{direction\}/)
  assert.match(footerSource, /whitespace-nowrap/)
  assert.match(footerSource, /text-\[11px\]/)
  assert.match(footerSource, /text-center/)
  assert.match(footerSource, /shrink-0 text-\[#ff0000\]/)
})

test("checkbox and switch controls stay aligned in rtl layouts", () => {
  const switchSource = fs.readFileSync(
    path.resolve("src/ui/components/ui/Switch.tsx"),
    "utf8"
  )
  const customUrlToggleSource = fs.readFileSync(
    path.resolve("src/ui/components/CustomUrlToggle.tsx"),
    "utf8"
  )
  const popularSectionSource = fs.readFileSync(
    path.resolve("src/ui/components/PopularSection.tsx"),
    "utf8"
  )
  const perSiteSettingsSource = fs.readFileSync(
    path.resolve("src/ui/components/PerSiteSettings.tsx"),
    "utf8"
  )
  const rtlSiteToggleSource = fs.readFileSync(
    path.resolve("src/ui/components/RtlSiteToggle.tsx"),
    "utf8"
  )
  const textStrokeToggleSource = fs.readFileSync(
    path.resolve("src/ui/components/TextStrokeToggle.tsx"),
    "utf8"
  )

  assert.match(switchSource, /\(\{ className, dir = "ltr", \.\.\.props \}/)
  assert.match(switchSource, /dir=\{dir\}/)
  assert.match(
    switchSource,
    /data-\[state=checked\]:translate-x-5 data-\[state=unchecked\]:translate-x-0/
  )
  assert.match(switchSource, /data-\[state=unchecked\]:bg-slate-200/)
  assert.doesNotMatch(switchSource, /data-\[state=unchecked\]:bg-input/)
  assert.match(customUrlToggleSource, /className="peer sr-only"/)
  assert.match(customUrlToggleSource, /peer-focus-visible:ring-2/)
  assert.match(customUrlToggleSource, /className="relative shrink-0"/)
  assert.match(customUrlToggleSource, /const \{ direction, t \} = useI18n\(\)/)
  assert.match(customUrlToggleSource, /useExtensionData\(\)\?\.activeTab/)
  assert.doesNotMatch(customUrlToggleSource, /chrome\.tabs\.query/)
  assert.match(customUrlToggleSource, /const isRtl = direction === "rtl"/)
  assert.match(customUrlToggleSource, /dir=\{direction\}/)
  assert.match(
    customUrlToggleSource,
    /isRtl \? "justify-end" : "justify-start"/
  )
  assert.match(customUrlToggleSource, /!isRtl && checkboxControl/)
  assert.match(customUrlToggleSource, /isRtl && checkboxControl/)
  assert.match(customUrlToggleSource, /displayPattern =/)
  assert.match(customUrlToggleSource, /activePattern \?\? domainPattern/)
  assert.match(customUrlToggleSource, /max-w-\[12rem\]/)
  assert.match(
    customUrlToggleSource,
    /inline-flex min-w-0 max-w-full items-center justify-start gap-1/
  )
  assert.match(customUrlToggleSource, /dir="ltr"[\s\S]*<img[\s\S]*<bdi/)
  assert.match(
    customUrlToggleSource,
    /<bdi className="truncate" dir="ltr" title=\{displaySiteName\}>/
  )
  assert.match(customUrlToggleSource, /createSiteListToggleUpdate/)
  assert.match(customUrlToggleSource, /createSiteListPatternToggleUpdate/)
  assert.match(customUrlToggleSource, /createSitePathPatternFromUrl/)
  assert.match(customUrlToggleSource, /getMatchingSiteListPattern/)
  assert.match(customUrlToggleSource, /POPULAR_WEBSITES/)
  assert.match(
    customUrlToggleSource,
    /getMatchingWebsite\(currentUrl, POPULAR_WEBSITES\)/
  )
  assert.match(
    customUrlToggleSource,
    /!currentTab\?\.isSupported \|\| !currentUrl \|\| matchingPopularWebsite/
  )
  assert.match(customUrlToggleSource, /addSitePatternToList/)
  assert.match(customUrlToggleSource, /removeSitePatternFromList/)
  assert.match(customUrlToggleSource, /<DrawerContent dir=\{direction\}/)
  assert.match(customUrlToggleSource, /<SiteScopeBadge/)
  assert.match(customUrlToggleSource, /handleScopeChoice/)
  assert.match(customUrlToggleSource, /customUrl\.scopeDomainOption/)
  assert.match(customUrlToggleSource, /customUrl\.scopePathOption/)
  assert.match(customUrlToggleSource, /customUrl\.manageRules/)
  assert.match(
    customUrlToggleSource,
    /openOptionsPageSafely\(\{ section: "sites" \}\)/
  )
  assert.doesNotMatch(customUrlToggleSource, /MoreHorizontal/)
  assert.doesNotMatch(customUrlToggleSource, /overflow-y-hidden/)
  assert.match(popularSectionSource, /createWebsiteSiteListToggleUpdate/)
  assert.match(popularSectionSource, /STORAGE_KEYS\.PINNED_WEBSITE_URLS/)
  assert.match(popularSectionSource, /getPinnedWebsiteUrlsInitialValue/)
  assert.match(popularSectionSource, /normalizePinnedWebsiteUrls/)
  assert.match(popularSectionSource, /pinnedWebsites/)
  assert.doesNotMatch(popularSectionSource, /POPULAR_WEBSITES\.map/)
  assert.match(perSiteSettingsSource, /STORAGE_KEYS\.SITE_PROFILES/)
  assert.match(perSiteSettingsSource, /getMatchingSiteListPattern/)
  assert.match(perSiteSettingsSource, /getSiteProfileForUrl/)
  assert.match(perSiteSettingsSource, /includeDisabled: true/)
  assert.match(perSiteSettingsSource, /const appliedProfile = active/)
  assert.match(perSiteSettingsSource, /fallbackProfile/)
  assert.match(perSiteSettingsSource, /fontara-per-site-fallback-notice/)
  assert.match(perSiteSettingsSource, /fontara-per-site-site-off-notice/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.fallbackTitle/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.fallbackDescription/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.siteOffDescription/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.useCustomPaused/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.usingFallback/)
  assert.match(perSiteSettingsSource, /<Trash2 className="size-4" \/>/)
  assert.doesNotMatch(perSiteSettingsSource, /<RotateCcw/)
  assert.match(perSiteSettingsSource, /isSiteProfileEnabled/)
  assert.match(perSiteSettingsSource, /getSitePatternScope/)
  assert.match(perSiteSettingsSource, /upsertSiteProfile/)
  assert.match(perSiteSettingsSource, /removeSiteProfile/)
  assert.match(
    perSiteSettingsSource,
    /saveProfilePatch\(\{ enabled: false \}\)/
  )
  assert.match(perSiteSettingsSource, /fontara-per-site-settings-open/)
  assert.match(perSiteSettingsSource, /fontara-per-site-font-select/)
  assert.doesNotMatch(
    perSiteSettingsSource,
    /createSiteListPatternToggleUpdate/
  )
  assert.doesNotMatch(perSiteSettingsSource, /disabled=\{!canEditProfile\}/)
  assert.doesNotMatch(perSiteSettingsSource, /popup\.perSite\.chooseScopeFirst/)
  assert.doesNotMatch(perSiteSettingsSource, /createSitePathPatternFromUrl/)
  assert.doesNotMatch(perSiteSettingsSource, /scopeChoice/)
  assert.doesNotMatch(perSiteSettingsSource, /handleScopeChange/)
  assert.doesNotMatch(perSiteSettingsSource, /customUrl\.scopePathOption/)
  assert.match(
    perSiteSettingsSource,
    /openOptionsPageSafely\(\{ section: "sites" \}\)/
  )
  assert.match(perSiteSettingsSource, /popup\.perSite\.useCustom/)
  assert.match(perSiteSettingsSource, /popup\.perSite\.drawerTitle/)
  assert.match(perSiteSettingsSource, /<DrawerContent/)
  assert.match(perSiteSettingsSource, /<Switch/)
  assert.match(perSiteSettingsSource, /DEFAULT_ACTIVE_TEXT_STROKE/)
  assert.match(customUrlToggleSource, /isSiteListUrlEnabled/)
  assert.match(customUrlToggleSource, /STORAGE_KEYS\.ENABLED_FOR/)
  assert.match(customUrlToggleSource, /STORAGE_KEYS\.DISABLED_FOR/)
  assert.match(rtlSiteToggleSource, /const isRtl = direction === "rtl"/)
  assert.match(rtlSiteToggleSource, /useExtensionData\(\)\?\.activeTab/)
  assert.doesNotMatch(rtlSiteToggleSource, /chrome\.tabs\.query/)
  assert.match(rtlSiteToggleSource, /!isRtl && switchControl/)
  assert.match(rtlSiteToggleSource, /isRtl && switchControl/)
  assert.match(rtlSiteToggleSource, /getRtlSiteByUrl/)
  assert.match(rtlSiteToggleSource, /popup\.rtl\.currentSite/)
  assert.match(textStrokeToggleSource, /ChevronLeft/)
  assert.match(textStrokeToggleSource, /ChevronRight/)
  assert.match(textStrokeToggleSource, /getNextTextStrokeValue/)
  assert.match(textStrokeToggleSource, /STORAGE_KEYS\.TEXT_STROKE/)
  assert.match(textStrokeToggleSource, /popup\.textStroke\.decrease/)
  assert.match(textStrokeToggleSource, /popup\.textStroke\.increase/)
  assert.match(textStrokeToggleSource, /popup\.textStroke\.off/)
  assert.match(textStrokeToggleSource, /popup\.textStroke\.title/)
  assert.match(textStrokeToggleSource, /trackFillPercentage/)
  assert.match(textStrokeToggleSource, /type="range"/)
  assert.match(textStrokeToggleSource, /cursor-ew-resize/)
  assert.match(textStrokeToggleSource, /transition-\[width\]/)
  assert.match(textStrokeToggleSource, /focus-within:ring-\[#2474FF\]\/15/)
  assert.match(textStrokeToggleSource, /bg-\[#dbeafe\]/)
  assert.doesNotMatch(textStrokeToggleSource, /#12252d/)
  assert.doesNotMatch(textStrokeToggleSource, /#2b6b7a/)
})

test("custom font uploads normalize stored names and data URLs", () => {
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )

  assert.match(optionsSource, /normalizedFontName = fontName\.trim\(\)/)
  assert.match(
    optionsSource,
    /isFontFileSignatureSupported\(extension, fileBytes\)/
  )
  assert.match(optionsSource, /normalizeFontDataURL\(base64Data, extension\)/)
  assert.match(optionsSource, /parseCustomFontUnicodeRangeInput/)
  assert.match(optionsSource, /unicodeRange/)
  assert.match(optionsSource, /options\.addFont\.unicodeRangeLabel/)
  assert.match(optionsSource, /name: normalizedFontName/)
  assert.doesNotMatch(optionsSource, /data: base64Data/)
})

test("settings export reads the latest local storage snapshot", () => {
  const optionsSource = fs.readFileSync(
    path.resolve("src/ui/options/index.tsx"),
    "utf8"
  )

  assert.match(optionsSource, /getLocalValues\(getSettingsBackupDefaults\(\)\)/)
  assert.match(optionsSource, /normalizeStorageValues/)
  assert.match(optionsSource, /createSettingsBackup\(settings/)
  assert.doesNotMatch(
    optionsSource,
    /createSettingsBackup\(extensionData\.settings/
  )
})

test("UI storage hooks use stable initial value references", () => {
  const storageHookSource = fs.readFileSync(
    path.resolve("src/ui/hooks/use-storage.ts"),
    "utf8"
  )
  const uiSources = [
    "src/ui/hooks/use-selected-ui-font.ts",
    "src/ui/popup/index.tsx",
    "src/ui/options/index.tsx",
    "src/ui/components/CustomUrlToggle.tsx",
    "src/ui/components/FontSelector.tsx",
    "src/ui/components/PerSiteSettings.tsx",
    "src/ui/components/PopularSection.tsx",
    "src/ui/components/RtlSiteToggle.tsx",
    "src/ui/components/TextStrokeToggle.tsx",
    "src/ui/components/layout/Header.tsx",
    "src/ui/components/layout/Footer.tsx"
  ]
    .map((sourcePath) => fs.readFileSync(path.resolve(sourcePath), "utf8"))
    .join("\n")

  assert.match(storageHookSource, /initialValueRef = React\.useRef/)
  assert.match(storageHookSource, /valueRef = React\.useRef\(value\)/)
  assert.match(storageHookSource, /setSyncedValue = React\.useCallback/)
  assert.match(storageHookSource, /valueRef\.current/)
  assert.match(storageHookSource, /useExtensionData\(\)/)
  assert.match(storageHookSource, /fontaraConnector\.changeSettings/)
  assert.doesNotMatch(storageHookSource, /\bgetLocalValue\s*\(/)
  assert.doesNotMatch(storageHookSource, /chrome\.storage\.onChanged/)
  assert.doesNotMatch(uiSources, /setLocalValues/)
  assert.doesNotMatch(storageHookSource, /\[key, value\]/)
  assert.match(uiSources, /EMPTY_CUSTOM_FONT_LIST/)
  assert.match(uiSources, /EMPTY_WEBSITE_LIST/)
  assert.match(uiSources, /getExtensionEnabledInitialValue/)
  assert.match(uiSources, /getRtlEnabledInitialValue/)
  assert.match(uiSources, /getRtlSiteSettingsInitialValue/)
  assert.match(uiSources, /getSyncSettingsInitialValue/)
  assert.match(uiSources, /getSystemFontsEnabledInitialValue/)
  assert.match(uiSources, /getTextStrokeInitialValue/)
  assert.match(uiSources, /getEnabledByDefaultInitialValue/)
  assert.match(uiSources, /getEnabledForInitialValue/)
  assert.match(uiSources, /getDisabledForInitialValue/)
  assert.match(uiSources, /getPinnedWebsiteUrlsInitialValue/)
  assert.doesNotMatch(uiSources, /\bgetLocalValue\s*\(/)
  assert.equal(uiSources.match(/\bgetLocalValues\s*\(/g)?.length ?? 0, 1)
  assert.match(uiSources, /getLocalValues\(getSettingsBackupDefaults\(\)\)/)
  assert.doesNotMatch(uiSources, /reconcileStoredSiteLists/)
  assert.doesNotMatch(uiSources, /handleSiteListStorageChange/)
  assert.doesNotMatch(uiSources, /chrome\.storage\.onChanged/)
  assert.match(
    uiSources,
    /STORAGE_KEYS\.ENABLED_FOR,[\s\S]{0,120}getEnabledForInitialValue/
  )
  assert.match(
    uiSources,
    /STORAGE_KEYS\.DISABLED_FOR,[\s\S]{0,120}getDisabledForInitialValue/
  )
  assert.doesNotMatch(uiSources, /getSitePatternListInitialValue/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.CUSTOM_FONT_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.WEBSITE_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.ENABLED_FOR,\s*\[\s*\]/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.DISABLED_FOR,\s*\[\s*\]/)
  assert.doesNotMatch(
    uiSources,
    /STORAGE_KEYS\.EXTENSION_ENABLED,\s*\([^)]*\)\s*=>/
  )
})
