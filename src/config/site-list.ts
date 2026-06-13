import type { WebsiteItem } from "../definitions"

export type SiteListSettings = {
  disabledFor: string[]
  enabledByDefault: boolean
  enabledFor: string[]
}

export type SitePatternScope = "custom" | "domain" | "path" | "regex"

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
const SITE_PATTERN_CACHE_LIMIT = 500
const SITE_REGEX_SOURCE_MAX_LENGTH = 512
const PROTOCOL_PATTERN = /^[a-z*][a-z0-9+.-]*:\/\//i

function getCacheEntry<T>(cache: Map<string, T>, key: string): T | undefined {
  const cached = cache.get(key)
  if (cached === undefined) return undefined

  cache.delete(key)
  cache.set(key, cached)
  return cached
}

function setCacheEntry<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.has(key)) {
    cache.delete(key)
  }

  cache.set(key, value)

  while (cache.size > SITE_PATTERN_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) return
    cache.delete(oldestKey)
  }
}

function isRegExpPattern(pattern: string): boolean {
  return pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2
}

function stripURLPort(host: string): string {
  if (host.startsWith("[")) {
    const ipv6EndIndex = host.indexOf("]")
    return ipv6EndIndex > 0 ? host.slice(0, ipv6EndIndex + 1) : host
  }

  const portIndex = host.lastIndexOf(":")
  return portIndex > 0 ? host.slice(0, portIndex) : host
}

function getRawURLLikeHost(value: string): string {
  const withoutProtocol = value.replace(PROTOCOL_PATTERN, "")
  const withoutUserInfo = withoutProtocol.includes("@")
    ? withoutProtocol.slice(withoutProtocol.lastIndexOf("@") + 1)
    : withoutProtocol
  const slashIndex = withoutUserInfo.indexOf("/")
  const host =
    slashIndex < 0 ? withoutUserInfo : withoutUserInfo.slice(0, slashIndex)

  return stripURLPort(host).toLowerCase()
}

function isIPAddressLikeHost(hostname: string): boolean {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^\[[0-9a-f:]+\]$/i.test(hostname)
  )
}

function isUsableSiteHostname(hostname: string, rawHostname: string): boolean {
  if (!hostname || hostname === "*" || hostname.includes("*")) return false
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isIPAddressLikeHost(hostname)
  ) {
    return true
  }

  if (!hostname.includes(".")) return false
  if (rawHostname.includes("..") || rawHostname.startsWith(".")) return false

  return true
}

function isUsableWildcardSiteHost(host: string): boolean {
  const hostname = stripURLPort(host).toLowerCase()
  if (!hostname || hostname === "*") return false
  if (!hostname.includes("*")) return isUsableSiteHostname(hostname, hostname)

  const hostParts = hostname.split(".")
  if (hostParts.some((part) => part === "*")) {
    const stableHost = hostParts.filter((part) => part !== "*").join(".")
    return isUsableSiteHostname(stableHost, stableHost)
  }

  const suffix = hostname.slice(hostname.indexOf("*") + 1).replace(/^\./, "")
  return isUsableSiteHostname(suffix, suffix)
}

function createRegExp(pattern: string): RegExp | null {
  const cached = getCacheEntry(regexpCache, pattern)
  if (cached !== undefined) return cached

  let source = pattern
  if (source.startsWith("/")) {
    source = source.slice(1)
  }
  if (source.endsWith("/")) {
    source = source.slice(0, -1)
  }
  if (source.length > SITE_REGEX_SOURCE_MAX_LENGTH) {
    setCacheEntry(regexpCache, pattern, null)
    return null
  }

  try {
    const regexp = new RegExp(source, "i")
    setCacheEntry(regexpCache, pattern, regexp)
    return regexp
  } catch {
    setCacheEntry(regexpCache, pattern, null)
    return null
  }
}

function prepareURL(url: string): PreparedURL | null {
  const cached = getCacheEntry(preparedURLCache, url)
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
    setCacheEntry(preparedURLCache, url, prepared)
    return prepared
  } catch {
    setCacheEntry(preparedURLCache, url, null)
    return null
  }
}

