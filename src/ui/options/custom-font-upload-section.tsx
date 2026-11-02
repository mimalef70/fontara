import { Info, Upload } from "lucide-react"
import { cn } from "../../utils/cn"
import { CUSTOM_FONT_NAME_MAX_LENGTH } from "../../utils/custom-font-name"
import { Button } from "../components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select"
import {
  CustomFontUploadSlot,
  SIMPLE_CUSTOM_FONT_UNICODE_RANGE_PRESETS,
  type SimpleCustomFontUnicodeRangePreset,
  unicodeRangeLabelKeys
} from "./custom-font-presentation"
import type { OptionsController } from "./use-options-controller"

export function CustomFontUploadSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "t"
    | "fontName"
    | "setFontName"
    | "hasValidFontName"
    | "isLoading"
    | "direction"
    | "isFontCoverageSelectOpen"
    | "setIsFontCoverageSelectOpen"
    | "fontUnicodeRangePreset"
    | "setFontUnicodeRangePreset"
    | "regularFontInputRef"
    | "preparedRegularFont"
    | "formatNumber"
    | "handleClearPreparedFontSlot"
    | "handleFontSlotChange"
    | "boldFontInputRef"
    | "regularCoversBold"
    | "preparedBoldFont"
    | "customFontSelectionFeedback"
    | "previewStatus"
    | "previewFontFamily"
    | "handleSaveFont"
  >
}) {
  const {
    t,
    fontName,
    setFontName,
    hasValidFontName,
    isLoading,
    direction,
    isFontCoverageSelectOpen,
    setIsFontCoverageSelectOpen,
    fontUnicodeRangePreset,
    setFontUnicodeRangePreset,
    regularFontInputRef,
    preparedRegularFont,
    formatNumber,
    handleClearPreparedFontSlot,
    handleFontSlotChange,
    boldFontInputRef,
    regularCoversBold,
    preparedBoldFont,
    customFontSelectionFeedback,
    previewStatus,
    previewFontFamily,
    handleSaveFont
  } = model
  return (
    <section
      data-testid="fontara-custom-font-form"
      className="fontara-panel p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">
            {t("options.addFont.title")}
          </h3>
          <p className="mt-1 text-xs text-[#64748b]">
            {t("options.addFont.subtitle")}
          </p>
        </div>
        <div className="fontara-icon-tile">
          <Upload className="size-5" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="custom-font-name"
            className="mb-2 block text-sm font-medium text-[#334155]">
            {t("options.addFont.nameLabel")}
          </label>
          <input
            id="custom-font-name"
            data-testid="fontara-custom-font-name"
            type="text"
            value={fontName}
            maxLength={CUSTOM_FONT_NAME_MAX_LENGTH}
            onChange={(event) => setFontName(event.target.value)}
            placeholder={t("options.addFont.namePlaceholder")}
            aria-describedby="custom-font-name-description"
            aria-invalid={fontName.length > 0 && !hasValidFontName}
            className="h-11 w-full rounded-md border border-[#dbe3ef] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#2374ff] focus:ring-2 focus:ring-[#2374ff]/15 aria-invalid:border-red-400 aria-invalid:ring-red-500/15"
            disabled={isLoading}
            dir="auto"
          />
          <p
            id="custom-font-name-description"
            className={cn(
              "mt-1.5 text-xs leading-5",
              fontName.length > 0 && !hasValidFontName
                ? "font-semibold text-red-700"
                : "text-[#64748b]"
            )}>
            {fontName.length > 0 && !hasValidFontName
              ? t("options.addFont.nameInvalid")
              : t("options.addFont.nameDescription")}
          </p>
        </div>

        <div>
          <label
            htmlFor="custom-font-unicode-range"
            className="mb-2 block text-sm font-medium text-[#334155]">
            {t("options.addFont.coverageLabel")}
          </label>
          <Select
            dir={direction}
            open={isFontCoverageSelectOpen}
            onOpenChange={setIsFontCoverageSelectOpen}
            value={fontUnicodeRangePreset}
            onValueChange={(value) => {
              setFontUnicodeRangePreset(
                value as SimpleCustomFontUnicodeRangePreset
              )
              setIsFontCoverageSelectOpen(false)
            }}
            disabled={isLoading}>
            <SelectTrigger
              id="custom-font-unicode-range"
              data-testid="fontara-custom-font-coverage"
              aria-describedby="custom-font-unicode-range-description"
              className="h-11 w-full border-[#dbe3ef] bg-white">
              <SelectValue>
                {t(unicodeRangeLabelKeys[fontUnicodeRangePreset])}
              </SelectValue>
            </SelectTrigger>
            {isFontCoverageSelectOpen && (
              <SelectContent dir={direction}>
                {SIMPLE_CUSTOM_FONT_UNICODE_RANGE_PRESETS.map((preset) => (
                  <SelectItem
                    key={preset}
                    value={preset}
                    data-testid={`fontara-custom-font-coverage-${preset}`}>
                    {t(unicodeRangeLabelKeys[preset])}
                  </SelectItem>
                ))}
              </SelectContent>
            )}
          </Select>
          <p
            id="custom-font-unicode-range-description"
            className="mt-1.5 text-xs leading-5 text-[#64748b]">
            {t("options.addFont.coverageDescription")}
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-5 text-blue-900">
          <span className="flex items-start gap-2.5">
            <Info
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-blue-600"
            />
            <span>{t("options.addFont.variableHint")}</span>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CustomFontUploadSlot
            slot="regular"
            inputRef={regularFontInputRef}
            label={t("options.addFont.regularLabel")}
            badge={t("options.addFont.required")}
            description={t("options.addFont.regularDescription")}
            selectLabel={t("options.addFont.selectFile")}
            removeLabel={t("options.addFont.removeFile", {
              role: t("options.addFont.regularLabel")
            })}
            preparedFont={preparedRegularFont}
            readySummary={
              preparedRegularFont?.isVariable
                ? t("options.addFont.variableReady", {
                    max: formatNumber(preparedRegularFont.face.weight.max),
                    min: formatNumber(preparedRegularFont.face.weight.min)
                  })
                : t("options.addFont.regularReady")
            }
            disabled={isLoading}
            onClear={() => handleClearPreparedFontSlot("regular")}
            onChange={(event) => void handleFontSlotChange("regular", event)}
          />
          <CustomFontUploadSlot
            slot="bold"
            inputRef={boldFontInputRef}
            label={t("options.addFont.boldLabel")}
            badge={t("options.addFont.optional")}
            description={
              regularCoversBold
                ? t("options.addFont.boldCovered")
                : t("options.addFont.boldDescription")
            }
            selectLabel={t("options.addFont.selectFile")}
            removeLabel={t("options.addFont.removeFile", {
              role: t("options.addFont.boldLabel")
            })}
            preparedFont={preparedBoldFont}
            readySummary={
              preparedBoldFont?.isVariable
                ? t("options.addFont.boldVariableReady")
                : t("options.addFont.boldReady")
            }
            disabled={isLoading || regularCoversBold}
            onClear={() => handleClearPreparedFontSlot("bold")}
            onChange={(event) => void handleFontSlotChange("bold", event)}
          />
        </div>

        {customFontSelectionFeedback && (
          <div
            role="alert"
            data-testid={`fontara-custom-font-${customFontSelectionFeedback.slot}-error`}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-start">
            <Info className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p className="min-w-0 text-xs font-bold text-red-900">
              {customFontSelectionFeedback.title}
            </p>
          </div>
        )}

        {preparedRegularFont && (
          <div
            data-testid="fontara-custom-font-preview"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  {t("options.addFont.previewTitle")}
                </h4>
                <p className="mt-1 text-[0.6875rem] leading-5 text-slate-500">
                  {t("options.addFont.previewDescription")}
                </p>
              </div>
              {previewStatus === "loading" && (
                <span className="shrink-0 text-[0.6875rem] font-bold text-blue-700">
                  {t("options.addFont.previewLoading")}
                </span>
              )}
            </div>

            {previewStatus === "error" ? (
              <p role="status" className="mt-3 text-xs font-bold text-red-700">
                {t("options.addFont.previewError")}
              </p>
            ) : (
              <div
                className={cn(
                  "mt-3 space-y-2 rounded-lg bg-white px-3 py-3 ring-1 ring-inset ring-slate-200 transition-opacity",
                  previewStatus !== "ready" && "opacity-45"
                )}
                style={{
                  fontFamily: previewFontFamily ?? undefined
                }}>
                <div>
                  <span className="mb-1 block font-sans text-[0.625rem] font-bold text-slate-500">
                    {t("options.addFont.regularLabel")}
                  </span>
                  <p
                    dir="rtl"
                    lang="fa"
                    className="text-base leading-7 text-slate-900">
                    {t("fontSelector.previewText")}
                  </p>
                  <p
                    dir="ltr"
                    lang="en"
                    className="text-sm leading-6 text-slate-800">
                    {t("fontSelector.previewTextLatin")}
                  </p>
                </div>
                {(preparedBoldFont || regularCoversBold) && (
                  <div className="border-t border-slate-100 pt-2">
                    <span className="mb-1 block font-sans text-[0.625rem] font-bold text-slate-500">
                      {t("options.addFont.boldLabel")}
                    </span>
                    <p
                      dir="rtl"
                      lang="fa"
                      className="text-base font-bold leading-7 text-slate-900">
                      {t("fontSelector.previewText")}
                    </p>
                    <p
                      dir="ltr"
                      lang="en"
                      className="text-sm font-bold leading-6 text-slate-800">
                      {t("fontSelector.previewTextLatin")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          type="button"
          data-testid="fontara-custom-font-add"
          onClick={handleSaveFont}
          className="h-11 w-full bg-[#2374ff] text-white hover:bg-[#1f66df]"
          disabled={isLoading || !preparedRegularFont || !hasValidFontName}>
          <Upload className="size-4" />
          {isLoading
            ? t("options.addFont.loading")
            : t("options.addFont.button")}
        </Button>
      </div>
    </section>
  )
}
