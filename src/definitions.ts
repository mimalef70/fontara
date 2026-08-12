import type { RtlSiteId } from "./config/rtl-sites"
import type {
  CustomFontFamilyDraft,
  CustomFontLoadResult,
  CustomFontTransactionBatchCommitData,
  CustomFontTransactionBeginData,
  CustomFontTransactionIdData,
  CustomFontTransactionPutFaceData
} from "./custom-font-types"

export type {
  CustomFontFaceMeta,
  CustomFontFamily
} from "./custom-font-types"

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

export interface SiteProfile {
  pattern: string
  enabled?: boolean
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
  settingsRevision: number
  shortcuts: FontaraShortcuts
}

export interface FontaraImportedSettingsResult {
  ignoredKeyCount: number
  importedKeyCount: number
  revision: number
}

export interface FontaraSettingsMutationResult {
  revision: number
}

export type FontaraApplyMode = "font-styles" | "full"

export interface FontaraFontThemeCommandData {
  active: boolean
  applyMode: FontaraApplyMode
  customCSS: string | null
  customFontFamilyRevision: number | null
  customFontFamilyValue: string | null
  fontFaceCSS: string
  fontName: string
  googleFontCSS: string | null
  textStrokeCSS: string
}

export interface FontaraRtlThemeCommandData {
  active: boolean
  siteId: RtlSiteId | null
}

export interface FontaraPageThemeCommandData {
  font: FontaraFontThemeCommandData
  rtl: FontaraRtlThemeCommandData
}

/**
 * Orders resolved theme commands for one content-script document.
 *
 * `dispatcherId` distinguishes service-worker lifetimes, `sequence` orders
 * commands produced by one worker for the document, and `settingsRevision`
 * prevents an asynchronously resolved command from restoring older settings.
 */
export interface FontaraContentCommandOrder {
  dispatcherId: string
  sequence: number
  settingsRevision: number
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
      data: {
        clientMutationId: string
        settings: FontaraSettings
      }
      type: "fontara-ui-bg-change-settings"
    }
  | {
      data: {
        clientMutationId: string
        settings: FontaraSettings
      }
      type: "fontara-ui-bg-import-settings"
    }
  | {
      data: {
        clientMutationId: string
      }
      type: "fontara-ui-bg-reset-settings"
    }
  | {
      data: {
        command: string
        url?: string | null
      }
      type: "fontara-ui-bg-run-command"
    }
  | {
      data: CustomFontTransactionBeginData
      type: "fontara-ui-bg-custom-font-begin"
    }
  | {
      data: CustomFontTransactionPutFaceData
      type: "fontara-ui-bg-custom-font-put-face"
    }
  | {
      data: CustomFontTransactionIdData
      type: "fontara-ui-bg-custom-font-commit"
    }
  | {
      data: CustomFontTransactionBatchCommitData
      type: "fontara-ui-bg-custom-font-import-batch"
    }
  | {
      data: CustomFontTransactionIdData
      type: "fontara-ui-bg-custom-font-abort"
    }
  | {
      data: { clientMutationId: string; familyValue: string }
      type: "fontara-ui-bg-custom-font-delete"
    }

export type FontaraBackgroundMessage = {
  data: FontaraExtensionData
  type: "fontara-bg-ui-changes"
}

export type FontaraContentScriptMessage = {
  pageURL?: string
  scriptId: string
  type:
    | "fontara-cs-bg-document-connect"
    | "fontara-cs-bg-document-forget"
    | "fontara-cs-bg-document-update"
    | "fontara-cs-bg-document-resume"
}

export type FontaraCustomFontLoadResultMessage = {
  data: CustomFontLoadResult
  type: "fontara-cs-bg-custom-font-load-result"
}

export type FontaraCustomFontTransactionFamily = CustomFontFamilyDraft

export type FontaraContentCommandMessage =
  | {
      commandOrder?: FontaraContentCommandOrder
      data: FontaraPageThemeCommandData
      scriptId?: string
      type: "fontara-bg-cs-apply-theme"
    }
  | {
      commandOrder?: FontaraContentCommandOrder
      scriptId?: string
      type: "fontara-bg-cs-clean-up"
    }
  | {
      scriptId?: string
      type: "fontara-bg-cs-settings-changed"
    }

export type FontaraMessageResponse<T = unknown> = {
  data?: T
  error?: string
}
