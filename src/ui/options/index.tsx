import { ShieldCheck } from "lucide-react"
import type React from "react"
import { createRoot } from "react-dom/client"
import { version } from "../../../package.json"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import ErrorBoundary from "../components/ErrorBoundary"
import { HotkeysSettings } from "../components/HotkeysSettings"
import { Switch } from "../components/ui/Switch"
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "../components/ui/sidebar"
import { ToastProvider } from "../components/ui/Toast"
import { Toaster } from "../components/ui/toaster"
import { ExtensionDataProvider } from "../hooks/use-extension-data"
import { I18nProvider, useI18n, waitForI18nBootstrap } from "../i18n"
import { AdvancedSettingsSection } from "./advanced-settings-section"
import { FontsSettingsSection } from "./fonts-settings-section"
import { GeneralSettingsSection } from "./general-settings-section"
import {
  OptionsLoadingState,
  SettingsNavigation,
  sectionDescriptionKeys
} from "./options-navigation"
import { RtlSettingsSection } from "./rtl-settings-section"
import { SitesSettingsSection } from "./sites-settings-section"
import { useOptionsController } from "./use-options-controller"

function OptionsPage() {
  const model = useOptionsController()
  const {
    direction,
    formatVersion,
    language,
    t,
    uiReady,
    extensionEnabled,
    activeSection,
    activeNavigation,
    ActiveSectionIcon,
    sidebarSide,
    handleSectionChange,
    handleExtensionToggle
  } = model
  return (
    <ToastProvider>
      <div
        className="font-estedad fontara-options-page"
        dir={direction}
        lang={language}>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "17.25rem",
              "--sidebar-width-icon": "4.25rem"
            } as React.CSSProperties
          }>
          <Sidebar
            collapsible="icon"
            dir={direction}
            side={sidebarSide}
            mobileTitle={t("options.sidebar.mobileTitle")}
            mobileDescription={t("options.sidebar.mobileDescription")}>
            <SidebarHeader className="border-b border-slate-200/80 px-4 py-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex min-h-12 items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_10px_24px_rgb(37_99_235_/_24%)] group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-xl">
                  <img
                    alt=""
                    src={getExtensionAssetURL("assets/icon-128.png")}
                    className="size-8 shrink-0 group-data-[collapsible=icon]:size-7"
                  />
                </span>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950">
                    {t("common.appName")}
                  </h1>
                  <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-500">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        extensionEnabled ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    {extensionEnabled
                      ? t("options.overview.extensionOn")
                      : t("options.overview.extensionOff")}
                  </div>
                </div>
              </div>
            </SidebarHeader>

            <SettingsNavigation
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />

            <SidebarFooter className="border-t border-slate-200/80 px-4 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-100/80 px-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200/70 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate font-semibold text-slate-700">
                    {t("options.overview.privacyTitle")}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.625rem] text-slate-500">
                    {t("common.version", { version: formatVersion(version) })}
                  </span>
                </span>
              </div>
            </SidebarFooter>
            <SidebarRail
              aria-label={t("options.sidebar.toggle")}
              title={t("options.sidebar.toggle")}
            />
          </Sidebar>

          <SidebarInset>
            <header className="fontara-options-header sticky top-0 z-20 flex min-h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
                <SidebarTrigger
                  type="button"
                  label={t("options.sidebar.toggle")}
                  className="size-10 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-blue-700"
                />
                <div className="fontara-icon-tile hidden sm:flex">
                  <ActiveSectionIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                    {activeNavigation
                      ? t(activeNavigation.labelKey)
                      : t("common.settings")}
                  </h2>
                  <p className="hidden truncate text-xs text-slate-500 sm:block">
                    {t(sectionDescriptionKeys[activeSection])}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 ps-3 pe-2 shadow-sm">
                  <span className="hidden text-xs font-bold text-slate-700 sm:inline">
                    {extensionEnabled
                      ? t("options.overview.extensionOn")
                      : t("options.overview.extensionOff")}
                  </span>
                  <Switch
                    dir="ltr"
                    checked={extensionEnabled}
                    disabled={!uiReady}
                    onCheckedChange={(checked) =>
                      void handleExtensionToggle(checked)
                    }
                    aria-label={t("options.extension.toggleLabel")}
                  />
                </div>
              </div>
            </header>

            <div
              id="fontara-options-panel"
              role="tabpanel"
              aria-busy={!uiReady}
              aria-labelledby={`fontara-options-tab-${activeSection}`}
              className="fontara-options-content mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
              {!uiReady && <OptionsLoadingState label={t("common.loading")} />}
              <div aria-hidden={!uiReady} className={cn(!uiReady && "hidden")}>
                {activeSection === "general" && (
                  <GeneralSettingsSection model={model} />
                )}

                {activeSection === "fonts" && (
                  <FontsSettingsSection model={model} />
                )}

                {activeSection === "sites" && (
                  <SitesSettingsSection model={model} />
                )}

                {activeSection === "rtl" && (
                  <RtlSettingsSection model={model} />
                )}

                {activeSection === "hotkeys" && <HotkeysSettings />}

                {activeSection === "advanced" && (
                  <AdvancedSettingsSection model={model} />
                )}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </div>
    </ToastProvider>
  )
}

function LocalizedOptionsRoot() {
  const { direction, t } = useI18n()

  return (
    <ErrorBoundary
      title={t("options.errorTitle")}
      description={t("error.description")}
      reloadLabel={t("error.reload")}
      direction={direction}>
      <OptionsPage />
    </ErrorBoundary>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("FontAra options root element was not found.")
}

const optionsRootElement = rootElement

async function mountOptions(): Promise<void> {
  await waitForI18nBootstrap()
  createRoot(optionsRootElement).render(
    <ExtensionDataProvider>
      <I18nProvider>
        <LocalizedOptionsRoot />
      </I18nProvider>
    </ExtensionDataProvider>
  )
}

void mountOptions()
