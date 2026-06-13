import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  ensureStorageValues,
  flushPendingSettingsSync,
  mergeWebsiteLists,
  normalizeCustomFontList
} from "../../src/background/storage-manager"
import { FONTARA_TEXT_UNICODE_RANGE } from "../../src/config/font-unicode-range"
import { getActiveWebsiteSitePatterns } from "../../src/config/site-list"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontData, WebsiteItem } from "../../src/definitions"
import { createGoogleFontValue } from "../../src/utils/google-fonts"
import { FONTARA_SETTINGS_UPDATED_AT_KEY } from "../../src/utils/settings-sync"
import { createSystemFontValue } from "../../src/utils/system-fonts"

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
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof key === "string") {
            callback({ [key]: values[key] })
            return
          }

          callback({ ...key, ...values })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(values, items)
          callback()
        }
      }
    }
  })
}

function mockExtensionStorage(
  localValues: Record<string, unknown>,
  syncValues: Record<string, unknown> = {}
): {
  localValues: Record<string, unknown>
  syncValues: Record<string, unknown>
} {
  let runtimeError: { message: string } | undefined

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return runtimeError
      }
    },
    storage: {
      local: {
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          runtimeError = undefined
          if (typeof key === "string") {
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          runtimeError = undefined
          Object.assign(localValues, items)
          callback()
        }
      },
      sync: {
        QUOTA_BYTES_PER_ITEM: 8192,
        get(_key: null, callback: (items: Record<string, unknown>) => void) {
          runtimeError = undefined
          callback({ ...syncValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          runtimeError = undefined
          Object.assign(syncValues, items)
          callback()
        },
        remove(keys: string | string[], callback: () => void) {
          runtimeError = undefined
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete syncValues[key]
          }
          callback()
        }
      }
    }
  })

  return { localValues, syncValues }
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

test("normalizeCustomFontList normalizes custom font unicode ranges", async () => {
  const fonts = await normalizeCustomFontList([
    {
      value: "LegacyCustom-Fontara",
      name: "Legacy Custom",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2",
      originalFileName: "legacy.woff2"
    },
    {
      value: "LatinCustom-Fontara",
      name: "Latin Custom",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2",
      originalFileName: "latin.woff2",
      unicodeRange: "U+0000-00FF U+0100-024F"
    },
    {
      value: "AllTextCustom-Fontara",
      name: "All Text Custom",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2",
      originalFileName: "all.woff2",
      unicodeRange: null
    }
  ])

  assert.equal(fonts[0].unicodeRange, FONTARA_TEXT_UNICODE_RANGE)
  assert.equal(fonts[1].unicodeRange, "U+0000-00FF, U+0100-024F")
  assert.equal(fonts[2].unicodeRange, null)
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

test("ensureStorageValues seeds empty sync storage without custom font files", async () => {
  const localCustomFont: FontData = {
    value: "LocalCustom-Fontara",
    name: "Local Custom",
    data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
    type: "woff2",
    fileHash: "b".repeat(64),
    originalFileName: "LocalCustom.woff2"
  }
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: localCustomFont.value,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [localCustomFont],
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        pattern: "example.com",
        font: localCustomFont.value,
        textStroke: 0.4
      }
    ],
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  }
  const { syncValues } = mockExtensionStorage(localValues)

  await ensureStorageValues()

  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], localCustomFont.value)
  assert.equal(STORAGE_KEYS.CUSTOM_FONT_LIST in syncValues, false)
  assert.equal(STORAGE_KEYS.SELECTED_FONT in syncValues, false)
  assert.deepEqual(syncValues[STORAGE_KEYS.SITE_PROFILES], [
    {
      pattern: "example.com",
      textStroke: 0.4
    }
  ])
  assert.equal(syncValues[STORAGE_KEYS.SYNC_SETTINGS], true)
})

