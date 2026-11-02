import { AlignRight } from "lucide-react"
import { isRtlSiteEnabled, RTL_SUPPORTED_SITES } from "../../config/rtl-sites"
import { getExtensionAssetURL } from "../../utils/assets"
import { cn } from "../../utils/cn"
import { Switch } from "../components/ui/Switch"

import type { OptionsController } from "./use-options-controller"

export function RtlSettingsSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "t"
    | "rtlEnabled"
    | "handleRtlGlobalToggle"
    | "formatNumber"
    | "activeRtlSiteCount"
    | "normalizedRtlSiteSettings"
    | "handleRtlSiteToggle"
  >
}) {
  const {
    t,
    rtlEnabled,
    handleRtlGlobalToggle,
    formatNumber,
    activeRtlSiteCount,
    normalizedRtlSiteSettings,
    handleRtlSiteToggle
  } = model
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="fontara-panel p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.rtl.title")}
            </h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {t("options.rtl.subtitle")}
            </p>
          </div>
          <div className="fontara-icon-tile">
            <AlignRight className="size-5" />
          </div>
        </div>

        <div
          data-active={rtlEnabled}
          className={cn(
            "fontara-choice flex items-center justify-between gap-4 rounded-md border p-4 transition"
          )}>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#111827]">
              {t("options.rtl.globalTitle")}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {t("options.rtl.globalDescription")}
            </p>
          </div>
          <Switch
            dir="ltr"
            checked={rtlEnabled}
            onCheckedChange={(checked) => void handleRtlGlobalToggle(checked)}
            aria-label={t("options.rtl.globalTitle")}
          />
        </div>
      </section>

      <section className="fontara-panel p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.rtl.supportedSitesTitle")}
            </h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {t("options.rtl.supportedSitesDescription", {
                active: formatNumber(activeRtlSiteCount),
                total: formatNumber(RTL_SUPPORTED_SITES.length)
              })}
            </p>
          </div>
          {!rtlEnabled && (
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs text-[#64748b]">
              {t("options.rtl.globallyDisabled")}
            </span>
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {RTL_SUPPORTED_SITES.map((site) => {
            const siteEnabled = isRtlSiteEnabled(
              normalizedRtlSiteSettings,
              site.id
            )
            const active = rtlEnabled !== false && siteEnabled

            return (
              <div
                key={site.id}
                className={cn(
                  "flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition",
                  active
                    ? "border-[#d7e7ff] bg-white shadow-[inset_0_0_0_1px_rgb(35_116_255_/_8%)]"
                    : "border-[#e8eef6] bg-[#fbfdff] opacity-80"
                )}>
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    alt=""
                    src={getExtensionAssetURL(site.icon)}
                    className={cn(
                      "size-7 rounded-md object-contain",
                      !active && "grayscale"
                    )}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#111827]">
                      {site.siteName}
                    </div>
                    <div className="truncate text-xs text-[#64748b]">
                      {rtlEnabled === false
                        ? t("options.rtl.globallyDisabled")
                        : siteEnabled
                          ? t("options.rtl.siteEnabled")
                          : t("options.rtl.siteDisabled")}
                    </div>
                  </div>
                </div>
                <Switch
                  dir="ltr"
                  checked={siteEnabled}
                  disabled={rtlEnabled === false}
                  onCheckedChange={(checked) =>
                    void handleRtlSiteToggle(site, checked)
                  }
                  aria-label={t("options.rtl.siteToggleAria", {
                    site: site.siteName
                  })}
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