function preparePattern(pattern: string): PreparedPattern | null {
  const cached = getCacheEntry(preparedPatternCache, pattern)
  if (cached !== undefined) return cached

  if (!pattern) {
    setCacheEntry(preparedPatternCache, pattern, null)
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
  setCacheEntry(preparedPatternCache, pattern, prepared)
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
    const extraPatternParts = pattern.pathParts.slice(url.pathParts.length)
    if (extraPatternParts.some((patternPart) => patternPart !== "*")) {
      return false
    }
  }

  const pathCompareLength = Math.min(
    pattern.pathParts.length,
    url.pathParts.length
  )
  for (let index = 0; index < pathCompareLength; index += 1) {
    const patternPart = pattern.pathParts[index]
    const urlPart = url.pathParts[index]
    if (patternPart !== "*" && patternPart !== urlPart) {
      return false
    }
  }

  return true
}

function normalizeWildcardSiteHost(host: string): string | null {
  const normalizedHost = host.toLowerCase()
  if (!normalizedHost.includes("*")) return normalizedHost

  const hostWithoutPort = stripURLPort(normalizedHost)
  const port = normalizedHost.slice(hostWithoutPort.length)
  if (hostWithoutPort.split(".").some((part) => part === "*")) {
    return normalizedHost
  }

  if (!hostWithoutPort.startsWith("*")) return null

  const suffix = hostWithoutPort.slice(1).replace(/^\./, "")
  if (!suffix) return null

  return `*.${suffix}${port}`
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

export function createSitePatternFromUrl(
  url: string,
  scope: Extract<SitePatternScope, "domain" | "path"> = "domain"
): string | null {
  if (scope === "path") {
    return createSitePathPatternFromUrl(url)
  }

  const pattern = getURLHostOrProtocol(url)
  return normalizeSitePattern(pattern)
}

export function createSitePathPatternFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.host) return createSitePatternFromUrl(url)

    const path =
      parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.replace(/\/+$/, "")
        : ""

    return normalizeSitePattern(`${parsed.host}${path}`)
  } catch {
    return createSitePatternFromUrl(url)
  }
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
    return normalizeWildcardSitePattern(decodedWildcardPattern)
  }

  try {
    const parsed = new URL(
      decodedWildcardPattern.includes("://")
        ? decodedWildcardPattern
        : `https://${decodedWildcardPattern}`
    )
    const rawHostname = getRawURLLikeHost(decodedWildcardPattern)
    if (parsed.host && !isUsableSiteHostname(parsed.hostname, rawHostname)) {
      return null
    }

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
    return null
  }
}

function normalizeRegexSitePattern(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  return normalizeSitePattern(
    isRegExpPattern(trimmed) ? trimmed : `/${trimmed}/`
  )
}

function looksLikeRegexSitePattern(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("^") ||
    value.endsWith("$") ||
    value.includes("\\") ||
    /\(\?|\[[^\]]+\]|\{(?:\d+,?\d*|,\d+)\}|\|/.test(value)
  )
}

function hasMeaningfulURLPath(value: string): boolean {
  try {
    const parsed = new URL(
      PROTOCOL_PATTERN.test(value) ? value : `https://${value}`
    )
    return Boolean(parsed.host && parsed.pathname.replace(/\/+$/, ""))
  } catch {
    const withoutProtocol = value.replace(PROTOCOL_PATTERN, "")
    const slashIndex = withoutProtocol.indexOf("/")
    return (
      slashIndex > 0 &&
      withoutProtocol.slice(slashIndex).replace(/\/+$/, "") !== ""
    )
  }
}

export function inferSitePatternScopeFromInput(
  value: unknown,
  fallback: SitePatternScope = "domain"
): SitePatternScope {
  if (typeof value !== "string") return fallback

  const trimmed = value.trim()
  if (!trimmed) return fallback

  const decodedWildcardPattern = trimmed.replace(/%2a/gi, "*")
  if (isRegExpPattern(trimmed) || looksLikeRegexSitePattern(trimmed)) {
    return "regex"
  }
  if (decodedWildcardPattern.includes("*")) {
    return "custom"
  }
  if (/\s/.test(trimmed)) {
    return fallback
  }
  if (hasMeaningfulURLPath(decodedWildcardPattern)) {
    return "path"
  }

  return "domain"
}

