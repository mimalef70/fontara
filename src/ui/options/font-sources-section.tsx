import { Cloud, HardDrive, Info, LibraryBig, Type } from "lucide-react"
import {
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
import { cn } from "../../utils/cn"
import { Button } from "../components/ui/button"
import { Switch } from "../components/ui/Switch"
import { formatBytes } from "./format-bytes"
import type { OptionsController } from "./use-options-controller"

export function FontSourcesSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "t"
    | "systemFontsSupported"
    | "systemFontsEnabled"
    | "handleSystemFontsToggle"
    | "googleFontsActive"
    | "googleFontsAvailable"
    | "googleFontsSupported"
    | "googleFontConsentState"
    | "googleFontsToggleBusy"
    | "handleGoogleFontsToggle"
    | "textStroke"
    | "formattedTextStroke"
    | "handleTextStrokeChange"
    | "flushTextStroke"
    | "formatNumber"
    | "googleFontCacheStats"
    | "googleFontCacheBusy"
    | "handleClearGoogleFontCache"
  >
}) {
  const {
    t,
    systemFontsSupported,
    systemFontsEnabled,
    handleSystemFontsToggle,
    googleFontsActive,
    googleFontsAvailable,
    googleFontsSupported,
    googleFontConsentState,
    googleFontsToggleBusy,
    handleGoogleFontsToggle,
    textStroke,
    formattedTextStroke,
    handleTextStrokeChange,
    flushTextStroke,
    formatNumber,
    googleFontCacheStats,
    googleFontCacheBusy,
    handleClearGoogleFontCache
  } = model
  return (
    <section className="fontara-panel p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-950">
            {t("options.fonts.sourcesTitle")}
          </h3>
          <p className="mt-1.5 max-w-2xl text-xs leading-6 text-slate-500">
            {t("options.fonts.sourcesDescription")}
          </p>
        </div>
        <span className="fontara-icon-tile">
          <LibraryBig className="size-5" />
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div
          data-active={systemFontsSupported && systemFontsEnabled}
          className={cn(
            "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-xl border p-4 transition",
            !systemFontsSupported && "opacity-75"
          )}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="fontara-icon-tile">
              <HardDrive className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#111827]">
                {t("options.systemFonts.title")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">
                {t("options.systemFonts.description")}
              </p>
              <p className="mt-2 text-xs text-[#64748b]">
                {!systemFontsSupported
                  ? t("options.systemFonts.unsupported")
                  : systemFontsEnabled
                    ? t("options.systemFonts.enabled")
                    : t("options.systemFonts.disabled")}
              </p>
            </div>
          </div>
          <Switch
            dir="ltr"
            checked={systemFontsSupported && systemFontsEnabled}
            disabled={!systemFontsSupported}
            onCheckedChange={(checked) => void handleSystemFontsToggle(checked)}
            aria-label={t("options.systemFonts.title")}
          />
        </div>

        <div
          data-active={googleFontsActive}
          className={cn(
            "fontara-choice flex min-h-36 items-start justify-between gap-4 rounded-xl border p-4 transition",
            !googleFontsAvailable && "opacity-75"
          )}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="fontara-icon-tile">
              <Cloud className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#111827]">
                {t("options.googleFonts.title")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">
                {t("options.googleFonts.description")}
              </p>
              <p className="mt-2 text-xs text-[#64748b]">
                {!googleFontsSupported
                  ? t("options.googleFonts.unsupported")
                  : googleFontConsentState === "unsupported"
                    ? t("options.googleFonts.consentUnsupported")
                    : googleFontsActive
                      ? t("options.googleFonts.enabled")
                      : t("options.googleFonts.disabled")}
              </p>
            </div>
          </div>
          <Switch
            dir="ltr"
            checked={googleFontsActive}
            disabled={
              !googleFontsAvailable ||
              googleFontConsentState === "checking" ||
              googleFontsToggleBusy
            }
            onCheckedChange={(checked) => void handleGoogleFontsToggle(checked)}
            aria-label={t("options.googleFonts.title")}
          />
        </div>

        <div
          data-active={textStroke > 0}
          className={cn(
            "fontara-choice flex min-h-36 flex-col gap-4 rounded-xl border p-4 transition"
          )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="fontara-icon-tile">
                <Type className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#111827]">
                  {t("options.textStroke.title")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">
                  {t("options.textStroke.description")}
                </p>
                <p className="mt-2 text-xs text-[#64748b]">
                  {textStroke > 0
                    ? t("options.textStroke.enabled")
                    : t("options.textStroke.disabled")}
                </p>
              </div>
            </div>
            <bdi className="shrink-0 rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#175cd3]">
              {formattedTextStroke}
            </bdi>
          </div>

          <div dir="ltr" className="space-y-2">
            <input
              type="range"
              min={TEXT_STROKE_MIN}
              max={TEXT_STROKE_MAX}
              step={TEXT_STROKE_STEP}
              value={textStroke}
              onChange={(event) =>
                void handleTextStrokeChange(Number(event.currentTarget.value))
              }
              onBlur={() => void flushTextStroke()}
              onPointerUp={() => void flushTextStroke()}
              aria-label={t("options.textStroke.title")}
              className="h-2 w-full cursor-pointer accent-[#2374ff]"
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
            <p className="text-xs text-[#64748b]">
              {t("options.textStroke.value", {
                value: formattedTextStroke
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleTextStrokeChange(0)}
            className="h-9 rounded-md border border-[#dbe3ef] bg-white px-3 text-xs font-semibold text-[#64748b] transition hover:border-[#bfdbfe] hover:text-[#175cd3]"
            disabled={textStroke <= TEXT_STROKE_MIN}>
            {t("options.textStroke.reset")}
          </button>
        </div>
      </div>
      {googleFontsSupported && (
        <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 text-amber-800">
              {t("options.googleFonts.privacyNotice")}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {googleFontCacheStats && (
                <span className="text-[11px] text-amber-700">
                  {t("options.googleFonts.cacheUsage", {
                    count: formatNumber(googleFontCacheStats.familyCount),
                    size: formatBytes(
                      googleFontCacheStats.totalBytes,
                      formatNumber,
                      t("unit.kb"),
                      t("unit.mb")
                    )
                  })}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-8 border-amber-200 bg-white px-3 text-xs text-amber-800 hover:bg-amber-100"
                disabled={googleFontCacheBusy}
                onClick={() => void handleClearGoogleFontCache()}>
                {googleFontCacheBusy
                  ? t("options.googleFonts.clearingCache")
                  : t("options.googleFonts.clearCache")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
