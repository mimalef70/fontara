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
  assert.match(fontSelectorSource, /FONT_SAMPLE_TEXT/)
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
  assert.match(popupSource, /<ErrorBoundary title="خطا در بارگذاری پاپ‌آپ/)
  assert.match(optionsSource, /<ErrorBoundary title="خطا در بارگذاری تنظیمات/)
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
  assert.match(packageSource, /"@radix-ui\/react-separator"/)
  assert.match(styleSource, /--sidebar-background/)
  assert.match(tailwindSource, /sidebar:\s*{[\s\S]*--sidebar-background/)
  assert.match(optionsSource, /from "..\/components\/ui\/sidebar"/)
  assert.match(optionsSource, /<SidebarProvider>/)
  assert.match(
    optionsSource,
    /<Sidebar collapsible="icon" dir="rtl" side="right">/
  )
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
  assert.match(sidebarSource, /w-\[var\(--sidebar-width\)\]/)
  assert.doesNotMatch(sidebarSource, /w-\[--sidebar-width/)
  assert.doesNotMatch(sidebarSource, /after:left-1\/2/)
  assert.doesNotMatch(sidebarSource, /text-left/)
  assert.doesNotMatch(sidebarSource, /menu-item:pr-8/)
})

test("popup add custom font action is an icon button beside the selector", () => {
  const popupSource = fs.readFileSync(
    path.resolve("src/ui/popup/index.tsx"),
    "utf8"
  )

  assert.match(popupSource, /<FontSelector \/>[\s\S]*<TooltipProvider/)
  assert.match(popupSource, /flex flex-col gap-3 mb-3/)
  assert.match(popupSource, /aria-label="افزودن فونت دلخواه"/)
  assert.match(popupSource, /className="[^"]*size-\[3rem\]/)
  assert.match(popupSource, /<PlusCircle className="size-6" \/>/)
  assert.doesNotMatch(
    popupSource,
    /<button[\s\S]*<PlusCircle \/>[\s\S]*افزودن فونت دلخواه[\s\S]*<\/button>/
  )
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
  assert.doesNotMatch(headerSource, /!bg-red-500/)
  assert.match(switchSource, /data-\[state=checked\]:bg-emerald-500/)
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
  assert.match(optionsSource, /name: normalizedFontName/)
  assert.doesNotMatch(optionsSource, /data: base64Data/)
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
    "src/ui/components/PopularSection.tsx",
    "src/ui/components/layout/Header.tsx",
    "src/ui/components/layout/Footer.tsx"
  ]
    .map((sourcePath) => fs.readFileSync(path.resolve(sourcePath), "utf8"))
    .join("\n")

  assert.match(storageHookSource, /initialValueRef = React\.useRef/)
  assert.match(uiSources, /EMPTY_CUSTOM_FONT_LIST/)
  assert.match(uiSources, /EMPTY_WEBSITE_LIST/)
  assert.match(uiSources, /getExtensionEnabledInitialValue/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.CUSTOM_FONT_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(uiSources, /STORAGE_KEYS\.WEBSITE_LIST,\s*\[\s*\]/)
  assert.doesNotMatch(
    uiSources,
    /STORAGE_KEYS\.EXTENSION_ENABLED,\s*\([^)]*\)\s*=>/
  )
})
