import {
  type FontaraRtlActivationState,
  getFontaraRtlActivationState
} from "../config/site-manager"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { getLocalValues } from "./storage"

export type RtlActivationState = FontaraRtlActivationState

export async function getRtlActivationState(
  currentUrl: string
): Promise<RtlActivationState> {
  let storedValues: {
    [STORAGE_KEYS.EXTENSION_ENABLED]: boolean
    [STORAGE_KEYS.RTL_ENABLED]: boolean
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: unknown
  }

  try {
    storedValues = await getLocalValues({
      [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
      [STORAGE_KEYS.RTL_ENABLED]: DEFAULT_VALUES.RTL_ENABLED,
      [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_VALUES.RTL_SITE_SETTINGS
    })
  } catch {
    storedValues = {
      [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
      [STORAGE_KEYS.RTL_ENABLED]: DEFAULT_VALUES.RTL_ENABLED,
      [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_VALUES.RTL_SITE_SETTINGS
    }
  }

  return getRtlActivationStateFromSettings(currentUrl, storedValues)
}

export function getRtlActivationStateFromSettings(
  currentUrl: string,
  settings: Record<string, unknown>
): RtlActivationState {
  return getFontaraRtlActivationState(currentUrl, settings)
}
