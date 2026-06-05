const FONTARA_CONTENT_SCRIPT = "inject/index.js"

type InjectableTab = chrome.tabs.Tab & { id: number }

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

export function isInjectableTabUrl(url: string | undefined): boolean {
  if (!url) return false

  try {
    const protocol = new URL(url).protocol
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

export function canRefreshTab(tab: chrome.tabs.Tab): tab is InjectableTab {
  return typeof tab.id === "number" && isInjectableTabUrl(tab.url)
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true
      },
      files: [FONTARA_CONTENT_SCRIPT]
    })
  } catch (error) {
    debugWarn("Failed to refresh FontAra content script in an open tab.", error)
  }
}

export async function refreshOpenTabs(): Promise<void> {
  if (
    typeof chrome === "undefined" ||
    !chrome.tabs?.query ||
    !chrome.scripting?.executeScript
  ) {
    return
  }

  let tabs: chrome.tabs.Tab[]
  try {
    tabs = await chrome.tabs.query({})
  } catch (error) {
    debugWarn("Failed to list open tabs for FontAra refresh.", error)
    return
  }

  await Promise.all(
    tabs.filter(canRefreshTab).map((tab) => injectContentScript(tab.id))
  )
}
