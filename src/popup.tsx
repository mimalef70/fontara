import "~src/style.css"
import "~src/fonts.css"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import CustomUrlToggle from "~src/components/CustomUrlToggle"
import FontSelector from "~src/components/FontSelector"
import { PlusCircle } from "~src/components/icons"
import Header from "~src/components/layout/Header"
import PopularSection from "~src/components/PopularSection"
import RtlToggle from "~src/components/RtlToggle"
import { STORAGE_KEYS } from "~src/lib/constants"

import { cn } from "./lib/utils"

function IndexPopup() {
  const [extensionActive] = useStorage({
    key: STORAGE_KEYS.EXTENSION_ENABLED,
    instance: new Storage({
      area: "local"
    })
  })

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
                    <a
                      onClick={() => chrome.runtime.openOptionsPage()}
                      target="_blank"
                      className="flex cursor-pointer justify-center items-center gap-1 h-10 font-bold antialiased tracking-[0.2px] bg-[#edf3fd] rounded-[3px] text-[13px] text-[#2374ff] text-center py-[9px] relative">
                      <PlusCircle />
                      افزودن فونت دلخواه
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
                  <RtlToggle />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
}

export default IndexPopup
