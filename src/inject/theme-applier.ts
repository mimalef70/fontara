import { DEFAULT_VALUES } from "../config/storage"
import type { FontaraPageThemeCommandData } from "../definitions"
import {
  activatePreparedCustomFontFamily,
  type CustomFontFamilyReference,
  clearCustomFontFaces,
  prepareCustomFontFamily
} from "./custom-font-manager"
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

let themeApplyGeneration = 0

function isDisposed(callbacks: ThemeApplierCallbacks): boolean {
  return callbacks.isDisposed?.() ?? false
}

export function cleanupFontTheme(): void {
  themeApplyGeneration += 1
  stopObserving()
  resetProcessedElements()
  removeFontStyles()
  clearCustomFontFaces()
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
  const applyGeneration = ++themeApplyGeneration

  try {
    if (!data.font.active) {
      cleanupFontTheme()
    } else {
      const customFontReference: CustomFontFamilyReference | null =
        data.font.customFontFamilyValue &&
        data.font.customFontFamilyRevision !== null
          ? {
              value: data.font.customFontFamilyValue,
              revision: data.font.customFontFamilyRevision
            }
          : null
      const customFontReady = await prepareCustomFontFamily(customFontReference)
      if (isDisposed(callbacks) || applyGeneration !== themeApplyGeneration) {
        return
      }
      const resolvedFont =
        customFontReference && !customFontReady
          ? {
              ...data.font,
              customFontFamilyRevision: null,
              customFontFamilyValue: null,
              fontName: DEFAULT_VALUES.SELECTED_FONT
            }
          : data.font

      injectResolvedTextStrokeStyle(resolvedFont.textStrokeCSS)
      const hasCustomCSS = injectResolvedFontStyles(resolvedFont)
      activatePreparedCustomFontFamily(
        customFontReady ? customFontReference : null
      )

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
