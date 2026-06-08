import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test, { afterEach } from "node:test"

import {
  getRtlSiteByUrl,
  RTL_SUPPORTED_SITES
} from "../../src/config/rtl-sites"
import {
  addSitePatternToList,
  createSiteListPatternAddUpdate,
  createWebsiteSiteListToggleUpdate,
  getDisplaySitePattern,
  getWebsiteSitePatterns,
  isSiteListUrlEnabled,
  isURLMatched,
  normalizeEnabledSiteList,
  normalizeSiteList,
  normalizeSitePattern
} from "../../src/config/site-list"
import {
  getSiteProfileForUrl,
  normalizeSiteProfiles
} from "../../src/config/site-profiles"
import { POPULAR_WEBSITES } from "../../src/config/sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { WebsiteItem } from "../../src/definitions"
import {
  createRegexFromUrl,
  getMatchingWebsite,
  getUrlActivationState,
  getUrlActivationStateFromSettings,
  isUrlActive
} from "../../src/utils/url"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

function mockLocalStorage(values: Record<string, unknown>): void {
  Reflect.set(globalThis, "chrome", {
    storage: {
      local: {
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof key === "string") {
            callback({ [key]: values[key] })
            return
          }

          callback({ ...key, ...values })
        }
      }
    }
  })
}

test("popular website regexes match their declared base URLs", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.equal(getMatchingWebsite(`${website.url}/`, [website]), website)
  }
})

test("popular website icons point to existing assets", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.ok(website.icon, `${website.siteName} should declare an icon`)
    assert.ok(
      fs.existsSync(path.resolve(website.icon)),
      `${website.siteName} icon is missing: ${website.icon}`
    )
  }
})

test("AI website icons use provided brand assets", () => {
  const expectedIcons = new Map([
    ["AI Studio", "assets/logos/AIStudio.svg"],
    ["Arena", "assets/logos/Arena.svg"],
    ["ChatGPT", "assets/logos/ChatGPT.svg"],
    ["Claude", "assets/logos/Claude.svg"],
    ["Copilot", "assets/logos/Copilot.svg"],
    ["DeepSeek", "assets/logos/Deepseek.svg"],
    ["Gemini", "assets/logos/Gemini.svg"],
    ["NotebookLM", "assets/logos/NotebookLM.svg"],
    ["Perplexity", "assets/logos/Perplexity.svg"],
    ["Poe", "assets/logos/poe.svg"],
    ["Qwen", "assets/logos/Qwen.svg"]
  ])

  for (const [siteName, expectedIcon] of expectedIcons) {
    const website = POPULAR_WEBSITES.find((site) => site.siteName === siteName)
    assert.equal(website?.icon, expectedIcon)
  }
})

test("X uses the X brand instead of Twitter assets", () => {
  const website = POPULAR_WEBSITES.find((site) => site.url === "https://x.com")

  assert.equal(website?.siteName, "X")
  assert.equal(website?.icon, "assets/logos/x-active.svg")
})

test("popular websites are ordered by priority and category", () => {
  assert.deepEqual(
    POPULAR_WEBSITES.map((site) => site.siteName),
    [
      "ChatGPT",
      "Claude",
      "Gemini",
      "Copilot",
      "Perplexity",
      "Poe",
      "OpenRouter",
      "DeepSeek",
      "Qwen",
      "NotebookLM",
      "AI Studio",
      "Arena",
      "Google",
      "YouTube",
      "Gmail",
      "X",
      "LinkedIn",
      "Instagram",
      "Facebook",
      "GitHub",
      "WhatsApp",
      "Telegram",
      "Slack",
      "Messages",
      "Trello",
      "Wikipedia",
      "DuckDuckGo",
      "Medium",
      "Goodreads",
      "Dropbox"
    ]
  )
})

test("RTL supported sites mirror the imported sample extension platforms", () => {
  assert.deepEqual(
    RTL_SUPPORTED_SITES.map((site) => site.id),
    [
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
    ]
  )
})

test("RTL host matching keeps wildcard support explicit", () => {
  const rtlSitesSource = fs.readFileSync(
    path.resolve("src/config/rtl-sites.ts"),
    "utf8"
  )

  assert.match(rtlSitesSource, /Keep matches exact/)
  assert.match(rtlSitesSource, /wildcardMatches\?: string\[\]/)
  assert.match(rtlSitesSource, /hostMatchesExact/)
  assert.match(rtlSitesSource, /hostMatchesWildcard/)
})

