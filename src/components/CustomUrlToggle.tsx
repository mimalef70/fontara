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
            <label
                className="text-xs cursor-pointer flex items-center whitespace-nowrap overflow-x-auto overflow-y-hidden"
                htmlFor="activeUrl"
            >
                <div className="flex items-center gap-2 min-w-max px-1">
                    <Checkbox
                        name="activeUrl"
                        id="activeUrl"
                        checked={isCustomUrlActive}
                        onCheckedChange={onToggle}
                        className="shrink-0"
                    />
                    <span className="shrink-0">برای سایت</span>
                    <span className="flex items-center gap-1 shrink-0">
                        {favicon && <img src={favicon} className="!size-4 object-contain" alt="site icon" />}
                        <span>{displayTabName()}</span>
                    </span>
                    <span className="shrink-0">فعال باشد؟</span>
                </div>
            </label>
        </div>
    )
}

export default CustomUrlToggle