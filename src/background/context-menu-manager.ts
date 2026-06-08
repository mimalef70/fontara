import {
  createSiteListToggleUpdate,
  getActiveWebsiteSitePatterns,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { WebsiteItem } from "../definitions"
import { openOptionsPageSafely } from "../utils/options-page"
import {
  getLocalValues,
  setLocalValues,
  watchLocalStorage
} from "../utils/storage"
import { createRegexFromUrl, getMatchingWebsite } from "../utils/url"

const CONTEXT_MENU_ROOT_ID = "FontARA-top"
const CONTEXT_MENU_PERMISSION = "contextMenus"
const CONTEXT_MENU_COMMANDS = {
  OPEN_OPTIONS: "openOptions",
  TOGGLE_EXTENSION: "toggle",
  TOGGLE_SITE: "addSite"
} as const

type ContextMenuCommand =
  (typeof CONTEXT_MENU_COMMANDS)[keyof typeof CONTEXT_MENU_COMMANDS]
type ContextMenusAPI = typeof chrome.contextMenus
type PermissionsAPI = typeof chrome.permissions

let contextMenuClickListenerRegistered = false

function debugWarn(message: string, error?: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getContextMenusAPI(): ContextMenusAPI | null {
  if (typeof chrome === "undefined") return null

  return chrome.contextMenus ?? null
}

function getPermissionsAPI(): PermissionsAPI | null {
  if (typeof chrome === "undefined") return null

  return chrome.permissions ?? null
}

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
}

function getMessage(key: string, fallback: string): string {
  try {
    return chrome.i18n?.getMessage(key) || fallback
  } catch {
    return fallback
  }
}

function getContextMenuTitle(key: string, fallback: string): string {
  return getMessage(key, fallback)
}

function isSupportedContextMenuURL(url: string | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function hasContextMenusPermission(): Promise<boolean> {
  const permissions = getPermissionsAPI()
  if (!permissions?.contains) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    permissions.contains({ permissions: [CONTEXT_MENU_PERMISSION] }, resolve)
  })
}

