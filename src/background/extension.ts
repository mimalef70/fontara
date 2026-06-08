import { URLS } from "../config/storage"
import type {
  FontaraExtensionData,
  FontaraImportedSettingsResult,
  FontaraSettings
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
  collectActiveTabInfo,
  collectShortcuts,
  getCommandURL
} from "./extension-data"
import { registerIconListeners, updateIconStatus } from "./icon-manager"
import { initMessenger, reportChanges } from "./messenger"
import {
  getBackgroundSettings,
  invalidateBackgroundSettingsCache,
  syncBackgroundSettingsCacheFromLocalChanges,
  writeBackgroundSettings
} from "./settings-manager"
import {
  ensureStorageValues,
  registerSettingsSyncListeners
} from "./storage-manager"
import {
  initTabManager,
  notifyContentScriptsAboutSettingsChange
} from "./tab-manager"

const CHANGE_REPORT_DELAY_MS = 25

let initialized = false
let started = false
let startPromise: Promise<void> | null = null
let reportChangesTimeout: ReturnType<typeof setTimeout> | null = null

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
    initMessenger({
      changeSettings: ExtensionRuntime.changeSettings,
      collect: ExtensionRuntime.collectData,
      importSettings: ExtensionRuntime.importSettings,
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
      .then(() => {
        invalidateBackgroundSettingsCache()
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

  private static async createDocumentMessage(document: { url: string }) {
    await ExtensionRuntime.ensureStarted()
    return ExtensionRuntime.createContentCommandMessage(
      document.url,
      await getBackgroundSettings()
    )
  }

  private static async notifyContentScriptsAboutSettingsChange(
    settings?: Record<string, unknown>
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    const resolvedSettings = settings ?? (await getBackgroundSettings())
    await notifyContentScriptsAboutSettingsChange((document) =>
      ExtensionRuntime.createContentCommandMessage(
        document.url,
        resolvedSettings
      )
    )
  }

  private static async handleLocalSettingsChange(
    changes: Record<string, chrome.storage.StorageChange>
  ): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    const settings = await syncBackgroundSettingsCacheFromLocalChanges(changes)
    if (!settings) return

    await ExtensionRuntime.publishSettingsChange(settings)
  }

  private static async publishSettingsChange(
    settings: Record<string, unknown>
  ): Promise<void> {
    await ExtensionRuntime.notifyContentScriptsAboutSettingsChange(settings)
    ExtensionRuntime.scheduleReportChanges()
  }

  private static async writeSettingsChange(
    settings: FontaraSettings
  ): Promise<Record<string, unknown>> {
    await ExtensionRuntime.ensureStarted()
    const updatedSettings = await writeBackgroundSettings(settings)

    await ExtensionRuntime.publishSettingsChange(updatedSettings)

    return updatedSettings
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
    const [settings, shortcuts] = await Promise.all([
      getBackgroundSettings(),
      collectShortcuts()
    ])
    const activeTab = await collectActiveTabInfo(settings)

    return {
      activeTab,
      isReady: true,
      settings,
      shortcuts
    }
  }

  static async changeSettings(settings: FontaraSettings): Promise<void> {
    await ExtensionRuntime.writeSettingsChange(settings)
  }

  static async importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult> {
    const normalizedBackup = await normalizeSettingsBackup(settings)

    await ExtensionRuntime.writeSettingsChange(normalizedBackup.settings)

    return {
      ignoredKeyCount: normalizedBackup.ignoredKeyCount,
      importedKeyCount: normalizedBackup.importedKeyCount
    }
  }

  static async resetSettings(): Promise<void> {
    await ExtensionRuntime.writeSettingsChange(
      await createSettingsResetValues()
    )
  }

  private static async toggleExtension(): Promise<void> {
    await ExtensionRuntime.changeSettings(
      createToggleExtensionSettings(await getBackgroundSettings())
    )
  }

  private static async toggleCurrentSite(
    details: CommandDetails
  ): Promise<void> {
    const url = await getCommandURL(details)
    if (!url) return

    await ExtensionRuntime.changeSettings(
      createToggleCurrentSiteSettings(url, await getBackgroundSettings())
    )
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
