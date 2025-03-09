export const STORAGE_KEYS = {
  EXTENSION_ENABLED: "isExtensionEnabled"
}

export const ExtensionEvent = {
  UPDATE_POPULAR_ACTIVE_URLS: "updatePopularActiveUrls"
}

// const addFurigana = async () => {
//   const tabs = await Browser.tabs.query({ active: true, currentWindow: true })
//   sendMessage(tabs[0]!.id!, ExtensionEvent.AddFurigana)
// }

// Content.ts
// Browser.runtime.onMessage.addListener((event: ExtensionEvent) => {
//   switch (event) {
//     ...
//   }
// })

// calling it in chrome://newtab raises a "Could not establish connection. Receiving end does not exist." runtime error.
// export const sendMessage = async (id: number, event: ExtensionEvent) => {
//   try {
//     await Browser.tabs.sendMessage(id, event)
//   } catch (error) {
//     if (
//       !(error instanceof Error) ||
//       error.message !== 'Could not establish connection. Receiving end does not exist.'
//     ) {
//       throw error
//     }
//   }
// }
// Avoid using tabs.query with the url parameter to determine if a page registers event listeners, as it need tab or activeTab permissions, potentially causing issues with Chrome's approval process.
