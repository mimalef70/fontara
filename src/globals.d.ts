declare module "*.css" {
  const content: string
  export default content
}

declare module "*.css?text" {
  const content: string
  export default content
}

declare module "*?text" {
  const content: string
  export default content
}

declare const __DEBUG__: boolean
declare const __PLATFORM__: string
declare const __CHROMIUM_MV3__: boolean
declare const __FIREFOX_MV3__: boolean

type FontAraBootstrapUILanguage = "auto" | "fa" | "en" | "ar"
type FontAraBootstrapLanguage = "fa" | "en" | "ar"
type FontAraBootstrapDirection = "ltr" | "rtl"

type FontAraI18nBootstrapState = {
  browserLanguage?: string
  direction: FontAraBootstrapDirection
  language: FontAraBootstrapLanguage
  preference: FontAraBootstrapUILanguage
}

interface Window {
  __FONTARA_I18N_BOOTSTRAP__?: Promise<FontAraI18nBootstrapState>
  __FONTARA_INITIAL_I18N__?: FontAraI18nBootstrapState
}
