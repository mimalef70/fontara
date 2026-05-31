import type { WebsiteItem } from "../definitions"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { getLocalValue, setLocalValue } from "../utils/storage"

export function mergeWebsiteLists(
  existingList: WebsiteItem[],
  defaultList: WebsiteItem[]
): WebsiteItem[] {
  const mergedList = [...existingList]

  for (const defaultSite of defaultList) {
    const existingIndex = mergedList.findIndex(
      (site) => site.url === defaultSite.url
    )

    if (existingIndex === -1) {
      mergedList.push(defaultSite)
      continue
    }

    if ("version" in defaultSite) {
      const existingSite = mergedList[existingIndex]

      if (
        !("version" in existingSite) ||
        existingSite.version !== defaultSite.version
      ) {
        mergedList[existingIndex] = {
          ...defaultSite,
          isActive: existingSite.isActive
        }
      }
    }
  }

  return mergedList
}

export async function ensureStorageValues(): Promise<void> {
  const storageUpdates: Record<string, unknown> = {}

  const extensionEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED
  )
  if (extensionEnabled === undefined) {
    storageUpdates[STORAGE_KEYS.EXTENSION_ENABLED] =
      DEFAULT_VALUES.EXTENSION_ENABLED
  }

  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  if (selectedFont === undefined) {
    storageUpdates[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  const websiteList = await getLocalValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST
  )
  if (websiteList === undefined) {
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = DEFAULT_VALUES.WEBSITE_LIST
  } else {
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = mergeWebsiteLists(
      websiteList,
      DEFAULT_VALUES.WEBSITE_LIST
    )
  }

  const customFontList = await getLocalValue(STORAGE_KEYS.CUSTOM_FONT_LIST)
  if (customFontList === undefined) {
    storageUpdates[STORAGE_KEYS.CUSTOM_FONT_LIST] =
      DEFAULT_VALUES.CUSTOM_FONT_LIST
  }

  await Promise.all(
    Object.entries(storageUpdates).map(([key, value]) =>
      setLocalValue(key, value)
    )
  )
}