function createSitePatternFromURLLikeInput(
  value: string,
  scope: Extract<SitePatternScope, "domain" | "path">
): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes("*") || isRegExpPattern(trimmed)) {
    return normalizeSitePattern(trimmed)
  }

  try {
    const parsed = new URL(
      PROTOCOL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`
    )
    if (!parsed.host) return normalizeSitePattern(trimmed)

    const path =
      scope === "path" && parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.replace(/\/+$/, "")
        : ""

    return normalizeSitePattern(`${parsed.host}${path}`)
  } catch {
    return normalizeSitePattern(trimmed)
  }
}

export function normalizeSitePatternForScope(
  value: unknown,
  scope: SitePatternScope
): string | null {
  if (typeof value !== "string") return null

  switch (scope) {
    case "custom":
      return normalizeSitePattern(value)
    case "domain":
      return createSitePatternFromURLLikeInput(value, "domain")
    case "path":
      return createSitePatternFromURLLikeInput(value, "path")
    case "regex":
      return normalizeRegexSitePattern(value)
  }
}

function normalizeWildcardSitePattern(pattern: string): string | null {
  const withoutProtocol = pattern.replace(PROTOCOL_PATTERN, "")
  const slashIndex = withoutProtocol.indexOf("/")
  const host =
    slashIndex < 0 ? withoutProtocol : withoutProtocol.slice(0, slashIndex)

  if (!host || host === "*") return null
  if (!isUsableWildcardSiteHost(host)) return null
  const normalizedHost = normalizeWildcardSiteHost(host)
  if (!normalizedHost) return null

  const path = slashIndex < 0 ? "" : withoutProtocol.slice(slashIndex)
  const normalizedPath = path && path !== "/" ? path.replace(/\/+$/, "") : ""
  const normalized = `${normalizedHost}${normalizedPath}`.toLowerCase()

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
  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern) return false

  if (isRegExpPattern(normalizedPattern)) {
    return createRegExp(normalizedPattern)?.test(url) === true
  }

  return matchPreparedURLPattern(
    prepareURL(url),
    preparePattern(normalizedPattern)
  )
}

export function isURLInSiteList(url: string, list: string[]): boolean {
  return list.some((pattern) => isURLMatched(url, pattern))
}

export function getSitePatternScope(pattern: string): SitePatternScope {
  const wildcardPattern = pattern.trim().replace(/%2a/gi, "*")
  if (wildcardPattern.includes("*") && !isRegExpPattern(wildcardPattern)) {
    return "custom"
  }

  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern || normalizedPattern === "*") return "custom"
  if (isRegExpPattern(normalizedPattern)) return "regex"
  if (normalizedPattern.includes("*")) return "custom"
  if (normalizedPattern.includes("/")) return "path"
  return "domain"
}

function getSitePatternMatchScore(pattern: string): number {
  const normalizedPattern = normalizeSitePattern(pattern)
  if (!normalizedPattern) return 0

  const scopeScore = {
    custom: 1,
    domain: 2,
    path: 3,
    regex: 4
  } satisfies Record<SitePatternScope, number>

  return (
    scopeScore[getSitePatternScope(normalizedPattern)] * 1000 + pattern.length
  )
}

export function getMatchingSiteListPattern(
  url: string,
  list: string[]
): string | null {
  return (
    normalizeSiteList(list)
      .filter((pattern) => isURLMatched(url, pattern))
      .sort(
        (firstPattern, secondPattern) =>
          getSitePatternMatchScore(secondPattern) -
          getSitePatternMatchScore(firstPattern)
      )[0] ?? null
  )
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

export function createSiteListPatternToggleUpdate(
  pattern: string,
  settings: SiteListSettings,
  checked: boolean
): Pick<SiteListSettings, "disabledFor" | "enabledFor"> {
  const normalizedPattern = normalizeSitePattern(pattern)
  return createSiteListToggleUpdateForPatterns(
    normalizedPattern ? [normalizedPattern] : [],
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

export function createSiteListPatternAddUpdate(
  pattern: string,
  settings: SiteListSettings
): Pick<SiteListSettings, "disabledFor" | "enabledFor"> {
  const normalizedPattern = normalizeSitePattern(pattern)
  return createSiteListToggleUpdateForPatterns(
    normalizedPattern ? [normalizedPattern] : [],
    settings,
    !settings.enabledByDefault
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