test("RTL site matching handles supported host aliases", () => {
  assert.equal(getRtlSiteByUrl("https://chat.openai.com/c/1")?.id, "chatgpt")
  assert.equal(getRtlSiteByUrl("https://chatgpt.com/c/1")?.id, "chatgpt")
  assert.equal(
    getRtlSiteByUrl("https://www.perplexity.ai/search")?.id,
    "perplexity"
  )
  assert.equal(getRtlSiteByUrl("https://deepseek.com/")?.id, "deepseek")
  assert.equal(getRtlSiteByUrl("https://chat.deepseek.com/")?.id, "deepseek")
  assert.equal(getRtlSiteByUrl("https://www.deepseek.com/")?.id, "deepseek")
  assert.equal(getRtlSiteByUrl("https://chat.qwen.ai/")?.id, "qwen")
  assert.equal(getRtlSiteByUrl("https://qwen.ai/")?.id, "qwen")
  assert.equal(getRtlSiteByUrl("https://www.arena.ai/")?.id, "arena")
  assert.equal(getRtlSiteByUrl("https://example.com/"), null)
  assert.equal(getRtlSiteByUrl("https://docs.deepseek.com/"), null)
  assert.equal(getRtlSiteByUrl("https://foo.qwen.ai/"), null)
  assert.equal(getRtlSiteByUrl("https://labs.perplexity.ai/"), null)
  assert.equal(getRtlSiteByUrl("https://foo.arena.ai/"), null)
})

