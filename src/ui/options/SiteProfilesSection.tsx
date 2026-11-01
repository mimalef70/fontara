import {
  Check,
  ChevronsUpDown,
  Globe2,
  Plus,
  Settings,
  Trash2
} from "lucide-react"
import {
  getDisplaySitePattern,
  getSitePatternScope
} from "../../config/site-list"
import { isSiteProfileEnabled } from "../../config/site-profiles"
import {
  normalizeTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
import { cn } from "../../utils/cn"
import { decodeGoogleFontValue } from "../../utils/google-fonts"
import { SiteModeBadge } from "../components/SiteModeBadge"
import { SiteScopeBadge } from "../components/SiteScopeBadge"
import { Button } from "../components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "../components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "../components/ui/popover"
import { Switch } from "../components/ui/Switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "../components/ui/select"
import { useI18n } from "../i18n"
import type { useSiteProfiles } from "./use-site-profiles"

const GLOBAL_SITE_PROFILE_FONT_VALUE = "__fontara_global_font__"

export function SiteProfilesSection({
  controller,
  hasCustomCssForSitePattern
}: {
  controller: ReturnType<typeof useSiteProfiles>
  hasCustomCssForSitePattern: (pattern: string) => boolean
}) {
  const { direction, formatNumber, t } = useI18n()
  const {
    canAddSiteProfileTarget,
    formattedSiteProfileTextStroke,
    formatTextStrokeDisplay,
    handleAddSiteProfileTarget,
    handleEditSiteProfile,
    handleRemoveSiteProfile,
    handleSaveSiteProfile,
    handleSiteProfileEnabledToggle,
    handleSiteProfileSubmit,
    isSaving,
    normalizedSiteProfiles,
    resetSiteProfileForm,
    selectSiteProfileTarget,
    selectedSiteProfilePattern,
    selectedSiteProfileScope,
    selectedSiteProfileTarget,
    setSiteProfileFontInput,
    setSiteProfileFontPickerOpen,
    setSiteProfileGoogleFontStatus,
    setSiteProfileTargetOpen,
    setSiteProfileTargetSearch,
    setSiteProfileTextStroke,
    setSiteProfileUsesGlobalStroke,
    siteFontOptionGroups,
    siteFontOptions,
    getSiteProfileFontLabel,
    siteProfileAddTargetPattern,
    siteProfileFontInput,
    siteProfileFontPickerOpen,
    siteProfileGoogleFontStatus,
    siteProfileTargetOpen,
    siteProfileTargetOptions,
    siteProfileTargetSearch,
    siteProfileTextStroke,
    siteProfileUsesGlobalStroke
  } = controller
  const renderSiteProfileTargetItem = (
    option: (typeof siteProfileTargetOptions)[number]
  ) => {
    const selected = selectedSiteProfilePattern === option.pattern
    const scope = getSitePatternScope(option.pattern)
    const hasCustomCss = hasCustomCssForSitePattern(option.pattern)

    return (
      <CommandItem
        key={option.id}
        value={`${option.title} ${option.subtitle ?? ""} ${option.pattern}`}
        data-testid={`fontara-site-profile-target-${option.id}`}
        className="min-h-11 cursor-pointer gap-3 px-2"
        onSelect={() => selectSiteProfileTarget(option.pattern)}>
        {option.iconUrl ? (
          <img
            alt=""
            src={option.iconUrl}
            className="size-7 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#f1f5f9] text-[#64748b]">
            <Globe2 className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <bdi
            className="block truncate text-sm font-bold text-[#111827]"
            dir="ltr"
            title={option.title}>
            {option.title}
          </bdi>
          {option.subtitle && (
            <span className="mt-0.5 block truncate text-xs text-[#64748b]">
              {option.subtitle}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <SiteScopeBadge scope={scope} />
          {hasCustomCss && <SiteModeBadge customCss />}
          {selected && <Check className="size-4 text-[#2374ff]" />}
        </span>
      </CommandItem>
    )
  }

  return (
    <section className="fontara-panel p-4 sm:p-5" aria-busy={isSaving}>
      <fieldset disabled={isSaving} className="m-0 min-w-0 border-0 p-0">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.siteProfiles.title")}
            </h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {t("options.siteProfiles.description")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <Settings className="size-5" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            className="fontara-soft-panel space-y-4 p-4"
            onSubmit={handleSiteProfileSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="site-profile-target"
                className="block text-sm font-medium text-[#334155]">
                {t("options.siteProfiles.targetLabel")}
              </label>
              <Popover
                open={siteProfileTargetOpen}
                onOpenChange={setSiteProfileTargetOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="site-profile-target"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={siteProfileTargetOpen}
                    data-testid="fontara-site-profile-target-trigger"
                    className="h-auto min-h-11 w-full justify-between border-[#dbe3ef] bg-white px-3 py-2 text-start hover:bg-white">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {selectedSiteProfileTarget?.iconUrl && (
                        <img
                          alt=""
                          src={selectedSiteProfileTarget.iconUrl}
                          className="size-6 shrink-0 rounded object-contain"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <bdi
                          className={cn(
                            "block truncate text-sm font-bold",
                            selectedSiteProfilePattern
                              ? "text-[#111827]"
                              : "text-[#64748b]"
                          )}
                          dir="ltr">
                          {selectedSiteProfilePattern
                            ? getDisplaySitePattern(selectedSiteProfilePattern)
                            : t("options.siteProfiles.targetPlaceholder")}
                        </bdi>
                        {selectedSiteProfileTarget?.title &&
                          selectedSiteProfileTarget.title !==
                            getDisplaySitePattern(
                              selectedSiteProfilePattern ?? ""
                            ) && (
                            <span className="mt-0.5 block truncate text-xs text-[#64748b]">
                              {selectedSiteProfileTarget.title}
                            </span>
                          )}
                      </span>
                      {selectedSiteProfileScope && (
                        <SiteScopeBadge scope={selectedSiteProfileScope} />
                      )}
                    </span>
                    <ChevronsUpDown className="ms-2 size-4 shrink-0 text-[#64748b]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-(--radix-popover-trigger-width) p-0">
                  <Command>
                    <CommandInput
                      value={siteProfileTargetSearch}
                      data-testid="fontara-site-profile-target-search"
                      onValueChange={setSiteProfileTargetSearch}
                      placeholder={t(
                        "options.siteProfiles.targetSearchPlaceholder"
                      )}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {t("options.siteProfiles.noTargets")}
                      </CommandEmpty>
                      {canAddSiteProfileTarget &&
                        siteProfileAddTargetPattern && (
                          <CommandGroup>
                            <CommandItem
                              value={siteProfileAddTargetPattern}
                              data-testid="fontara-site-profile-target-add"
                              className="min-h-11 cursor-pointer gap-3 px-2"
                              onSelect={handleAddSiteProfileTarget}>
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
                                <Plus className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-[#111827]">
                                  {t("options.siteProfiles.addTarget", {
                                    site: getDisplaySitePattern(
                                      siteProfileAddTargetPattern
                                    )
                                  })}
                                </span>
                                <bdi
                                  className="mt-0.5 block truncate text-xs text-[#64748b]"
                                  dir="ltr">
                                  {siteProfileAddTargetPattern}
                                </bdi>
                              </span>
                              <SiteScopeBadge
                                scope={getSitePatternScope(
                                  siteProfileAddTargetPattern
                                )}
                              />
                            </CommandItem>
                          </CommandGroup>
                        )}
                      <CommandGroup>
                        {siteProfileTargetOptions.map(
                          renderSiteProfileTargetItem
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label
                htmlFor="site-profile-font"
                className="mb-2 block text-sm font-medium text-[#334155]">
                {t("options.siteProfiles.fontLabel")}
              </label>
              <Select
                dir={direction}
                disabled={isSaving}
                open={siteProfileFontPickerOpen}
                value={siteProfileFontInput || GLOBAL_SITE_PROFILE_FONT_VALUE}
                onOpenChange={setSiteProfileFontPickerOpen}
                onValueChange={(value) => {
                  // Radix's form integration can emit an empty value while
                  // async options register. Only the explicit global item clears
                  // a saved override.
                  if (!value) return
                  setSiteProfileGoogleFontStatus("idle")
                  setSiteProfileFontInput(
                    value === GLOBAL_SITE_PROFILE_FONT_VALUE ? "" : value
                  )
                }}>
                <SelectTrigger
                  id="site-profile-font"
                  data-testid="fontara-site-profile-font-select"
                  className="h-10 border-[#dbe3ef] bg-white text-[#111827] shadow-none focus:ring-[#2374ff]/20">
                  <SelectValue>
                    {getSiteProfileFontLabel(siteProfileFontInput)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  dir={direction}
                  className="max-h-80 border-[#dbe3ef] shadow-xl">
                  <SelectItem
                    value={GLOBAL_SITE_PROFILE_FONT_VALUE}
                    data-testid="fontara-site-profile-font-option-global">
                    {t("options.siteProfiles.globalFont")}
                  </SelectItem>
                  {siteProfileFontInput &&
                    !siteFontOptions.some(
                      (font) => font.value === siteProfileFontInput
                    ) && (
                      <SelectItem value={siteProfileFontInput}>
                        {getSiteProfileFontLabel(siteProfileFontInput)}
                      </SelectItem>
                    )}
                  {siteFontOptionGroups.map((group) =>
                    group.options.length > 0 ? (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs text-slate-500">
                          {group.label}
                        </SelectLabel>
                        {group.options.map((font) => (
                          <SelectItem
                            key={font.value}
                            value={font.value}
                            data-testid={`fontara-site-profile-font-option-${font.value}`}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null
                  )}
                </SelectContent>
              </Select>
              {siteProfileGoogleFontStatus !== "idle" && (
                <div
                  aria-live="polite"
                  className={cn(
                    "mt-2 flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs",
                    siteProfileGoogleFontStatus === "error"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-blue-100 bg-blue-50 text-blue-700"
                  )}>
                  <span>
                    {siteProfileGoogleFontStatus === "loading"
                      ? t("fontSelector.googleDownloading", {
                          font:
                            decodeGoogleFontValue(siteProfileFontInput) ?? ""
                        })
                      : t("fontSelector.googleDownloadFailed")}
                  </span>
                  {siteProfileGoogleFontStatus === "error" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => void handleSaveSiteProfile()}>
                      {t("fontSelector.googleRetry")}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-[#eef2f7] bg-[#f8fafc] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="site-profile-stroke-toggle"
                    className="text-sm font-medium text-[#334155]">
                    {t("options.siteProfiles.strokeLabel")}
                  </label>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {siteProfileUsesGlobalStroke
                      ? t("options.siteProfiles.globalStroke")
                      : t("options.siteProfiles.customStroke", {
                          value: formattedSiteProfileTextStroke
                        })}
                  </p>
                </div>
                <Switch
                  id="site-profile-stroke-toggle"
                  dir="ltr"
                  checked={!siteProfileUsesGlobalStroke}
                  data-testid="fontara-site-profile-stroke-toggle"
                  onCheckedChange={(checked) =>
                    setSiteProfileUsesGlobalStroke(!checked)
                  }
                  aria-label={t("options.siteProfiles.strokeLabel")}
                />
              </div>

              <div
                dir="ltr"
                className={cn(
                  "space-y-2 transition",
                  siteProfileUsesGlobalStroke && "opacity-50"
                )}>
                <input
                  type="range"
                  min={TEXT_STROKE_MIN}
                  max={TEXT_STROKE_MAX}
                  step={TEXT_STROKE_STEP}
                  value={siteProfileTextStroke}
                  data-testid="fontara-site-profile-stroke-range"
                  disabled={siteProfileUsesGlobalStroke}
                  onChange={(event) =>
                    setSiteProfileTextStroke(
                      normalizeTextStrokeValue(
                        Number(event.currentTarget.value)
                      )
                    )
                  }
                  aria-label={t("options.siteProfiles.strokeLabel")}
                  className="h-2 w-full cursor-pointer accent-[#2374ff] disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between text-[10px] font-semibold text-[#64748b]">
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

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={siteProfileGoogleFontStatus === "loading"}
                data-testid="fontara-site-profile-save"
                className="h-10 bg-[#2374ff] text-white hover:bg-[#1f66df]">
                <Check className="size-4" />
                {t("options.siteProfiles.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={resetSiteProfileForm}>
                {t("options.siteProfiles.reset")}
              </Button>
            </div>
          </form>

          <div className="fontara-soft-panel p-4">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-[#111827]">
                {t("options.siteProfiles.savedTitle")}
              </h4>
              <p className="mt-1 text-xs text-[#64748b]">
                {t("options.siteProfiles.savedDescription", {
                  count: formatNumber(normalizedSiteProfiles.length)
                })}
              </p>
            </div>

            {normalizedSiteProfiles.length > 0 ? (
              <div className="space-y-2">
                {normalizedSiteProfiles.map((profile) => {
                  const hasCustomCss = hasCustomCssForSitePattern(
                    profile.pattern
                  )
                  const profileEnabled = isSiteProfileEnabled(profile)

                  return (
                    <div
                      key={profile.pattern}
                      data-testid={`fontara-site-profile-row-${profile.pattern}`}
                      className={cn(
                        "rounded-md border px-3 py-3 transition",
                        profileEnabled
                          ? "border-[#eef2f7] bg-[#f8fafc]"
                          : "border-slate-200 bg-slate-50 opacity-75"
                      )}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <bdi
                            className={cn(
                              "min-w-0 truncate text-sm font-bold",
                              profileEnabled
                                ? "text-[#111827]"
                                : "text-[#64748b]"
                            )}>
                            {getDisplaySitePattern(profile.pattern)}
                          </bdi>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              profileEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-500"
                            )}>
                            {profileEnabled
                              ? t("options.siteProfiles.active")
                              : t("options.siteProfiles.inactive")}
                          </span>
                          {hasCustomCss && <SiteModeBadge customCss />}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Switch
                            dir="ltr"
                            checked={profileEnabled}
                            data-testid={`fontara-site-profile-enabled-${profile.pattern}`}
                            onCheckedChange={(checked) =>
                              void handleSiteProfileEnabledToggle(
                                profile,
                                checked
                              )
                            }
                            aria-label={t("options.siteProfiles.applyProfile", {
                              site: profile.pattern
                            })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#64748b] hover:bg-[#eaf2ff] hover:text-[#2374ff]"
                            aria-label={t("options.siteProfiles.edit", {
                              site: profile.pattern
                            })}
                            onClick={() => handleEditSiteProfile(profile)}>
                            <Settings className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                            data-testid={`fontara-site-profile-remove-${profile.pattern}`}
                            aria-label={t("options.siteProfiles.remove", {
                              site: profile.pattern
                            })}
                            onClick={() =>
                              void handleRemoveSiteProfile(profile.pattern)
                            }>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-[#64748b] sm:grid-cols-2">
                        <div className="rounded-md bg-white px-3 py-2">
                          <span className="font-semibold text-[#334155]">
                            {t("options.siteProfiles.fontValue")}
                          </span>{" "}
                          <span dir="auto">
                            {getSiteProfileFontLabel(profile.font)}
                          </span>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2">
                          <span className="font-semibold text-[#334155]">
                            {t("options.siteProfiles.strokeValue")}
                          </span>{" "}
                          <bdi>
                            {profile.textStroke === undefined
                              ? t("options.siteProfiles.globalStroke")
                              : formatTextStrokeDisplay(profile.textStroke)}
                          </bdi>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-[#dbe3ef] px-4 text-center text-sm text-[#64748b]">
                {t("options.siteProfiles.empty")}
              </div>
            )}
          </div>
        </div>
      </fieldset>
    </section>
  )
}
