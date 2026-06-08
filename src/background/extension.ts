import {
  createSiteListToggleUpdate,
  getActiveWebsiteSitePatterns,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import { DEFAULT_VALUES, STORAGE_KEYS, URLS } from "../config/storage"
import type {
  FontaraExtensionData,
  FontaraImportedSettingsResult,
  FontaraSettings,
  FontaraShortcuts,
  FontaraTabInfo,
  WebsiteItem
} from "../definitions"
import {
  createSettingsResetValues,
  getSettingsBackupDefaults,
  normalizeSettingsBackup
} from "../utils/settings-backup"
import { getLocalValues, setLocalValues } from "../utils/storage"
import { normalizeStorageValues } from "../utils/storage-normalization"
import {
  createRegexFromUrl,
  getMatchingWebsite,
  isUrlActive
} from "../utils/url"
import {
  type CommandDetails,
  FONTARA_COMMANDS,
  registerCommandListeners,
  setFontaraCommandRunner
} from "./command-manager"
import { registerContextMenuListeners } from "./context-menu-manager"
import { registerIconListeners, updateIconStatus } from "./icon-manager"
import { initMessenger, reportChanges } from "./messenger"
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

function valuesAreEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

function pickChangedValues(
  currentValues: Record<string, unknown>,
  nextValues: Record<string, unknown>
): Record<string, unknown> {
  const changedValues: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(nextValues)) {
    if (!valuesAreEqual(currentValues[key], value)) {
      changedValues[key] = value
    }
  }

  return changedValues
}

function isSupportedPageURL(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null)
    })
  })
}

function getCommands(): Promise<chrome.commands.Command[]> {
  if (!chrome.commands?.getAll) {
    return Promise.resolve([])
  }

  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => {
      resolve(commands ?? [])
    })
  })
}

async function getCommandURL(details: CommandDetails): Promise<string | null> {
  if (isSupportedPageURL(details.url)) return details.url
  if (isSupportedPageURL(details.tab?.url)) return details.tab.url

  const activeTab = await getActiveTab()
  return isSupportedPageURL(activeTab?.url) ? activeTab.url : null
}

async function readSettings(): Promise<Record<string, unknown>> {
  const values = await getLocalValues(getSettingsBackupDefaults())
  return normalizeStorageValues(values)
}

async function writeNormalizedSettings(
  nextValues: Record<string, unknown>
): Promise<void> {
  const currentValues = await getLocalValues(getSettingsBackupDefaults())
  const normalizedValues = await normalizeStorageValues({
    ...currentValues,
    ...nextValues
  })
  const changedValues = pickChangedValues(currentValues, normalizedValues)

  if (Object.keys(changedValues).length > 0) {
    await setLocalValues(changedValues)
  }
}

async function collectShortcuts(): Promise<FontaraShortcuts> {
  const commands = await getCommands()

  return commands.reduce<FontaraShortcuts>((shortcuts, command) => {
    if (command.name === "toggle" || command.name === "addSite") {
      shortcuts[command.name] = command.shortcut || ""
    }

    return shortcuts
  }, {})
}

async function collectActiveTabInfo(): Promise<FontaraTabInfo> {
  const tab = await getActiveTab()
  const url = tab?.url ?? null
  const isSupported = isSupportedPageURL(url)
  const active = isSupported ? await isUrlActive(url) : false

  return {
    id: typeof tab?.id === "number" ? tab.id : null,
    isActive: active,
    isSupported,
    url
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
    initTabManager()
    registerIconListeners()
    registerCommandListeners()
    registerContextMenuListeners()
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && Object.keys(changes).length > 0) {
        notifyContentScriptsAboutSettingsChange()
        ExtensionRuntime.scheduleReportChanges()
      }
    })
    chrome.runtime.onInstalled.addListener((details) => {
      void (async () => {
        await ensureStorageValues()
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
    reportChanges(await ExtensionRuntime.collectData())
    await updateIconStatus()
  }

  static async collectData(): Promise<FontaraExtensionData> {
    await ExtensionRuntime.ensureStarted()
    const [settings, shortcuts, activeTab] = await Promise.all([
      readSettings(),
      collectShortcuts(),
      collectActiveTabInfo()
    ])

    return {
      activeTab,
      isReady: true,
      settings,
      shortcuts
    }
  }

  static async changeSettings(settings: FontaraSettings): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    await writeNormalizedSettings(settings)
    ExtensionRuntime.scheduleReportChanges()
  }

  static async importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult> {
    await ExtensionRuntime.ensureStarted()
    const normalizedBackup = await normalizeSettingsBackup(settings)
    await writeNormalizedSettings(normalizedBackup.settings)
    ExtensionRuntime.scheduleReportChanges()

    return {
      ignoredKeyCount: normalizedBackup.ignoredKeyCount,
      importedKeyCount: normalizedBackup.importedKeyCount
    }
  }

  static async resetSettings(): Promise<void> {
    await ExtensionRuntime.ensureStarted()
    await writeNormalizedSettings(await createSettingsResetValues())
    ExtensionRuntime.scheduleReportChanges()
  }

  private static async toggleExtension(): Promise<void> {
    const settings = await readSettings()
    await ExtensionRuntime.changeSettings({
      [STORAGE_KEYS.EXTENSION_ENABLED]:
        settings[STORAGE_KEYS.EXTENSION_ENABLED] === false
    })
  }

  private static async toggleCurrentSite(
    details: CommandDetails
  ): Promise<void> {
    const url = await getCommandURL(details)
    if (!url) return

    const settings = await readSettings()
    const websiteList = Array.isArray(settings[STORAGE_KEYS.WEBSITE_LIST])
      ? (settings[STORAGE_KEYS.WEBSITE_LIST] as WebsiteItem[])
      : DEFAULT_VALUES.WEBSITE_LIST
    const enabledByDefault = normalizeEnabledByDefault(
      settings[STORAGE_KEYS.ENABLED_BY_DEFAULT]
    )
    const enabledFor =
      settings[STORAGE_KEYS.ENABLED_FOR] === undefined
        ? getActiveWebsiteSitePatterns(websiteList)
        : normalizeEnabledSiteList(settings[STORAGE_KEYS.ENABLED_FOR])
    const disabledFor =
      settings[STORAGE_KEYS.DISABLED_FOR] === undefined
        ? DEFAULT_VALUES.DISABLED_FOR
        : normalizeSiteList(settings[STORAGE_KEYS.DISABLED_FOR])
    const siteListSettings = {
      disabledFor,
      enabledByDefault,
      enabledFor
    }
    const checked = !isSiteListUrlEnabled(url, siteListSettings)
    const existingWebsiteIndex = websiteList.findIndex(
      (item) => getMatchingWebsite(url, [item]) !== null
    )
    const siteListUpdate = createSiteListToggleUpdate(
      url,
      siteListSettings,
      checked
    )
    const updatedWebsiteList =
      existingWebsiteIndex === -1 && checked
        ? [
            ...websiteList,
            {
              url,
              regex: createRegexFromUrl(url),
              isActive: true
            }
          ]
        : websiteList.map((item, index) =>
            index === existingWebsiteIndex
              ? { ...item, isActive: checked }
              : item
          )

    await ExtensionRuntime.changeSettings({
      [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
      [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
      [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
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