test("custom URL regex matches the same host over http and https", () => {
  const regex = createRegexFromUrl("https://example.com/path")
  const customWebsite: WebsiteItem = {
    url: "https://example.com/path",
    regex,
    isActive: true
  }

  assert.equal(
    getMatchingWebsite("https://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(
    getMatchingWebsite("http://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(
    getMatchingWebsite("https://sub.example.com/", [customWebsite]),
    null
  )
})

test("custom URL regex escapes host metacharacters", () => {
  const regex = createRegexFromUrl("http://[::1]/path")
  const customWebsite: WebsiteItem = {
    url: "http://[::1]/path",
    regex,
    isActive: true
  }

  assert.equal(
    getMatchingWebsite("http://[::1]/anything", [customWebsite]),
    customWebsite
  )
})

test("isUrlActive falls back to default websites when local storage is empty", async () => {
  mockLocalStorage({})

  assert.equal(await isUrlActive(`${POPULAR_WEBSITES[0].url}/`), true)
})

test("getUrlActivationState returns active status and matching website together", async () => {
  mockLocalStorage({})

  const state = await getUrlActivationState(`${POPULAR_WEBSITES[0].url}/`)
  assert.equal(state.active, true)
  assert.equal(state.matchingWebsite?.url, POPULAR_WEBSITES[0].url)
})

test("isUrlActive respects the global disabled flag", async () => {
  mockLocalStorage({
    [STORAGE_KEYS.EXTENSION_ENABLED]: false
  })

  assert.equal(await isUrlActive(`${POPULAR_WEBSITES[0].url}/`), false)
})

test("site list URL matching supports wildcard and path behavior", () => {
  assert.equal(
    isURLMatched("https://www.google.com/search", "google.com"),
    true
  )
  assert.equal(
    isURLMatched("https://mail.google.com/mail/u/0", "google.com"),
    false
  )
  assert.equal(
    isURLMatched("https://mail.google.com/mail/u/0", "mail.google.*/mail"),
    true
  )
  assert.equal(
    isURLMatched(
      "https://leetcode.com/problems/two-sum/",
      "leetcode.com/problems"
    ),
    true
  )
  assert.equal(
    isURLMatched(
      "https://leetcode.com/problemset/all/",
      "leetcode.com/problems"
    ),
    false
  )
  assert.equal(
    isURLMatched("https://example.com/?q=*", "/example\\.com/"),
    true
  )
})

test("site list URL cache is capped with LRU eviction", () => {
  const siteListSource = fs.readFileSync(
    path.resolve("src/config/site-list.ts"),
    "utf8"
  )

  assert.match(siteListSource, /const PREPARED_URL_CACHE_LIMIT = 500/)
  assert.match(siteListSource, /function getPreparedURLCacheEntry/)
  assert.match(siteListSource, /function setPreparedURLCacheEntry/)
  assert.match(siteListSource, /preparedURLCache\.delete\(url\)/)
  assert.match(
    siteListSource,
    /preparedURLCache\.size > PREPARED_URL_CACHE_LIMIT/
  )
  assert.match(siteListSource, /preparedURLCache\.delete\(oldestKey\)/)
})

test("site list helpers keep append order and reject invalid regex patterns", () => {
  assert.deepEqual(addSitePatternToList(["b.com"], "a.com"), ["b.com", "a.com"])
  assert.deepEqual(addSitePatternToList(["dropbox.com"], "www.dropbox.com"), [
    "dropbox.com"
  ])
  assert.equal(normalizeSitePattern("/(/"), null)
  assert.equal(normalizeSitePattern("/example\\s+site/"), "/example\\s+site/")
  assert.equal(
    isURLMatched("https://example.com/path", "/example\\.com\\/path/"),
    true
  )
  assert.equal(normalizeSitePattern("%2a.dropbox.com"), "*.dropbox.com")
  assert.equal(normalizeSitePattern("%2A.linkedin.com"), "*.linkedin.com")
  assert.equal(
    normalizeSitePattern("https://%2A.wikipedia.org"),
    "*.wikipedia.org"
  )
  assert.equal(
    normalizeSitePattern("https://%2a.wikipedia.org/wiki"),
    "*.wikipedia.org/wiki"
  )
  assert.equal(getDisplaySitePattern("%2a.linkedin.com"), "*.linkedin.com")
  assert.equal(
    getDisplaySitePattern(" https://%2A.linkedin.com/ "),
    "*.linkedin.com"
  )
  assert.deepEqual(
    normalizeSiteList(["www.dropbox.com", "dropbox.com", "*.dropbox.com"]),
    ["dropbox.com", "*.dropbox.com"]
  )
  assert.deepEqual(
    normalizeSiteList(["www.wikipedia.org", "*.wikipedia.org"]),
    ["*.wikipedia.org"]
  )
  assert.deepEqual(normalizeEnabledSiteList(["%2a.linkedin.com"]), [
    "*.linkedin.com"
  ])
})

test("site profiles normalize patterns and resolve the first matching override", () => {
  assert.deepEqual(
    normalizeSiteProfiles([
      { pattern: " https://ChatGPT.com/ ", font: "Vazirmatn-Fontara" },
      { pattern: "chatgpt.com", textStroke: 0.26 },
      { pattern: "empty.example.com" },
      { pattern: "/(/", font: "Samim-Fontara" }
    ]),
    [
      {
        font: "Vazirmatn-Fontara",
        pattern: "chatgpt.com",
        textStroke: 0.3
      }
    ]
  )

  assert.deepEqual(
    getSiteProfileForUrl("https://chatgpt.com/c/1", [
      { pattern: "example.com", font: "Samim-Fontara" },
      { pattern: "chatgpt.com", textStroke: 0.4 }
    ]),
    {
      pattern: "chatgpt.com",
      textStroke: 0.4
    }
  )
})

test("site list settings support include and exclude modes", () => {
  assert.equal(
    isSiteListUrlEnabled("https://example.com/", {
      disabledFor: [],
      enabledByDefault: false,
      enabledFor: ["example.com"]
    }),
    true
  )
  assert.equal(
    isSiteListUrlEnabled("https://mail.google.com/mail/u/0", {
      disabledFor: [],
      enabledByDefault: false,
      enabledFor: ["google.com"]
    }),
    false
  )
  assert.equal(
    isSiteListUrlEnabled("https://mail.google.com/mail/u/0", {
      disabledFor: ["mail.google.*/mail"],
      enabledByDefault: true,
      enabledFor: []
    }),
    false
  )
  assert.equal(
    isSiteListUrlEnabled("https://mail.google.com/mail/u/0", {
      disabledFor: ["mail.google.*/mail"],
      enabledByDefault: true,
      enabledFor: ["mail.google.com"]
    }),
    true
  )
})

test("popular website toggles update every configured site pattern", () => {
  const linkedIn = POPULAR_WEBSITES.find((site) => site.siteName === "LinkedIn")
  assert.ok(linkedIn)
  assert.deepEqual(getWebsiteSitePatterns(linkedIn), [
    "linkedin.com",
    "*.linkedin.com"
  ])

  const dropbox = POPULAR_WEBSITES.find((site) => site.siteName === "Dropbox")
  assert.ok(dropbox)
  assert.deepEqual(getWebsiteSitePatterns(dropbox), [
    "dropbox.com",
    "*.dropbox.com"
  ])

  const siteListSettings = {
    disabledFor: [],
    enabledByDefault: false,
    enabledFor: getWebsiteSitePatterns(linkedIn)
  }
  const update = createWebsiteSiteListToggleUpdate(
    linkedIn,
    siteListSettings,
    false
  )

  assert.deepEqual(update.enabledFor, [])
  assert.equal(
    isSiteListUrlEnabled("https://www.linkedin.com/feed/", {
      ...siteListSettings,
      ...update
    }),
    false
  )
  assert.equal(
    isSiteListUrlEnabled("https://jobs.linkedin.com/", {
      ...siteListSettings,
      ...update
    }),
    false
  )
})

test("manual exclude removes matching enabled overrides", () => {
  const update = createSiteListPatternAddUpdate("chatgpt.com", {
    disabledFor: [],
    enabledByDefault: true,
    enabledFor: ["chatgpt.com"]
  })

  assert.deepEqual(update, {
    disabledFor: ["chatgpt.com"],
    enabledFor: []
  })
  assert.equal(
    isSiteListUrlEnabled("https://chatgpt.com/", {
      ...update,
      enabledByDefault: true
    }),
    false
  )
})

test("getUrlActivationState uses site list settings and keeps website metadata", async () => {
  mockLocalStorage({
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["example.com"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        font: "Samim-Fontara",
        pattern: "example.com",
        textStroke: 0.4
      }
    ],
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        isActive: false,
        regex: "^https?://example\\.com/?.*$",
        siteName: "Example",
        url: "https://example.com"
      }
    ]
  })

  const state = await getUrlActivationState("https://example.com/")

  assert.equal(state.active, true)
  assert.equal(state.matchingWebsite?.siteName, "Example")
  assert.deepEqual(state.siteProfile, {
    font: "Samim-Fontara",
    pattern: "example.com",
    textStroke: 0.4
  })
})

