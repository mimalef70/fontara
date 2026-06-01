import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontData } from "../definitions"

export function createCustomFontDeletionUpdate(
  customFontList: FontData[],
  fontValue: string,
  selectedFont: string | undefined
): Record<string, unknown> {
  const updatedFonts = customFontList.filter((font) => font.value !== fontValue)
  const storageUpdate: Record<string, unknown> = {
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: updatedFonts
  }

  if (selectedFont === fontValue) {
    storageUpdate[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  return storageUpdate
}
