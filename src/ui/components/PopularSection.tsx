import { POPULAR_WEBSITES } from "../../config/sites"
import { STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import { useStorageValue } from "../hooks/use-storage"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "./ui/tooltip"

function PopularUrl() {
  const [websiteList, setWebsiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    []
  )

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

    try {
      await setWebsiteList(updatedUrls)
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update popular website setting.", error)
      }
    }
  }

  return (
    <div className="grid grid-cols-5 gap-2 pb-3 justify-items-center items-center w-full">
      {POPULAR_WEBSITES.map((website) => (
        <TooltipProvider key={website.url} delayDuration={90}>
          <Tooltip>
            <TooltipTrigger
              className="p-1 shadow-md hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)] rounded-md size-12 cursor-pointer transition-all duration-300 border border-gray-100"
              onClick={() => toggleActive(website)}>
              <img
                src={website.icon ? getExtensionAssetURL(website.icon) : ""}
                alt={`${website.url} Logo`}
                className={cn(
                  "rounded-md transition-all duration-300 px-2 py-2",
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
