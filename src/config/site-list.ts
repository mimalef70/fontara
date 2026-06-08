import type { WebsiteItem } from "../definitions"

export type SiteListSettings = {
  disabledFor: string[]
  enabledByDefault: boolean
  enabledFor: string[]
}

type PreparedURL = {
  hostParts: string[]
  pathParts: string[]
  port: string
  protocol: string
}

type PreparedPattern = PreparedURL & {
  exactEnd: boolean
  exactStart: boolean
}

const regexpCache = new Map<string, RegExp | null>()
const preparedPatternCache = new Map<string, PreparedPattern | null>()
const preparedURLCache = new Map<string, PreparedURL | null>()
const PROTOCOL_PATTERN = /^[a-z*][a-z0-9+.-]*:\/\//i

function isRegExpPattern(pattern: string): boolean {
  return pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2
}

function createRegExp(pattern: string): RegExp | null {
  const cached = regexpCache.get(pattern)
  if (cached !== undefined) return cached

  let source = pattern
  if (source.startsWith("/")) {
    source = source.slice(1)
  }
  if (source.endsWith("/")) {
    source = source.slice(0, -1)
  }

  try {
    const regexp = new RegExp(source, "i")
    regexpCache.set(pattern, regexp)
    return regexp
  } catch {
    regexpCache.set(pattern, null)
    return null
  }
}

function prepareURL(url: string): PreparedURL | null {
  const cached = preparedURLCache.get(url)
  if (cached !== undefined) return cached

  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split("/").slice(1)
    if (!pathParts[pathParts.length - 1]) {
      pathParts.pop()
    }

    const prepared = {
      hostParts: parsed.hostname.toLowerCase().split(".").reverse(),
      pathParts,
      port: parsed.port,
      protocol: parsed.protocol
    }
    preparedURLCache.set(url, prepared)
    return prepared
  } catch {
    preparedURLCache.set(url, null)
    return null
  }
}

function preparePattern(pattern: string): PreparedPattern | null {
  const cached = preparedPatternCache.get(pattern)
  if (cached !== undefined) return cached

  if (!pattern) {
    preparedPatternCache.set(pattern, null)
    return null
  }

  let normalizedPattern = pattern
  const exactStart = normalizedPattern.startsWith("^")
  const exactEnd = normalizedPattern.endsWith("$")

  if (exactStart) normalizedPattern = normalizedPattern.slice(1)
  if (exactEnd) normalizedPattern = normalizedPattern.slice(0, -1)

  let protocol = ""
  const protocolIndex = normalizedPattern.indexOf("://")
  if (protocolIndex > 0) {
    protocol = `${normalizedPattern.slice(0, protocolIndex)}:`
    normalizedPattern = normalizedPattern.slice(protocolIndex + 3)
  }

  const slashIndex = normalizedPattern.indexOf("/")
  const host =
    slashIndex < 0 ? normalizedPattern : normalizedPattern.slice(0, slashIndex)
  let hostname = host
  let isIPv6 = false
  let ipv6EndIndex = -1

  if (host.startsWith("[")) {
    ipv6EndIndex = host.indexOf("]")
    isIPv6 = ipv6EndIndex > 0
  }

  let port = "*"
  const portIndex = host.lastIndexOf(":")
  if (portIndex >= 0 && (!isIPv6 || ipv6EndIndex < portIndex)) {
    hostname = host.slice(0, portIndex)
    port = host.slice(portIndex + 1)
  }

  if (isIPv6) {
    try {
      hostname = new URL(`http://${hostname}`).hostname
    } catch {}
  }

  const path = slashIndex < 0 ? "" : normalizedPattern.slice(slashIndex + 1)
  const pathParts = path.split("/")
  if (!pathParts[pathParts.length - 1]) {
    pathParts.pop()
  }

  const prepared = {
    exactEnd,
    exactStart,
    hostParts: hostname.toLowerCase().split(".").reverse(),
    pathParts,
    port,
    protocol
  }
  preparedPatternCache.set(pattern, prepared)
  return prepared
}

