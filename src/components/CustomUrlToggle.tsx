import { Checkbox } from "./ui/Checkbox"

interface CustomUrlToggleProps {
    currentTab: string
    isCustomUrlActive: boolean
    onToggle: () => void
    isExtensionEnabled: boolean
    favicon: string
}

const CustomUrlToggle = ({
    currentTab,
    isCustomUrlActive,
    onToggle,
    isExtensionEnabled,
    favicon
}: CustomUrlToggleProps) => {
    if (!currentTab) return null

    return (
        <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full">
            <label className="text-xs cursor-pointer flex items-center gap-1" htmlFor="activeUrl">
                <Checkbox
                    name="activeUrl"
                    id="activeUrl"
                    checked={isCustomUrlActive}
                    onCheckedChange={onToggle}
                    disabled={!isExtensionEnabled}
                />
                برای سایت {" "}
                {currentTab && currentTab.slice(8, -2)} <img src={favicon} className="!size-4 object-contain" />
                {" "} فعال باشد؟
            </label>
        </div>
    )
}
export default CustomUrlToggle