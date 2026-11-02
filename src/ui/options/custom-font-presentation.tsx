import { Check } from "lucide-react"
import type React from "react"
import type { CustomFontUnicodeRangePresetId } from "../../config/font-unicode-range"
import type {
  CustomFontFaceMeta,
  CustomFontFamily
} from "../../custom-font-types"
import { cn } from "../../utils/cn"
import type { MessageKey } from "../i18n/messages"
import type {
  CustomFontMutationErrorKind,
  SimpleCustomFontSlot
} from "./custom-font-upload"

export type CustomFontUnicodeRangeSelectValue =
  | CustomFontUnicodeRangePresetId
  | "custom"

export type SimpleCustomFontUnicodeRangePreset = Extract<
  CustomFontUnicodeRangePresetId,
  "all" | "arabic-persian" | "latin-arabic"
>

export type CustomFontHealthState = {
  signature: string
  status: "checking" | "error" | "ready"
}

export const SIMPLE_CUSTOM_FONT_UNICODE_RANGE_PRESETS = [
  "arabic-persian",
  "latin-arabic",
  "all"
] as const satisfies readonly SimpleCustomFontUnicodeRangePreset[]

export function getCustomFontHealthSignature(font: CustomFontFamily): string {
  return `${font.revision}:${font.faces
    .map((face) => `${face.id}:${face.fileHash}`)
    .join("|")}`
}

export type PreparedCustomFontFile = {
  bytes: ArrayBuffer
  coversBold: boolean
  face: CustomFontFaceMeta
  isVariable: boolean
  slot: SimpleCustomFontSlot
}

export type CustomFontSelectionFeedback = {
  slot: SimpleCustomFontSlot
  title: string
}

export class UserFacingCustomFontError extends Error {}

export const CUSTOM_FONT_UPLOAD_ERROR_KEYS = {
  "duplicate-name": "options.toast.duplicateFontName",
  "family-limit": "options.toast.customFontFamilyLimit",
  "family-size-limit": "options.toast.customFontFamilyTooLarge",
  "invalid-data": "options.toast.fontProcessingError",
  "library-limit": "options.toast.customFontLibraryFull",
  retryable: "options.toast.customFontUploadRetry",
  "storage-unavailable": "options.toast.customFontStorageUnavailable",
  unknown: "options.toast.customFontUploadError"
} as const satisfies Record<CustomFontMutationErrorKind, MessageKey>

export function CustomFontUploadSlot({
  badge,
  description,
  disabled,
  inputRef,
  label,
  onChange,
  onClear,
  preparedFont,
  readySummary,
  removeLabel,
  selectLabel,
  slot
}: {
  badge: string
  description: string
  disabled: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  preparedFont: PreparedCustomFontFile | null
  readySummary: string
  removeLabel: string
  selectLabel: string
  slot: SimpleCustomFontSlot
}) {
  const inputId = `custom-font-${slot}-file`

  return (
    <div
      data-testid={`fontara-custom-font-${slot}-slot`}
      aria-disabled={disabled}
      className={cn(
        "group flex min-h-32 flex-col rounded-2xl border p-3.5 text-start transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20",
        preparedFont
          ? "border-emerald-200 bg-emerald-50/70 shadow-sm"
          : "border-dashed border-blue-200 bg-gradient-to-b from-blue-50/80 to-white hover:border-blue-400 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-60"
      )}>
      <div className="flex items-start gap-2">
        <label
          htmlFor={inputId}
          className={cn(
            "min-w-0 flex-1 cursor-pointer",
            disabled && "cursor-not-allowed"
          )}>
          <span className="min-w-0">
            <strong className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
              {preparedFont && (
                <Check
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-emerald-700"
                />
              )}
              {label}
            </strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              {description}
            </span>
          </span>
        </label>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
            {badge}
          </span>
          {preparedFont && (
            <button
              type="button"
              data-testid={`fontara-custom-font-${slot}-remove`}
              onClick={onClear}
              aria-label={removeLabel}
              disabled={disabled}
              className="flex size-7 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          )}
        </span>
      </div>

      <label
        htmlFor={inputId}
        className={cn(
          "mt-auto block cursor-pointer pt-3",
          disabled && "cursor-not-allowed"
        )}>
        {preparedFont ? (
          <span
            data-testid={`fontara-custom-font-${slot}-ready`}
            role="status"
            className="block min-w-0 rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
            <bdi
              dir="auto"
              title={preparedFont.face.fileName}
              className="block truncate text-xs font-bold text-slate-800">
              {preparedFont.face.fileName}
            </bdi>
            <span className="mt-1 block text-[0.6875rem] font-semibold text-emerald-700">
              {readySummary}
            </span>
          </span>
        ) : (
          <span className="text-xs font-bold text-blue-700">{selectLabel}</span>
        )}
      </label>

      <input
        id={inputId}
        data-testid={`fontara-custom-font-${slot}-file`}
        ref={inputRef}
        type="file"
        onChange={onChange}
        accept=".ttf,.woff,.woff2,.otf"
        className="sr-only"
        disabled={disabled}
      />
    </div>
  )
}

export const unicodeRangeLabelKeys = {
  all: "options.addFont.unicodeRangePreset.all",
  "arabic-persian": "options.addFont.unicodeRangePreset.arabicPersian",
  cjk: "options.addFont.unicodeRangePreset.cjk",
  custom: "options.addFont.unicodeRangePreset.custom",
  cyrillic: "options.addFont.unicodeRangePreset.cyrillic",
  devanagari: "options.addFont.unicodeRangePreset.devanagari",
  greek: "options.addFont.unicodeRangePreset.greek",
  hebrew: "options.addFont.unicodeRangePreset.hebrew",
  latin: "options.addFont.unicodeRangePreset.latin",
  "latin-arabic": "options.addFont.unicodeRangePreset.latinArabic",
  thai: "options.addFont.unicodeRangePreset.thai"
} satisfies Record<CustomFontUnicodeRangeSelectValue, MessageKey>
