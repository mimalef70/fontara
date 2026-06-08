import { URLS } from "../config/storage"
import { registerIconListeners } from "./icon-manager"
import {
  ensureStorageValues,
  registerSettingsSyncListeners
} from "./storage-manager"

function logStorageError(error: unknown): void {
  if (__DEBUG__) {
    console.warn("Failed to initialize FontAra storage.", error)
  }
}

void ensureStorageValues().catch(logStorageError)
registerSettingsSyncListeners()
registerIconListeners()

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    await ensureStorageValues().catch(logStorageError)

    if (details.reason === "install") {
      await chrome.tabs.create({ url: URLS.WELCOME_PAGE })
    } else if (details.reason === "update") {
      await chrome.tabs.create({ url: URLS.CHANGELOG })
    }
  })()
})

chrome.runtime.setUninstallURL(URLS.UNINSTALL_FORM)
