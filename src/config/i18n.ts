export const UI_LANGUAGE_AUTO = "auto" as const

export const SUPPORTED_UI_LANGUAGES = ["fa", "en", "ar"] as const

export type SupportedUILanguage = (typeof SUPPORTED_UI_LANGUAGES)[number]
export type UILanguagePreference = SupportedUILanguage | typeof UI_LANGUAGE_AUTO
export type TextDirection = "ltr" | "rtl"

const RTL_LANGUAGES = new Set<SupportedUILanguage>(["fa", "ar"])

export function isSupportedUILanguage(
  value: unknown
): value is SupportedUILanguage {
  return (
    typeof value === "string" &&
    SUPPORTED_UI_LANGUAGES.includes(value as SupportedUILanguage)
  )
}

export function normalizeUILanguagePreference(
  value: unknown
): UILanguagePreference {
  if (value === UI_LANGUAGE_AUTO || isSupportedUILanguage(value)) {
    return value
  }

  return UI_LANGUAGE_AUTO
}

export function getLanguageDirection(
  language: SupportedUILanguage
): TextDirection {
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr"
}

export function getLanguageLocale(language: SupportedUILanguage): string {
  switch (language) {
    case "fa":
      return "fa-IR"
    case "ar":
      return "ar"
    case "en":
      return "en-US"
  }
}

export function resolveUILanguage(
  preference: UILanguagePreference,
  browserLanguage: string | undefined
): SupportedUILanguage {
  if (preference !== UI_LANGUAGE_AUTO) {
    return preference
  }

  const normalizedBrowserLanguage = browserLanguage
    ?.trim()
    .toLowerCase()
    .split(/[-_]/, 1)[0]

  return isSupportedUILanguage(normalizedBrowserLanguage)
    ? normalizedBrowserLanguage
    : "en"
}
