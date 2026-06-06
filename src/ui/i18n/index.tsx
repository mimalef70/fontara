import * as React from "react"

import {
  getLanguageDirection,
  getLanguageLocale,
  normalizeUILanguagePreference,
  resolveUILanguage,
  type SupportedUILanguage,
  type TextDirection,
  type UILanguagePreference
} from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage"
import { useStorageValue } from "../hooks/use-storage"
import { interpolateMessage, type MessageKey, UI_MESSAGES } from "./messages"

type MessageParams = Record<string, string | number>

type I18nContextValue = {
  direction: TextDirection
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatVersion: (version: string) => string
  language: SupportedUILanguage
  locale: string
  preference: UILanguagePreference
  setPreference: (preference: UILanguagePreference) => Promise<void>
  t: (key: MessageKey, params?: MessageParams) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

function getInitialI18nState(): FontAraI18nBootstrapState | undefined {
  return window.__FONTARA_INITIAL_I18N__
}

function getBrowserUILanguage(): string | undefined {
  try {
    return chrome.i18n?.getUILanguage?.() || navigator.language
  } catch {
    return navigator.language
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initialI18nState = React.useMemo(() => getInitialI18nState(), [])
  const [preference, setStoredPreference] =
    useStorageValue<UILanguagePreference>(STORAGE_KEYS.UI_LANGUAGE, (value) =>
      normalizeUILanguagePreference(value ?? initialI18nState?.preference)
    )
  const [browserLanguage, setBrowserLanguage] = React.useState(
    () => initialI18nState?.browserLanguage || getBrowserUILanguage()
  )

  React.useEffect(() => {
    setBrowserLanguage(getBrowserUILanguage())
  }, [])

  const normalizedPreference = normalizeUILanguagePreference(preference)
  const language = resolveUILanguage(normalizedPreference, browserLanguage)
  const direction = getLanguageDirection(language)
  const locale = getLanguageLocale(language)

  React.useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
    document.body.dir = direction
  }, [direction, language])

  const formatNumber = React.useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, options).format(value)
    },
    [locale]
  )

  const formatVersion = React.useCallback(
    (version: string) => {
      const digitFormatter = new Intl.NumberFormat(locale, {
        useGrouping: false
      })

      return version.replace(/\d/g, (digit) =>
        digitFormatter.format(Number(digit))
      )
    },
    [locale]
  )

  const t = React.useCallback(
    (key: MessageKey, params?: MessageParams) => {
      return interpolateMessage(UI_MESSAGES[language][key], params)
    },
    [language]
  )

  const setPreference = React.useCallback(
    (nextPreference: UILanguagePreference) =>
      setStoredPreference(normalizeUILanguagePreference(nextPreference)),
    [setStoredPreference]
  )

  const value = React.useMemo<I18nContextValue>(
    () => ({
      direction,
      formatNumber,
      formatVersion,
      language,
      locale,
      preference: normalizedPreference,
      setPreference,
      t
    }),
    [
      direction,
      formatNumber,
      formatVersion,
      language,
      locale,
      normalizedPreference,
      setPreference,
      t
    ]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.")
  }

  return context
}

export async function waitForI18nBootstrap(): Promise<void> {
  try {
    await window.__FONTARA_I18N_BOOTSTRAP__
  } catch {
    // Rendering should not fail if the early language bootstrap could not read
    // extension storage.
  }
}
