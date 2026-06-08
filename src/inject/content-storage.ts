import { STORAGE_KEYS } from "../config/storage"
import { watchLocalStorage } from "../utils/storage"
import type { ContentApplyMode } from "./content-theme-scheduler"

type ThemeStorageScheduler = {
  scheduleStorageFallbackApply: (mode?: ContentApplyMode) => void
}

export function watchContentThemeStorageChanges(
  scheduler: ThemeStorageScheduler
): () => void {
  return watchLocalStorage({
    [STORAGE_KEYS.SELECTED_FONT]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.EXTENSION_ENABLED]: () =>
      scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: () =>
      scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.ENABLED_FOR]: () => scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.DISABLED_FOR]: () => scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.SITE_PROFILES]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.WEBSITE_LIST]: () => scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.TEXT_STROKE]: () =>
      scheduler.scheduleStorageFallbackApply("font-styles"),
    [STORAGE_KEYS.RTL_ENABLED]: () => scheduler.scheduleStorageFallbackApply(),
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: () =>
      scheduler.scheduleStorageFallbackApply()
  })
}
