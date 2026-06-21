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
const commandTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

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

export async function runFontaraCommand(
  command: string,
  details: CommandDetails = {}
): Promise<void> {
  if (!commandRunner) {
    debugWarn("FontAra command runtime is not ready.")
    return
  }

  try {
    await commandRunner(command, details)
  } catch (error) {
    debugWarn("Failed to run FontAra command.", error)
  }
}

export function setFontaraCommandRunner(
  runner: FontaraCommandRunner | null
): void {
  commandRunner = runner
}

function runDebouncedCommand(command: string, tab?: chrome.tabs.Tab): void {
  const timeoutId = commandTimeouts.get(command)
  if (timeoutId) {
    clearTimeout(timeoutId)
  }

  commandTimeouts.set(
    command,
    setTimeout(() => {
      commandTimeouts.delete(command)
      void runFontaraCommand(command, { tab })
    }, COMMAND_DEBOUNCE_DELAY_MS)
  )
}

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

export function resetCommandManagerStateForTesting(): void {
  for (const timeoutId of commandTimeouts.values()) {
    clearTimeout(timeoutId)
  }

  commandTimeouts.clear()
  commandListenerRegistered = false
  commandRunner = null
}
