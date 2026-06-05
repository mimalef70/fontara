import { createRoot } from "react-dom/client"

import { STORAGE_KEYS } from "../../config/storage"
import { cn } from "../../utils/cn"
import { openOptionsPageSafely } from "../../utils/options-page"
import CustomUrlToggle from "../components/CustomUrlToggle"
import ErrorBoundary from "../components/ErrorBoundary"
import FontSelector from "../components/FontSelector"
import { PlusCircle } from "../components/icons"
import Footer from "../components/layout/Footer"
import Header from "../components/layout/Header"
import PopularSection from "../components/PopularSection"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../components/ui/tooltip"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useStorageValue } from "../hooks/use-storage"
import { getExtensionEnabledInitialValue } from "../storage-defaults"

function IndexPopup() {
  useSelectedUIFont()

  const [extensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    getExtensionEnabledInitialValue
  )

  return (
    <div className="w-[20rem] h-[570px] py-4">
      <section className="h-full">
        <div className="flex flex-col justify-between h-full w-[90%] mx-auto relative">
          <div className="relative flex flex-col justify-between h-full">
            <Header />

            <div
              className={cn(
                "flex-1 flex flex-col transition-opacity duration-200",
                {
                  "opacity-50 pointer-events-none": !extensionActive,
                  "opacity-100": extensionActive
                }
              )}>
              <div className="relative z-20">
                <div className="relative">
                  <div className="flex flex-col gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <FontSelector />
                      </div>
                      <TooltipProvider delayDuration={90}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="افزودن فونت دلخواه"
                              onClick={() => void openOptionsPageSafely()}
                              className="flex size-[3rem] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-[#edf3fd] text-[#2374ff] shadow-[0_3px_8px_rgba(0,0,0,0.08)] transition-all duration-300 hover:bg-[#e4efff]">
                              <PlusCircle className="size-6" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
                            side="top"
                            align="center">
                            افزودن فونت دلخواه
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {/* <a
                      href="https://mimalef70.github.io/fontara/#donate"
                      target="_blank"
                      className="flex cursor-pointer justify-center items-center h-10 gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] bg-[#4caf4f1c] rounded-[3px] text-[13px] text-[#4caf50] text-center py-[9px] relative"
                      rel="noopener">
                      حمایت از فونت آرا
                    </a> */}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ direction: "rtl" }}>
                  <div>
                    <PopularSection />
                  </div>

                  <CustomUrlToggle />
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </section>
    </div>
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("FontAra popup root element was not found.")
}

createRoot(rootElement).render(
  <ErrorBoundary title="خطا در بارگذاری پاپ‌آپ فونت‌آرا">
    <IndexPopup />
  </ErrorBoundary>
)
