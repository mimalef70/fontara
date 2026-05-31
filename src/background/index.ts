import { URLS } from "../config/storage"
import { registerIconListeners } from "./icon-manager"
import { ensureStorageValues } from "./storage-manager"

registerIconListeners()

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    await ensureStorageValues()

    if (details.reason === "install") {
      await chrome.tabs.create({ url: URLS.WELCOME_PAGE })
    } else if (details.reason === "update") {
      await chrome.tabs.create({ url: URLS.CHANGELOG })
    }
  })()
})

chrome.runtime.setUninstallURL(URLS.UNINSTALL_FORM)
