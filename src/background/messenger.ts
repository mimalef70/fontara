import type {
  FontaraExtensionData,
  FontaraImportedSettingsResult,
  FontaraMessageResponse,
  FontaraSettings,
  FontaraUIMessage
} from "../definitions"
import { isFontaraBrowserTestRelayMessage } from "../utils/browser-test-bridge"
import {
  createFontaraBackgroundChangesMessage,
  createFontaraMessageErrorResponse,
  createFontaraMessageResponse,
  isFontaraUIMessage,
  MESSAGE_TYPES_UI_TO_BG
} from "../utils/message"

export type FontaraMessengerAdapter = {
  changeSettings(settings: FontaraSettings): Promise<void>
  collect(): Promise<FontaraExtensionData>
  importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult>
  resetSettings(): Promise<void>
  runCommand(command: string, details?: { url?: string | null }): Promise<void>
}

type SendResponse = (response: FontaraMessageResponse) => void

const ALLOWED_UI_PAGE_PATHS = [
  "ui/options/index.html",
  "ui/popup/index.html"
] as const

let adapter: FontaraMessengerAdapter | null = null
let initialized = false
let subscriberCount = 0

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getRuntimeURL(path: string): string | null {
  try {
    return chrome.runtime.getURL(path)
  } catch {
    return null
  }
}

function matchesAllowedURL(senderURL: string, allowedURL: string): boolean {
  return (
    senderURL === allowedURL ||
    senderURL.startsWith(`${allowedURL}?`) ||
    senderURL.startsWith(`${allowedURL}#`)
  )
}

function isAllowedUIMessageSender(
  sender: chrome.runtime.MessageSender
): boolean {
  if (typeof sender.url !== "string") {
    return false
  }

  return ALLOWED_UI_PAGE_PATHS.some((path) => {
    const allowedURL = getRuntimeURL(path)
    return allowedURL
      ? matchesAllowedURL(sender.url as string, allowedURL)
      : false
  })
}

function isDebugBuild(): boolean {
  return typeof __DEBUG__ !== "undefined" && __DEBUG__
}

function isContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  return typeof sender.tab?.id === "number" && typeof sender.url === "string"
}

async function handleMessage(message: FontaraUIMessage): Promise<unknown> {
  if (!adapter) {
    throw new Error("fontara-messenger-not-ready")
  }

  switch (message.type) {
    case MESSAGE_TYPES_UI_TO_BG.GET_DATA:
      return adapter.collect()
    case MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES:
      subscriberCount += 1
      return adapter.collect()
    case MESSAGE_TYPES_UI_TO_BG.UNSUBSCRIBE_FROM_CHANGES:
      subscriberCount = Math.max(0, subscriberCount - 1)
      return true
    case MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS:
      await adapter.changeSettings(message.data)
      return true
    case MESSAGE_TYPES_UI_TO_BG.IMPORT_SETTINGS:
      return adapter.importSettings(message.data)
    case MESSAGE_TYPES_UI_TO_BG.RESET_SETTINGS:
      await adapter.resetSettings()
      return true
    case MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND:
      await adapter.runCommand(message.data.command, { url: message.data.url })
      return true
  }
}

function messageListener(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse
): boolean {
  if (
    isDebugBuild() &&
    isContentScriptSender(sender) &&
    isFontaraBrowserTestRelayMessage(message)
  ) {
    void handleMessage(message.data.message)
      .then((data) => sendResponse(createFontaraMessageResponse(data)))
      .catch((error) =>
        sendResponse(createFontaraMessageErrorResponse(getErrorMessage(error)))
      )

    return true
  }

  if (!isFontaraUIMessage(message) || !isAllowedUIMessageSender(sender)) {
    return false
  }

  void handleMessage(message)
    .then((data) => sendResponse(createFontaraMessageResponse(data)))
    .catch((error) =>
      sendResponse(createFontaraMessageErrorResponse(getErrorMessage(error)))
    )

  return true
}

export function initMessenger(nextAdapter: FontaraMessengerAdapter): void {
  adapter = nextAdapter

  if (initialized) return

  chrome.runtime.onMessage.addListener(messageListener)
  initialized = true
}

export function reportChanges(data: FontaraExtensionData): void {
  if (subscriberCount === 0) return

  chrome.runtime.sendMessage(createFontaraBackgroundChangesMessage(data))
}