test("ensureStorageValues mirrors synced settings and preserves local custom fonts", async () => {
  const localCustomFont: FontData = {
    value: "LocalCustom-Fontara",
    name: "Local Custom",
    data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
    type: "woff2",
    fileHash: "c".repeat(64),
    originalFileName: "LocalCustom.woff2"
  }
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: localCustomFont.value,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [localCustomFont],
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        pattern: "example.com",
        font: localCustomFont.value,
        textStroke: 0.2
      }
    ],
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  }
  const syncValues: Record<string, unknown> = {
    [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara",
    [STORAGE_KEYS.RTL_ENABLED]: false,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        pattern: "example.com",
        textStroke: 0.6
      }
    ],
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  }
  mockExtensionStorage(localValues, syncValues)

  await ensureStorageValues()

  assert.equal(localValues[STORAGE_KEYS.RTL_ENABLED], false)
  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], localCustomFont.value)
  assert.deepEqual(localValues[STORAGE_KEYS.SITE_PROFILES], [
    {
      pattern: "example.com",
      textStroke: 0.6,
      font: localCustomFont.value
    }
  ])
  assert.equal(syncValues[STORAGE_KEYS.SELECTED_FONT], "Sahel-Fontara")
})

test("ensureStorageValues preserves newer local settings over stale synced settings", async () => {
  const localValues: Record<string, unknown> = {
    ...DEFAULT_VALUES,
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: 2,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.ENABLED_FOR]: ["127.0.0.1:3000"],
    [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  }
  const syncValues: Record<string, unknown> = {
    ...DEFAULT_VALUES,
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: 1,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  }
  mockExtensionStorage(localValues, syncValues)

  await ensureStorageValues()

  assert.deepEqual(localValues[STORAGE_KEYS.ENABLED_FOR], ["127.0.0.1:3000"])
  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], "Samim-Fontara")
  assert.deepEqual(syncValues[STORAGE_KEYS.ENABLED_FOR], ["127.0.0.1:3000"])
  assert.equal(syncValues[STORAGE_KEYS.SELECTED_FONT], "Samim-Fontara")
  assert.equal(syncValues[FONTARA_SETTINGS_UPDATED_AT_KEY], 2)
})

test("flushPendingSettingsSync mirrors fresh local settings before a service worker restart can restore stale sync values", async () => {
  const localValues: Record<string, unknown> = {
    ...DEFAULT_VALUES,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.ENABLED_FOR]: ["127.0.0.1:3000"],
    [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  }
  const syncValues: Record<string, unknown> = {
    ...DEFAULT_VALUES,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  }
  mockExtensionStorage(localValues, syncValues)

  await flushPendingSettingsSync()

  assert.deepEqual(syncValues[STORAGE_KEYS.ENABLED_FOR], ["127.0.0.1:3000"])
  assert.equal(syncValues[STORAGE_KEYS.SELECTED_FONT], "Samim-Fontara")
})

test("ensureStorageValues initializes and normalizes the UI language preference", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.UI_LANGUAGE]: "de"
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.UI_LANGUAGE], DEFAULT_VALUES.UI_LANGUAGE)
})

test("ensureStorageValues initializes and normalizes RTL settings", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: {
      chatgpt: false,
      unknown: false
    }
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.RTL_ENABLED], DEFAULT_VALUES.RTL_ENABLED)
  assert.deepEqual(values[STORAGE_KEYS.RTL_SITE_SETTINGS], {
    ...DEFAULT_VALUES.RTL_SITE_SETTINGS,
    chatgpt: false
  })
})

test("ensureStorageValues migrates active website settings into the include site list", async () => {
  const migratedWebsiteList = DEFAULT_VALUES.WEBSITE_LIST.map(
    (website, index) =>
      index === 0 ? { ...website, isActive: false } : website
  )
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: migratedWebsiteList
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(
    values[STORAGE_KEYS.ENABLED_BY_DEFAULT],
    DEFAULT_VALUES.ENABLED_BY_DEFAULT
  )
  assert.deepEqual(
    values[STORAGE_KEYS.ENABLED_FOR],
    getActiveWebsiteSitePatterns(migratedWebsiteList)
  )
  assert.deepEqual(values[STORAGE_KEYS.DISABLED_FOR], [])
})

