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
import { getLocalValues, setLocalValues } from "../utils/storage"
import { createRegexFromUrl, getMatchingWebsite } from "../utils/url"

export const FONTARA_COMMANDS = {
  TOGGLE_EXTENSION: "toggle",
  TOGGLE_SITE: "addSite"
} as const

export type FontaraCommand =
  (typeof FONTARA_COMMANDS)[keyof typeof FONTARA_COMMANDS]

type CommandDetails = {
  tab?: chrome.tabs.Tab | null
  url?: string | null
}

type CommandsAPI = typeof chrome.commands

const COMMAND_DEBOUNCE_DELAY_MS = 75

let commandListenerRegistered = false

function debugWarn(message: string, error?: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getCommandsAPI(): CommandsAPI | null {
  if (typeof chrome === "undefined") return null

  return chrome.commands ?? null
}

function isFirefoxBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("firefox")
  )
}

function debounce<T extends unknown[]>(
  delay: number,
  fn: (...args: T) => void
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      fn(...args)
    }, delay)
  }
}

function isSupportedCommandURL(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null)
    })
  })
}

async function getCommandURL(details: CommandDetails): Promise<string | null> {
  if (isSupportedCommandURL(details.url)) return details.url
  if (isSupportedCommandURL(details.tab?.url)) return details.tab.url

  const activeTab = await getActiveTab()
  return isSupportedCommandURL(activeTab?.url) ? activeTab.url : null
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

async function toggleCurrentSite(details: CommandDetails): Promise<void> {
  const url = await getCommandURL(details)
  if (!url) return

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

export async function runFontaraCommand(
  command: string,
  details: CommandDetails = {}
): Promise<void> {
  try {
    switch (command) {
      case FONTARA_COMMANDS.TOGGLE_EXTENSION:
        await toggleExtension()
        break
      case FONTARA_COMMANDS.TOGGLE_SITE:
        await toggleCurrentSite(details)
        break
    }
  } catch (error) {
    debugWarn("Failed to run FontAra command.", error)
  }
}

const runDebouncedCommand = debounce(
  COMMAND_DEBOUNCE_DELAY_MS,
  (command: string, tab?: chrome.tabs.Tab) => {
    void runFontaraCommand(command, { tab })
  }
)

export function registerCommandListeners(): void {
  const commands = getCommandsAPI()
  if (!commands?.onCommand || commandListenerRegistered) return

  const addCommandListener = () => {
    commands.onCommand.addListener((command, tab) => {
      runDebouncedCommand(command, tab)
    })
  }

  commandListenerRegistered = true
  if (isFirefoxBrowser()) {
    setTimeout(addCommandListener)
    return
  }

  addCommandListener()
}
