import { STORAGE_KEYS } from "../config/storage"

/**
 * Disables remote Google downloads while preserving the user's selected
 * family as dormant intent, matching the system-font source behavior. Cached
 * binaries stay local until the user explicitly clears them.
 */
export function createGoogleFontsDisabledUpdate(
  _selectedFont?: unknown,
  _siteProfiles?: unknown
): Record<string, unknown> {
  return {
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: false
  }
}
