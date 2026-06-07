export const TEXT_STROKE_MIN = 0
export const TEXT_STROKE_MAX = 1
export const TEXT_STROKE_STEP = 0.1
export const DEFAULT_TEXT_STROKE = 0
export const DEFAULT_ACTIVE_TEXT_STROKE = 0.3

export function normalizeTextStrokeValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TEXT_STROKE
  }

  const clampedValue = Math.min(
    TEXT_STROKE_MAX,
    Math.max(TEXT_STROKE_MIN, value)
  )

  return Number(
    (Math.round(clampedValue / TEXT_STROKE_STEP) * TEXT_STROKE_STEP).toFixed(1)
  )
}

export function getNextTextStrokeValue(
  currentValue: unknown,
  delta: number
): number {
  return normalizeTextStrokeValue(
    normalizeTextStrokeValue(currentValue) + delta
  )
}