function matchPreparedURLPattern(
  url: PreparedURL | null,
  pattern: PreparedPattern | null
): boolean {
  if (
    !url ||
    !pattern ||
    pattern.hostParts.length > url.hostParts.length ||
    (pattern.exactStart && pattern.hostParts.length !== url.hostParts.length) ||
    (pattern.exactEnd && pattern.pathParts.length !== url.pathParts.length) ||
    (pattern.port !== "*" && pattern.port !== url.port) ||
    (pattern.protocol && pattern.protocol !== url.protocol)
  ) {
    return false
  }

  for (let index = 0; index < pattern.hostParts.length; index += 1) {
    const patternPart = pattern.hostParts[index]
    const urlPart = url.hostParts[index]
    if (patternPart !== "*" && patternPart !== urlPart) {
      return false
    }
  }

  const patternTopLevelHostPart =
    pattern.hostParts[pattern.hostParts.length - 1]
  const urlTopLevelHostPart = url.hostParts[url.hostParts.length - 1]
  if (
    pattern.hostParts.length >= 2 &&
    patternTopLevelHostPart !== "*" &&
    (pattern.hostParts.length < url.hostParts.length - 1 ||
      (pattern.hostParts.length === url.hostParts.length - 1 &&
        urlTopLevelHostPart !== "www"))
  ) {
    return false
  }

  if (pattern.pathParts.length === 0) {
    return true
  }

  if (pattern.pathParts.length > url.pathParts.length) {
    return false
  }

  for (let index = 0; index < pattern.pathParts.length; index += 1) {
    const patternPart = pattern.pathParts[index]
    const urlPart = url.pathParts[index]
    if (patternPart !== "*" && patternPart !== urlPart) {
      return false
    }
  }

  return true
}

export function getURLHostOrProtocol(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.host) return parsed.host.toLowerCase()
    if (parsed.protocol === "file:") return parsed.pathname
    return parsed.protocol
  } catch {
    return url.trim().toLowerCase()
  }
}

export function getDisplaySitePattern(pattern: string): string {
  const normalizedPattern =
    normalizeSitePattern(pattern) ?? pattern.trim().replace(/%2a/gi, "*")
  return normalizedPattern.startsWith("www.")
    ? normalizedPattern.slice(4)
    : normalizedPattern
}

export function createSitePatternFromUrl(url: string): string | null {
  const pattern = getURLHostOrProtocol(url)
  return normalizeSitePattern(pattern)
}

export function getWebsiteSitePattern(website: WebsiteItem): string | null {
  return getWebsiteSitePatterns(website)[0] ?? null
}

function createSitePatternsFromExtensionPattern(pattern: string): string[] {
  const trimmed = pattern.trim()
  if (!trimmed) return []

  const withoutProtocol = trimmed.replace(PROTOCOL_PATTERN, "")
  const slashIndex = withoutProtocol.indexOf("/")
  const host =
    slashIndex < 0 ? withoutProtocol : withoutProtocol.slice(0, slashIndex)
  if (!host || host === "*") return []

  const normalizedHost = host.replace(/^\*\./, "*.")
  if (!normalizedHost.includes("*")) {
    return [normalizedHost]
  }

  const hostParts = normalizedHost.split(".")
  if (hostParts.some((part) => part === "*")) {
    return [normalizedHost]
  }

  const wildcardIndex = normalizedHost.indexOf("*")
  if (wildcardIndex < 0) return [normalizedHost]

  const suffix = normalizedHost.slice(wildcardIndex + 1).replace(/^\./, "")
  if (!suffix) return []

  return [suffix, `*.${suffix}`]
}

export function getWebsiteSitePatterns(website: WebsiteItem): string[] {
  return normalizeSiteList([
    createSitePatternFromUrl(website.url),
    ...(website.pattern
      ? createSitePatternsFromExtensionPattern(website.pattern)
      : [])
  ])
}

export function normalizeSitePattern(value: unknown): string | null {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed === "*") return trimmed
  if (isRegExpPattern(trimmed)) {
    return createRegExp(trimmed) ? trimmed : null
  }
  if (/\s/.test(trimmed)) return null

  const decodedWildcardPattern = trimmed.replace(/%2a/gi, "*")
  if (decodedWildcardPattern.includes("*")) {
    const normalizedWildcardPattern = normalizeWildcardSitePattern(
      decodedWildcardPattern
    )
    if (normalizedWildcardPattern) return normalizedWildcardPattern
  }

  try {
    const parsed = new URL(
      decodedWildcardPattern.includes("://")
        ? decodedWildcardPattern
        : `https://${decodedWildcardPattern}`
    )
    const host =
      parsed.host ||
      (parsed.protocol === "file:" ? parsed.pathname : parsed.protocol)
    const pathname =
      parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.replace(/\/+$/, "")
        : ""
    const normalized = `${host}${pathname}`.toLowerCase()
    return normalized || null
  } catch {
    return decodedWildcardPattern.toLowerCase()
  }
}

function normalizeWildcardSitePattern(pattern: string): string | null {
  const withoutProtocol = pattern.replace(PROTOCOL_PATTERN, "")
  const slashIndex = withoutProtocol.indexOf("/")
  const host =
    slashIndex < 0 ? withoutProtocol : withoutProtocol.slice(0, slashIndex)

  if (!host || host === "*") return null

  const path = slashIndex < 0 ? "" : withoutProtocol.slice(slashIndex)
  const normalizedPath = path && path !== "/" ? path.replace(/\/+$/, "") : ""
  const normalized = `${host}${normalizedPath}`.toLowerCase()

  return normalized || null
}

export function normalizeSiteList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalizedList: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    const normalized = normalizeSitePattern(item)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    normalizedList.push(normalized)
  }

  return removeRedundantWWWPatterns(normalizedList)
}

