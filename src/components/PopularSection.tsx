import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~src/components/ui/tooltip"
import { STORAGE_KEYS } from "~src/lib/constants"
import { popularWebsites } from "~src/lib/popularWebsites"
import type { WebsiteItem } from "~src/lib/types"
import { cn } from "~src/lib/utils"

function PopularUrl() {
  const [websiteList, setWebsiteList] = useStorage<WebsiteItem[]>({
    key: STORAGE_KEYS.WEBSITE_LIST,
    instance: new Storage({
      area: "local"
    })
  })

  const toggleActive = async (website: WebsiteItem) => {
    let updatedUrls

    const existingWebsiteIndex = websiteList.findIndex(
      (item) => item.url === website.url
    )

    if (existingWebsiteIndex === -1) {
      // Website doesn't exist, add it with isActive: true
      updatedUrls = [...websiteList, { ...website, isActive: true }]
    } else {
      // Website exists, toggle isActive property
      updatedUrls = websiteList.map((item, index) =>
        index === existingWebsiteIndex
          ? { ...item, isActive: !item.isActive }
          : item
      )
    }

    setWebsiteList(updatedUrls)
  }

  return (
    <div className="grid grid-cols-5 gap-2 pb-3 justify-items-center items-center overflow-auto w-full">
      {popularWebsites.map((website) => (
        <TooltipProvider key={website.url} delayDuration={90}>
          <Tooltip>
            <TooltipTrigger
              className="p-1 shadow-md hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] rounded-md size-12 cursor-pointer transition-all duration-300 border border-gray-100"
              onClick={() => toggleActive(website)}>
              <img
                src={website.icon}
                alt={`${website.url} Logo`}
                className={cn(
                  "size-10 object-cover rounded-md transition-all duration-300",
                  {
                    "grayscale opacity-25": !websiteList?.find(
                      (item) => item.url === website.url
                    )?.isActive
                  }
                )}
              />
            </TooltipTrigger>
            <TooltipContent
              className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
              side="top"
              align="center">
              {website.siteName || website.url}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}

export default PopularUrl
