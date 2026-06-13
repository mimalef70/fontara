import {
  createWebsiteSiteListToggleUpdate,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../../config/site-list"
import {
  normalizePinnedWebsiteUrls,
  POPULAR_WEBSITES
} from "../../config/sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import { fontaraConnector } from "../connect/connector"
import { useStorageValue } from "../hooks/use-storage"
import {
  EMPTY_WEBSITE_LIST,
  getDisabledForInitialValue,
  getEnabledByDefaultInitialValue,
  getEnabledForInitialValue,
  getPinnedWebsiteUrlsInitialValue
} from "../storage-defaults"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "./ui/tooltip"

function PopularUrl() {
  const [websiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
  )
  const [enabledByDefault] = useStorageValue<boolean>(
    STORAGE_KEYS.ENABLED_BY_DEFAULT,
    getEnabledByDefaultInitialValue
  )
  const [enabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.ENABLED_FOR,
    getEnabledForInitialValue
  )
  const [disabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.DISABLED_FOR,
    getDisabledForInitialValue
  )
  const [pinnedWebsiteUrls] = useStorageValue<string[]>(
    STORAGE_KEYS.PINNED_WEBSITE_URLS,
    getPinnedWebsiteUrlsInitialValue
  )
  const pinnedWebsiteUrlSet = new Set(
    normalizePinnedWebsiteUrls(pinnedWebsiteUrls, [])
  )
  const pinnedWebsites = POPULAR_WEBSITES.filter((website) =>
    pinnedWebsiteUrlSet.has(website.url)
  )

  if (pinnedWebsites.length === 0) return null

  const toggleActive = async (website: WebsiteItem) => {
    let updatedUrls: WebsiteItem[]
    const currentWebsiteList =
      websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
    const siteListSettings = {
      disabledFor,
      enabledByDefault,
      enabledFor
    }
    const active = isSiteListUrlEnabled(website.url, {
      disabledFor: normalizeSiteList(disabledFor),
      enabledByDefault: normalizeEnabledByDefault(enabledByDefault),
      enabledFor: normalizeEnabledSiteList(enabledFor)
    })
    const siteListUpdate = createWebsiteSiteListToggleUpdate(
      website,
      siteListSettings,
      !active
    )

    const existingWebsiteIndex = currentWebsiteList.findIndex(
      (item) => item.url === website.url
    )

    if (existingWebsiteIndex === -1) {
      updatedUrls = [...currentWebsiteList, { ...website, isActive: !active }]
    } else {
      updatedUrls = currentWebsiteList.map((item, index) =>
        index === existingWebsiteIndex ? { ...item, isActive: !active } : item
      )
    }

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: updatedUrls
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update popular website setting.", error)
      }
    }
  }

  return (
    <div className="grid grid-cols-5 gap-2 pb-3 justify-items-center items-center w-full">
      {pinnedWebsites.map((website) => {
        const active = isSiteListUrlEnabled(website.url, {
          disabledFor: normalizeSiteList(disabledFor),
          enabledByDefault: normalizeEnabledByDefault(enabledByDefault),
          enabledFor: normalizeEnabledSiteList(enabledFor)
        })

        return (
          <TooltipProvider key={website.url} delayDuration={90}>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="flex size-12 cursor-pointer items-center justify-center rounded-md border border-gray-100 p-0 shadow-md transition-all duration-300 hover:!shadow-[0_10px_20px_rgba(0,0,0,0.15)]"
                onClick={() => void toggleActive(website)}>
                <img
                  src={website.icon ? getExtensionAssetURL(website.icon) : ""}
                  alt={`${website.url} Logo`}
                  className={cn(
                    "size-8 rounded-md object-contain transition-all duration-300",
                    {
                      "grayscale opacity-25": !active
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
        )
      })}
    </div>
  )
}

export default PopularUrl
