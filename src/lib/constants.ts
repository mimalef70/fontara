export const STORAGE_KEYS = {
  EXTENSION_ENABLED: "isExtensionEnabled",
  SELECTED_FONT: "selectedFont"
}

export const ExtensionEvent = {
  UPDATE_POPULAR_ACTIVE_URLS: "updatePopularActiveUrls"
}

export const defaultFonts = [
  {
    value: "Vazirmatn-Fontara",
    name: "وزیر",
    author: "صابر راستی کردار"
  },
  {
    value: "Samim-Fontara",
    name: "صمیم",
    author: "صابر راستی کردار"
  },
  {
    value: "Shabnam-Fontara",
    name: "شبنم",
    author: "صابر راستی کردار"
  },
  {
    value: "Sahel-Fontara",
    name: "ساحل",
    author: "صابر راستی کردار"
  },
  {
    value: "Parastoo-Fontara",
    name: "پرستو",
    author: "صابر راستی کردار"
  },
  {
    value: "Gandom-Fontara",
    name: "گندم",
    author: "صابر راستی کردار"
  },
  {
    value: "Tanha-Fontara",
    name: "تنها",
    author: "صابر راستی کردار"
  },
  {
    value: "Nahid-Fontara",
    name: "ناهید",
    author: "صابر راستی کردار"
  },
  {
    value: "Azarmehr-Fontara",
    name: "آذرمهر",
    author: "امین عابدی"
  },
  {
    value: "Mikhak-Fontara",
    name: "میخک",
    author: "امین عابدی"
  },
  {
    value: "Estedad-Fontara",
    name: "استعداد",
    author: "امین عابدی"
  },

  {
    value: "Behdad-Fontara",
    name: "بهداد",
    author: "صالح سوزنچی"
  },
  {
    value: "Nika-Fontara",
    name: "نیکا",
    author: "صالح سوزنچی"
  },
  {
    value: "Ganjname-Fontara",
    name: "گنج نامه",
    author: "صالح سوزنچی"
  },
  {
    value: "Shahab-Fontara",
    name: "شهاب",
    author: "صالح سوزنچی"
  }
]

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