function isHostOnlyPattern(pattern: string): boolean {
  return !isRegExpPattern(pattern) && pattern !== "*" && !pattern.includes("/")
}

function removeRedundantWWWPatterns(list: string[]): string[] {
  const hostPatterns = new Set(list.filter(isHostOnlyPattern))

  return list.filter((pattern) => {
    if (!isHostOnlyPattern(pattern) || !pattern.startsWith("www.")) {
      return true
    }

    const suffix = pattern.slice(4)
    return !hostPatterns.has(suffix) && !hostPatterns.has(`*.${suffix}`)
  })
}

export function normalizeEnabledSiteList(value: unknown): string[] {
  return normalizeSiteList(value)
}

export function normalizeEnabledByDefault(value: unknown): boolean {
  return value === true
}

export function isURLMatched(url: string, pattern: string): boolean {
  if (isRegExpPattern(pattern)) {
    return createRegExp(pattern)?.test(url) === true
  }

  return matchPreparedURLPattern(prepareURL(url), preparePattern(pattern))
}

export function isURLInSiteList(url: string, list: string[]): boolean {
  return list.some((pattern) => isURLMatched(url, pattern))
}

export function isSiteListUrlEnabled(
  url: string,
  settings: SiteListSettings
): boolean {
  const enabledFor = normalizeEnabledSiteList(settings.enabledFor)
  const disabledFor = normalizeSiteList(settings.disabledFor)
  const isURLInEnabledList = isURLInSiteList(url, enabledFor)

  if (!settings.enabledByDefault) {
    return isURLInEnabledList
  }

  if (isURLInEnabledList) {
    return true
  }

  return !isURLInSiteList(url, disabledFor)
}

function getPatternAliases(pattern: string): string[] {
  const aliases = [pattern]
  if (pattern.startsWith("www.")) {
    aliases.push(pattern.slice(4))
  }
  return aliases
}

export function addSitePatternToList(
  list: string[],
  pattern: string
): string[] {
  const normalizedList = normalizeSiteList(list)
  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern) return normalizedList
  if (normalizedList.includes(normalizedPattern)) return normalizedList

  return normalizeSiteList([...normalizedList, normalizedPattern])
}

function addSitePatternsToList(list: string[], patterns: string[]): string[] {
  return patterns.reduce(addSitePatternToList, normalizeSiteList(list))
}

export function removeSitePatternFromList(
  list: string[],
  pattern: string
): string[] {
  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern) return normalizeSiteList(list)

  const aliases = new Set(getPatternAliases(normalizedPattern))
  return normalizeSiteList(list).filter((item) => !aliases.has(item))
}

function removeSitePatternsFromList(
  list: string[],
  patterns: string[]
): string[] {
  return patterns.reduce(removeSitePatternFromList, normalizeSiteList(list))
}

function createSiteListToggleUpdateForPatterns(
  patterns: string[],
  settings: SiteListSettings,
  checked: boolean
): Pick<SiteListSettings, "disabledFor" | "enabledFor"> {
  const normalizedPatterns = normalizeSiteList(patterns)
  const enabledFor = normalizeEnabledSiteList(settings.enabledFor)
  const disabledFor = normalizeSiteList(settings.disabledFor)

  if (normalizedPatterns.length === 0) {
    return { disabledFor, enabledFor }
  }

  if (settings.enabledByDefault) {
    return {
      disabledFor: checked
        ? removeSitePatternsFromList(disabledFor, normalizedPatterns)
        : addSitePatternsToList(disabledFor, normalizedPatterns),
      enabledFor: checked
        ? enabledFor
        : removeSitePatternsFromList(enabledFor, normalizedPatterns)
    }
  }

  return {
    disabledFor,
    enabledFor: checked
      ? addSitePatternsToList(enabledFor, normalizedPatterns)
      : removeSitePatternsFromList(enabledFor, normalizedPatterns)
  }
}

export function createSiteListToggleUpdate(
  url: string,
  settings: SiteListSettings,
  checked: boolean
): Pick<SiteListSettings, "disabledFor" | "enabledFor"> {
  const pattern = createSitePatternFromUrl(url)
  return createSiteListToggleUpdateForPatterns(
    pattern ? [pattern] : [],
    settings,
    checked
  )
}

export function createWebsiteSiteListToggleUpdate(
  website: WebsiteItem,
  settings: SiteListSettings,
  checked: boolean
): Pick<SiteListSettings, "disabledFor" | "enabledFor"> {
  return createSiteListToggleUpdateForPatterns(
    getWebsiteSitePatterns(website),
    settings,
    checked
  )
}

export function getActiveWebsiteSitePatterns(
  websites: WebsiteItem[]
): string[] {
  return normalizeSiteList(
    websites
      .filter((website) => website.isActive !== false)
      .flatMap((website) => getWebsiteSitePatterns(website))
  )
}
