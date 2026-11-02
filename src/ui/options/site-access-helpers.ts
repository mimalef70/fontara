import {
  getSitePatternScope,
  type SitePatternScope
} from "../../config/site-list"
import type { WebsiteItem } from "../../definitions"
import type { MessageKey } from "../i18n/messages"

export const sitePatternScopeOptions: Array<{
  labelKey: MessageKey
  value: SitePatternScope
}> = [
  { value: "domain", labelKey: "options.siteList.scopeDomain" },
  { value: "path", labelKey: "options.siteList.scopePath" },
  { value: "custom", labelKey: "options.siteList.scopeCustom" },
  { value: "regex", labelKey: "options.siteList.scopeRegex" }
]

export const sitePatternPlaceholderKeys = {
  custom: "options.siteList.wildcardPlaceholder",
  domain: "options.siteList.placeholder",
  path: "options.siteList.pathPlaceholder",
  regex: "options.siteList.regexPlaceholder"
} satisfies Record<SitePatternScope, MessageKey>

export function createCustomCssProbeUrl(
  website: WebsiteItem,
  normalizedPattern: string
): string {
  if (getSitePatternScope(normalizedPattern) === "regex") return website.url

  const slashIndex = normalizedPattern.indexOf("/")
  if (slashIndex < 0) return website.url

  const path = normalizedPattern
    .slice(slashIndex + 1)
    .split("/")
    .map((part) => (part === "*" ? "__fontara__" : part.replace(/\*/g, "")))
    .filter(Boolean)
    .join("/")

  if (!path) return website.url

  try {
    const url = new URL(website.url)
    url.pathname = `/${path}`
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return website.url
  }
}
