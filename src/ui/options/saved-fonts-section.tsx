import {
  FileText,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  Trash2
} from "lucide-react"
import { cn } from "../../utils/cn"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "../components/ui/alert-dialog"
import { Button } from "../components/ui/button"
import { Progress } from "../components/ui/progress"
import { getCustomFontHealthSignature } from "./custom-font-presentation"
import { formatBytes } from "./format-bytes"
import type { OptionsController } from "./use-options-controller"

export function SavedFontsSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "t"
    | "formatNumber"
    | "customFontList"
    | "customFontStorageBytes"
    | "customFontStorageLimit"
    | "customFontStoragePercent"
    | "direction"
    | "customFontHealth"
    | "getCustomFontFaceSummary"
    | "getCustomFontUnicodeRangeLabel"
    | "handleCheckCustomFont"
    | "isLoading"
    | "handleDeleteFont"
  >
}) {
  const {
    t,
    formatNumber,
    customFontList,
    customFontStorageBytes,
    customFontStorageLimit,
    customFontStoragePercent,
    direction,
    customFontHealth,
    getCustomFontFaceSummary,
    getCustomFontUnicodeRangeLabel,
    handleCheckCustomFont,
    isLoading,
    handleDeleteFont
  } = model
  return (
    <section className="fontara-panel p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">
            {t("options.savedFonts.title")}
          </h3>
          <p className="mt-1 text-xs text-[#64748b]">
            {t("options.customFonts.count", {
              count: formatNumber(customFontList.length),
              size: formatBytes(
                customFontStorageBytes,
                formatNumber,
                t("unit.kb"),
                t("unit.mb")
              )
            })}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-[#f8fafc] text-[#64748b]">
          <FileText className="size-5" />
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-blue-950">
        <HardDrive
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-blue-700"
        />
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-extrabold text-blue-800 ring-1 ring-inset ring-blue-200">
            {t("options.customFonts.localOnlyBadge")}
          </span>
          <p className="mt-1.5 text-xs leading-5 text-blue-900">
            {t("options.customFonts.localOnlyDescription")}
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-600">
          <span className="font-semibold">
            {t("options.customFonts.storageUsage", {
              used: formatBytes(
                customFontStorageBytes,
                formatNumber,
                t("unit.kb"),
                t("unit.mb")
              ),
              limit: customFontStorageLimit
            })}
          </span>
          <span className="shrink-0 font-bold text-slate-800">
            {formatNumber(customFontStoragePercent / 100, {
              style: "percent",
              maximumFractionDigits: 0
            })}
          </span>
        </div>
        <Progress
          dir={direction}
          value={customFontStoragePercent}
          aria-label={t("options.customFonts.storageUsage", {
            used: formatBytes(
              customFontStorageBytes,
              formatNumber,
              t("unit.kb"),
              t("unit.mb")
            ),
            limit: customFontStorageLimit
          })}
          className="h-1.5 bg-slate-200"
        />
      </div>

      {customFontList.length > 0 ? (
        <div className="space-y-3">
          {customFontList.map((font) => {
            const recordedHealth = customFontHealth[font.value]
            const health =
              recordedHealth?.signature === getCustomFontHealthSignature(font)
                ? recordedHealth.status
                : null

            return (
              <div
                key={font.value}
                data-testid={`fontara-custom-font-family-${font.value}`}
                className="flex flex-col gap-3 rounded-md border border-[#e5e7eb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <bdi
                    dir="auto"
                    title={font.displayName}
                    className="block truncate text-sm font-semibold text-[#111827]">
                    {font.displayName}
                  </bdi>
                  <div className="mt-1 truncate text-xs text-[#64748b]">
                    {t("options.customFonts.familySummary", {
                      count: formatNumber(font.faces.length),
                      styles: getCustomFontFaceSummary(font.faces)
                    })}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#64748b]">
                    {t("options.savedFonts.unicodeRange", {
                      range: getCustomFontUnicodeRangeLabel(font.unicodeRange)
                    })}
                  </div>
                  {health && (
                    <div
                      role="status"
                      data-testid={`fontara-custom-font-health-status-${font.value}`}
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-bold",
                        health === "ready" && "bg-emerald-50 text-emerald-700",
                        health === "error" && "bg-red-50 text-red-700",
                        health === "checking" && "bg-blue-50 text-blue-700"
                      )}>
                      {health === "ready"
                        ? t("options.customFonts.healthReady")
                        : health === "error"
                          ? t("options.customFonts.healthError")
                          : t("options.customFonts.healthChecking")}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`fontara-custom-font-health-${font.value}`}
                    onClick={() => void handleCheckCustomFont(font)}
                    disabled={isLoading || health === "checking"}
                    className="border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-800">
                    {health === "error" ? (
                      <RotateCcw className="size-4" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {health === "checking"
                      ? t("options.customFonts.healthChecking")
                      : health === "error"
                        ? t("options.customFonts.healthRetry")
                        : t("options.customFonts.healthCheck")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`fontara-custom-font-delete-${font.value}`}
                        className="shrink-0 border-red-100 text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={isLoading}>
                        <Trash2 className="size-4" />
                        {t("common.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir={direction}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("options.customFonts.deleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("options.customFonts.deleteDescription", {
                            font: font.displayName
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t("options.backup.cancelButton")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          data-testid={`fontara-custom-font-delete-confirm-${font.value}`}
                          onClick={() => void handleDeleteFont(font.value)}>
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-dashed border-[#dbe3ef] text-sm text-[#64748b]">
          {t("options.emptyFonts")}
        </div>
      )}
    </section>
  )
}
