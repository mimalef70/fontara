import type { FontaraPageThemeCommandData } from "../definitions"
import { applyFontToTreeChunked, resetProcessedElements } from "./dom-processor"
import {
  injectResolvedFontStyles,
  removeFontStyles
} from "./font-style-manager"
import { startObserving, stopObserving } from "./observer"
import { applyResolvedRtlSupport } from "./rtl"
import {
  injectResolvedTextStrokeStyle,
  removeTextStrokeStyle
} from "./text-stroke-style"

type ThemeApplierCallbacks = {
  isDisposed?: () => boolean
  isExtensionContextInvalidated?: (error: unknown) => boolean
  onExtensionContextInvalidated?: () => void
  warn?: (message: string, error: unknown) => void
}

function isDisposed(callbacks: ThemeApplierCallbacks): boolean {
  return callbacks.isDisposed?.() ?? false
}

export function cleanupFontTheme(): void {
  stopObserving()
  resetProcessedElements()
  removeFontStyles()
  removeTextStrokeStyle()
}

export function cleanupResolvedPageTheme(): void {
  cleanupFontTheme()
  applyResolvedRtlSupport({
    active: false,
    siteId: null
  })
}

export async function applyResolvedPageTheme(
  data: FontaraPageThemeCommandData,
  callbacks: ThemeApplierCallbacks = {}
): Promise<void> {
  if (isDisposed(callbacks)) return

  try {
    if (!data.font.active) {
      cleanupFontTheme()
    } else {
      injectResolvedTextStrokeStyle(data.font.textStrokeCSS)
      const hasCustomCSS = injectResolvedFontStyles(data.font)

      if (hasCustomCSS) {
        stopObserving()
        resetProcessedElements()
      } else {
        if (data.font.applyMode === "full" && document.body) {
          applyFontToTreeChunked(document.body)
        }

        if (document.body) {
          startObserving()
        }
      }
    }

    applyResolvedRtlSupport(data.rtl)
  } catch (error) {
    stopObserving()
    if (callbacks.isExtensionContextInvalidated?.(error)) {
      callbacks.onExtensionContextInvalidated?.()
      return
    }
    callbacks.warn?.("Failed to apply resolved FontAra theme.", error)
  }
}
