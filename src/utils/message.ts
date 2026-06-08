import type {
  FontaraBackgroundMessage,
  FontaraContentScriptMessage,
  FontaraExtensionData,
  FontaraMessageResponse,
  FontaraSettings,
  FontaraUIMessage
} from "../definitions"

export const MESSAGE_TYPES_UI_TO_BG = {
  GET_DATA: "fontara-ui-bg-get-data",
  SUBSCRIBE_TO_CHANGES: "fontara-ui-bg-subscribe-to-changes",
  UNSUBSCRIBE_FROM_CHANGES: "fontara-ui-bg-unsubscribe-from-changes",
  CHANGE_SETTINGS: "fontara-ui-bg-change-settings",
  IMPORT_SETTINGS: "fontara-ui-bg-import-settings",
  RESET_SETTINGS: "fontara-ui-bg-reset-settings",
  RUN_COMMAND: "fontara-ui-bg-run-command"
} as const

export const MESSAGE_TYPES_BG_TO_UI = {
  CHANGES: "fontara-bg-ui-changes"
} as const

export const MESSAGE_TYPES_CS_TO_BG = {
  DOCUMENT_CONNECT: "fontara-cs-bg-document-connect",
  DOCUMENT_FORGET: "fontara-cs-bg-document-forget",
  DOCUMENT_UPDATE: "fontara-cs-bg-document-update",
  DOCUMENT_RESUME: "fontara-cs-bg-document-resume"
} as const

export const MESSAGE_TYPES_BG_TO_CS = {
  APPLY_THEME: "fontara-bg-cs-apply-theme",
  CLEAN_UP: "fontara-bg-cs-clean-up",
  SETTINGS_CHANGED: "fontara-bg-cs-settings-changed"
} as const

export type MessageTypeUIToBG =
  (typeof MESSAGE_TYPES_UI_TO_BG)[keyof typeof MESSAGE_TYPES_UI_TO_BG]

export type MessageTypeBGToUI =
  (typeof MESSAGE_TYPES_BG_TO_UI)[keyof typeof MESSAGE_TYPES_BG_TO_UI]

export type MessageTypeCSToBG =
  (typeof MESSAGE_TYPES_CS_TO_BG)[keyof typeof MESSAGE_TYPES_CS_TO_BG]

export type MessageTypeBGToCS =
  (typeof MESSAGE_TYPES_BG_TO_CS)[keyof typeof MESSAGE_TYPES_BG_TO_CS]

const UI_TO_BG_MESSAGE_TYPES = new Set<string>(
  Object.values(MESSAGE_TYPES_UI_TO_BG)
)
const BG_TO_UI_MESSAGE_TYPES = new Set<string>(
  Object.values(MESSAGE_TYPES_BG_TO_UI)
)
const CS_TO_BG_MESSAGE_TYPES = new Set<string>(
  Object.values(MESSAGE_TYPES_CS_TO_BG)
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSettingsPayload(value: unknown): value is FontaraSettings {
  return isRecord(value)
}

function hasOptionalURL(value: Record<string, unknown>): boolean {
  return (
    !("url" in value) || value.url === null || typeof value.url === "string"
  )
}

export function isFontaraUIMessage(
  message: unknown
): message is FontaraUIMessage {
  if (!isRecord(message) || typeof message.type !== "string") return false
  if (!UI_TO_BG_MESSAGE_TYPES.has(message.type)) return false

  switch (message.type) {
    case MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS:
    case MESSAGE_TYPES_UI_TO_BG.IMPORT_SETTINGS:
      return isSettingsPayload(message.data)
    case MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND:
      return (
        isRecord(message.data) &&
        typeof message.data.command === "string" &&
        hasOptionalURL(message.data)
      )
    default:
      return true
  }
}

export function isFontaraBackgroundMessage(
  message: unknown
): message is FontaraBackgroundMessage {
  return (
    isRecord(message) &&
    typeof message.type === "string" &&
    BG_TO_UI_MESSAGE_TYPES.has(message.type) &&
    isRecord(message.data)
  )
}

export function isFontaraContentScriptMessage(
  message: unknown
): message is FontaraContentScriptMessage {
  return (
    isRecord(message) &&
    typeof message.scriptId === "string" &&
    typeof message.type === "string" &&
    CS_TO_BG_MESSAGE_TYPES.has(message.type) &&
    isRecord(message.data) &&
    typeof message.data.isTopFrame === "boolean" &&
    typeof message.data.url === "string"
  )
}

export function createFontaraMessageResponse<T>(
  data: T
): FontaraMessageResponse<T> {
  return { data }
}

export function createFontaraMessageErrorResponse(
  error: string
): FontaraMessageResponse {
  return { error }
}

export function createFontaraBackgroundChangesMessage(
  data: FontaraExtensionData
): FontaraBackgroundMessage {
  return {
    data,
    type: MESSAGE_TYPES_BG_TO_UI.CHANGES
  }
}
