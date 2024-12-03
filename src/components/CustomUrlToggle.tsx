import { Checkbox } from "~src/components/ui/checkbox"
import { Storage } from "@plasmohq/storage"

interface CustomUrlToggleProps {
    currentTab: string
    isCustomUrlActive: boolean
    setIsCustomUrlActive: any
    favicon: string
}

interface BoxItem {
    id?: string
    src?: string
    isActive?: boolean
    url?: string
    isInUi?: boolean
}


const storage = new Storage()
declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome =
    typeof browser !== "undefined" ? browser : chrome

const CustomUrlToggle = ({
    currentTab,
    isCustomUrlActive,
    setIsCustomUrlActive,
    favicon
}: CustomUrlToggleProps) => {
    if (!currentTab || currentTab.toLowerCase().includes('extension') || currentTab.toLowerCase().includes('newtab')) return null

    const displayTabName = () => {
        const tabName = currentTab.slice(8, -2)
        return tabName.length > 20 ? `${tabName.slice(0, 20)}...` : tabName
    }

    const handleCustomUrlToggle = async () => {
        try {
            const newIsActive = !isCustomUrlActive
            setIsCustomUrlActive(newIsActive)

            const customActiveUrls =
                (await storage.get<BoxItem[]>("customActiveUrls")) || []
            let updatedUrls: BoxItem[]

            if (newIsActive) {
                const existingUrlIndex = customActiveUrls.findIndex(
                    (item) => item.url === currentTab
                )
                if (existingUrlIndex === -1) {
                    updatedUrls = [
                        ...customActiveUrls,
                        { url: currentTab, isActive: true }
                    ]
                } else {
                    updatedUrls = customActiveUrls.map((item) =>
                        item.url === currentTab ? { ...item, isActive: true } : item
                    )
                }
            } else {
                updatedUrls = customActiveUrls.map((item) =>
                    item.url === currentTab ? { ...item, isActive: false } : item
                )
            }

            await storage.set("customActiveUrls", updatedUrls)
            browserAPI.runtime.sendMessage({
                action: "updateCustomUrlStatus",
                data: updatedUrls
            })

            const tabs = await browserAPI.tabs.query({
                active: true,
                currentWindow: true
            })
            if (tabs[0]?.id) {
                browserAPI.tabs.sendMessage(tabs[0].id, {
                    action: "setActiveStatus",
                    isActive: newIsActive
                })
            }
        } catch (error) {
            console.error("Error toggling custom URL:", error)
            setIsCustomUrlActive(!isCustomUrlActive)
        }
    }

    return (
        <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full mt-3">
            <label
                className="text-xs cursor-pointer flex items-center whitespace-nowrap overflow-x-auto overflow-y-hidden"
                htmlFor="activeUrl">
                <div className="flex items-center gap-2 min-w-max px-1">
                    <Checkbox
                        name="activeUrl"
                        id="activeUrl"
                        checked={isCustomUrlActive}
                        onCheckedChange={handleCustomUrlToggle}
                        className="shrink-0"
                    />
                    <span className="shrink-0">برای سایت</span>
                    <span className="flex items-center gap-1 shrink-0">

                        <span>{displayTabName()}</span>
                        {favicon && (
                            <img
                                src={favicon}
                                className="!size-4 object-contain"
                                alt="site icon"
                            />
                        )}
                    </span>
                    <span className="shrink-0">فعال باشد؟</span>
                </div>
            </label>
        </div>
    )
}

export default CustomUrlToggle