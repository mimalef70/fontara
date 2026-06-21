import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"

import { STORAGE_KEYS } from "../../config/storage"
import {
  DEFAULT_TEXT_STROKE,
  getNextTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
import { cn } from "../../utils/cn"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import { getTextStrokeInitialValue } from "../storage-defaults"

const TextStrokeToggle = () => {
  const { formatNumber, t } = useI18n()
  const [textStroke, setTextStroke] = useStorageValue<number>(
    STORAGE_KEYS.TEXT_STROKE,
    getTextStrokeInitialValue
  )
  const formattedValue = formatNumber(textStroke, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    useGrouping: false
  })
  const normalizedTrackValue =
    (textStroke - TEXT_STROKE_MIN) / (TEXT_STROKE_MAX - TEXT_STROKE_MIN)
  const trackFillPercentage = `${normalizedTrackValue * 100}%`
  const valueText =
    textStroke === DEFAULT_TEXT_STROKE
      ? t("popup.textStroke.off")
      : `+${formattedValue}`

  const handleChange = async (nextValue: number) => {
    try {
      await setTextStroke(nextValue)
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update text stroke setting.", error)
      }
    }
  }

  const decreaseTextStroke = () =>
    handleChange(getNextTextStrokeValue(textStroke, -TEXT_STROKE_STEP))

  const increaseTextStroke = () =>
    handleChange(getNextTextStrokeValue(textStroke, TEXT_STROKE_STEP))

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleChange(Number(event.currentTarget.value))
  }

  return (
    <div
      className={cn(
        "mx-auto mt-2 w-full select-none rounded-md p-1.5 transition",
        textStroke > 0 ? "bg-[#f8fbff]" : "bg-white"
      )}
      dir="ltr">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] gap-2">
        <button
          type="button"
          className="flex h-8 items-center justify-center rounded-[3px] bg-[#edf3fd] text-[#2374ff] transition hover:bg-[#e4efff] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
          disabled={textStroke <= TEXT_STROKE_MIN}
          aria-label={t("popup.textStroke.decrease")}
          onClick={() => void decreaseTextStroke()}>
          <ChevronLeft className="size-5" strokeWidth={2.5} />
        </button>

        <div className="relative flex h-8 min-w-0 items-center justify-center overflow-hidden rounded-[3px] bg-white text-sm font-bold text-[#111827] transition focus-within:ring-2 focus-within:ring-[#2474FF]/15">
          <span
            className="absolute inset-y-0 left-0 bg-[#dbeafe] transition-[width] duration-150"
            style={{ width: trackFillPercentage }}
          />
          <span className="absolute inset-y-0 left-0 w-px bg-[#2374ff]/60" />
          <span className="relative z-[1] truncate">
            {t("popup.textStroke.title")}
            <bdi className="font-bold text-[#2374ff]"> ({valueText})</bdi>
          </span>
          <input
            type="range"
            min={TEXT_STROKE_MIN}
            max={TEXT_STROKE_MAX}
            step={TEXT_STROKE_STEP}
            value={textStroke}
            aria-label={t("popup.textStroke.title")}
            className="absolute inset-0 z-[2] h-full w-full cursor-ew-resize opacity-0"
            onChange={handleRangeChange}
          />
        </div>

        <button
          type="button"
          className="flex h-8 items-center justify-center rounded-[3px] bg-[#edf3fd] text-[#2374ff] transition hover:bg-[#e4efff] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
          disabled={textStroke >= TEXT_STROKE_MAX}
          aria-label={t("popup.textStroke.increase")}
          onClick={() => void increaseTextStroke()}>
          <ChevronRight className="size-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

export default TextStrokeToggle
