import { DEFAULT_VALUES } from "../config/storage"
import type { FontaraPageThemeCommandData } from "../definitions"
import {
  activatePreparedCustomFontFamily,
  type CustomFontFamilyReference,
  clearCustomFontFaces,
  getActiveCustomFontFamilyReference,
  prepareCustomFontFamily,
  registerPreparedCustomFontFamily
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
): Promise<boolean> {
  if (isDisposed(callbacks)) return false
  const applyGeneration = ++themeApplyGeneration
  let fullyApplied = true

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
        return false
      }
      const customFontRegistered = Boolean(
        customFontReference &&
          customFontReady &&
          registerPreparedCustomFontFamily(customFontReference)
      )
      const lastKnownGoodCustomFont =
        customFontReference && !customFontRegistered
          ? getActiveCustomFontFamilyReference()
          : null
      const resolvedFont =
        customFontReference && !customFontRegistered
          ? {
              ...data.font,
              customFontFamilyRevision:
                lastKnownGoodCustomFont?.revision ?? null,
              customFontFamilyValue: lastKnownGoodCustomFont?.value ?? null,
              // A transient storage or parser failure must not make an
              // already-rendered page jump back to the bundled default.
              fontName:
                lastKnownGoodCustomFont?.value ?? DEFAULT_VALUES.SELECTED_FONT
            }
          : data.font
      fullyApplied = !customFontReference || customFontRegistered

      injectResolvedTextStrokeStyle(resolvedFont.textStrokeCSS)
      const hasCustomCSS = injectResolvedFontStyles(resolvedFont)
      if (customFontReference && customFontRegistered) {
        if (!activatePreparedCustomFontFamily(customFontReference)) {
          fullyApplied = false
          const activeReference = getActiveCustomFontFamilyReference()
          injectResolvedFontStyles({
            ...data.font,
            customFontFamilyRevision: activeReference?.revision ?? null,
            customFontFamilyValue: activeReference?.value ?? null,
            fontName: activeReference?.value ?? DEFAULT_VALUES.SELECTED_FONT
          })
        }
      } else if (lastKnownGoodCustomFont) {
        activatePreparedCustomFontFamily(lastKnownGoodCustomFont)
      } else if (!customFontReference) {
        activatePreparedCustomFontFamily(null)
      }

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
    return fullyApplied
  } catch (error) {
    stopObserving()
    if (callbacks.isExtensionContextInvalidated?.(error)) {
      callbacks.onExtensionContextInvalidated?.()
      return false
    }
    callbacks.warn?.("Failed to apply resolved FontAra theme.", error)
    return false
  }
}
