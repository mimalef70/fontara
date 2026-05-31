import type { WebsiteItem } from "../definitions"
import { getLocalValue } from "./storage"
import { STORAGE_KEYS } from "../config/storage"

export function createRegexFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `^https?://${urlObj.hostname.replace(/\./g, "\\.")}/?.*$`
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
    } catch {
      continue
    }
  }

  return null
}

export async function isUrlActive(currentUrl: string): Promise<boolean> {
  const isExtensionEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED
  )
  const websiteList = await getLocalValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST
  )

  if (isExtensionEnabled === false) return false

  const matchingWebsite = getMatchingWebsite(currentUrl, websiteList)
  return matchingWebsite?.isActive === true
}
