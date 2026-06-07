export const RTL_SUPPORTED_SITE_IDS = [
  "chatgpt",
  "claude",
  "gemini",
  "copilot",
  "perplexity",
  "deepseek",
  "notebooklm",
  "aistudio",
  "qwen",
  "arena"
] as const

export type RtlSiteId = (typeof RTL_SUPPORTED_SITE_IDS)[number]
export type RtlSiteSettings = Record<RtlSiteId, boolean>

export type RtlSiteConfig = {
  id: RtlSiteId
  icon: string
  matches: string[]
  siteName: string
  url: string
  // Keep matches exact; use wildcardMatches only when every subdomain should
  // intentionally share the same RTL adapter.
  wildcardMatches?: string[]
}

export const RTL_SUPPORTED_SITES: RtlSiteConfig[] = [
  {
    id: "chatgpt",
    url: "https://chatgpt.com",
    matches: ["chatgpt.com", "chat.openai.com"],
    icon: "assets/logos/ChatGPT.svg",
    siteName: "ChatGPT"
  },
  {
    id: "claude",
    url: "https://claude.ai",
    matches: ["claude.ai"],
    icon: "assets/logos/Claude.svg",
    siteName: "Claude"
  },
  {
    id: "gemini",
    url: "https://gemini.google.com",
    matches: ["gemini.google.com"],
    icon: "assets/logos/Gemini.svg",
    siteName: "Gemini"
  },
  {
    id: "copilot",
    url: "https://copilot.microsoft.com",
    matches: ["copilot.microsoft.com"],
    icon: "assets/logos/Copilot.svg",
    siteName: "Copilot"
  },
  {
    id: "perplexity",
    url: "https://www.perplexity.ai",
    matches: ["perplexity.ai", "www.perplexity.ai"],
    icon: "assets/logos/Perplexity.svg",
    siteName: "Perplexity"
  },
  {
    id: "deepseek",
    url: "https://chat.deepseek.com",
    matches: ["chat.deepseek.com", "deepseek.com", "www.deepseek.com"],
    icon: "assets/logos/Deepseek.svg",
    siteName: "DeepSeek"
  },
  {
    id: "notebooklm",
    url: "https://notebooklm.google.com",
    matches: ["notebooklm.google.com"],
    icon: "assets/logos/NotebookLM.svg",
    siteName: "NotebookLM"
  },
  {
    id: "aistudio",
    url: "https://aistudio.google.com",
    matches: ["aistudio.google.com"],
    icon: "assets/logos/AIStudio.svg",
    siteName: "AI Studio"
  },
  {
    id: "qwen",
    url: "https://chat.qwen.ai",
    matches: ["qwen.ai", "chat.qwen.ai"],
    icon: "assets/logos/Qwen.svg",
    siteName: "Qwen"
  },
  {
    id: "arena",
    url: "https://arena.ai",
    matches: ["arena.ai", "www.arena.ai"],
    icon: "assets/logos/Arena.svg",
    siteName: "Arena"
  }
]

export const DEFAULT_RTL_SITE_SETTINGS = RTL_SUPPORTED_SITE_IDS.reduce(
  (settings, siteId) => {
    settings[siteId] = true
    return settings
  },
  {} as RtlSiteSettings
)

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase()
}

function hostMatchesExact(hostname: string, domain: string): boolean {
  return normalizeHost(hostname) === normalizeHost(domain)
}

function hostMatchesWildcard(hostname: string, domain: string): boolean {
  const normalizedHost = normalizeHost(hostname)
  const normalizedDomain = normalizeHost(domain)

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

export function getRtlSiteByHostname(
  hostname: string | undefined
): RtlSiteConfig | null {
  if (!hostname) return null

  return (
    RTL_SUPPORTED_SITES.find(
      (site) =>
        site.matches.some((domain) => hostMatchesExact(hostname, domain)) ||
        site.wildcardMatches?.some((domain) =>
          hostMatchesWildcard(hostname, domain)
        )
    ) ?? null
  )
}

export function getRtlSiteByUrl(
  currentUrl: string | undefined
): RtlSiteConfig | null {
  if (!currentUrl) return null

  try {
    return getRtlSiteByHostname(new URL(currentUrl).hostname)
  } catch {
    return null
  }
}

export function normalizeRtlSiteSettings(value: unknown): RtlSiteSettings {
  const input =
    typeof value === "object" && value !== null
      ? (value as Partial<Record<RtlSiteId, unknown>>)
      : {}

  return RTL_SUPPORTED_SITE_IDS.reduce((settings, siteId) => {
    settings[siteId] =
      typeof input[siteId] === "boolean"
        ? input[siteId]
        : DEFAULT_RTL_SITE_SETTINGS[siteId]
    return settings
  }, {} as RtlSiteSettings)
}

export function isRtlSiteEnabled(
  settings: RtlSiteSettings | undefined,
  siteId: RtlSiteId
): boolean {
  return (settings ?? DEFAULT_RTL_SITE_SETTINGS)[siteId] !== false
}
