import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import CustomUrlToggle from "./CustomUrlToggle"
import FontSelector from "./FontSelector"
import Header from "./layout/Header"
import PopoularUrl from "./PopoularUrl"
import Footer from "./layout/Footer"

export const fonts = [
  {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
]

// Types
interface BoxItem {
  id?: string
  src?: string
  isActive?: boolean
  url?: string
  isInUi?: boolean
}

// Browser API setup
const storage = new Storage()

export default function BaseVersion() {
  // State
  const [isActive, setIsActive] = useState(false)
  const [extentionEnabledState, setExtentionEnabledState] = useState(true)
  // ------------------------------------------

  // Initialize extension state from storage
  useEffect(() => {
    const initializeExtensionState = async () => {
      // await storage.clear()
      const storedState = await storage.get<boolean>("isExtensionEnabled")
      setExtentionEnabledState(storedState)
    }

    initializeExtensionState()
  }, [])

  return (
    <section className="h-full">
      {isActive && (
        <div className="absolute inset-0 bg-black/30 z-10" />
      )}
      <div className="flex flex-col justify-between h-full w-[90%] mx-auto relative">
        {/* Main content wrapper */}
        <div className="relative flex flex-col justify-between h-full">
          <Header
            extentionEnabledState={extentionEnabledState}
            setExtentionEnabledState={setExtentionEnabledState}
          />

          <div className={`
          flex-1 flex flex-col 
          ${!extentionEnabledState ? "opacity-50 pointer-events-none" : "opacity-100"}
          transition-opacity duration-200
        `}>
            {/* FontSelector with higher z-index to stay above overlay */}
            <div className="relative z-20">
              <FontSelector setIsActive={setIsActive} />
            </div>

            {/* Main content */}
            <div>
              <div style={{ direction: "rtl" }}>
                <div className="overflow-auto">
                  <PopoularUrl />
                </div>

                <CustomUrlToggle
                />
              </div>
            </div>
          </div>

          <Footer
            isExtensionEnabled={!extentionEnabledState}
          />
        </div>
      </div>
    </section>
  )
}
