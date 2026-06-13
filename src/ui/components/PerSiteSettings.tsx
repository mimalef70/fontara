import { RotateCcw, Settings2 } from "lucide-react"
import * as React from "react"

import { DEFAULT_FONTS, type DefaultFont } from "../../config/fonts"
import type { SupportedUILanguage } from "../../config/i18n"
import {
  createSiteListPatternToggleUpdate,
  createSitePatternFromUrl,
  getDisplaySitePattern,
  getMatchingSiteListPattern,
  getSitePatternScope,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../../config/site-list"
import { getMatchingWebsite } from "../../config/site-manager"
import {
  hasSiteProfileOverrides,
  normalizeSiteProfiles,
  removeSiteProfile,
  upsertSiteProfile
} from "../../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import {
  DEFAULT_ACTIVE_TEXT_STROKE,
  DEFAULT_TEXT_STROKE,
  normalizeTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
import type { FontData, SiteProfile, WebsiteItem } from "../../definitions"
import { cn } from "../../utils/cn"
import {
  getGoogleFontByValue,
  getGoogleFontList
} from "../../utils/google-fonts"
import { openOptionsPageSafely } from "../../utils/options-page"
import {
  decodeSystemFontValue,
  getSystemFontList,
  type SystemFontData
} from "../../utils/system-fonts"
import { createRegexFromUrl } from "../../utils/url"
import { fontaraConnector } from "../connect/connector"
import { useExtensionData } from "../hooks/use-extension-data"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import {
  EMPTY_CUSTOM_FONT_LIST,
  EMPTY_WEBSITE_LIST,
  getDisabledForInitialValue,
  getEnabledByDefaultInitialValue,
  getEnabledForInitialValue,
  getGoogleFontsEnabledInitialValue,
  getSiteProfilesInitialValue,
  getSystemFontsEnabledInitialValue,
  getTextStrokeInitialValue
} from "../storage-defaults"
import { SiteScopeBadge, type SiteScopeBadgeKind } from "./SiteScopeBadge"
import { Button } from "./ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "./ui/drawer"
import { Switch } from "./ui/Switch"

type FontOption = {
  label: string
  value: string
}

type FontOptionGroup = {
  label: string
  options: FontOption[]
}

type SiteProfilePatch = {
  font?: string | null
  textStroke?: number | null
}

function getDefaultFontLabel(
  font: DefaultFont,
  language: SupportedUILanguage
): string {
  return font.localizedName[language] || font.name
}

function getProfileScope(pattern: string | null): SiteScopeBadgeKind | null {
  return pattern ? getSitePatternScope(pattern) : null
}

function getTextStrokeValueLabel(
  value: number,
  formatNumber: ReturnType<typeof useI18n>["formatNumber"],
  offLabel: string
): string {
  if (value === DEFAULT_TEXT_STROKE) return offLabel

  return `+${formatNumber(value, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    useGrouping: false
  })}`
}

export default function PerSiteSettings() {
  const { direction, formatNumber, language, t } = useI18n()
  const currentTab = useExtensionData()?.activeTab ?? null
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [systemFonts, setSystemFonts] = React.useState<SystemFontData[]>([])

  const [selectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_VALUES.SELECTED_FONT
  )
  const [textStroke] = useStorageValue<number>(
    STORAGE_KEYS.TEXT_STROKE,
    getTextStrokeInitialValue
  )
  const [customFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )
  const [siteProfiles, setSiteProfiles] = useStorageValue<SiteProfile[]>(
    STORAGE_KEYS.SITE_PROFILES,
    getSiteProfilesInitialValue
  )
  const [websiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
  )
  const [enabledByDefault] = useStorageValue<boolean>(
    STORAGE_KEYS.ENABLED_BY_DEFAULT,
    getEnabledByDefaultInitialValue
  )
  const [enabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.ENABLED_FOR,
    getEnabledForInitialValue
  )
  const [disabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.DISABLED_FOR,
    getDisabledForInitialValue
  )
  const [googleFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
    getGoogleFontsEnabledInitialValue
  )
  const [systemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )

  React.useEffect(() => {
    let cancelled = false

    if (!systemFontsEnabled) {
      setSystemFonts([])
      return () => {
        cancelled = true
      }
    }

    getSystemFontList()
      .then((fonts) => {
        if (!cancelled) {
          setSystemFonts(fonts)
        }
      })
      .catch((error) => {
        if (__DEBUG__) {
          console.warn("Failed to load system fonts.", error)
        }
        if (!cancelled) {
          setSystemFonts([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [systemFontsEnabled])

  const currentUrl = currentTab?.url ?? null
  const domainPattern = currentUrl ? createSitePatternFromUrl(currentUrl) : null
  const normalizedSiteProfiles = normalizeSiteProfiles(siteProfiles)

  if (!currentTab?.isSupported || !currentUrl || !domainPattern) return null

  const normalizedEnabledByDefault = normalizeEnabledByDefault(enabledByDefault)
  const normalizedEnabledFor = normalizeEnabledSiteList(enabledFor)
  const normalizedDisabledFor = normalizeSiteList(disabledFor)
  const siteListSettings = {
    disabledFor: normalizedDisabledFor,
    enabledByDefault: normalizedEnabledByDefault,
    enabledFor: normalizedEnabledFor
  }
  const active = isSiteListUrlEnabled(currentUrl, siteListSettings)
  const activeRulePattern =
    active && currentUrl
      ? getMatchingSiteListPattern(currentUrl, normalizedEnabledFor)
      : null
  const profilePattern = activeRulePattern
  const currentProfile =
    profilePattern !== null
      ? (normalizedSiteProfiles.find(
          (profile) => profile.pattern === profilePattern
        ) ?? null)
      : null
  const displayedScope = getProfileScope(profilePattern)
  const siteDisplayName = getDisplaySitePattern(profilePattern ?? domainPattern)
  const canEditProfile = Boolean(profilePattern)
  const textStrokeLabel = getTextStrokeValueLabel(
    textStroke,
    formatNumber,
    t("popup.textStroke.off")
  )
  const profileTextStrokeValue =
    currentProfile?.textStroke ??
    (textStroke > 0 ? textStroke : DEFAULT_ACTIVE_TEXT_STROKE)
  const profileTextStrokeLabel = getTextStrokeValueLabel(
    profileTextStrokeValue,
    formatNumber,
    t("popup.textStroke.off")
  )
  const customStrokeEnabled = currentProfile?.textStroke !== undefined

  const fontOptionGroups: FontOptionGroup[] = [
    {
      label: t("fontSelector.bundledGroup"),
      options: DEFAULT_FONTS.map((font) => ({
        label: getDefaultFontLabel(font, language),
        value: font.value
      }))
    },
    {
      label: t("fontSelector.customGroup"),
      options: customFontList.map((font) => ({
        label: font.name,
        value: font.value
      }))
    },
    {
      label: t("fontSelector.googleGroup"),
      options: googleFontsEnabled
        ? getGoogleFontList().map((font) => ({
            label: font.name,
            value: font.value
          }))
        : []
    },
    {
      label: t("fontSelector.systemGroup"),
      options: systemFonts.map((font) => ({
        label: font.name,
        value: font.value
      }))
    }
  ]
  const fontOptions = fontOptionGroups.flatMap((group) => group.options)

  const getFontLabel = (fontValue: string | undefined): string => {
    if (!fontValue) return t("popup.perSite.globalFont")

    const option = fontOptions.find((font) => font.value === fontValue)
    if (option) return option.label

    const systemFont = decodeSystemFontValue(fontValue)
    if (systemFont) return systemFont

    const googleFont = getGoogleFontByValue(fontValue)
    if (googleFont) return googleFont.family

    return fontValue
  }

  const createUpdatedWebsiteList = (checked: boolean): WebsiteItem[] => {
    const currentWebsiteList =
      websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
    const existingWebsiteIndex = currentWebsiteList.findIndex(
      (item) => getMatchingWebsite(currentUrl, [item]) !== null
    )

    if (existingWebsiteIndex === -1 && checked) {
      return [
        ...currentWebsiteList,
        {
          url: currentUrl,
          regex: createRegexFromUrl(currentUrl),
          isActive: true
        }
      ]
    }

    return currentWebsiteList.map((item, index) =>
      index === existingWebsiteIndex ? { ...item, isActive: checked } : item
    )
  }

  const saveProfilePatch = async (patch: SiteProfilePatch) => {
    if (!profilePattern) return

    const nextPattern = profilePattern
    const sourcePattern = nextPattern
    const sourceProfile =
      normalizedSiteProfiles.find(
        (profile) => profile.pattern === sourcePattern
      ) ?? null
    const nextProfile: SiteProfile = {
      ...(sourceProfile ?? { pattern: nextPattern }),
      pattern: nextPattern
    }

    if ("font" in patch) {
      if (patch.font) {
        nextProfile.font = patch.font
      } else {
        delete nextProfile.font
      }
    }

    if ("textStroke" in patch) {
      if (typeof patch.textStroke === "number") {
        nextProfile.textStroke = normalizeTextStrokeValue(patch.textStroke)
      } else {
        delete nextProfile.textStroke
      }
    }

    const baseProfiles = normalizedSiteProfiles.filter(
      (profile) =>
        profile.pattern !== nextPattern && profile.pattern !== sourcePattern
    )
    const nextProfiles = hasSiteProfileOverrides(nextProfile)
      ? upsertSiteProfile(baseProfiles, nextProfile)
      : baseProfiles
    const siteListUpdate = createSiteListPatternToggleUpdate(
      nextPattern,
      siteListSettings,
      true
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.SITE_PROFILES]: nextProfiles,
        [STORAGE_KEYS.WEBSITE_LIST]: createUpdatedWebsiteList(true)
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to save per-site settings.", error)
      }
    }
  }

  const removeCurrentProfile = async () => {
    const profileToRemove = currentProfile
    if (!profileToRemove) return

    try {
      await setSiteProfiles(
        removeSiteProfile(normalizedSiteProfiles, profileToRemove.pattern)
      )
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to reset per-site settings.", error)
      }
    }
  }

  const handleCustomToggle = async (checked: boolean) => {
    if (!checked) {
      await removeCurrentProfile()
      return
    }

    if (currentProfile) return

    await saveProfilePatch({
      font: selectedFont || DEFAULT_VALUES.SELECTED_FONT
    })
  }

  const handleFontChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nextFont = event.currentTarget.value

    await saveProfilePatch({ font: nextFont || null })
  }

  const handleCustomStrokeToggle = async (checked: boolean) => {
    await saveProfilePatch({
      textStroke: checked ? profileTextStrokeValue : null
    })
  }

  const handleTextStrokeChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    await saveProfilePatch({
      textStroke: Number(event.currentTarget.value)
    })
  }

  return (
    <div className="mx-auto mt-2 w-full select-none" dir={direction}>
      <button
        type="button"
        disabled={!canEditProfile}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border p-2 text-start transition",
          !canEditProfile
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-75"
            : currentProfile
              ? "border-[#bfdbfe] bg-[#f8fbff]"
              : "border-gray-200 bg-white hover:border-[#dbeafe] hover:bg-[#f8fbff]"
        )}
        onClick={() => setDrawerOpen(true)}>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            currentProfile
              ? "bg-[#eaf2ff] text-[#2374ff]"
              : "bg-gray-50 text-[#64748b]"
          )}>
          <Settings2 className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[#111827]">
            {t("popup.perSite.title")}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-[#64748b]">
            <span className="truncate">
              {currentProfile
                ? t("popup.perSite.usingCustom")
                : t("popup.perSite.usingGlobal")}
            </span>
            {displayedScope && <SiteScopeBadge scope={displayedScope} />}
          </span>
        </span>
        {!active && (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {t("popup.perSite.siteOff")}
          </span>
        )}
        {active && !canEditProfile && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {t("popup.perSite.chooseScopeFirst")}
          </span>
        )}
      </button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="bottom">
        <DrawerContent dir={direction} className="max-h-[85vh] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("popup.perSite.drawerTitle")}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {t("popup.perSite.drawerDescription")}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 px-4 pb-2">
            <div className="flex items-center gap-3 rounded-md border border-[#e5e7eb] bg-[#f8fafc] p-3">
              {currentTab.favIconUrl && (
                <img
                  alt=""
                  src={currentTab.favIconUrl}
                  className="size-6 shrink-0 rounded object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#64748b]">
                  {t("popup.perSite.currentSite")}
                </span>
                <bdi
                  className="block truncate text-sm font-bold text-[#111827]"
                  dir="ltr"
                  title={siteDisplayName}>
                  {siteDisplayName}
                </bdi>
              </div>
            </div>

            {profilePattern && displayedScope && (
              <div className="rounded-md border border-[#e5e7eb] p-3">
                <div className="mb-2 text-xs font-semibold text-[#64748b]">
                  {t("popup.perSite.scopeLabel")}
                </div>
                <div className="flex min-w-0 items-center gap-2" dir="ltr">
                  <SiteScopeBadge scope={displayedScope} />
                  <bdi
                    className="min-w-0 flex-1 truncate text-sm font-bold text-[#111827]"
                    dir="ltr"
                    title={siteDisplayName}>
                    {siteDisplayName}
                  </bdi>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md border border-[#e5e7eb] p-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#111827]">
                  {t("popup.perSite.useCustom")}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  {currentProfile
                    ? t("popup.perSite.useCustomOn")
                    : t("popup.perSite.useCustomOff")}
                </p>
              </div>
              <Switch
                dir="ltr"
                checked={Boolean(currentProfile)}
                onCheckedChange={(checked) => void handleCustomToggle(checked)}
                aria-label={t("popup.perSite.useCustom")}
              />
            </div>

            <div className="space-y-2 rounded-md border border-[#e5e7eb] p-3">
              <label
                htmlFor="fontara-per-site-font"
                className="block text-xs font-semibold text-[#64748b]">
                {t("popup.perSite.fontLabel")}
              </label>
              <select
                id="fontara-per-site-font"
                value={currentProfile?.font ?? ""}
                onChange={(event) => void handleFontChange(event)}
                className="h-10 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15">
                <option value="">
                  {t("popup.perSite.globalFontWithValue", {
                    font: getFontLabel(selectedFont)
                  })}
                </option>
                {fontOptionGroups.map((group) =>
                  group.options.length > 0 ? (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                )}
              </select>
              <p className="text-xs text-[#64748b]">
                {currentProfile?.font
                  ? t("popup.perSite.customFontValue", {
                      font: getFontLabel(currentProfile.font)
                    })
                  : t("popup.perSite.globalFont")}
              </p>
            </div>

            <div className="space-y-3 rounded-md border border-[#e5e7eb] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748b]">
                    {t("popup.perSite.textStrokeLabel")}
                  </div>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {customStrokeEnabled
                      ? t("popup.perSite.customStrokeValue", {
                          value: profileTextStrokeLabel
                        })
                      : t("popup.perSite.globalStrokeValue", {
                          value: textStrokeLabel
                        })}
                  </p>
                </div>
                <Switch
                  dir="ltr"
                  checked={customStrokeEnabled}
                  onCheckedChange={(checked) =>
                    void handleCustomStrokeToggle(checked)
                  }
                  aria-label={t("popup.perSite.textStrokeLabel")}
                />
              </div>
              <div
                dir="ltr"
                className={cn(
                  "space-y-1 transition",
                  !customStrokeEnabled && "opacity-45"
                )}>
                <input
                  type="range"
                  min={TEXT_STROKE_MIN}
                  max={TEXT_STROKE_MAX}
                  step={TEXT_STROKE_STEP}
                  value={profileTextStrokeValue}
                  disabled={!customStrokeEnabled}
                  onChange={(event) => void handleTextStrokeChange(event)}
                  aria-label={t("popup.perSite.textStrokeLabel")}
                  className="h-2 w-full cursor-pointer accent-[#2374ff] disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between text-[10px] font-semibold text-[#94a3b8]">
                  <span>
                    {formatNumber(TEXT_STROKE_MIN, {
                      maximumFractionDigits: 1,
                      minimumFractionDigits: 1,
                      useGrouping: false
                    })}
                  </span>
                  <span>
                    {formatNumber(TEXT_STROKE_MAX, {
                      maximumFractionDigits: 1,
                      minimumFractionDigits: 1,
                      useGrouping: false
                    })}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full border-red-100 text-red-600 hover:bg-red-50"
              disabled={!currentProfile}
              onClick={() => void removeCurrentProfile()}>
              <RotateCcw className="size-4" />
              {t("popup.perSite.reset")}
            </Button>
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openOptionsPageSafely({ section: "sites" })}>
              {t("popup.perSite.manage")}
            </Button>
            <DrawerClose asChild>
              <Button>{t("common.close")}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
