import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { setFontaraCommandRunner } from "../../src/background/command-manager"
import { createToggleCurrentSiteSettings } from "../../src/background/command-settings"
import { ensureContextMenus } from "../../src/background/context-menu-manager"
import { STORAGE_KEYS } from "../../src/config/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  setFontaraCommandRunner(null)
  Reflect.set(globalThis, "chrome", originalChrome)
})

function waitForAsyncCommand(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

test("context menu manager registers menus and toggles the current site", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true,
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: [],
    [STORAGE_KEYS.WEBSITE_LIST]: []
  }
  const createdMenus: chrome.contextMenus.CreateProperties[] = []
  const clickListeners: Array<
    (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void
  > = []
  const commandCalls: Array<{ command: string; url?: string | null }> = []

  setFontaraCommandRunner(async (command, details) => {
    commandCalls.push({
      command,
      url: details?.url
    })

    if (command === "addSite" && details?.url) {
      Object.assign(
        localValues,
        createToggleCurrentSiteSettings(details.url, localValues)
      )
    }
  })

  Reflect.set(globalThis, "chrome", {
    contextMenus: {
      create(
        properties: chrome.contextMenus.CreateProperties,
        callback?: () => void
      ) {
        createdMenus.push(properties)
        callback?.()
      },
      onClicked: {
        addListener(
          listener: (
            info: chrome.contextMenus.OnClickData,
            tab?: chrome.tabs.Tab
          ) => void
        ) {
          clickListeners.push(listener)
        }
      },
      removeAll(callback?: () => void) {
        createdMenus.length = 0
        callback?.()
      }
    },
    i18n: {
      getMessage(key: string) {
        return key
      }
    },
    permissions: {
      contains(
        _permissions: chrome.permissions.Permissions,
        callback: (hasPermission: boolean) => void
      ) {
        callback(true)
      },
      onRemoved: {
        addListener() {}
      }
    },
    runtime: {
      get lastError() {
        return undefined
      },
      openOptionsPage(_callback?: () => void) {}
    },
    storage: {
      local: {
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof key === "string") {
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(localValues, items)
          callback()
        }
      },
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  })

  await ensureContextMenus()

  assert.deepEqual(
    createdMenus.map((menu) => menu.id),
    ["fontara-top", "toggle", "addSite", "openOptions"]
  )
  assert.equal(createdMenus[1].parentId, "fontara-top")
  assert.equal(clickListeners.length, 1)

  clickListeners[0](
    {
      editable: false,
      frameId: 0,
      menuItemId: "addSite",
      pageUrl: "https://example.com/path"
    },
    { id: 1, url: "https://example.com/path" } as chrome.tabs.Tab
  )
  await waitForAsyncCommand()

  assert.deepEqual(commandCalls, [
    {
      command: "addSite",
      url: "https://example.com/path"
    }
  ])
  assert.deepEqual(localValues[STORAGE_KEYS.ENABLED_FOR], ["example.com"])
  assert.deepEqual(localValues[STORAGE_KEYS.DISABLED_FOR], [])
  assert.deepEqual(localValues[STORAGE_KEYS.WEBSITE_LIST], [
    {
      url: "https://example.com/path",
      regex: "^https?://example\\.com/?.*$",
      isActive: true
    }
  ])
})

test("context menu manager skips registration without permission", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true
  }
  const createdMenus: chrome.contextMenus.CreateProperties[] = []

  Reflect.set(globalThis, "chrome", {
    contextMenus: {
      create(
        properties: chrome.contextMenus.CreateProperties,
        callback?: () => void
      ) {
        createdMenus.push(properties)
        callback?.()
      },
      onClicked: {
        addListener() {}
      },
      removeAll(callback?: () => void) {
        callback?.()
      }
    },
    permissions: {
      contains(
        _permissions: chrome.permissions.Permissions,
        callback: (hasPermission: boolean) => void
      ) {
        callback(false)
      }
    },
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
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        }
      },
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  })

  await ensureContextMenus()

  assert.deepEqual(createdMenus, [])
})

test("context menu manager removes menus when the setting is disabled", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: false
  }
  let removeAllCount = 0

  Reflect.set(globalThis, "chrome", {
    contextMenus: {
      create(_properties: chrome.contextMenus.CreateProperties) {},
      onClicked: {
        addListener() {}
      },
      removeAll(callback?: () => void) {
        removeAllCount += 1
        callback?.()
      }
    },
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
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        }
      },
      onChanged: {
        addListener() {},
        removeListener() {}
      }
    }
  })

  await ensureContextMenus()

  assert.equal(removeAllCount, 1)
})
