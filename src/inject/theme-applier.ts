import { DEFAULT_VALUES } from "../config/storage"
import type {
  FontaraFontThemeCommandData,
  FontaraLocalFontCommand,
  FontaraPageThemeCommandData
} from "../definitions"
import {
  applyFontToTreeChunked,
  resetProcessedElements,
  setActiveFontFamilyForProcessing
} from "./dom-processor"
import { setActiveFontFamilyForEditableStyles } from "./editable-font-style"
import {
  injectResolvedFontStyles,
  removeFontStyles
} from "./font-style-manager"
import {
  activatePreparedLocalFontFamily,
  clearLocalFontFaces,
  getActiveLocalFontFamilyName,
  getActiveLocalFontFamilyReference,
  prepareLocalFontFamily,
  registerPreparedLocalFontFamily
} from "./local-font-manager"
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
let lastAppliedFontTheme: FontaraFontThemeCommandData | null = null

function isDisposed(callbacks: ThemeApplierCallbacks): boolean {
  return callbacks.isDisposed?.() ?? false
}

function getLocalFontCommand(
  data: FontaraFontThemeCommandData
): FontaraLocalFontCommand {
  if (data.localFont !== undefined) return data.localFont
  return data.customFontFamilyValue && data.customFontFamilyRevision !== null
    ? {
        reference: {
          revision: data.customFontFamilyRevision,
          source: "custom",
          value: data.customFontFamilyValue
        },
        state: "ready"
      }
    : null
}

function getLastKnownGoodTheme(
  requested: FontaraFontThemeCommandData
): FontaraFontThemeCommandData {
  if (lastAppliedFontTheme) return lastAppliedFontTheme

  const activeReference = getActiveLocalFontFamilyReference()
  const activeName = getActiveLocalFontFamilyName()
  return {
    ...requested,
    customFontFamilyRevision:
      activeReference?.source === "custom" ? activeReference.revision : null,
    customFontFamilyValue:
      activeReference?.source === "custom" ? activeReference.value : null,
    fontName: activeName ?? DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null,
    localFont: activeReference
      ? { reference: activeReference, state: "ready" }
      : null
  }
}

function applyFontStylesAndObservation(
  data: FontaraFontThemeCommandData
): void {
  setActiveFontFamilyForProcessing(data.fontName)
  setActiveFontFamilyForEditableStyles(data.fontName)
  injectResolvedTextStrokeStyle(data.textStrokeCSS)
  const hasCustomCSS = injectResolvedFontStyles(data)
  if (hasCustomCSS) {
    stopObserving()
    resetProcessedElements()
    if (document.body) startObserving("shadow-only")
    return
  }

  if (document.body) startObserving()
  if (data.applyMode === "full" && document.body) {
    applyFontToTreeChunked(document.body)
  }
}

export function cleanupFontTheme(): void {
  themeApplyGeneration += 1
  lastAppliedFontTheme = null
  stopObserving()
  setActiveFontFamilyForProcessing(null)
  setActiveFontFamilyForEditableStyles(null)
  removeFontStyles()
  resetProcessedElements()
  clearLocalFontFaces()
  removeTextStrokeStyle()
}

export function cleanupResolvedPageTheme(): void {
  cleanupFontTheme()
  applyResolvedRtlSupport({ active: false, siteId: null })
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
      const localFont = getLocalFontCommand(data.font)

      if (localFont?.state === "pending") {
        fullyApplied = false
        if (!lastAppliedFontTheme) {
          const fallback = getLastKnownGoodTheme(data.font)
          applyFontStylesAndObservation(fallback)
          lastAppliedFontTheme = fallback
        }
      } else {
        const reference =
          localFont?.state === "ready" ? localFont.reference : null
        const ready = await prepareLocalFontFamily(reference)
        if (isDisposed(callbacks) || applyGeneration !== themeApplyGeneration) {
          return false
        }

        const registered = Boolean(
          reference && ready && registerPreparedLocalFontFamily(reference)
        )
        if (reference && !registered) {
          fullyApplied = false
          applyFontStylesAndObservation(getLastKnownGoodTheme(data.font))
        } else {
          applyFontStylesAndObservation(data.font)
          if (reference) {
            if (!activatePreparedLocalFontFamily(reference)) {
              fullyApplied = false
              applyFontStylesAndObservation(getLastKnownGoodTheme(data.font))
            } else {
              lastAppliedFontTheme = data.font
            }
          } else {
            activatePreparedLocalFontFamily(null)
            lastAppliedFontTheme = data.font
          }
        }
      }
    }

    applyResolvedRtlSupport(data.rtl)
    return fullyApplied
  } catch (error) {
    stopObserving({ cancelPendingEditableWork: true })
    if (callbacks.isExtensionContextInvalidated?.(error)) {
      callbacks.onExtensionContextInvalidated?.()
      return false
    }
    callbacks.warn?.("Failed to apply resolved FontAra theme.", error)
    return false
  }
}
