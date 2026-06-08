export interface WebsiteItem {
  url: string
  regex: string
  icon?: string
  pattern?: string
  isActive?: boolean
  siteName?: string
  version?: string
  customCss?: boolean
}

export interface FontData {
  value: string
  name: string
  data: string
  type: string
  fileHash: string
  originalFileName: string
}

export interface SiteProfile {
  pattern: string
  font?: string
  textStroke?: number
}

export type FontaraSettings = Record<string, unknown>

export type FontaraShortcuts = Partial<Record<"addSite" | "toggle", string>>

export interface FontaraTabInfo {
  id: number | null
  isActive: boolean
  isSupported: boolean
  url: string | null
}

export interface FontaraExtensionData {
  activeTab: FontaraTabInfo
  isReady: boolean
  settings: FontaraSettings
  shortcuts: FontaraShortcuts
}

export interface FontaraImportedSettingsResult {
  ignoredKeyCount: number
  importedKeyCount: number
}

export type FontaraUIMessage =
  | {
      type: "fontara-ui-bg-get-data"
    }
  | {
      type: "fontara-ui-bg-subscribe-to-changes"
    }
  | {
      type: "fontara-ui-bg-unsubscribe-from-changes"
    }
  | {
      data: FontaraSettings
      type: "fontara-ui-bg-change-settings"
    }
  | {
      data: FontaraSettings
      type: "fontara-ui-bg-import-settings"
    }
  | {
      type: "fontara-ui-bg-reset-settings"
    }
  | {
      data: {
        command: string
        url?: string | null
      }
      type: "fontara-ui-bg-run-command"
    }

export type FontaraBackgroundMessage = {
  data: FontaraExtensionData
  type: "fontara-bg-ui-changes"
}

export type FontaraContentScriptMessage = {
  data: {
    isTopFrame: boolean
    url: string
  }
  scriptId: string
  type:
    | "fontara-cs-bg-document-connect"
    | "fontara-cs-bg-document-forget"
    | "fontara-cs-bg-document-resume"
}

export type FontaraContentCommandMessage = {
  scriptId?: string
  type: "fontara-bg-cs-settings-changed"
}

export type FontaraMessageResponse<T = unknown> = {
  data?: T
  error?: string
}
