import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  ensureStorageValues,
  mergeWebsiteLists,
  normalizeCustomFontList
} from "../../src/background/storage-manager"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { WebsiteItem } from "../../src/definitions"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

function mockLocalStorage(values: Record<string, unknown>): void {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: values[key] })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(values, items)
          callback()
        }
      }
    }
  })
}

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
      version: "4.3.0"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists updates versioned defaults when metadata changes without a version bump", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://old-chatgpt\\.example/.*$",
      isActive: false,
      customCss: false,
      version: "4.3.0"
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://chatgpt\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.3.0"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists updates versionless defaults and preserves active state", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://medium.com",
      regex: "^https://old-medium\\.example/.*$",
      icon: "assets/logos/old-medium.png",
      pattern: "https://old-medium.example/*",
      siteName: "Old Medium",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://medium.com",
      regex: "^https://medium\\.com/.*$",
      icon: "assets/logos/medium-active.png",
      pattern: "https://medium.com/*",
      siteName: "Medium",
      isActive: true
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades GitHub to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://github.com",
      regex: "^https://github\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://github.com",
      regex: "^https://github\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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
      version: "4.3.0"
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

test("normalizeCustomFontList normalizes generic font data URL MIME types", async () => {
  const [font] = await normalizeCustomFontList([
    {
      value: "GenericMimeCustom-Fontara",
      name: "Generic MIME Custom",
      data: `data:application/octet-stream;base64,${Buffer.from("font").toString("base64")}`,
      type: "ttf",
      originalFileName: "generic.ttf"
    }
  ])

  assert.equal(font.data.startsWith("data:font/ttf;base64,"), true)
  assert.equal(font.type, "ttf")
  assert.equal(font.fileHash.length, 64)
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

test("ensureStorageValues resets selection when normalization removes the selected custom font", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
      {
        value: "RemovedCustom-Fontara",
        name: "Removed Custom",
        data: `data:text/plain;base64,${Buffer.from("font").toString("base64")}`,
        type: "woff2"
      }
    ],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: "RemovedCustom-Fontara",
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], DEFAULT_VALUES.SELECTED_FONT)
  assert.deepEqual(values[STORAGE_KEYS.CUSTOM_FONT_LIST], [])
})
