import type { SupportedUILanguage } from "../../config/i18n"
import messageCatalog from "../../i18n/messages.json"

export const MESSAGE_CATALOG = messageCatalog

export type MessageKey = keyof typeof messageCatalog.ui.en
export type ExtensionMessageKey = keyof typeof messageCatalog.extension.en
export type ExtensionMessage = {
  description?: string
  message: string
}

export const UI_MESSAGES: Record<
  SupportedUILanguage,
  Record<MessageKey, string>
> = messageCatalog.ui

export const EXTENSION_MESSAGES: Record<
  SupportedUILanguage,
  Record<ExtensionMessageKey, ExtensionMessage>
> = messageCatalog.extension

export function interpolateMessage(
  message: string,
  params: Record<string, string | number> = {}
): string {
  return message.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    params[key] === undefined ? match : String(params[key])
  )
}
