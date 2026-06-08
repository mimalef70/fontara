import type {
  FontaraApplyMode,
  FontaraContentCommandMessage
} from "../definitions"
import { createFontaraPageThemeData } from "../generators/page-theme"
import { MESSAGE_TYPES_BG_TO_CS } from "../utils/message"

export async function createFontaraContentCommandMessage(
  currentUrl: string,
  settings: Record<string, unknown>,
  applyMode: FontaraApplyMode = "full"
): Promise<FontaraContentCommandMessage> {
  const data = await createFontaraPageThemeData(currentUrl, settings, applyMode)

  if (!data.font.active && !data.rtl.active) {
    return {
      type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP
    }
  }

  return {
    data,
    type: MESSAGE_TYPES_BG_TO_CS.APPLY_THEME
  }
}
