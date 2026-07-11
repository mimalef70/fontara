import { Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import { STORAGE_KEYS } from "../../config/storage"
import { cn } from "../../utils/cn"
import { openOptionsPageSafely } from "../../utils/options-page"
import CustomUrlToggle from "../components/CustomUrlToggle"
import ErrorBoundary from "../components/ErrorBoundary"
import FontSelector from "../components/FontSelector"
import Footer from "../components/layout/Footer"
import Header from "../components/layout/Header"
import PerSiteSettings from "../components/PerSiteSettings"
import PopularSection from "../components/PopularSection"
import RtlSiteToggle from "../components/RtlSiteToggle"
import TextStrokeToggle from "../components/TextStrokeToggle"
import { Skeleton } from "../components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../components/ui/tooltip"
import {
  ExtensionDataProvider,
  useExtensionData
} from "../hooks/use-extension-data"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { I18nProvider, useI18n, waitForI18nBootstrap } from "../i18n"
import { getExtensionEnabledInitialValue } from "../storage-defaults"

const POPUP_LOADING_TILE_IDS = ["one", "two", "three", "four", "five"]

function IndexPopup() {
  useSelectedUIFont()
  const { direction, language, t } = useI18n()
  const extensionData = useExtensionData()
  const [uiReady, setUiReady] = useState(false)
  const extensionActive = extensionData
    ? getExtensionEnabledInitialValue(
        extensionData.settings[STORAGE_KEYS.EXTENSION_ENABLED] as
          | boolean
          | undefined
      )
    : false

  useEffect(() => {
    document.title = t("common.appName")
  }, [t])

  useEffect(() => {
    if (!extensionData) {
      setUiReady(false)
      return
    }

    const frame = requestAnimationFrame(() => setUiReady(true))
    return () => cancelAnimationFrame(frame)
  }, [extensionData])

  return (
    <div
      className="max-h-[600px] w-[20rem] overflow-hidden p-4"
      dir={direction}
      lang={language}>
      <section className="flex max-h-[calc(600px-2rem)] min-h-0 flex-col overflow-hidden">
        <Header disabled={!uiReady} />

        {!uiReady && (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-0 flex-auto flex-col gap-3 py-3">
            <span className="sr-only">{t("common.loading")}</span>
            <div className="flex items-center gap-2">
              <Skeleton className="h-12 min-w-0 flex-1" />
              <Skeleton className="size-12 shrink-0" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {POPUP_LOADING_TILE_IDS.map((id) => (
                <Skeleton key={id} className="size-12" />
              ))}
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        <div
          aria-hidden={!uiReady}
          className={cn(
            "min-h-0 flex-auto overflow-y-auto overscroll-contain py-3 transition-opacity duration-200",
            !uiReady && "hidden"
          )}>
          <div className="relative z-20">
            <div className="relative">
              <div className="flex flex-col gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <fieldset
                    disabled={!extensionActive}
                    aria-disabled={!extensionActive}
                    className={cn(
                      "m-0 min-w-0 flex-1 border-0 p-0 transition-opacity",
                      !extensionActive && "opacity-50"
                    )}>
                    <FontSelector />
                  </fieldset>
                  <TooltipProvider delayDuration={90}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("common.settings")}
                          onClick={() => void openOptionsPageSafely()}
                          className="flex size-[3rem] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-[#edf3fd] text-[#2374ff] shadow-[0_3px_8px_rgba(0,0,0,0.08)] transition-all duration-300 hover:bg-[#e4efff]">
                          <Settings className="size-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
                        side="top"
                        align="center">
                        {t("common.settings")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {/* <a
                  href="https://mimalef70.github.io/fontara/#donate"
                  target="_blank"
                  className="flex cursor-pointer justify-center items-center h-10 gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] bg-[#4caf4f1c] rounded-[3px] text-[13px] text-[#4caf50] text-center py-[9px] relative"
                  rel="noopener">
                  حمایت از FontAra
                </a> */}
              </div>
            </div>
          </div>

          <fieldset
            disabled={!extensionActive}
            aria-disabled={!extensionActive}
            className={cn(
              "m-0 min-w-0 border-0 p-0 transition-opacity",
              !extensionActive && "opacity-50"
            )}>
            <div dir={direction}>
              <div>
                <PopularSection />
              </div>

              <CustomUrlToggle />
              <PerSiteSettings />
              <TextStrokeToggle />
              <RtlSiteToggle />
            </div>
          </fieldset>
        </div>

        <Footer />
      </section>
    </div>
  )
}

function LocalizedPopupRoot() {
  const { direction, t } = useI18n()

  return (
    <ErrorBoundary
      title={t("popup.errorTitle")}
      description={t("error.description")}
      reloadLabel={t("error.reload")}
      direction={direction}>
      <IndexPopup />
    </ErrorBoundary>
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("FontAra popup root element was not found.")
}
const popupRootElement = rootElement

async function mountPopup(): Promise<void> {
  await waitForI18nBootstrap()
  createRoot(popupRootElement).render(
    <ExtensionDataProvider>
      <I18nProvider>
        <LocalizedPopupRoot />
      </I18nProvider>
    </ExtensionDataProvider>
  )
}

void mountPopup()
