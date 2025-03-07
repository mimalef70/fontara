import "~src/style.css"
import "~src/fonts.css"

import { useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import CustomUrlToggle from "~src/components/CustomUrlToggle"
import FontSelector from "~src/components/FontSelector"
import Footer from "~src/components/layout/Footer"
import Header from "~src/components/layout/Header"
import PopoularUrl from "~src/components/PopoularUrl"
import { STORAGE_KEYS } from "~src/lib/constants"

import { cn } from "./lib/utils"

function IndexPopup() {
  const [showOverlay, setShowOverlay] = useState(false)

  const [extensionActive] = useStorage(STORAGE_KEYS.EXTENSION_ENABLED)

  return (
    <div className="w-[20rem] h-[570px] py-4">
      <section className="h-full">
        {showOverlay && <div className="absolute inset-0 bg-black/30 z-20" />}
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
                <FontSelector setIsOverlayActive={setShowOverlay} />
              </div>

              <div>
                <div style={{ direction: "rtl" }}>
                  <div className="overflow-auto">
                    <PopoularUrl />
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

export default IndexPopup
