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

const BACKGROUND_STORAGE_UPDATE_GRACE_MS = 25

export type ResolvedPageThemeRequestType =
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE

type ThemeSchedulerOptions = {
  isDisposed: () => boolean
  onExtensionContextInvalidated: () => void
  onLocalFallbackActivated?: () => void
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
  scheduleLocalThemeApply: (mode: ContentApplyMode) => void
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
  let localApplyQueuedMode: ContentApplyMode | null = null
  let localApplyRunning = false
  let localApplyScheduledMode: ContentApplyMode | null = null
  let backgroundStorageUpdateTimeout: number | null = null
  let backgroundStorageUpdateMode: ContentApplyMode | null = null
  let backgroundCommandsEnabled = false
  let resolvedThemeRevision = 0
  let localFallbackActive = false

  const themeApplierCallbacks = {
    isDisposed: options.isDisposed,
    isExtensionContextInvalidated,
    onExtensionContextInvalidated: options.onExtensionContextInvalidated,
    warn: options.warn ?? debugWarn
  }

  function activateLocalFallback(): void {
    if (localFallbackActive) return

    localFallbackActive = true
    options.onLocalFallbackActivated?.()
  }

  function markBackgroundCommandsEnabled(): void {
    backgroundCommandsEnabled = true
  }

  async function applyLocalResolvedPageTheme(
    mode: ContentApplyMode
  ): Promise<void> {
    if (options.isDisposed()) return
    try {
      await applyResolvedPageTheme(
        await createFontaraPageThemeData(
          window.location.href,
          await readLocalThemeSettings(),
          mode,
          { googleFontCSSLoadMode: "cache-only" }
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

  async function runScheduledLocalThemeApply(
    mode: ContentApplyMode
  ): Promise<void> {
    if (localApplyRunning) {
      localApplyQueuedMode = mergeApplyMode(localApplyQueuedMode, mode)
      return
    }

    localApplyRunning = true
    let currentMode: ContentApplyMode | null = mode
    try {
      while (currentMode && !options.isDisposed()) {
        const modeToRun = currentMode
        currentMode = null
        localApplyQueuedMode = null
        await applyLocalResolvedPageTheme(modeToRun)
        currentMode = localApplyQueuedMode
      }
    } finally {
      localApplyRunning = false
    }
  }

  function scheduleLocalThemeApply(mode: ContentApplyMode = "full"): void {
    if (options.isDisposed()) return

    activateLocalFallback()

    if (localApplyRunning) {
      localApplyQueuedMode = mergeApplyMode(localApplyQueuedMode, mode)
      return
    }

    const alreadyScheduled = localApplyScheduledMode !== null
    localApplyScheduledMode = mergeApplyMode(localApplyScheduledMode, mode)
    if (alreadyScheduled) return

    queueMicrotask(() => {
      const scheduledMode = localApplyScheduledMode
      localApplyScheduledMode = null

      if (!options.isDisposed() && scheduledMode) {
        void runScheduledLocalThemeApply(scheduledMode)
      }
    })
  }

  function clearBackgroundStorageUpdate(): void {
    if (backgroundStorageUpdateTimeout !== null) {
      clearTimeout(backgroundStorageUpdateTimeout)
      backgroundStorageUpdateTimeout = null
    }
    backgroundStorageUpdateMode = null
  }

  function scheduleStorageFallbackApply(mode: ContentApplyMode = "full"): void {
    if (backgroundCommandsEnabled) {
      const alreadyScheduled = backgroundStorageUpdateTimeout !== null
      backgroundStorageUpdateMode = mergeApplyMode(
        backgroundStorageUpdateMode,
        mode
      )
      if (alreadyScheduled) return

      backgroundStorageUpdateTimeout = window.setTimeout(() => {
        const scheduledMode = backgroundStorageUpdateMode
        backgroundStorageUpdateTimeout = null
        backgroundStorageUpdateMode = null

        if (!options.isDisposed() && scheduledMode) {
          requestResolvedPageThemeOrFallback(
            MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE,
            scheduledMode
          )
        }
      }, BACKGROUND_STORAGE_UPDATE_GRACE_MS)
      return
    }

    scheduleLocalThemeApply(mode)
  }

  function requestResolvedPageThemeOrFallback(
    type: ResolvedPageThemeRequestType,
    mode: ContentApplyMode = "full"
  ): void {
    const expectedRevision = resolvedThemeRevision
    const sent = options.sendDocumentLifecycleMessage(type)

    if (!sent) {
      scheduleLocalThemeApply(mode)
      return
    }

    window.setTimeout(() => {
      if (!options.isDisposed() && resolvedThemeRevision === expectedRevision) {
        scheduleLocalThemeApply(mode)
      }
    }, 100)
  }

  function applyThemeCommand(data: FontaraPageThemeCommandData): void {
    markBackgroundCommandsEnabled()
    clearBackgroundStorageUpdate()
    resolvedThemeRevision += 1
    void applyResolvedPageTheme(data, themeApplierCallbacks)
  }

  function cleanUpThemeCommand(): void {
    markBackgroundCommandsEnabled()
    clearBackgroundStorageUpdate()
    resolvedThemeRevision += 1
    cleanupResolvedPageTheme()
  }

  function dispose(): void {
    clearBackgroundStorageUpdate()
    localApplyQueuedMode = null
    localApplyScheduledMode = null
  }

  return {
    applyThemeCommand,
    cleanUpThemeCommand,
    dispose,
    requestResolvedPageThemeOrFallback,
    scheduleLocalThemeApply,
    scheduleStorageFallbackApply
  }
}
