import whatsapp from "data-text:../../assets/styles/whatsapp.css"

import { popularWebsites } from "./popularWebsites"

export const STORAGE_KEYS = {
  EXTENSION_ENABLED: "isExtensionEnabled",
  SELECTED_FONT: "selectedFont",
  WEBSITE_LIST: "websiteList"
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

export const ICON_PATHS = {
  default: {
    "16": "../../assets/icon-16.png",
    "32": "../../assets/icon-32.png",
    "48": "../../assets/icon-48.png"
  },
  active: {
    "16": "../../assets/icon-active-16.png",
    "32": "../../assets/icon-active-32.png",
    "48": "../../assets/icon-active-48.png"
  }
}

export const DEFAULT_VALUES = {
  EXTENSION_ENABLED: true,
  SELECTED_FONT: "Vazirmatn-Fontara",
  WEBSITE_LIST: popularWebsites.map((website) => ({
    ...website,
    isActive: true
  }))
}

export const URLS = {
  WELCOME_PAGE: "https://mimalef70.github.io/fontara",
  CHANGELOG: "https://mimalef70.github.io/fontara#changelogs"
}

export const CUSTOM_CSS = {
  "https://web.whatsapp.com": whatsapp
}
