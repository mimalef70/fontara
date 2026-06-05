import { URLS } from "../config/storage"
import { registerIconListeners } from "./icon-manager"
import { ensureStorageValues } from "./storage-manager"
import { refreshOpenTabs } from "./tab-refresher"

function logStorageError(error: unknown): void {
  if (__DEBUG__) {
    console.warn("Failed to initialize FontAra storage.", error)
  }
}

void ensureStorageValues().catch(logStorageError)
registerIconListeners()

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    await ensureStorageValues().catch(logStorageError)

    if (details.reason === "install") {
      await refreshOpenTabs()
      await chrome.tabs.create({ url: URLS.WELCOME_PAGE })
    } else if (details.reason === "update") {
      await refreshOpenTabs()
      await chrome.tabs.create({ url: URLS.CHANGELOG })
    }
  })()
})

chrome.runtime.setUninstallURL(URLS.UNINSTALL_FORM)
