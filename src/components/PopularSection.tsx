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
  const [websiteList, setWebsiteList] = useStorage<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST
  )

  // const toggleActive = async (popularUrl: any) => {
  //   const updatedUrls = activeUrls.some((url) => url.url === popularUrl.url)
  //     ? activeUrls.filter((url) => url.url !== popularUrl.url)
  //     : [...activeUrls, { ...popularUrl }]
  //   setActiveUrls(updatedUrls)
  // }

  return (
    <div className="mt-2 grid grid-cols-5 justify-items-center items-center overflow-auto h-[18rem] w-full">
      {popularWebsites.map((website) => (
        <TooltipProvider key={website.url} delayDuration={90}>
          <Tooltip>
            <TooltipTrigger
              className="p-1 shadow-md hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] rounded-md size-12 flex items-center justify-center cursor-pointer transition-all duration-300 border border-gray-100"
              // onClick={() => toggleActive(popularUrl)}
            >
              <img
                src={website.icon}
                alt={`${website.url} Logo`}
                className={cn(
                  "size-10 object-cover rounded-md transition-all duration-300",
                  {
                    // "grayscale opacity-25": activeUrls?.some((url) => url.url === popularUrl.url)
                  }
                )}
              />
            </TooltipTrigger>
            <TooltipContent
              className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
              side="top"
              align="center">
              {website.url}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}

export default PopularUrl
