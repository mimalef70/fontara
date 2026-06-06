import {
  getLanguageDirection,
  normalizeUILanguagePreference,
  resolveUILanguage,
  UI_LANGUAGE_AUTO,
  type UILanguagePreference
} from "../../config/i18n"
import { STORAGE_KEYS } from "../../config/storage-keys"

function getBrowserUILanguage(): string | undefined {
  try {
    return chrome.i18n?.getUILanguage?.() || navigator.language
  } catch {
    return navigator.language
  }
}

function resolveBootstrapState(
  preference: UILanguagePreference,
  browserLanguage: string | undefined
): FontAraI18nBootstrapState {
  const language = resolveUILanguage(preference, browserLanguage)

  return {
    browserLanguage,
    direction: getLanguageDirection(language),
    language,
    preference
  }
}

function applyBootstrapState(state: FontAraI18nBootstrapState): void {
  document.documentElement.lang = state.language
  document.documentElement.dir = state.direction

  if (document.body) {
    document.body.dir = state.direction
    return
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      document.body.dir = state.direction
    },
    { once: true }
  )
}

function readStoredPreference(): Promise<UILanguagePreference> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEYS.UI_LANGUAGE, (items) => {
        if (chrome.runtime?.lastError) {
          resolve(UI_LANGUAGE_AUTO)
          return
        }

        resolve(normalizeUILanguagePreference(items[STORAGE_KEYS.UI_LANGUAGE]))
      })
    } catch {
      resolve(UI_LANGUAGE_AUTO)
    }
  })
}

const browserLanguage = getBrowserUILanguage()
const initialState = resolveBootstrapState(UI_LANGUAGE_AUTO, browserLanguage)
window.__FONTARA_INITIAL_I18N__ = initialState
applyBootstrapState(initialState)

window.__FONTARA_I18N_BOOTSTRAP__ = readStoredPreference().then(
  (preference) => {
    const resolvedState = resolveBootstrapState(preference, browserLanguage)
    window.__FONTARA_INITIAL_I18N__ = resolvedState
    applyBootstrapState(resolvedState)
    return resolvedState
  }
)
