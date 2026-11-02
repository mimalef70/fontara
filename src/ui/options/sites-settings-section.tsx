import {
  Check,
  Globe2,
  ListChecks,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react"
import {
  getDisplaySitePattern,
  getSitePatternScope,
  type SitePatternScope
} from "../../config/site-list"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import { SiteModeBadge } from "../components/SiteModeBadge"
import { SiteScopeBadge } from "../components/SiteScopeBadge"
import { Button } from "../components/ui/button"
import { Switch } from "../components/ui/Switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import type { SiteSettingsTab } from "./options-navigation"
import { SiteProfilesSection } from "./SiteProfilesSection"
import {
  sitePatternPlaceholderKeys,
  sitePatternScopeOptions
} from "./site-access-helpers"

import type { OptionsController } from "./use-options-controller"

export function SitesSettingsSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "direction"
    | "siteSettingsTab"
    | "setSiteSettingsTab"
    | "t"
    | "normalizedEnabledByDefault"
    | "handleSiteListModeChange"
    | "handleSitePatternSubmit"
    | "sitePatternScope"
    | "setSitePatternScope"
    | "sitePatternInput"
    | "handleSitePatternInputChange"
    | "currentTab"
    | "currentTabDomainPattern"
    | "fillSitePatternFromCurrentTab"
    | "currentTabHasPathPattern"
    | "hasSitePatternInput"
    | "normalizedSitePatternInput"
    | "hasCustomCssForSitePattern"
    | "managedSiteList"
    | "handleRemoveSitePattern"
    | "siteProfilesController"
    | "formatNumber"
    | "activeWebsiteCount"
    | "defaultWebsiteList"
    | "isWebsiteActive"
    | "isWebsitePinned"
    | "getWebsiteCardPattern"
    | "getWebsiteCardTitle"
    | "handleWebsitePinToggle"
    | "handleWebsiteToggle"
  >
}) {
  const {
    direction,
    siteSettingsTab,
    setSiteSettingsTab,
    t,
    normalizedEnabledByDefault,
    handleSiteListModeChange,
    handleSitePatternSubmit,
    sitePatternScope,
    setSitePatternScope,
    sitePatternInput,
    handleSitePatternInputChange,
    currentTab,
    currentTabDomainPattern,
    fillSitePatternFromCurrentTab,
    currentTabHasPathPattern,
    hasSitePatternInput,
    normalizedSitePatternInput,
    hasCustomCssForSitePattern,
    managedSiteList,
    handleRemoveSitePattern,
    siteProfilesController,
    formatNumber,
    activeWebsiteCount,
    defaultWebsiteList,
    isWebsiteActive,
    isWebsitePinned,
    getWebsiteCardPattern,
    getWebsiteCardTitle,
    handleWebsitePinToggle,
    handleWebsiteToggle
  } = model
  return (
    <Tabs
      dir={direction}
      value={siteSettingsTab}
      onValueChange={(value) => setSiteSettingsTab(value as SiteSettingsTab)}
      className="space-y-5">
      <TabsList className="fontara-subnav grid h-auto w-full grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <TabsTrigger
          value="access"
          data-testid="fontara-sites-tab-access"
          className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
          <ListChecks className="size-4" />
          {t("options.sites.accessTab")}
        </TabsTrigger>
        <TabsTrigger
          value="profiles"
          data-testid="fontara-sites-tab-profiles"
          className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
          <Settings className="size-4" />
          {t("options.sites.profilesTab")}
        </TabsTrigger>
        <TabsTrigger
          value="optimized"
          data-testid="fontara-sites-tab-optimized"
          className="min-h-10 gap-2 rounded-xl px-3 text-xs font-bold sm:text-sm">
          <Sparkles className="size-4" />
          {t("options.sites.optimizedTab")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="access" className="mt-0">
        <section className="fontara-panel p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#111827]">
                {t("options.siteList.title")}
              </h3>
              <p className="mt-1 text-xs text-[#64748b]">
                {normalizedEnabledByDefault
                  ? t("options.siteList.excludeDescription")
                  : t("options.siteList.includeDescription")}
              </p>
            </div>
            <div className="fontara-icon-tile">
              <ListChecks className="size-5" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              <button
                type="button"
                aria-pressed={!normalizedEnabledByDefault}
                data-testid="fontara-site-list-include-mode"
                onClick={() => void handleSiteListModeChange(false)}
                className={cn(
                  "fontara-choice flex w-full items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                  !normalizedEnabledByDefault && "border-[#b9d4ff]"
                )}>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#111827]">
                    {t("options.siteList.includeMode")}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">
                    {t("options.siteList.includeModeDescription")}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    !normalizedEnabledByDefault
                      ? "border-[#2374ff] bg-[#2374ff] text-white"
                      : "border-[#dbe3ef] text-transparent"
                  )}>
                  <Check className="size-4" />
                </span>
              </button>

              <button
                type="button"
                aria-pressed={normalizedEnabledByDefault}
                data-testid="fontara-site-list-exclude-mode"
                onClick={() => void handleSiteListModeChange(true)}
                className={cn(
                  "fontara-choice flex w-full items-start justify-between gap-3 rounded-md border p-3.5 text-start transition",
                  normalizedEnabledByDefault && "border-[#b9d4ff]"
                )}>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#111827]">
                    {t("options.siteList.excludeMode")}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">
                    {t("options.siteList.excludeModeDescription")}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    normalizedEnabledByDefault
                      ? "border-[#2374ff] bg-[#2374ff] text-white"
                      : "border-[#dbe3ef] text-transparent"
                  )}>
                  <Check className="size-4" />
                </span>
              </button>
            </div>

            <div className="fontara-soft-panel p-4">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-[#111827]">
                  {normalizedEnabledByDefault
                    ? t("options.siteList.disabledListTitle")
                    : t("options.siteList.enabledListTitle")}
                </h4>
                <p className="mt-1 text-xs text-[#64748b]">
                  {t("options.siteList.patternHelp")}
                </p>
              </div>

              <form className="mb-4" onSubmit={handleSitePatternSubmit}>
                <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem]">
                  <Select
                    value={sitePatternScope}
                    onValueChange={(value) =>
                      setSitePatternScope(value as SitePatternScope)
                    }>
                    <SelectTrigger
                      className="h-10 rounded-md border-[#dbe3ef] text-sm"
                      aria-label={t("options.siteList.scopeLabel")}
                      data-testid="fontara-site-list-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={direction}>
                      {sitePatternScopeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={sitePatternInput}
                    data-testid="fontara-site-list-pattern-input"
                    onChange={handleSitePatternInputChange}
                    placeholder={t(
                      sitePatternPlaceholderKeys[sitePatternScope]
                    )}
                    dir="ltr"
                    className="h-10 min-w-0 rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 shrink-0 bg-[#2374ff] text-white hover:bg-[#1f66df]"
                    data-testid="fontara-site-list-add"
                    aria-label={t("options.siteList.add")}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                {currentTab?.isSupported && currentTab.url && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentTabDomainPattern && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-[#dbe3ef] text-xs"
                        onClick={() => fillSitePatternFromCurrentTab("domain")}>
                        {t("options.siteList.useCurrentDomain")}
                      </Button>
                    )}
                    {currentTabHasPathPattern && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-[#dbe3ef] text-xs"
                        onClick={() => fillSitePatternFromCurrentTab("path")}>
                        {t("options.siteList.useCurrentPath")}
                      </Button>
                    )}
                  </div>
                )}
              </form>
              {hasSitePatternInput && (
                <div
                  className={cn(
                    "mb-4 rounded-md border px-3 py-2 text-xs",
                    normalizedSitePatternInput
                      ? "border-[#bfdbfe] bg-[#f8fbff] text-[#1e3a8a]"
                      : "border-red-200 bg-red-50 text-red-700"
                  )}
                  aria-live="polite">
                  {normalizedSitePatternInput ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0">
                        {normalizedEnabledByDefault
                          ? t("options.siteList.previewExclude")
                          : t("options.siteList.previewInclude")}
                      </span>
                      <bdi className="min-w-0 truncate font-semibold" dir="ltr">
                        {getDisplaySitePattern(normalizedSitePatternInput)}
                      </bdi>
                      <SiteScopeBadge
                        scope={getSitePatternScope(normalizedSitePatternInput)}
                      />
                      {hasCustomCssForSitePattern(
                        normalizedSitePatternInput
                      ) && <SiteModeBadge customCss />}
                    </div>
                  ) : (
                    t("options.siteList.previewInvalid")
                  )}
                </div>
              )}

              {managedSiteList.length > 0 ? (
                <div className="space-y-2">
                  {managedSiteList.map((pattern) => {
                    const hasCustomCss = hasCustomCssForSitePattern(pattern)

                    return (
                      <div
                        key={pattern}
                        data-testid={`fontara-site-list-row-${pattern}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-[#e8eef6] bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_70%)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <bdi className="min-w-0 truncate text-sm font-semibold text-[#111827]">
                            {getDisplaySitePattern(pattern)}
                          </bdi>
                          <SiteScopeBadge
                            scope={getSitePatternScope(pattern)}
                          />
                          {hasCustomCss && <SiteModeBadge customCss />}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                          data-testid={`fontara-site-list-remove-${pattern}`}
                          aria-label={t("options.siteList.remove", {
                            site: pattern
                          })}
                          onClick={() => void handleRemoveSitePattern(pattern)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-[#dbe3ef] px-4 text-center text-sm text-[#64748b]">
                  {normalizedEnabledByDefault
                    ? t("options.siteList.emptyDisabled")
                    : t("options.siteList.emptyEnabled")}
                </div>
              )}
            </div>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="profiles" className="mt-0">
        <SiteProfilesSection
          controller={siteProfilesController}
          hasCustomCssForSitePattern={hasCustomCssForSitePattern}
        />
      </TabsContent>

      <TabsContent value="optimized" className="mt-0">
        <section className="fontara-panel p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#111827]">
                {t("options.sites.title")}
              </h3>
              <p className="mt-1 text-xs text-[#64748b]">
                {t("options.sites.count", {
                  active: formatNumber(activeWebsiteCount),
                  total: formatNumber(defaultWebsiteList.length)
                })}
              </p>
            </div>
            <div className="fontara-icon-tile">
              <Globe2 className="size-5" />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-[#e5edf6] bg-white">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-[#f8fbff]">
                <TableRow className="hover:bg-[#f8fbff]">
                  <TableHead className="w-[28%] ps-4 text-start text-xs font-bold text-[#64748b]">
                    {t("options.sites.column.site")}
                  </TableHead>
                  <TableHead className="w-[28%] text-start text-xs font-bold text-[#64748b]">
                    {t("options.sites.column.pattern")}
                  </TableHead>
                  <TableHead className="w-[22%] text-start text-xs font-bold text-[#64748b]">
                    {t("options.sites.column.mode")}
                  </TableHead>
                  <TableHead className="w-[11%] text-center text-xs font-bold text-[#64748b]">
                    {t("options.sites.column.popup")}
                  </TableHead>
                  <TableHead className="w-[11%] pe-4 text-end text-xs font-bold text-[#64748b]">
                    {t("options.sites.column.enabled")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaultWebsiteList.map((website) => {
                  const active = isWebsiteActive(website)
                  const pinned = isWebsitePinned(website)
                  const websitePattern = getWebsiteCardPattern(website)
                  const websitePatternLabel = websitePattern
                    ? getDisplaySitePattern(websitePattern)
                    : null
                  const websiteTitle = getWebsiteCardTitle(
                    website,
                    websitePattern
                  )

                  return (
                    <TableRow
                      key={website.url}
                      className={cn(
                        "h-[4.25rem] hover:bg-[#f8fbff]",
                        !active && "bg-[#fbfdff] opacity-75"
                      )}>
                      <TableCell className="ps-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {website.icon && (
                            <img
                              alt=""
                              src={getExtensionAssetURL(website.icon)}
                              className={cn(
                                "size-8 rounded-md object-contain",
                                !active && "grayscale"
                              )}
                            />
                          )}
                          <div
                            className="min-w-0 truncate text-sm font-semibold text-[#111827]"
                            title={websiteTitle}>
                            {websiteTitle}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {websitePatternLabel ? (
                          <bdi
                            className="block max-w-[13rem] truncate text-xs text-[#64748b]"
                            dir="ltr"
                            title={websitePatternLabel}>
                            {websitePatternLabel}
                          </bdi>
                        ) : (
                          <span className="text-xs text-[#64748b]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <SiteModeBadge
                            customCss={website.customCss === true}
                          />
                          {websitePattern && (
                            <SiteScopeBadge
                              scope={getSitePatternScope(websitePattern)}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "mx-auto h-8 w-8 text-[#64748b] hover:bg-[#eaf2ff] hover:text-[#175cd3]",
                            pinned &&
                              "bg-[#eaf2ff] text-[#2374ff] hover:bg-[#dbeafe]"
                          )}
                          aria-pressed={pinned}
                          aria-label={t(
                            pinned
                              ? "options.sites.unpinFromPopup"
                              : "options.sites.pinToPopup",
                            {
                              site: websiteTitle
                            }
                          )}
                          onClick={() => void handleWebsitePinToggle(website)}>
                          <Pin
                            className={cn("size-4", pinned && "fill-current")}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="pe-4 text-end">
                        <Switch
                          checked={active}
                          onCheckedChange={() =>
                            void handleWebsiteToggle(website)
                          }
                          aria-label={t("options.siteToggleAria", {
                            site: websiteTitle
                          })}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </TabsContent>
    </Tabs>
  )
}
