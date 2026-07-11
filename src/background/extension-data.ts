import { getFontaraSiteActivationState } from "../config/site-manager"
import type { FontaraShortcuts, FontaraTabInfo } from "../definitions"
import { sanitizeRuntimePageURL } from "../utils/runtime-url"

export type CommandURLDetails = {
  tab?: chrome.tabs.Tab | null
  url?: string | null
}

export function isSupportedPageURL(
  url: string | null | undefined
): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

export function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null)
    })
  })
}

function getCommands(): Promise<chrome.commands.Command[]> {
  if (typeof chrome === "undefined" || !chrome.commands?.getAll) {
    return Promise.resolve([])
  }

  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => {
      resolve(commands ?? [])
    })
  })
}

export async function getCommandURL(
  details: CommandURLDetails
): Promise<string | null> {
  const explicitURL = sanitizeRuntimePageURL(details.url)
  if (explicitURL) return explicitURL
  const providedTabURL = sanitizeRuntimePageURL(details.tab?.url)
  if (providedTabURL) return providedTabURL

  const activeTab = await getActiveTab()
  return sanitizeRuntimePageURL(activeTab?.url)
}

export async function collectShortcuts(): Promise<FontaraShortcuts> {
  const commands = await getCommands()

  return commands.reduce<FontaraShortcuts>((shortcuts, command) => {
    if (command.name === "toggle" || command.name === "addSite") {
      shortcuts[command.name] = command.shortcut || ""
    }

    return shortcuts
  }, {})
}

export async function collectActiveTabInfo(
  settings: Record<string, unknown>
): Promise<FontaraTabInfo> {
  const tab = await getActiveTab()
  const url = sanitizeRuntimePageURL(tab?.url)
  const isSupported = url !== null
  const active = url
    ? getFontaraSiteActivationState(url, settings).active
    : false

  return {
    id: typeof tab?.id === "number" ? tab.id : null,
    isActive: active,
    isSupported,
    url
  }
}
