import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test, { afterEach } from "node:test"

import {
  getRtlSiteByUrl,
  RTL_SUPPORTED_SITE_IDS,
  RTL_SUPPORTED_SITES
} from "../../src/config/rtl-sites"
import {
  addSitePatternToList,
  createSiteListPatternAddUpdate,
  createSitePathPatternFromUrl,
  createSitePatternFromUrl,
  createWebsiteSiteListToggleUpdate,
  getDisplaySitePattern,
  getMatchingSiteListPattern,
  getSitePatternScope,
  getWebsiteSitePatterns,
  inferSitePatternScopeFromInput,
  isSiteListUrlEnabled,
  isURLMatched,
  normalizeEnabledSiteList,
  normalizeSiteList,
  normalizeSitePattern,
  normalizeSitePatternForScope
} from "../../src/config/site-list"
import {
  normalizeFontaraSiteManagerSettings,
  resolveFontaraSiteConfig
} from "../../src/config/site-manager"
import {
  getSiteProfileForUrl,
  normalizeSiteProfiles
} from "../../src/config/site-profiles"
import {
  DEFAULT_PINNED_WEBSITE_URLS,
  normalizePinnedWebsiteUrls,
  POPULAR_WEBSITES
} from "../../src/config/sites"
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

test("site configuration stays internally consistent", () => {
  const websiteUrls = new Set<string>()
  const websiteNames = new Set<string>()
  const siteFixesSource = fs.readFileSync(
    path.resolve("src/config/site-fixes.ts"),
    "utf8"
  )
  const customCssUrls = new Set(
    [...siteFixesSource.matchAll(/"https:\/\/[^"]+":/g)].map((match) =>
      match[0].slice(1, -2)
    )
  )

  for (const website of POPULAR_WEBSITES) {
    assert.equal(
      websiteUrls.has(website.url),
      false,
      `${website.url} should be unique`
    )
    websiteUrls.add(website.url)

    if (website.siteName) {
      assert.equal(
        websiteNames.has(website.siteName),
        false,
        `${website.siteName} should be unique`
      )
      websiteNames.add(website.siteName)
    }

    assert.ok(normalizeSitePattern(website.url), `${website.url} is invalid`)
    assert.doesNotThrow(
      () => new RegExp(website.regex, "i"),
      `${website.url} has an invalid regex`
    )

    if (website.pattern) {
      assert.ok(
        normalizeSitePattern(website.pattern),
        `${website.url} has an invalid extension pattern`
      )
    }

    if (website.customCss) {
      assert.ok(
        customCssUrls.has(website.url),
        `${website.url} enables custom CSS without a CSS fix`
      )
    }
  }

  for (const customCssUrl of customCssUrls) {
    const website = POPULAR_WEBSITES.find((site) => site.url === customCssUrl)
    assert.ok(website, `${customCssUrl} CSS has no website entry`)
    assert.equal(
      website?.customCss,
      true,
      `${customCssUrl} CSS is mapped to a non-CSS website`
    )
  }

  assert.deepEqual(
    [...new Set(RTL_SUPPORTED_SITE_IDS)],
    [...RTL_SUPPORTED_SITE_IDS],
    "RTL site ids should be unique"
  )
  assert.deepEqual(
    RTL_SUPPORTED_SITES.map((site) => site.id),
    [...RTL_SUPPORTED_SITE_IDS],
    "RTL site config order should match the supported id tuple"
  )
  for (const rtlSite of RTL_SUPPORTED_SITES) {
    assert.ok(normalizeSitePattern(rtlSite.url), `${rtlSite.id} URL is invalid`)
    assert.ok(websiteUrls.has(rtlSite.url), `${rtlSite.id} has no website`)
    assert.equal(
      fs.existsSync(path.resolve(rtlSite.icon)),
      true,
      `${rtlSite.id} icon is missing`
    )
  }
})

