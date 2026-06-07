import {
  getRtlSiteByUrl,
  isRtlSiteEnabled,
  normalizeRtlSiteSettings,
  type RtlSiteConfig,
  type RtlSiteSettings
} from "../config/rtl-sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { getLocalValues } from "./storage"

export type RtlActivationState = {
  active: boolean
  globalEnabled: boolean
  masterEnabled: boolean
  matchingSite: RtlSiteConfig | null
  siteEnabled: boolean
  siteSettings: RtlSiteSettings
}

export async function getRtlActivationState(
  currentUrl: string
): Promise<RtlActivationState> {
  const matchingSite = getRtlSiteByUrl(currentUrl)
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

  const siteSettings = normalizeRtlSiteSettings(
    storedValues[STORAGE_KEYS.RTL_SITE_SETTINGS]
  )
  const normalizedMasterEnabled =
    storedValues[STORAGE_KEYS.EXTENSION_ENABLED] !== false
  const normalizedGlobalEnabled =
    storedValues[STORAGE_KEYS.RTL_ENABLED] !== false
  const siteEnabled = matchingSite
    ? isRtlSiteEnabled(siteSettings, matchingSite.id)
    : false

  return {
    active:
      normalizedMasterEnabled &&
      normalizedGlobalEnabled &&
      siteEnabled &&
      matchingSite !== null,
    globalEnabled: normalizedGlobalEnabled,
    masterEnabled: normalizedMasterEnabled,
    matchingSite,
    siteEnabled,
    siteSettings
  }
}
