import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeWebsiteLists,
  normalizeCustomFontList
} from "../../src/background/storage-manager"
import type { WebsiteItem } from "../../src/definitions"

test("mergeWebsiteLists appends new default sites", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://example.com",
      regex: "^https://example\\.com/.*$",
      isActive: true
    }
  ]
  const defaultList: WebsiteItem[] = [
    ...existingList,
    {
      url: "https://new.example.com",
      regex: "^https://new\\.example\\.com/.*$",
      isActive: true
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), defaultList)
})

test("mergeWebsiteLists updates versioned defaults and preserves active state", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://web.whatsapp.com",
      regex: "^https://web\\.whatsapp\\.com/.*$",
      isActive: false,
      version: "4.0.0"
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://web.whatsapp.com",
      regex: "^https://web\\.whatsapp\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades ChatGPT to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://chatgpt\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://chatgpt\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Facebook to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.facebook.com",
      regex: "^https://www\\.facebook\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.facebook.com",
      regex: "^https://www\\.facebook\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Arena to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://arena.ai",
      regex: "^https://arena\\.ai/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://arena.ai",
      regex: "^https://arena\\.ai/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Claude to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://claude.ai",
      regex: "^https://claude\\.ai/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://claude.ai",
      regex: "^https://claude\\.ai/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Copilot to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://copilot.microsoft.com",
      regex: "^https://copilot\\.microsoft\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://copilot.microsoft.com",
      regex: "^https://copilot\\.microsoft\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades DeepSeek to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://chat.deepseek.com",
      regex: "^https://chat\\.deepseek\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://chat.deepseek.com",
      regex: "^https://chat\\.deepseek\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades AI Studio to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://aistudio.google.com",
      regex: "^https://aistudio\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://aistudio.google.com",
      regex: "^https://aistudio\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Perplexity to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.perplexity.ai",
      regex: "^https://www\\.perplexity\\.ai/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.perplexity.ai",
      regex: "^https://www\\.perplexity\\.ai/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Poe to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://poe.com",
      regex: "^https://poe\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://poe.com",
      regex: "^https://poe\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades OpenRouter to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://openrouter.ai",
      regex: "^https://openrouter\\.ai/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://openrouter.ai",
      regex: "^https://openrouter\\.ai/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades NotebookLM to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://notebooklm.google.com",
      regex: "^https://notebooklm\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://notebooklm.google.com",
      regex: "^https://notebooklm\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Qwen to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://chat.qwen.ai",
      regex: "^https://chat\\.qwen\\.ai/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://chat.qwen.ai",
      regex: "^https://chat\\.qwen\\.ai/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Telegram to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://web.telegram.org",
      regex: "^https://web\\.telegram\\.org/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://web.telegram.org",
      regex: "^https://web\\.telegram\\.org/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Trello to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://trello.com",
      regex: "^https://trello\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://trello.com",
      regex: "^https://trello\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Wikipedia to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.wikipedia.org",
      regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.wikipedia.org",
      regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades YouTube to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.youtube.com",
      regex: "^https://www\\.youtube\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.youtube.com",
      regex: "^https://www\\.youtube\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades DuckDuckGo to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://duckduckgo.com",
      regex: "^https://duckduckgo\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://duckduckgo.com",
      regex: "^https://duckduckgo\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Slack to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://app.slack.com",
      regex: "^https://app\\.slack\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://app.slack.com",
      regex: "^https://app\\.slack\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades X to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://x.com",
      regex: "^https://x\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://x.com",
      regex: "^https://x\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Instagram to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.instagram.com",
      regex: "^https://www\\.instagram\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.instagram.com",
      regex: "^https://www\\.instagram\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades LinkedIn to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.linkedin.com",
      regex: "^https://[^/]*linkedin\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.linkedin.com",
      regex: "^https://[^/]*linkedin\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Gemini to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://gemini.google.com",
      regex: "^https://gemini\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://gemini.google.com",
      regex: "^https://gemini\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Gmail to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://mail.google.com",
      regex: "^https://mail\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://mail.google.com",
      regex: "^https://mail\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Google to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.google.com",
      regex: "^https://www\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.google.com",
      regex: "^https://www\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("normalizeCustomFontList backfills missing file hashes", async () => {
  const [font] = await normalizeCustomFontList([
    {
      value: "LegacyCustom-Fontara",
      name: "Legacy Custom",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2",
      originalFileName: "legacy.woff2"
    }
  ])

  assert.equal(font.fileHash.length, 64)
  assert.equal(font.originalFileName, "legacy.woff2")
})

test("normalizeCustomFontList rejects unsafe custom font records", async () => {
  const fonts = await normalizeCustomFontList([
    {
      value: 'Bad"-Fontara',
      name: "Bad Font",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2"
    },
    {
      value: "InvalidData-Fontara",
      name: "Invalid Data",
      data: `data:text/plain;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2"
    }
  ])

  assert.deepEqual(fonts, [])
})
