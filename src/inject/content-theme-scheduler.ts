import type {
  FontaraContentCommandOrder,
  FontaraPageThemeCommandData
} from "../definitions"
import { createFontaraPageThemeData } from "../generators/page-theme"
import { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import { getRelatedFrameRuntimePageURL } from "../utils/runtime-url"
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
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE

type ThemeSchedulerOptions = {
  isDisposed: () => boolean
  onBackgroundCommandsEnabled?: () => void
  onExtensionContextInvalidated: () => void
  onLocalFallbackActivated?: () => void
  sendDocumentLifecycleMessage: (type: ResolvedPageThemeRequestType) => boolean
  warn?: (message: string, error: unknown) => void
}

export type ContentThemeScheduler = {
  applyThemeCommand: (
    data: FontaraPageThemeCommandData,
    commandOrder?: FontaraContentCommandOrder
  ) => void
  cleanUpThemeCommand: (commandOrder?: FontaraContentCommandOrder) => void
  dispose: () => void
  requestResolvedPageThemeOrFallback: (
    type: ResolvedPageThemeRequestType,
    mode?: ContentApplyMode
  ) => void
  scheduleLocalThemeApply: (mode: ContentApplyMode) => void
  scheduleStorageFallbackApply: (mode?: ContentApplyMode) => void
}

const MAX_RETIRED_DISPATCHERS = 8

type ContentCommandOrderTracker = {
  accept: (commandOrder?: FontaraContentCommandOrder) => boolean
}

function isValidCommandOrder(
  commandOrder: FontaraContentCommandOrder | undefined
): commandOrder is FontaraContentCommandOrder {
  return Boolean(
    commandOrder &&
      typeof commandOrder.dispatcherId === "string" &&
      commandOrder.dispatcherId.length > 0 &&
      Number.isSafeInteger(commandOrder.sequence) &&
      commandOrder.sequence > 0 &&
      Number.isSafeInteger(commandOrder.settingsRevision) &&
      commandOrder.settingsRevision >= 0
  )
}

/** @internal Exported so ordering behavior can be verified without a DOM. */
export function createContentCommandOrderTracker(): ContentCommandOrderTracker {
  let dispatcherId: string | null = null
  let sequence = 0
  let settingsRevision = -1
  const retiredDispatcherIds = new Set<string>()
  const retiredDispatcherOrder: string[] = []

  function retireDispatcher(value: string): void {
    retiredDispatcherIds.add(value)
    retiredDispatcherOrder.push(value)
    if (retiredDispatcherOrder.length <= MAX_RETIRED_DISPATCHERS) return

    const expiredDispatcherId = retiredDispatcherOrder.shift()
    if (expiredDispatcherId) retiredDispatcherIds.delete(expiredDispatcherId)
  }

  return {
    accept(commandOrder) {
      if (!isValidCommandOrder(commandOrder)) {
        // Legacy commands remain compatible until the first ordered command.
        // Afterwards they must not be allowed to bypass stale-command guards.
        return dispatcherId === null
      }

      if (retiredDispatcherIds.has(commandOrder.dispatcherId)) return false
      if (commandOrder.settingsRevision < settingsRevision) return false

      if (commandOrder.dispatcherId === dispatcherId) {
        if (commandOrder.sequence <= sequence) return false
      } else {
        if (dispatcherId) retireDispatcher(dispatcherId)
        dispatcherId = commandOrder.dispatcherId
        sequence = 0
      }

      sequence = commandOrder.sequence
      settingsRevision = commandOrder.settingsRevision
      return true
    }
  }
}

function createThemeFingerprint(data: FontaraPageThemeCommandData): string {
  if (!data.font.active && !data.rtl.active) return "clean-up"
  return `apply:${JSON.stringify(data)}`
}

type LocalThemeDuplicateGuard = {
  clear: () => void
  consumeBackground: (data?: FontaraPageThemeCommandData) => boolean
  recordLocal: (data: FontaraPageThemeCommandData) => void
}

/** @internal Exported so fallback/background deduplication can be unit tested. */
export function createLocalThemeDuplicateGuard(): LocalThemeDuplicateGuard {
  let localFingerprint: string | null = null

  return {
    clear() {
      localFingerprint = null
    },
    consumeBackground(data) {
      const backgroundFingerprint = data
        ? createThemeFingerprint(data)
        : "clean-up"
      const isDuplicate = localFingerprint === backgroundFingerprint
      localFingerprint = null
      return isDuplicate
    },
    recordLocal(data) {
      localFingerprint = createThemeFingerprint(data)
    }
  }
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
  const commandOrderTracker = createContentCommandOrderTracker()
  const localThemeDuplicateGuard = createLocalThemeDuplicateGuard()

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
    if (!backgroundCommandsEnabled) {
      options.onBackgroundCommandsEnabled?.()
    }
    backgroundCommandsEnabled = true
  }

  async function applyLocalResolvedPageTheme(
    mode: ContentApplyMode
  ): Promise<void> {
    if (options.isDisposed()) return
    const expectedRevision = resolvedThemeRevision
    try {
      const data = await createFontaraPageThemeData(
        getRelatedFrameRuntimePageURL() ?? window.location.href,
        await readLocalThemeSettings(),
        mode,
        { googleFontCSSLoadMode: "cache-only" }
      )
      if (options.isDisposed() || expectedRevision !== resolvedThemeRevision) {
        return
      }

      const applied = await applyResolvedPageTheme(data, themeApplierCallbacks)
      if (applied) localThemeDuplicateGuard.recordLocal(data)
    } catch (error) {
      stopObserving({ cancelPendingEditableWork: true })
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
    // A previous fallback may only deduplicate the response to its own request.
    // Resume and SPA updates must be free to re-run observers for the same theme.
    localThemeDuplicateGuard.clear()
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

  function applyThemeCommand(
    data: FontaraPageThemeCommandData,
    commandOrder?: FontaraContentCommandOrder
  ): void {
    if (!commandOrderTracker.accept(commandOrder)) return

    markBackgroundCommandsEnabled()
    clearBackgroundStorageUpdate()
    resolvedThemeRevision += 1
    if (localThemeDuplicateGuard.consumeBackground(data)) return
    void applyResolvedPageTheme(data, themeApplierCallbacks)
  }

  function cleanUpThemeCommand(
    commandOrder?: FontaraContentCommandOrder
  ): void {
    if (!commandOrderTracker.accept(commandOrder)) return

    markBackgroundCommandsEnabled()
    clearBackgroundStorageUpdate()
    resolvedThemeRevision += 1
    if (localThemeDuplicateGuard.consumeBackground()) return
    cleanupResolvedPageTheme()
  }

  function dispose(): void {
    clearBackgroundStorageUpdate()
    localApplyQueuedMode = null
    localApplyScheduledMode = null
    localThemeDuplicateGuard.clear()
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