test("default popup pins stay limited to known popular websites", () => {
  const popularWebsiteUrls = new Set(POPULAR_WEBSITES.map((site) => site.url))

  assert.ok(DEFAULT_PINNED_WEBSITE_URLS.length > 0)
  assert.ok(DEFAULT_PINNED_WEBSITE_URLS.length < POPULAR_WEBSITES.length)
  assert.deepEqual(
    new Set(DEFAULT_PINNED_WEBSITE_URLS).size,
    DEFAULT_PINNED_WEBSITE_URLS.length
  )

  for (const url of DEFAULT_PINNED_WEBSITE_URLS) {
    assert.equal(popularWebsiteUrls.has(url), true, `${url} should be known`)
  }

  assert.deepEqual(
    normalizePinnedWebsiteUrls(
      [
        "https://chatgpt.com",
        "https://unknown.example",
        " https://chatgpt.com ",
        "https://github.com",
        42
      ],
      []
    ),
    ["https://chatgpt.com", "https://github.com"]
  )
  assert.deepEqual(normalizePinnedWebsiteUrls(undefined), [
    ...DEFAULT_PINNED_WEBSITE_URLS
  ])
  assert.deepEqual(normalizePinnedWebsiteUrls([], []), [])
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

test("site pattern scopes separate domain, path, and regex matching", () => {
  const url = "https://foo.mimalef70.github.io/fontara/"

  assert.equal(createSitePatternFromUrl(url), "foo.mimalef70.github.io")
  assert.equal(
    createSitePathPatternFromUrl(url),
    "foo.mimalef70.github.io/fontara"
  )
  assert.equal(
    normalizeSitePatternForScope(url, "domain"),
    "foo.mimalef70.github.io"
  )
  assert.equal(
    normalizeSitePatternForScope(url, "path"),
    "foo.mimalef70.github.io/fontara"
  )
  assert.equal(
    normalizeSitePatternForScope("^https?://foo\\.example\\.com/path", "regex"),
    "/^https?://foo\\.example\\.com/path/"
  )
  assert.equal(getSitePatternScope("foo.mimalef70.github.io"), "domain")
  assert.equal(getSitePatternScope("foo.mimalef70.github.io/fontara"), "path")
  assert.equal(getSitePatternScope("*.mimalef70.github.io"), "custom")
  assert.equal(getSitePatternScope("*.mimalef70.github.io/fontara"), "custom")
  assert.equal(getSitePatternScope("*.linkedin.com"), "custom")
  assert.equal(
    getSitePatternScope("/^https?://foo\\.example\\.com/path/"),
    "regex"
  )
  assert.equal(inferSitePatternScopeFromInput("", "path"), "path")
  assert.equal(inferSitePatternScopeFromInput("google.com"), "domain")
  assert.equal(inferSitePatternScopeFromInput("https://google.com/"), "domain")
  assert.equal(inferSitePatternScopeFromInput("google.com/"), "domain")
  assert.equal(inferSitePatternScopeFromInput("google.com/?q=1"), "domain")
  assert.equal(normalizeSitePatternForScope("اشسبشسیشسیشسیشسی", "domain"), null)
  assert.equal(
    normalizeSitePatternForScope("مثال.com", "domain"),
    "xn--mgbh0fb.com"
  )
  assert.equal(
    normalizeSitePatternForScope("https://مثال.com/maps", "path"),
    "xn--mgbh0fb.com/maps"
  )
  assert.equal(inferSitePatternScopeFromInput("google.com/maps"), "path")
  assert.equal(
    inferSitePatternScopeFromInput("https://google.com/maps?q=1"),
    "path"
  )
  assert.equal(inferSitePatternScopeFromInput("localhost:3000/app"), "path")
  assert.equal(inferSitePatternScopeFromInput("127.0.0.1:3000"), "domain")
  assert.equal(inferSitePatternScopeFromInput("*.google.com/maps"), "custom")
  assert.equal(inferSitePatternScopeFromInput("google.com/*"), "custom")
  assert.equal(
    inferSitePatternScopeFromInput("^https?://google\\.com/maps"),
    "regex"
  )
  assert.equal(
    inferSitePatternScopeFromInput("/^https?://google\\.com/maps/"),
    "regex"
  )
  assert.equal(
    getMatchingSiteListPattern(url, [
      "foo.mimalef70.github.io",
      "foo.mimalef70.github.io/fontara"
    ]),
    "foo.mimalef70.github.io/fontara"
  )
  assert.equal(
    isURLMatched(
      "https://foo.mimalef70.github.io/other/",
      "foo.mimalef70.github.io"
    ),
    true
  )
  assert.equal(
    isURLMatched(
      "https://foo.mimalef70.github.io/other/",
      "foo.mimalef70.github.io/fontara"
    ),
    false
  )
  assert.equal(
    isSiteListUrlEnabled("https://foo.mimalef70.github.io/fontara/", {
      disabledFor: ["foo.mimalef70.github.io"],
      enabledByDefault: true,
      enabledFor: ["foo.mimalef70.github.io/fontara"]
    }),
    true
  )
  assert.equal(
    isSiteListUrlEnabled("https://foo.mimalef70.github.io/other/", {
      disabledFor: ["foo.mimalef70.github.io"],
      enabledByDefault: true,
      enabledFor: ["foo.mimalef70.github.io/fontara"]
    }),
    false
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
    isURLMatched("https://www.linkedin.com/feed", "*linkedin.com"),
    true
  )
  assert.equal(
    isURLMatched("https://www.linkedin.com/feed", "https://*linkedin.com/*"),
    true
  )
  assert.equal(
    isURLMatched("https://www.linkedin.com/", "*.linkedin.com/*"),
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

test("site list pattern caches are capped with LRU eviction", () => {
  const siteListSource = fs.readFileSync(
    path.resolve("src/config/site-list.ts"),
    "utf8"
  )

  assert.match(siteListSource, /const SITE_PATTERN_CACHE_LIMIT = 500/)
  assert.match(siteListSource, /const SITE_REGEX_SOURCE_MAX_LENGTH = 512/)
  assert.match(siteListSource, /function getCacheEntry/)
  assert.match(siteListSource, /function setCacheEntry/)
  assert.match(siteListSource, /cache\.delete\(key\)/)
  assert.match(siteListSource, /cache\.size > SITE_PATTERN_CACHE_LIMIT/)
  assert.match(siteListSource, /cache\.delete\(oldestKey\)/)
})

test("site list helpers keep append order and reject invalid regex patterns", () => {
  assert.deepEqual(addSitePatternToList(["b.com"], "a.com"), ["b.com", "a.com"])
  assert.deepEqual(addSitePatternToList(["dropbox.com"], "www.dropbox.com"), [
    "dropbox.com"
  ])
  assert.equal(normalizeSitePattern("/(/"), null)
  assert.equal(normalizeSitePattern("/example\\s+site/"), "/example\\s+site/")
  assert.equal(normalizeSitePattern(`/${"a".repeat(513)}/`), null)
  assert.equal(
    isURLMatched("https://example.com/path", "/example\\.com\\/path/"),
    true
  )
  assert.equal(normalizeSitePattern("%2a.dropbox.com"), "*.dropbox.com")
  assert.equal(normalizeSitePattern("%2A.linkedin.com"), "*.linkedin.com")
  assert.equal(normalizeSitePattern("*linkedin.com"), "*.linkedin.com")
  assert.equal(
    normalizeSitePattern("https://*linkedin.com/*"),
    "*.linkedin.com/*"
  )
  assert.equal(normalizeSitePattern("foo*linkedin.com"), null)
  assert.equal(normalizeSitePattern("%2a/github.com"), null)
  assert.equal(normalizeSitePattern("*/github.com"), null)
  assert.equal(normalizeSitePattern("اشسبشسیشسیشسیشسی"), null)
  assert.equal(normalizeSitePattern("xn--mgbc6abaaaccbbb58qcacc"), null)
  assert.equal(normalizeSitePattern("github"), null)
  assert.equal(normalizeSitePattern("localhost:3000"), "localhost:3000")
  assert.equal(normalizeSitePattern("127.0.0.1:3000"), "127.0.0.1:3000")
  assert.equal(normalizeSitePattern("مثال.com"), "xn--mgbh0fb.com")
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
  assert.deepEqual(normalizeSiteList(["%2a/github.com", "github.com"]), [
    "github.com"
  ])
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

test("site profiles normalize patterns and resolve the strongest matching override", () => {
  assert.deepEqual(
    normalizeSiteProfiles([
      { pattern: " https://ChatGPT.com/ ", font: "Vazirmatn-Fontara" },
      { pattern: "chatgpt.com", textStroke: 0.26 },
      { enabled: false, font: "Samim-Fontara", pattern: "chatgpt.com/c/1" },
      { pattern: "empty.example.com" },
      { pattern: "/(/", font: "Samim-Fontara" }
    ]),
    [
      {
        font: "Vazirmatn-Fontara",
        pattern: "chatgpt.com",
        textStroke: 0.3
      },
      {
        enabled: false,
        font: "Samim-Fontara",
        pattern: "chatgpt.com/c/1"
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
  assert.deepEqual(
    getSiteProfileForUrl("https://chatgpt.com/c/1", [
      { pattern: "chatgpt.com", font: "Samim-Fontara" },
      { pattern: "chatgpt.com/c/1", textStroke: 0.5 }
    ]),
    {
      pattern: "chatgpt.com/c/1",
      textStroke: 0.5
    }
  )
  assert.deepEqual(
    getSiteProfileForUrl("https://chatgpt.com/c/1", [
      { pattern: "chatgpt.com", font: "Samim-Fontara" },
      { enabled: false, pattern: "chatgpt.com/c/1", textStroke: 0.5 }
    ]),
    {
      font: "Samim-Fontara",
      pattern: "chatgpt.com"
    }
  )
  assert.deepEqual(
    getSiteProfileForUrl(
      "https://chatgpt.com/c/1",
      [
        { pattern: "chatgpt.com", font: "Samim-Fontara" },
        { enabled: false, pattern: "chatgpt.com/c/1", textStroke: 0.5 }
      ],
      { includeDisabled: true }
    ),
    {
      enabled: false,
      pattern: "chatgpt.com/c/1",
      textStroke: 0.5
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

test("FontARA site manager resolves font, profile, and RTL config together", () => {
  const config = resolveFontaraSiteConfig("https://chatgpt.com/c/1", {
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["chatgpt.com"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.RTL_ENABLED]: true,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_VALUES.RTL_SITE_SETTINGS,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        enabled: false,
        font: "Vazirmatn-Fontara",
        pattern: "chatgpt.com/c/1"
      },
      {
        font: "Samim-Fontara",
        pattern: "chatgpt.com",
        textStroke: 0.4
      }
    ],
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  })

  assert.equal(config.font.active, true)
  assert.equal(config.font.matchingWebsite?.siteName, "ChatGPT")
  assert.deepEqual(config.font.siteProfile, {
    font: "Samim-Fontara",
    pattern: "chatgpt.com",
    textStroke: 0.4
  })
  assert.equal(config.rtl.active, true)
  assert.equal(config.rtl.matchingSite?.id, "chatgpt")
})

test("FontARA site manager normalizes a typed settings snapshot", () => {
  const snapshot = normalizeFontaraSiteManagerSettings({
    [STORAGE_KEYS.DISABLED_FOR]: [" https://ChatGPT.com/ "],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: "not-a-boolean",
    [STORAGE_KEYS.ENABLED_FOR]: ["%2A.wikipedia.org", "/(/"],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.RTL_ENABLED]: false,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: {
      chatgpt: false,
      claude: "bad"
    },
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        font: "Samim-Fontara",
        pattern: "https://chatgpt.com/",
        textStroke: 0.26
      },
      {
        font: "",
        pattern: "invalid profile without overrides"
      }
    ],
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  })

  assert.deepEqual(snapshot.disabledFor, ["chatgpt.com"])
  assert.equal(snapshot.enabledByDefault, false)
  assert.deepEqual(snapshot.enabledFor, ["*.wikipedia.org"])
  assert.equal(snapshot.extensionEnabled, true)
  assert.equal(snapshot.rtlEnabled, false)
  assert.equal(snapshot.rtlSiteSettings.chatgpt, false)
  assert.equal(snapshot.rtlSiteSettings.claude, true)
  assert.deepEqual(snapshot.siteProfiles, [
    {
      font: "Samim-Fontara",
      pattern: "chatgpt.com",
      textStroke: 0.3
    }
  ])
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
