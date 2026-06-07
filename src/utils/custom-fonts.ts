import { removeSiteProfileFontOverrides } from "../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontData, SiteProfile } from "../definitions"

export function createCustomFontDeletionUpdate(
  customFontList: FontData[],
  fontValue: string,
  selectedFont: string | undefined,
  siteProfiles?: SiteProfile[]
): Record<string, unknown> {
  const updatedFonts = customFontList.filter((font) => font.value !== fontValue)
  const storageUpdate: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: updatedFonts
  }

  if (selectedFont === fontValue) {
    storageUpdate[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  if (siteProfiles) {
    storageUpdate[STORAGE_KEYS.SITE_PROFILES] = removeSiteProfileFontOverrides(
      siteProfiles,
      (profileFontValue) => profileFontValue === fontValue
    )
  }

  return storageUpdate
}
