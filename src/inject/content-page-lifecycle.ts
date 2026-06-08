import { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import type { ResolvedPageThemeRequestType } from "./content-theme-scheduler"
import { stopObserving } from "./observer"
import { pauseRtlSupport } from "./rtl"

type ContentPageLifecycleOptions = {
  cleanupRuntime: () => void
  requestResolvedPageThemeOrFallback: (
    type: ResolvedPageThemeRequestType
  ) => void
  sendDocumentForget: () => void
}

function pauseContentPageTheme(): void {
  stopObserving()
  pauseRtlSupport()
}

export function watchContentPageLifecycle(
  options: ContentPageLifecycleOptions
): () => void {
  function handlePageHide(event: PageTransitionEvent): void {
    pauseContentPageTheme()

    if (!event.persisted) {
      options.sendDocumentForget()
      options.cleanupRuntime()
    }
  }

  function handlePageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      options.requestResolvedPageThemeOrFallback(
        MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
      )
    }
  }

  function handleFreeze(): void {
    pauseContentPageTheme()
  }

  function handleResume(): void {
    options.requestResolvedPageThemeOrFallback(
      MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
    )
  }

  addEventListener("pagehide", handlePageHide)
  addEventListener("pageshow", handlePageShow)
  addEventListener("freeze", handleFreeze)
  addEventListener("resume", handleResume)

  return () => {
    removeEventListener("pagehide", handlePageHide)
    removeEventListener("pageshow", handlePageShow)
    removeEventListener("freeze", handleFreeze)
    removeEventListener("resume", handleResume)
  }
}
