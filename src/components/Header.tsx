import { Switch } from "./ui/Switch"

interface HeaderProps {
    isExtensionEnabled: boolean
    onToggle: () => void
}

const Header = ({ isExtensionEnabled, onToggle }: HeaderProps) => {
    return (
        <div className="flex justify-between relative z-10">
            <p className="text-center mb-2 text-xl text-blue-800">v2فونت آرا</p>
            <Switch
                dir="ltr"
                checked={isExtensionEnabled}
                onCheckedChange={onToggle}
            />
        </div>
    )
}

export default Header