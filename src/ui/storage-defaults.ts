import type { FontData, WebsiteItem } from "../definitions"

export const EMPTY_CUSTOM_FONT_LIST: FontData[] = []
export const EMPTY_WEBSITE_LIST: WebsiteItem[] = []

export function getExtensionEnabledInitialValue(
  value: boolean | undefined
): boolean {
  return value !== false
}