test("getUrlActivationStateFromSettings resolves activation from a normalized snapshot", () => {
  const state = getUrlActivationStateFromSettings("https://example.com/", {
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["example.com"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        font: "Samim-Fontara",
        pattern: "example.com",
        textStroke: 0.4
      }
    ],
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        isActive: false,
        regex: "^https?://example\\.com/?.*$",
        siteName: "Example",
        url: "https://example.com"
      }
    ]
  })

  assert.equal(state.active, true)
  assert.equal(state.matchingWebsite?.siteName, "Example")
  assert.deepEqual(state.siteProfile, {
    font: "Samim-Fontara",
    pattern: "example.com",
    textStroke: 0.4
  })
})

test("default site list values keep existing popular sites active", async () => {
  mockLocalStorage({
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR
  })

  assert.equal(await isUrlActive(`${POPULAR_WEBSITES[0].url}/`), true)
})

test("runtime derives missing site list settings from legacy website list before migration", async () => {
  const legacyWebsiteList = DEFAULT_VALUES.WEBSITE_LIST.map((website, index) =>
    index === 0 ? { ...website, isActive: false } : website
  )
  mockLocalStorage({
    [STORAGE_KEYS.WEBSITE_LIST]: legacyWebsiteList
  })

  assert.equal(await isUrlActive(`${legacyWebsiteList[0].url}/`), false)
  assert.equal(await isUrlActive(`${legacyWebsiteList[1].url}/`), true)
})

test("default site list values preserve wildcard default site coverage", async () => {
  mockLocalStorage({
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR
  })

  assert.equal(await isUrlActive("https://en.wikipedia.org/wiki/Font"), true)
  assert.equal(await isUrlActive("https://jobs.linkedin.com/"), true)
  assert.equal(DEFAULT_VALUES.ENABLED_FOR.includes("*.wikipedia.org"), true)
  assert.equal(DEFAULT_VALUES.ENABLED_FOR.includes("*.linkedin.com"), true)
})
