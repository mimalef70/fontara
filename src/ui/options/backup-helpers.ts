import type { MessageKey } from "../i18n/messages"
import { classifyCustomFontMutationError } from "./custom-font-upload"

export function getSettingsImportErrorDescriptionKey(
  error: unknown
): MessageKey {
  const kind = classifyCustomFontMutationError(error)
  if (kind === "family-limit") {
    return "options.toast.settingsImportTooManyFonts"
  }
  if (kind === "family-size-limit") {
    return "options.toast.settingsImportFontFamilyTooLarge"
  }
  if (kind === "library-limit") {
    return "options.toast.settingsImportFontLibraryTooLarge"
  }
  if (kind === "retryable") {
    return "options.toast.settingsImportRetry"
  }
  if (kind === "storage-unavailable") {
    return "options.toast.settingsImportStorageUnavailable"
  }
  if (kind === "duplicate-name" || kind === "invalid-data") {
    return "options.toast.settingsImportInvalid"
  }
  return "options.toast.settingsImportUnknown"
}

export const CONTEXT_MENU_PERMISSION = "contextMenus"

export function requestContextMenusPermission(): Promise<boolean> {
  if (!chrome.permissions?.request) {
    return Promise.resolve(true)
  }

  return new Promise((resolve, reject) => {
    chrome.permissions.request(
      { permissions: [CONTEXT_MENU_PERMISSION] },
      (hasPermission) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(hasPermission)
      }
    )
  })
}

export function removeContextMenusPermission(): Promise<boolean> {
  if (!chrome.permissions?.remove) return Promise.resolve(true)

  return new Promise((resolve, reject) => {
    chrome.permissions.remove(
      { permissions: [CONTEXT_MENU_PERMISSION] },
      (removed) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(removed)
      }
    )
  })
}

export function downloadTextFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function readTextFile(file: File): Promise<string> {
  return file.text()
}
