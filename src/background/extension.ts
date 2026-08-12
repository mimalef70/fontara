import { STORAGE_KEYS, URLS } from "../config/storage"
import type {
  CustomFontFamilyDraft,
  CustomFontTransactionBeginResult,
  CustomFontTransactionCommitResult,
  CustomFontTransactionMode
} from "../custom-font-types"
import type {
  FontaraExtensionData,
  FontaraImportedSettingsResult,
  FontaraSettings,
  FontaraSettingsMutationResult
} from "../definitions"
import {
  createSettingsResetValues,
  normalizeSettingsBackup
} from "../utils/settings-backup"
import {
  type CommandDetails,
  FONTARA_COMMANDS,
  registerCommandListeners,
  setFontaraCommandRunner
} from "./command-manager"
import {
  createToggleCurrentSiteSettings,
  createToggleExtensionSettings
} from "./command-settings"
import { registerContextMenuListeners } from "./context-menu-manager"
import {
  BackgroundCustomFontManager,
  registerCustomFontLoadResultListener
} from "./custom-font-manager"
import {
  collectActiveTabInfo,
  collectShortcuts,
  getCommandURL
} from "./extension-data"
import { registerIconListeners, updateIconStatus } from "./icon-manager"
import { initMessenger, reportChanges } from "./messenger"
import {
  getBackgroundSettings,
  getBackgroundSettingsSnapshot,
  invalidateBackgroundSettingsCache,
  syncBackgroundSettingsCacheFromLocalChanges,
  writeBackgroundSettingsWithSyncSnapshot
} from "./settings-manager"
import {
  ensureStorageValues,
  flushPendingSettingsSync,
  registerSettingsSyncListeners,
  schedulePendingSettingsSync
} from "./storage-manager"
import {
  type FontaraResolvedDocumentMessage,
  initTabManager,
  notifyContentScriptsAboutSettingsChange
} from "./tab-manager"

const CHANGE_REPORT_DELAY_MS = 25

let initialized = false
let started = false
let startPromise: Promise<void> | null = null
let reportChangesTimeout: ReturnType<typeof setTimeout> | null = null
let customFontManager: BackgroundCustomFontManager | null = null
let settingsMutationQueue: Promise<void> = Promise.resolve()

function enqueueSettingsMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsMutationQueue.then(operation, operation)
  settingsMutationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function logDebug(message: string, error?: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

async function openInstalledPage(reason: chrome.runtime.OnInstalledReason) {
  if (reason === "install") {
    await chrome.tabs.create({ url: URLS.WELCOME_PAGE })
  } else if (reason === "update") {
    await chrome.tabs.create({ url: URLS.CHANGELOG })
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: Keeps the central static extension controller explicit.
export class ExtensionRuntime {
  private static init(): void {
    if (initialized) return

    initialized = true
    customFontManager = new BackgroundCustomFontManager({
      readSettings: getBackgroundSettings,
      writeSettings: ExtensionRuntime.persistSettingsChange
    })
    initMessenger({
      abortCustomFontTransaction: ExtensionRuntime.abortCustomFontTransaction,
      beginCustomFontTransaction: ExtensionRuntime.beginCustomFontTransaction,
      changeSettings: ExtensionRuntime.changeSettings,
      collect: ExtensionRuntime.collectData,
      commitCustomFontTransaction: ExtensionRuntime.commitCustomFontTransaction,
      deleteCustomFont: ExtensionRuntime.deleteCustomFont,
      importCustomFontBatch: ExtensionRuntime.importCustomFontBatch,
      importSettings: ExtensionRuntime.importSettings,
      putCustomFontFace: ExtensionRuntime.putCustomFontFace,
      resetSettings: ExtensionRuntime.resetSettings,
      runCommand: ExtensionRuntime.runCommand
    })
    setFontaraCommandRunner(ExtensionRuntime.runCommand)
    registerSettingsSyncListeners()
    initTabManager({
      createDocumentMessage: ExtensionRuntime.createDocumentMessage
    })
    registerIconListeners()
    registerCommandListeners()
    registerContextMenuListeners()
    registerCustomFontLoadResultListener()
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && Object.keys(changes).length > 0) {
        void ExtensionRuntime.handleLocalSettingsChange(changes)
      }
    })
    chrome.runtime.onInstalled.addListener((details) => {
      void (async () => {
        await ensureStorageValues()
        invalidateBackgroundSettingsCache()
        await openInstalledPage(details.reason)
      })().catch((error) => {
        logDebug("Failed to handle FontAra install/update event.", error)
      })
    })
    chrome.runtime.setUninstallURL(URLS.UNINSTALL_FORM)
  }

  static start(): Promise<void> {
    ExtensionRuntime.init()

    if (startPromise) return startPromise

    startPromise = ensureStorageValues()
      .then(async () => {
        invalidateBackgroundSettingsCache()
        try {
          await customFontManager?.initialize()
        } catch (error) {
          // Recovery/cleanup must never make the whole MV3 worker unusable.
          // Journals and blobs are intentionally retained by the manager so a
          // later startup or explicit health check can retry safely.
          logDebug("Failed to recover custom font transactions.", error)
        }
      })
      .then(() => {
        started = true
        ExtensionRuntime.scheduleReportChanges()
      })
      .catch((error) => {
        logDebug("Failed to initialize FontAra runtime.", error)
        throw error
      })

    return startPromise
  }

  private static async ensureStarted(): Promise<void> {
    if (started) return
    await ExtensionRuntime.start()
  }

  private static scheduleReportChanges(): void {
    if (reportChangesTimeout !== null) {
      clearTimeout(reportChangesTimeout)
    }

    reportChangesTimeout = setTimeout(() => {
      reportChangesTimeout = null
      void ExtensionRuntime.reportChanges().catch((error) => {
        logDebug("Failed to report FontAra changes.", error)
      })
    }, CHANGE_REPORT_DELAY_MS)
  }

  private static async reportChanges(): Promise<void> {
    const data = await ExtensionRuntime.collectData()

    reportChanges(data)
    await updateIconStatus(data.settings)
  }

  private static async createDocumentMessage(document: {
    url: string
  }): Promise<FontaraResolvedDocumentMessage> {
    await ExtensionRuntime.ensureStarted()
    const { revision, settings } = await getBackgroundSettingsSnapshot()
    return {
      message: await ExtensionRuntime.createContentCommandMessage(
        document.url,
        settings
      ),
      settingsRevision: revision
    }
  }

  private static async notifyContentScriptsAboutSettingsChange(
    settings?: Record<string, unknown>,
    settingsRevision?: number
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    let resolvedSettings = settings
    let resolvedRevision = settingsRevision
    if (!resolvedSettings || resolvedRevision === undefined) {
      const snapshot = await getBackgroundSettingsSnapshot()
      resolvedSettings = resolvedSettings ?? snapshot.settings
      resolvedRevision = resolvedRevision ?? snapshot.revision
    }

    await notifyContentScriptsAboutSettingsChange(async (document) => ({
      message: await ExtensionRuntime.createContentCommandMessage(
        document.url,
        resolvedSettings
      ),
      settingsRevision: resolvedRevision
    }))
  }

  private static async handleLocalSettingsChange(
    changes: Record<string, chrome.storage.StorageChange>
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    const settings = await syncBackgroundSettingsCacheFromLocalChanges(changes)
    if (!settings) return

    const { revision } = await getBackgroundSettingsSnapshot()
    await ExtensionRuntime.publishSettingsChange(settings, revision)
  }

  private static async publishSettingsChange(
    settings: Record<string, unknown>,
    settingsRevision?: number
  ): Promise<void> {
    await ExtensionRuntime.notifyContentScriptsAboutSettingsChange(
      settings,
      settingsRevision
    )
    ExtensionRuntime.scheduleReportChanges()
  }

  private static async persistSettingsChange(
    settings: FontaraSettings,
    options: { flushSync?: boolean } = {}
  ): Promise<FontaraSettingsMutationResult> {
    await ExtensionRuntime.ensureStarted()
    const {
      revision,
      settings: updatedSettings,
      syncSnapshot
    } = await writeBackgroundSettingsWithSyncSnapshot(settings)

    await ExtensionRuntime.publishSettingsChange(updatedSettings, revision)
    if (options.flushSync) {
      await flushPendingSettingsSync(syncSnapshot)
    } else {
      schedulePendingSettingsSync(syncSnapshot)
    }

    return { revision }
  }

  private static writeSettingsChange(
    settings: FontaraSettings,
    options: { flushSync?: boolean } = {}
  ): Promise<FontaraSettingsMutationResult> {
    return enqueueSettingsMutation(() =>
      ExtensionRuntime.persistSettingsChange(settings, options)
    )
  }

  private static async createContentCommandMessage(
    url: string,
    settings: Record<string, unknown>
  ) {
    const { createFontaraContentCommandMessage } = await import(
      "./theme-message"
    )

    return createFontaraContentCommandMessage(url, settings)
  }

  static async collectData(): Promise<FontaraExtensionData> {
    await ExtensionRuntime.ensureStarted()
    const [settingsSnapshot, shortcuts] = await Promise.all([
      getBackgroundSettingsSnapshot(),
      collectShortcuts()
    ])
    const { revision: settingsRevision, settings } = settingsSnapshot
    const activeTab = await collectActiveTabInfo(settings)

    return {
      activeTab,
      isReady: true,
      settings,
      settingsRevision,
      shortcuts
    }
  }

  static async changeSettings(
    settings: FontaraSettings
  ): Promise<FontaraSettingsMutationResult> {
    if (
      Object.getOwnPropertyDescriptor(
        settings,
        STORAGE_KEYS.CUSTOM_FONT_LIST
      ) !== undefined
    ) {
      throw new Error("custom-font-list-requires-transaction")
    }
    return ExtensionRuntime.writeSettingsChange(settings)
  }

  static async importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult> {
    return enqueueSettingsMutation(async () => {
      const replacesCustomFonts =
        Object.getOwnPropertyDescriptor(
          settings,
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ) !== undefined
      if (
        replacesCustomFonts &&
        !Array.isArray(settings[STORAGE_KEYS.CUSTOM_FONT_LIST])
      ) {
        // The background is the durability boundary. Do not rely on the
        // options-page preflight here: normalization turns malformed catalog
        // values into [], which would otherwise look like an intentional
        // request to erase the complete local font library.
        throw new Error("invalid-custom-font-backup")
      }
      const normalizedBackup = await normalizeSettingsBackup(settings)
      if (!replacesCustomFonts) {
        // Old and partial backups did not necessarily contain custom-font
        // data. Omit the generated default instead of copying the normalized
        // catalog back: this preserves even quarantined/forward-compatible raw
        // metadata in storage until the user explicitly replaces the library.
        delete normalizedBackup.settings[STORAGE_KEYS.CUSTOM_FONT_LIST]
      }
      const importedCustomFonts =
        normalizedBackup.settings[STORAGE_KEYS.CUSTOM_FONT_LIST]
      if (replacesCustomFonts && Array.isArray(importedCustomFonts)) {
        if (!customFontManager) {
          throw new Error("custom-font-manager-not-ready")
        }
        await customFontManager.validateLibrary(importedCustomFonts)
      }
      const mutation = await ExtensionRuntime.persistSettingsChange(
        normalizedBackup.settings,
        {
          flushSync: true
        }
      )
      if (replacesCustomFonts) {
        try {
          await customFontManager?.collectUnusedAfterCatalogReplacement()
        } catch (error) {
          // The settings import has already crossed its durability boundary.
          // Orphan cleanup is best-effort and must not report a successful
          // import as failed (or invite the UI to submit it again).
          logDebug("Failed to clean unused custom fonts after import.", error)
        }
      }

      return {
        ignoredKeyCount: normalizedBackup.ignoredKeyCount,
        importedKeyCount: normalizedBackup.importedKeyCount,
        revision: mutation.revision
      }
    })
  }

  static resetSettings(): Promise<FontaraSettingsMutationResult> {
    return enqueueSettingsMutation(async () => {
      const result = await ExtensionRuntime.persistSettingsChange(
        await createSettingsResetValues(),
        {
          flushSync: true
        }
      )
      try {
        await customFontManager?.collectUnusedAfterCatalogReplacement()
      } catch (error) {
        // Reset is already persisted; retain recoverable blobs for a later
        // cleanup instead of turning this into a false mutation failure.
        logDebug("Failed to clean unused custom fonts after reset.", error)
      }
      return result
    })
  }

  static async importCustomFontBatch(
    transactionIds: string[],
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    const manager = customFontManager

    return enqueueSettingsMutation(async () => {
      const normalizedBackup = await normalizeSettingsBackup(settings)
      await manager.commitBatch(transactionIds, normalizedBackup.settings)
      const { revision } = await getBackgroundSettingsSnapshot()
      return {
        ignoredKeyCount: normalizedBackup.ignoredKeyCount,
        importedKeyCount: normalizedBackup.importedKeyCount,
        revision
      }
    })
  }

  static async beginCustomFontTransaction(
    family: CustomFontFamilyDraft,
    mode?: CustomFontTransactionMode
  ): Promise<CustomFontTransactionBeginResult> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    return customFontManager.begin(family, mode)
  }

  static async putCustomFontFace(
    transactionId: string,
    faceId: string,
    base64: string
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    await customFontManager.putFace(transactionId, faceId, base64)
  }

  static async commitCustomFontTransaction(
    transactionId: string
  ): Promise<CustomFontTransactionCommitResult> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    const manager = customFontManager
    return enqueueSettingsMutation(async () => {
      const family = await manager.commit(transactionId)
      const { revision } = await getBackgroundSettingsSnapshot()
      return { family, revision }
    })
  }

  static async abortCustomFontTransaction(
    transactionId: string
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    await customFontManager.abort(transactionId)
  }

  static async deleteCustomFont(
    familyValue: string
  ): Promise<FontaraSettingsMutationResult> {
    await ExtensionRuntime.ensureStarted()
    if (!customFontManager) throw new Error("custom-font-manager-not-ready")
    const manager = customFontManager
    return enqueueSettingsMutation(async () => {
      await manager.delete(familyValue)
      const { revision } = await getBackgroundSettingsSnapshot()
      return { revision }
    })
  }

  private static toggleExtension(): Promise<void> {
    return enqueueSettingsMutation(async () => {
      await ExtensionRuntime.persistSettingsChange(
        createToggleExtensionSettings(await getBackgroundSettings())
      )
    })
  }

  private static async toggleCurrentSite(
    details: CommandDetails
  ): Promise<void> {
    const url = await getCommandURL(details)
    if (!url) return

    await enqueueSettingsMutation(async () => {
      await ExtensionRuntime.persistSettingsChange(
        createToggleCurrentSiteSettings(url, await getBackgroundSettings())
      )
    })
  }

  static async runCommand(
    command: string,
    details: CommandDetails = {}
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()

    switch (command) {
      case FONTARA_COMMANDS.TOGGLE_EXTENSION:
        await ExtensionRuntime.toggleExtension()
        break
      case FONTARA_COMMANDS.TOGGLE_SITE:
        await ExtensionRuntime.toggleCurrentSite(details)
        break
    }
  }
}
