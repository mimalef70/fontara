import { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import { runWhenBodyIsReady, watchUrlChanges } from "./content-lifecycle"
import {
  debugWarn,
  getRuntimeMessageEvent,
  isExpectedRuntimeTeardownError,
  type RuntimeControlMessage,
  type RuntimeMessageEvent,
  sendDocumentLifecycleMessage
} from "./content-messaging"
import { watchContentPageLifecycle } from "./content-page-lifecycle"
import { handleContentRuntimeCommandMessage } from "./content-runtime-commands"
import { watchContentThemeStorageChanges } from "./content-storage"
import { startContentTestBridge } from "./content-test-bridge"
import { createContentThemeScheduler } from "./content-theme-scheduler"
import { stopObserving } from "./observer"
import { cleanupRtlSupport } from "./rtl"
import { cleanupFontTheme } from "./theme-applier"

export function startContentRuntime(): void {
  if (typeof __TEST__ !== "undefined" && __TEST__) {
    startContentTestBridge()
  }

  const scriptId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`

  let disposed = false
  let runtimeMessageEvent: RuntimeMessageEvent | null = null
  let stopWatchingPageLifecycle: (() => void) | null = null
  let stopWatchingStorage: (() => void) | null = null
  let stopWatchingUrlChanges: (() => void) | null = null
  let stopWaitingForBody: (() => void) | null = null

  const documentLifecycleMessageOptions = {
    isDisposed: () => disposed,
    onExtensionContextInvalidated: () =>
      cleanupRuntimeListeners({ preserveAppliedTheme: true }),
    scriptId,
    warn: debugWarn
  }

  let themeScheduler: ReturnType<typeof createContentThemeScheduler>

  function ensureStorageFallbackWatcher(): void {
    if (stopWatchingStorage || disposed) return

    stopWatchingStorage = watchContentThemeStorageChanges(themeScheduler)
  }

  themeScheduler = createContentThemeScheduler({
    isDisposed: () => disposed,
    onBackgroundCommandsEnabled: () => {
      stopWatchingStorage?.()
      stopWatchingStorage = null
    },
    onExtensionContextInvalidated: () =>
      cleanupRuntimeListeners({ preserveAppliedTheme: true }),
    onLocalFallbackActivated: ensureStorageFallbackWatcher,
    sendDocumentLifecycleMessage: (type) =>
      sendDocumentLifecycleMessage(type, documentLifecycleMessageOptions),
    warn: debugWarn
  })

  stopWaitingForBody = runWhenBodyIsReady(() => {
    // Font resolution already starts at document_start below. Once body is
    // available, apply the DOM-dependent part locally; sending a second
    // background request here would cancel an in-flight cold-start response.
    themeScheduler.scheduleLocalThemeApply("full")
  })

  stopWatchingUrlChanges = watchUrlChanges(
    () => {
      themeScheduler.requestResolvedPageThemeOrFallback(
        MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
      )
    },
    { warn: debugWarn }
  )

  function handleRuntimeMessage(message: RuntimeControlMessage): void {
    handleContentRuntimeCommandMessage(message, {
      scheduler: themeScheduler,
      scriptId
    })
  }

  function cleanupRuntimeListeners(
    options: { preserveAppliedTheme?: boolean; removeStyles?: boolean } = {}
  ): void {
    if (disposed) return

    disposed = true
    themeScheduler.dispose()
    stopWaitingForBody?.()
    stopWaitingForBody = null
    stopObserving()
    if (options.removeStyles && !options.preserveAppliedTheme) {
      cleanupFontTheme()
    }
    cleanupRtlSupport()
    stopWatchingPageLifecycle?.()
    stopWatchingPageLifecycle = null
    stopWatchingStorage?.()
    stopWatchingStorage = null
    stopWatchingUrlChanges?.()
    stopWatchingUrlChanges = null
    const messageEvent = runtimeMessageEvent ?? getRuntimeMessageEvent()
    runtimeMessageEvent = null
    try {
      messageEvent?.removeListener(handleRuntimeMessage)
    } catch (error) {
      if (!isExpectedRuntimeTeardownError(error)) {
        debugWarn("Failed to remove FontAra runtime message listener.", error)
      }
    }
  }

  try {
    const messageEvent = getRuntimeMessageEvent()
    if (!messageEvent) {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'onMessage')"
      )
    }
    messageEvent.addListener(handleRuntimeMessage)
    runtimeMessageEvent = messageEvent
  } catch (error) {
    cleanupRuntimeListeners({ preserveAppliedTheme: true })
    if (!isExpectedRuntimeTeardownError(error)) {
      debugWarn("Failed to register FontAra runtime message listener.", error)
    }
  }

  if (!disposed) {
    // One ordered CONNECT both tracks the document and starts resolving the
    // selected font. Avoid a second immediate UPDATE that could supersede a
    // still-pending cold-service-worker response.
    themeScheduler.requestResolvedPageThemeOrFallback(
      MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT,
      "font-styles"
    )
    stopWatchingPageLifecycle = watchContentPageLifecycle({
      cleanupRuntime: () => cleanupRuntimeListeners(),
      requestResolvedPageThemeOrFallback: (type) => {
        themeScheduler.requestResolvedPageThemeOrFallback(type)
      },
      sendDocumentForget: () => {
        sendDocumentLifecycleMessage(
          MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET,
          documentLifecycleMessageOptions
        )
      }
    })
  }
}
