import { Checkbox } from "./ui/Checkbox"

interface CustomUrlToggleProps {
    currentTab: string
    isCustomUrlActive: boolean
    onToggle: () => void
    favicon: string
}

const CustomUrlToggle = ({
    currentTab,
    isCustomUrlActive,
    onToggle,
    favicon
}: CustomUrlToggleProps) => {
    if (!currentTab) return null

    const displayTabName = () => {
        const tabName = currentTab.slice(8, -2)
        return tabName.length > 20 ? `${tabName.slice(0, 20)}...` : tabName
    }

    return (
        <div className="border border-gray-400 rounded-md p-2 select-none mx-auto w-full">
            <label className="text-xs cursor-pointer flex items-center gap-1" htmlFor="activeUrl">
                <Checkbox
                    name="activeUrl"
                    id="activeUrl"
                    checked={isCustomUrlActive}
                    onCheckedChange={onToggle}
                />
                برای سایت {" "}
                {currentTab && displayTabName()} {favicon && <img src={favicon} className="!size-4 object-contain" />}
                {" "} فعال باشد؟
            </label>
        </div>
    )
}

export default CustomUrlToggle