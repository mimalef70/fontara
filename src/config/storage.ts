import type { WebsiteItem } from "../definitions"
import { POPULAR_WEBSITES } from "./sites"

export const STORAGE_KEYS = {
  EXTENSION_ENABLED: "isExtensionEnabled",
  SELECTED_FONT: "selectedFont",
  WEBSITE_LIST: "websiteList",
  CUSTOM_FONT_LIST: "customFontList"
} as const

export const DEFAULT_VALUES = {
  EXTENSION_ENABLED: true,
  SELECTED_FONT: "Vazirmatn-Fontara",
  WEBSITE_LIST: POPULAR_WEBSITES.map<WebsiteItem>((website) => ({
    ...website,
    isActive: true
  })),
  CUSTOM_FONT_LIST: []
}

export const URLS = {
  WELCOME_PAGE: "https://mimalef70.github.io/fontara",
  CHANGELOG: "https://mimalef70.github.io/fontara#changelogs",
  UNINSTALL_FORM: "https://app.mu.chat/forms/cm7x2dyjo0ajl01lfci211xev"
}

export const ICON_PATHS = {
  default: {
    "16": "/assets/icon-16.png",
    "32": "/assets/icon-32.png",
    "48": "/assets/icon-48.png"
  },
  active: {
    "16": "/assets/icon-active-16.png",
    "32": "/assets/icon-active-32.png",
    "48": "/assets/icon-active-48.png"
  }
}
