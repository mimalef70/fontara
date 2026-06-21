import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { registerIconListeners } from "../../src/background/icon-manager"
import { resetBackgroundSettingsCacheForTesting } from "../../src/background/settings-manager"
import {
  DEFAULT_VALUES,
  ICON_PATHS,
  STORAGE_KEYS
} from "../../src/config/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalDebug = Reflect.get(globalThis, "__DEBUG__") as unknown

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender
) => boolean | undefined

type TabsUpdatedListener = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => void

function wait(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

afterEach(() => {
  resetBackgroundSettingsCacheForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__DEBUG__", originalDebug)
})

function installChromeMock() {
  const setIconCalls: Array<Parameters<typeof chrome.action.setIcon>[0]> = []
  const runtimeMessageListeners: RuntimeMessageListener[] = []
  const tabsUpdatedListeners: TabsUpdatedListener[] = []
  const localValues: Record<string, unknown> = {
    ...DEFAULT_VALUES,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR
  }

  Reflect.set(globalThis, "__DEBUG__", false)
  Reflect.set(globalThis, "chrome", {
    action: {
      async setIcon(details: Parameters<typeof chrome.action.setIcon>[0]) {
        setIconCalls.push(details)
      }
    },
    runtime: {
      get lastError() {
        return undefined
      },
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      onMessage: {
        addListener(listener: RuntimeMessageListener) {
          runtimeMessageListeners.push(listener)
        }
      }
    },
    storage: {
      local: {
        get(
          defaults: Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          callback({ ...defaults, ...localValues })
        }
      }
    },
    tabs: {
      onActivated: {
        addListener() {}
      },
      onUpdated: {
        addListener(listener: TabsUpdatedListener) {
          tabsUpdatedListeners.push(listener)
        }
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          {
            id: 7,
            url: "https://chatgpt.com/"
          } as chrome.tabs.Tab
        ]
        callback?.(tabs)
        return Promise.resolve(tabs)
      }
    }
  })

  return {
    runtimeMessageListeners,
    setIconCalls,
    tabsUpdatedListeners
  }
}

test("icon manager updates tab icon from top-frame content URL changes", async () => {
  const { runtimeMessageListeners, setIconCalls } = installChromeMock()

  registerIconListeners()
  await wait()
  setIconCalls.length = 0

  runtimeMessageListeners[0]?.(
    {
      data: {
        isTopFrame: true,
        url: "https://chatgpt.com/c/spa-route"
      },
      scriptId: "script-1",
      type: "fontara-cs-bg-document-update"
    },
    {
      frameId: 0,
      tab: {
        id: 42,
        url: "https://chatgpt.com/c/spa-route"
      } as chrome.tabs.Tab,
      url: "https://chatgpt.com/c/spa-route"
    }
  )
  await wait()

  assert.deepEqual(setIconCalls[setIconCalls.length - 1], {
    path: ICON_PATHS.active,
    tabId: 42
  })
})

test("icon manager ignores iframe content URL changes", async () => {
  const { runtimeMessageListeners, setIconCalls } = installChromeMock()

  registerIconListeners()
  await wait()
  setIconCalls.length = 0

  runtimeMessageListeners[0]?.(
    {
      data: {
        isTopFrame: false,
        url: "https://chatgpt.com/c/iframe-route"
      },
      scriptId: "script-1",
      type: "fontara-cs-bg-document-update"
    },
    {
      frameId: 1,
      tab: {
        id: 42,
        url: "https://chatgpt.com/c/iframe-route"
      } as chrome.tabs.Tab,
      url: "https://chatgpt.com/c/iframe-route"
    }
  )
  await wait()

  assert.deepEqual(setIconCalls, [])
})

test("icon manager applies tab-specific icons for tab URL updates", async () => {
  const { setIconCalls, tabsUpdatedListeners } = installChromeMock()

  registerIconListeners()
  await wait()
  setIconCalls.length = 0

  tabsUpdatedListeners[0]?.(21, { url: "https://example.invalid/" }, {
    id: 21,
    url: "https://example.invalid/"
  } as chrome.tabs.Tab)
  await wait()

  assert.deepEqual(setIconCalls[setIconCalls.length - 1], {
    path: ICON_PATHS.default,
    tabId: 21
  })
})
