import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { getLocalValues, setLocalValues } from "../utils/storage"
import {
  createToggleCurrentSiteSettings,
  createToggleExtensionSettings
} from "./command-settings"
import { getCommandURL } from "./extension-data"

export const FONTARA_COMMANDS = {
  TOGGLE_EXTENSION: "toggle",
  TOGGLE_SITE: "addSite"
} as const

export type FontaraCommand =
  (typeof FONTARA_COMMANDS)[keyof typeof FONTARA_COMMANDS]

export type CommandDetails = {
  tab?: chrome.tabs.Tab | null
  url?: string | null
}

export type FontaraCommandRunner = (
  command: string,
  details?: CommandDetails
) => Promise<void>

type CommandsAPI = typeof chrome.commands

const COMMAND_DEBOUNCE_DELAY_MS = 75

let commandListenerRegistered = false
let commandRunner: FontaraCommandRunner | null = null

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

async function toggleExtension(): Promise<void> {
  const values = await getLocalValues({
    [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED
  })

  await setLocalValues(createToggleExtensionSettings(values))
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
  await setLocalValues(createToggleCurrentSiteSettings(url, storedValues))
}

export async function runFontaraCommand(
  command: string,
  details: CommandDetails = {}
): Promise<void> {
  if (commandRunner) {
    await commandRunner(command, details)
    return
  }

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

export function setFontaraCommandRunner(
  runner: FontaraCommandRunner | null
): void {
  commandRunner = runner
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
