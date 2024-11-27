import { useState } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/Select"
import { Circle, CheckedCircle, PlusIcon } from "@/assets/icons/Icons"
export const fonts = [
    {
        value: "Estedad",
        name: "استعداد",
        svg: "بستد دل و دین از من",
        style: "font-estedad"
    },
    {
        value: "Vazirmatn",
        name: "وزیر",
        svg: "بستد دل و دین از من",
        style: "font-estedad"
    },
    {
        value: "Morraba",
        name: "مربا",
        svg: "بستد دل و دین از من",
        style: "font-morabba"
    },
    {
        value: "Dana",
        name: "دانا",
        svg: "بستد دل و دین از من",
        style: "font-dana"
    },
    {
        value: "Samim",
        name: "صمیم",
        svg: "بستد دل و دین از من",
        style: "font-samim"
    },
    {
        value: "Shabnam",
        name: "شبنم",
        svg: "بستد دل و دین از من",
        style: "font-shabnam"
    },
    {
        value: "Sahel",
        name: "ساحل",
        svg: "بستد دل و دین از من",
        style: "font-sahel"
    },
    {
        Value: "Parastoo",
        name: "پرستو",
        svg: "بستد دل و دین از من",
        style: "font-parastoo"
    },
    {
        value: "Gandom",
        name: "گندم",
        svg: "بستد دل و دین از من",
        style: "font-gandom"
    },
    {
        value: "Tanha",
        name: "تنها",
        svg: "بستد دل و دین از من",
        style: "font-tanha"
    },
    {
        value: "Behdad",
        name: "بهداد",
        svg: "بستد دل و دین از من",
        style: "font-behdad"
    },
    {
        value: "Nika",
        name: "نیکا",
        svg: "بستد دل و دین از من",
        style: "font-nika"
    },
    {
        value: "Ganjname",
        name: "گنج نامه",
        svg: "بستد دل و دین از من",
        style: "font-ganjname"
    },
    {
        value: "Shahab",
        name: "شهاب",
        svg: "بستد دل و دین از من",
        style: "font-shahab"
    },
    {
        value: "Mikhak",
        name: "میخک",
        svg: "بستد دل و دین از من",
        style: "font-mikhak"
    }
]

interface FontSelectorProps {
    selected: any
    handleFontChange: (font: any) => void
    isExtensionEnabled: boolean
}

const FontSelector = ({ selected, handleFontChange, isExtensionEnabled }: FontSelectorProps) => {
    const [isActive, setIsActive] = useState(false)
    const [hoveredFont, setHoveredFont] = useState(null)

    return (
        <div className="relative">
            <div className="flex flex-col gap-3">
                <Select
                    onValueChange={(value) =>
                        handleFontChange(fonts.find((font) => font.name === value)!)
                    }
                    onOpenChange={() => setIsActive((prev) => !prev)}
                    dir="rtl"
                    disabled={!isExtensionEnabled}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={selected.name} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
                        {fonts.map((font) => (
                            <div key={font.name} className="flex items-center justify-between gap-2 relative">
                                <SelectItem
                                    value={font.name}
                                    className="flex items-center gap-2 py-1 px-3 cursor-pointer"
                                    onMouseEnter={() => setHoveredFont(font.name)}
                                    onMouseLeave={() => setHoveredFont(null)}
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <span className={`font-estedad text-sm ${font.style} ${selected.name === font.name ? "text-[#0D92F4]" : ""
                                            }`}>
                                            {font.name}
                                        </span>
                                        <span className={`${font.style} text-gray-400 text-[13px] ${hoveredFont === font.name && selected.name !== font.name ? "inline" : "hidden"
                                            }`}>
                                            {font.svg}
                                        </span>
                                    </div>
                                </SelectItem>
                                <div className="!size-5 fill-black absolute left-2 flex items-center justify-center">
                                    {hoveredFont === font.name && selected.name !== font.name ? (
                                        <Circle />
                                    ) : (
                                        selected.name === font.name && <CheckedCircle />
                                    )}
                                </div>
                            </div>
                        ))}
                    </SelectContent>
                </Select>
                <a href="#" className="flex cursor-pointer justify-center items-center gap-1 mb-[15px] font-bold antialiased tracking-[0.2px] bg-[#edf3fd] rounded-[3px] text-[13px] text-[#2374ff] text-center py-[9px] relative">
                    افزودن فونت دلخواه <PlusIcon />
                </a>
            </div>
        </div>
    )
}

export default FontSelector