function createContextMenu(
  createProperties: chrome.contextMenus.CreateProperties
): Promise<void> {
  const contextMenus = getContextMenusAPI()
  if (!contextMenus) return Promise.resolve()

  return new Promise((resolve, reject) => {
    contextMenus.create(createProperties, () => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function removeContextMenus(): Promise<void> {
  const contextMenus = getContextMenusAPI()
  if (!contextMenus) return Promise.resolve()

  return new Promise((resolve) => {
    contextMenus.removeAll(() => {
      getRuntimeError()
      resolve()
    })
  })
}

function ensureContextMenuClickListener(): void {
  const contextMenus = getContextMenusAPI()
  if (!contextMenus || contextMenuClickListenerRegistered) return

  contextMenus.onClicked.addListener((info, tab) => {
    void runContextMenuCommand(
      info.menuItemId as ContextMenuCommand,
      info.frameUrl || info.pageUrl || tab?.url
    )
  })
  contextMenuClickListenerRegistered = true
}

async function registerContextMenus(): Promise<void> {
  const contextMenus = getContextMenusAPI()
  if (!contextMenus) return

  if (!(await hasContextMenusPermission())) {
    debugWarn("User has enabled context menus, but did not provide permission.")
    return
  }

  ensureContextMenuClickListener()
  await removeContextMenus()
  await createContextMenu({
    id: CONTEXT_MENU_ROOT_ID,
    title: getContextMenuTitle("contextMenuTitle", "Font Ara")
  })
  await createContextMenu({
    id: CONTEXT_MENU_COMMANDS.TOGGLE_EXTENSION,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: getContextMenuTitle(
      "contextMenuToggleEverywhere",
      "Toggle everywhere"
    )
  })
  await createContextMenu({
    id: CONTEXT_MENU_COMMANDS.TOGGLE_SITE,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: getContextMenuTitle("contextMenuToggleSite", "Toggle for this site")
  })
  await createContextMenu({
    id: CONTEXT_MENU_COMMANDS.OPEN_OPTIONS,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: getContextMenuTitle("contextMenuOpenSettings", "Open settings")
  })
}

async function toggleExtension(): Promise<void> {
  const values = await getLocalValues({
    [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED
  })

  await setLocalValues({
    [STORAGE_KEYS.EXTENSION_ENABLED]:
      values[STORAGE_KEYS.EXTENSION_ENABLED] === false
  })
}

async function toggleCurrentSite(url: string | undefined): Promise<void> {
  if (!isSupportedContextMenuURL(url)) return

  const storedValues = await getLocalValues({
    [STORAGE_KEYS.DISABLED_FOR]: undefined,
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: DEFAULT_VALUES.ENABLED_BY_DEFAULT,
    [STORAGE_KEYS.ENABLED_FOR]: undefined,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
  })
  const websiteList = Array.isArray(storedValues[STORAGE_KEYS.WEBSITE_LIST])
    ? (storedValues[STORAGE_KEYS.WEBSITE_LIST] as WebsiteItem[])
    : DEFAULT_VALUES.WEBSITE_LIST
  const enabledByDefault = normalizeEnabledByDefault(
    storedValues[STORAGE_KEYS.ENABLED_BY_DEFAULT]
  )
  const enabledFor =
    storedValues[STORAGE_KEYS.ENABLED_FOR] === undefined
      ? getActiveWebsiteSitePatterns(websiteList)
      : normalizeEnabledSiteList(storedValues[STORAGE_KEYS.ENABLED_FOR])
  const disabledFor =
    storedValues[STORAGE_KEYS.DISABLED_FOR] === undefined
      ? DEFAULT_VALUES.DISABLED_FOR
      : normalizeSiteList(storedValues[STORAGE_KEYS.DISABLED_FOR])
  const siteListSettings = {
    disabledFor,
    enabledByDefault,
    enabledFor
  }
  const checked = !isSiteListUrlEnabled(url, siteListSettings)
  const existingWebsiteIndex = websiteList.findIndex(
    (item) => getMatchingWebsite(url, [item]) !== null
  )
  const siteListUpdate = createSiteListToggleUpdate(
    url,
    siteListSettings,
    checked
  )
  const updatedWebsiteList =
    existingWebsiteIndex === -1 && checked
      ? [
          ...websiteList,
          {
            url,
            regex: createRegexFromUrl(url),
            isActive: true
          }
        ]
      : websiteList.map((item, index) =>
          index === existingWebsiteIndex ? { ...item, isActive: checked } : item
        )

  await setLocalValues({
    [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
    [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
    [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
  })
}

async function runContextMenuCommand(
  command: ContextMenuCommand,
  url: string | undefined
): Promise<void> {
  try {
    switch (command) {
      case CONTEXT_MENU_COMMANDS.TOGGLE_EXTENSION:
        await toggleExtension()
        break
      case CONTEXT_MENU_COMMANDS.TOGGLE_SITE:
        await toggleCurrentSite(url)
        break
      case CONTEXT_MENU_COMMANDS.OPEN_OPTIONS:
        await openOptionsPageSafely()
        break
    }
  } catch (error) {
    debugWarn("Failed to run Font Ara context menu command.", error)
  }
}

export async function ensureContextMenus(): Promise<void> {
  const values = await getLocalValues({
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: DEFAULT_VALUES.CONTEXT_MENUS_ENABLED
  })

  if (values[STORAGE_KEYS.CONTEXT_MENUS_ENABLED] === true) {
    await registerContextMenus()
    return
  }

  await removeContextMenus()
}

export function registerContextMenuListeners(): void {
  void ensureContextMenus().catch((error) => {
    debugWarn("Failed to initialize Font Ara context menus.", error)
  })

  watchLocalStorage({
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: () => ensureContextMenus()
  })

  const permissions = getPermissionsAPI()
  permissions?.onRemoved?.addListener((permissions) => {
    if (permissions?.permissions?.includes(CONTEXT_MENU_PERMISSION)) {
      void removeContextMenus()
    }
  })
}
