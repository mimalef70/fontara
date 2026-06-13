import type { WebsiteItem } from "../definitions"
import { UI_LANGUAGE_AUTO } from "./i18n"
import { DEFAULT_RTL_SITE_SETTINGS } from "./rtl-sites"
import { getActiveWebsiteSitePatterns } from "./site-list"
import { EMPTY_SITE_PROFILES } from "./site-profiles"
import { DEFAULT_PINNED_WEBSITE_URLS, POPULAR_WEBSITES } from "./sites"
import { DEFAULT_TEXT_STROKE } from "./text-stroke"

export { STORAGE_KEYS } from "./storage-keys"

export const DEFAULT_VALUES = {
  EXTENSION_ENABLED: true,
  SELECTED_FONT: "Vazirmatn-Fontara",
  WEBSITE_LIST: POPULAR_WEBSITES.map<WebsiteItem>((website) => ({
    ...website,
    isActive: true
  })),
  PINNED_WEBSITE_URLS: [...DEFAULT_PINNED_WEBSITE_URLS],
  ENABLED_BY_DEFAULT: false,
  ENABLED_FOR: getActiveWebsiteSitePatterns(
    POPULAR_WEBSITES.map<WebsiteItem>((website) => ({
      ...website,
      isActive: true
    }))
  ),
  DISABLED_FOR: [],
  SITE_PROFILES: EMPTY_SITE_PROFILES,
  CUSTOM_FONT_LIST: [],
  GOOGLE_FONTS_ENABLED: false,
  SYSTEM_FONTS_ENABLED: false,
  TEXT_STROKE: DEFAULT_TEXT_STROKE,
  UI_LANGUAGE: UI_LANGUAGE_AUTO,
  RTL_ENABLED: true,
  RTL_SITE_SETTINGS: DEFAULT_RTL_SITE_SETTINGS,
  CONTEXT_MENUS_ENABLED: false,
  SYNC_SETTINGS: true
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
