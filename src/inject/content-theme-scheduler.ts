import type { FontaraPageThemeCommandData } from "../definitions"
import { createFontaraPageThemeData } from "../generators/page-theme"
import { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import { getSettingsBackupDefaults } from "../utils/settings-backup"
import { getLocalValues } from "../utils/storage"
import { normalizeStorageValues } from "../utils/storage-normalization"
import { debugWarn, isExtensionContextInvalidated } from "./content-messaging"
import { stopObserving } from "./observer"
import {
  applyResolvedPageTheme,
  cleanupResolvedPageTheme
} from "./theme-applier"

export type ContentApplyMode = "font-styles" | "full"

export type ResolvedPageThemeRequestType =
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE

type ThemeSchedulerOptions = {
  isDisposed: () => boolean
  onExtensionContextInvalidated: () => void
  sendDocumentLifecycleMessage: (type: ResolvedPageThemeRequestType) => boolean
  warn?: (message: string, error: unknown) => void
}

export type ContentThemeScheduler = {
  applyThemeCommand: (data: FontaraPageThemeCommandData) => void
  cleanUpThemeCommand: () => void
  dispose: () => void
  requestResolvedPageThemeOrFallback: (
    type: ResolvedPageThemeRequestType,
    mode?: ContentApplyMode
  ) => void
  scheduleLegacyApply: (mode: ContentApplyMode) => void
  scheduleStorageFallbackApply: (mode?: ContentApplyMode) => void
}

function mergeApplyMode(
  currentMode: ContentApplyMode | null,
  nextMode: ContentApplyMode
): ContentApplyMode {
  return currentMode === "full" || nextMode === "full" ? "full" : "font-styles"
}

async function readLocalThemeSettings(): Promise<Record<string, unknown>> {
  return normalizeStorageValues(
    await getLocalValues(getSettingsBackupDefaults())
  )
}

export function createContentThemeScheduler(
  options: ThemeSchedulerOptions
): ContentThemeScheduler {
  let applyFontsQueuedMode: ContentApplyMode | null = null
  let applyFontsRunning = false
  let applyFontsScheduledMode: ContentApplyMode | null = null
  let backgroundCommandsEnabled = false
  let resolvedThemeRevision = 0

  const themeApplierCallbacks = {
    isDisposed: options.isDisposed,
    isExtensionContextInvalidated,
    onExtensionContextInvalidated: options.onExtensionContextInvalidated,
    warn: options.warn ?? debugWarn
  }

  async function applyFontsIfActive(mode: ContentApplyMode): Promise<void> {
    if (options.isDisposed()) return
    try {
      await applyResolvedPageTheme(
        await createFontaraPageThemeData(
          window.location.href,
          await readLocalThemeSettings(),
          mode
        ),
        themeApplierCallbacks
      )
    } catch (error) {
      stopObserving()
      if (isExtensionContextInvalidated(error)) {
        options.onExtensionContextInvalidated()
        return
      }
      options.warn?.("Failed to apply FontAra styles.", error)
    }
  }

  async function runScheduledApplyFontsIfActive(
    mode: ContentApplyMode
  ): Promise<void> {
    if (applyFontsRunning) {
      applyFontsQueuedMode = mergeApplyMode(applyFontsQueuedMode, mode)
      return
    }

    applyFontsRunning = true
    let currentMode: ContentApplyMode | null = mode
    try {
      while (currentMode && !options.isDisposed()) {
        const modeToRun = currentMode
        currentMode = null
        applyFontsQueuedMode = null
        await applyFontsIfActive(modeToRun)
        currentMode = applyFontsQueuedMode
      }
    } finally {
      applyFontsRunning = false
    }
  }

  function scheduleApplyFontsIfActive(mode: ContentApplyMode = "full"): void {
    if (options.isDisposed()) return

    if (applyFontsRunning) {
      applyFontsQueuedMode = mergeApplyMode(applyFontsQueuedMode, mode)
      return
    }

    const alreadyScheduled = applyFontsScheduledMode !== null
    applyFontsScheduledMode = mergeApplyMode(applyFontsScheduledMode, mode)
    if (alreadyScheduled) return

    queueMicrotask(() => {
      const scheduledMode = applyFontsScheduledMode
      applyFontsScheduledMode = null

      if (!options.isDisposed() && scheduledMode) {
        void runScheduledApplyFontsIfActive(scheduledMode)
      }
    })
  }

  function scheduleLegacyApply(mode: ContentApplyMode): void {
    scheduleApplyFontsIfActive(mode)
  }

  function scheduleStorageFallbackApply(mode: ContentApplyMode = "full"): void {
    if (backgroundCommandsEnabled) {
      requestResolvedPageThemeOrFallback(
        MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
        mode
      )
      return
    }

    scheduleLegacyApply(mode)
  }

  function requestResolvedPageThemeOrFallback(
    type: ResolvedPageThemeRequestType,
    mode: ContentApplyMode = "full"
  ): void {
    const expectedRevision = resolvedThemeRevision
    const sent = options.sendDocumentLifecycleMessage(type)

    if (!sent) {
      scheduleLegacyApply(mode)
      return
    }

    window.setTimeout(() => {
      if (!options.isDisposed() && resolvedThemeRevision === expectedRevision) {
        scheduleLegacyApply(mode)
      }
    }, 100)
  }

  function applyThemeCommand(data: FontaraPageThemeCommandData): void {
    backgroundCommandsEnabled = true
    resolvedThemeRevision += 1
    void applyResolvedPageTheme(data, themeApplierCallbacks)
  }

  function cleanUpThemeCommand(): void {
    backgroundCommandsEnabled = true
    resolvedThemeRevision += 1
    cleanupResolvedPageTheme()
  }

  function dispose(): void {
    applyFontsQueuedMode = null
    applyFontsScheduledMode = null
  }

  return {
    applyThemeCommand,
    cleanUpThemeCommand,
    dispose,
    requestResolvedPageThemeOrFallback,
    scheduleLegacyApply,
    scheduleStorageFallbackApply
  }
}
