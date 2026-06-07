import { ChevronLeft, ChevronRight } from "lucide-react"

import { STORAGE_KEYS } from "../../config/storage"
import {
  getNextTextStrokeValue,
  TEXT_STROKE_MAX,
  TEXT_STROKE_MIN,
  TEXT_STROKE_STEP
} from "../../config/text-stroke"
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

  return (
    <div className="mx-auto mt-2 w-full select-none" dir="ltr">
      <div className="grid grid-cols-[2.35rem_minmax(0,1fr)_2.35rem] gap-2">
        <button
          type="button"
          className="flex h-8 items-center justify-center rounded-[2px] border border-[#2b6b7a] bg-[#12252d] text-white transition hover:bg-[#18313a] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={textStroke <= TEXT_STROKE_MIN}
          aria-label={t("popup.textStroke.decrease")}
          onClick={() => void decreaseTextStroke()}>
          <ChevronLeft className="size-7" strokeWidth={2.5} />
        </button>

        <div className="flex h-8 min-w-0 items-center justify-center rounded-[2px] border border-[#2b6b7a] bg-[#13242b] px-3 text-sm font-bold text-white">
          <span className="truncate">{t("popup.textStroke.title")}</span>
        </div>

        <button
          type="button"
          className="flex h-8 items-center justify-center rounded-[2px] border border-[#2b6b7a] bg-[#12252d] text-white transition hover:bg-[#18313a] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={textStroke >= TEXT_STROKE_MAX}
          aria-label={t("popup.textStroke.increase")}
          onClick={() => void increaseTextStroke()}>
          <ChevronRight className="size-7" strokeWidth={2.5} />
        </button>
      </div>

      <bdi className="mt-1 block text-center text-xs font-bold text-[#2b93ac]">
        +{formattedValue}
      </bdi>
    </div>
  )
}

export default TextStrokeToggle