test("ensureStorageValues normalizes stored site list settings", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.DISABLED_FOR]: [
      " Example.com ",
      "",
      "example.com",
      "%2a.dropbox.com"
    ],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: "yes",
    [STORAGE_KEYS.ENABLED_FOR]: [
      "https://www.google.com/",
      "google.com",
      "%2A.wikipedia.org"
    ],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.ENABLED_BY_DEFAULT], false)
  assert.deepEqual(values[STORAGE_KEYS.DISABLED_FOR], [
    "example.com",
    "*.dropbox.com"
  ])
  assert.deepEqual(values[STORAGE_KEYS.ENABLED_FOR], [
    "google.com",
    "*.wikipedia.org"
  ])
})

test("ensureStorageValues normalizes per-site profile overrides", async () => {
  const selectedGoogleFont = createGoogleFontValue("Noto Sans Arabic")
  const selectedSystemFont = createSystemFontValue("Noto Sans Arabic")
  assert.ok(selectedSystemFont)
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: false,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        font: "Samim-Fontara",
        pattern: " https://ChatGPT.com/ ",
        textStroke: 0.26
      },
      {
        font: "MissingCustom-Fontara",
        enabled: false,
        pattern: "custom.example.com",
        textStroke: 0.4
      },
      {
        font: selectedGoogleFont,
        pattern: "google.example.com"
      },
      {
        font: selectedSystemFont,
        pattern: "system.example.com"
      },
      {
        pattern: "empty.example.com"
      }
    ],
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.deepEqual(values[STORAGE_KEYS.SITE_PROFILES], [
    {
      font: "Samim-Fontara",
      pattern: "chatgpt.com",
      textStroke: 0.3
    },
    {
      enabled: false,
      pattern: "custom.example.com",
      textStroke: 0.4
    }
  ])
})

test("ensureStorageValues initializes and normalizes text stroke settings", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.TEXT_STROKE]: 0.26
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.TEXT_STROKE], 0.3)
})

test("ensureStorageValues migrates legacy boolean text stroke settings", async () => {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.TEXT_STROKE_ENABLED]: true
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.TEXT_STROKE], 0.3)
})

test("ensureStorageValues preserves selected system fonts only when enabled", async () => {
  const selectedSystemFont = createSystemFontValue("Noto Sans Arabic")
  assert.ok(selectedSystemFont)
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: selectedSystemFont,
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], selectedSystemFont)

  values[STORAGE_KEYS.SYSTEM_FONTS_ENABLED] = false
  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], DEFAULT_VALUES.SELECTED_FONT)
})

test("ensureStorageValues preserves selected Google fonts only when enabled", async () => {
  const selectedGoogleFont = createGoogleFontValue("Noto Sans Arabic")
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: selectedGoogleFont,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], selectedGoogleFont)

  values[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] = false
  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], DEFAULT_VALUES.SELECTED_FONT)
})

test("ensureStorageValues resets unknown selected Google font values", async () => {
  const unknownGoogleFont = createGoogleFontValue("Missing Font")
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: unknownGoogleFont,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], DEFAULT_VALUES.SELECTED_FONT)
})

test("ensureStorageValues resets non-text Google font selections", async () => {
  const iconGoogleFont = createGoogleFontValue("Material Icons")
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true,
    [STORAGE_KEYS.SELECTED_FONT]: iconGoogleFont,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  }
  mockLocalStorage(values)

  await ensureStorageValues()

  assert.equal(values[STORAGE_KEYS.SELECTED_FONT], DEFAULT_VALUES.SELECTED_FONT)
})
