import "~src/style.css"

import { useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import CustomUrlToggle from "~src/components/CustomUrlToggle"
import FontSelector from "~src/components/FontSelector"
import Footer from "~src/components/layout/Footer"
import Header from "~src/components/layout/Header"
import PopoularUrl from "~src/components/PopoularUrl"

function IndexPopup() {
  // overlay while Select is open we set a overlay into full popup d
  const [isOverlayActive, setIsOverlayActive] = useState(false)

  const [extentionEnabledState, setExtentionEnabledState] = useStorage(
    "isExtensionEnabled",
    true
  )
  return (
    <div dir="rtl" className="font-estedad">
      <div className="w-[20rem] h-[570px] py-4">
        <section className="h-full">
          {isOverlayActive && (
            <div className="absolute inset-0 bg-black/30 z-20" />
          )}
          <div className="flex flex-col justify-between h-full w-[90%] mx-auto relative">
            {/* Main content wrapper */}
            <div className="relative flex flex-col justify-between h-full">
              <Header
                extentionEnabledState={extentionEnabledState}
                setExtentionEnabledState={setExtentionEnabledState}
              />

              <div
                className={`  
          flex-1 flex flex-col 
          ${!extentionEnabledState ? "opacity-50 pointer-events-none" : "opacity-100"}
          transition-opacity duration-200
        `}>
                {/* FontSelector with higher z-index to stay above overlay */}
                <div className="relative z-20">
                  <FontSelector setIsOverlayActive={setIsOverlayActive} />
                </div>

                {/* Main content */}
                <div>
                  <div style={{ direction: "rtl" }}>
                    <div className="overflow-auto">
                      <PopoularUrl />
                    </div>

                    <CustomUrlToggle />
                  </div>
                </div>
              </div>

              <Footer isExtensionEnabled={!extentionEnabledState} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default IndexPopup
