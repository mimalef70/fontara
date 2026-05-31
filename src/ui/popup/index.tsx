import { createRoot } from "react-dom/client"

import { STORAGE_KEYS } from "../../config/storage"
import { cn } from "../../utils/cn"
import CustomUrlToggle from "../components/CustomUrlToggle"
import FontSelector from "../components/FontSelector"
import { PlusCircle } from "../components/icons"
import Footer from "../components/layout/Footer"
import Header from "../components/layout/Header"
import PopularSection from "../components/PopularSection"
import { useSelectedUIFont } from "../hooks/use-selected-ui-font"
import { useStorageValue } from "../hooks/use-storage"

function IndexPopup() {
  useSelectedUIFont()

  const [extensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    (value) => value !== false
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
                  <div className="flex flex-col gap-3">
                    <FontSelector />
                    <button
                      type="button"
                      onClick={() => void chrome.runtime.openOptionsPage()}
                      className="flex cursor-pointer justify-center items-center gap-1 h-10 font-bold antialiased tracking-[0.2px] bg-[#edf3fd] rounded-[3px] text-[13px] text-[#2374ff] text-center py-[9px] relative border-0">
                      <PlusCircle />
                      افزودن فونت دلخواه
                    </button>
                    <a
                      href="https://mimalef70.github.io/fontara/#donate"
                      target="_blank"
                      className="flex cursor-pointer justify-center items-center h-10 gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] bg-[#4caf4f1c] rounded-[3px] text-[13px] text-[#4caf50] text-center py-[9px] relative"
                      rel="noopener">
                      حمایت از فونت آرا
                    </a>
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

createRoot(rootElement).render(<IndexPopup />)
