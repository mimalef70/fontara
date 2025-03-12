import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { Storage } from "@plasmohq/storage"

import type { WebsiteItem } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function isUrlActive(currentUrl: string): Promise<boolean> {
  const storage = new Storage({
    area: "local"
  })

  const isExtensionEnabled = await storage.get("isExtensionEnabled")
  const websiteList = await storage.get("websiteList")

  if ((isExtensionEnabled as any) === false) return false
  if (!websiteList) return false

  const websites: WebsiteItem[] =
    typeof websiteList === "string"
      ? JSON.parse(websiteList)
      : (websiteList as unknown as WebsiteItem[])

  for (const website of websites) {
    const regex = new RegExp(website.regex, "i")
    // Test if current URL matches the pattern
    if (regex.test(currentUrl.trim())) {
      return website.isActive
    }
  }

  return false
}

// async function isUrlInPatternList(
//   currentUrl: string,
//   activeUrls: any
// ): Promise<boolean> {
//   // If no patterns are stored or the list is empty, return false
//   if (!activeUrls || !Array.isArray(activeUrls) || activeUrls.length === 0) {
//     return false
//   }

//   // Normalize the current URL
//   const normalizedUrl = currentUrl.trim()

//   // Check each pattern for a match
//   for (const pattern of activeUrls) {
//     try {
//       // Skip invalid patterns
//       if (!pattern || typeof (pattern as any).regex !== "string") {
//         continue
//       }

//       const patternString = (pattern as any).regex

//       // Convert the wildcard pattern to a proper regex pattern
//       // Escape all special regex characters except asterisk
//       const escaped = patternString.replace(/[.+^${}()|[\]\\]/g, "\\$&")

//       // Replace wildcards with regex equivalent
//       const regexString = `^${escaped.replace(/\*/g, ".*")}$`

//       // Create case-insensitive regex for more flexible matching
//       const regex = new RegExp(regexString, "i")

//       // Test if current URL matches the pattern
//       if (regex.test(normalizedUrl)) {
//         return true
//       }
//     } catch (error) {
//       // Log error but continue checking other patterns
//       console.error(`Error matching pattern: ${JSON.stringify(pattern)}`, error)
//     }
//   }

//   return false
// }
