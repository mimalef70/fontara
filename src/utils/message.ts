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
