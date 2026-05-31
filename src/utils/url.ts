import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { WebsiteItem } from "../definitions"
import { getLocalValue } from "./storage"

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function createRegexFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `^https?://${escapeRegex(urlObj.hostname)}/?.*$`
  } catch {
    return url
  }
}

export function getMatchingWebsite(
  currentUrl: string | undefined,
  websites: WebsiteItem[] | undefined
): WebsiteItem | null {
  if (!currentUrl || !websites) return null

  for (const website of websites) {
    try {
      const regex = new RegExp(website.regex, "i")
      if (regex.test(currentUrl.trim())) {
        return website
      }
    } catch {}
  }

  return null
}

export async function getStoredWebsiteList(): Promise<WebsiteItem[]> {
  try {
    const websiteList = await getLocalValue<WebsiteItem[]>(
      STORAGE_KEYS.WEBSITE_LIST
    )
    return Array.isArray(websiteList)
      ? websiteList
      : DEFAULT_VALUES.WEBSITE_LIST
  } catch {
    return DEFAULT_VALUES.WEBSITE_LIST
  }
}

export async function isUrlActive(currentUrl: string): Promise<boolean> {
  let isExtensionEnabled: boolean | undefined
  try {
    isExtensionEnabled = await getLocalValue<boolean>(
      STORAGE_KEYS.EXTENSION_ENABLED
    )
  } catch {
    isExtensionEnabled = DEFAULT_VALUES.EXTENSION_ENABLED
  }

  if (isExtensionEnabled === false) return false

  const websiteList = await getStoredWebsiteList()
  const matchingWebsite = getMatchingWebsite(currentUrl, websiteList)
  return matchingWebsite?.isActive === true
}
