import React, { useState } from "react"
import type { FontaraGoogleFontCacheStats } from "../../definitions"
import {
  getGoogleFontDataConsentState,
  requestGoogleFontNetworkConsent
} from "../../utils/google-font-consent"
import { isGoogleFontFeatureSupported } from "../../utils/google-fonts"
import {
  isSystemFontFeatureSupported,
  loadSystemFonts
} from "../../utils/system-fonts"
import { fontaraConnector } from "../connect/connector"

import type { OptionsState } from "./use-options-state"

export function useFontSources({
  googleFontsEnabled,
  activeSection,
  setSystemFontsEnabled,
  toast,
  t,
  setGoogleFontsEnabled
}: Pick<
  OptionsState,
  | "googleFontsEnabled"
  | "activeSection"
  | "setSystemFontsEnabled"
  | "toast"
  | "t"
  | "setGoogleFontsEnabled"
>) {
  const [googleFontConsentState, setGoogleFontConsentState] = useState<
    "checking" | "granted" | "not-granted" | "unsupported"
  >("checking")

  const [googleFontsToggleBusy, setGoogleFontsToggleBusy] = useState(false)

  const [googleFontCacheBusy, setGoogleFontCacheBusy] = useState(false)

  const [googleFontCacheStats, setGoogleFontCacheStats] =
    useState<FontaraGoogleFontCacheStats | null>(null)

  const systemFontsSupported = isSystemFontFeatureSupported()

  const googleFontsSupported = isGoogleFontFeatureSupported()

  const googleFontsAvailable =
    googleFontsSupported && googleFontConsentState !== "unsupported"

  const googleFontsActive =
    googleFontsAvailable &&
    googleFontConsentState === "granted" &&
    googleFontsEnabled

  React.useEffect(() => {
    let cancelled = false

    if (!googleFontsSupported) {
      setGoogleFontConsentState("unsupported")
      return () => {
        cancelled = true
      }
    }

    void getGoogleFontDataConsentState()
      .then((state) => {
        if (!cancelled) setGoogleFontConsentState(state)
      })
      .catch(() => {
        if (!cancelled) setGoogleFontConsentState("not-granted")
      })

    return () => {
      cancelled = true
    }
  }, [googleFontsSupported])

  React.useEffect(() => {
    let cancelled = false
    if (!googleFontsSupported || activeSection !== "fonts") return

    void fontaraConnector
      .getGoogleFontCacheStats()
      .then((stats) => {
        if (!cancelled) setGoogleFontCacheStats(stats)
      })
      .catch((error) => {
        if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
          console.warn("Failed to read Google Fonts cache stats.", error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeSection, googleFontsSupported])

  const handleSystemFontsToggle = async (checked: boolean) => {
    try {
      if (!checked) {
        await setSystemFontsEnabled(false)
        return
      }

      if (!isSystemFontFeatureSupported()) {
        toast({ title: t("options.toast.systemFontsUnsupported") })
        return
      }

      await setSystemFontsEnabled(true)
      const state = await loadSystemFonts({ forceRefresh: true })
      if (state.status === "error") {
        toast({ title: t("options.toast.systemFontsError") })
      }
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleGoogleFontsToggle = async (checked: boolean) => {
    if (googleFontsToggleBusy) return
    setGoogleFontsToggleBusy(true)

    try {
      if (!checked) {
        await setGoogleFontsEnabled(false)
        return
      }

      if (!isGoogleFontFeatureSupported()) {
        setGoogleFontConsentState("unsupported")
        toast({ title: t("options.toast.googleFontsUnsupported") })
        return
      }

      if (
        googleFontConsentState === "checking" ||
        googleFontConsentState === "unsupported"
      ) {
        toast({ title: t("options.toast.googleFontsUnsupported") })
        return
      }

      // Start the permission request synchronously from the switch gesture.
      // Firefox can reject requests made after an earlier awaited operation.
      const granted = await requestGoogleFontNetworkConsent()
      if (!granted) {
        toast({ title: t("options.toast.googleFontsConsentDenied") })
        return
      }
      setGoogleFontConsentState("granted")

      await setGoogleFontsEnabled(true)
    } catch (error) {
      toast({
        title: t("options.toast.googleFontsConsentError"),
        ...(typeof __DEBUG__ !== "undefined" &&
        __DEBUG__ &&
        error instanceof Error
          ? { description: error.message }
          : {})
      })
    } finally {
      setGoogleFontsToggleBusy(false)
    }
  }

  const handleClearGoogleFontCache = async () => {
    if (googleFontCacheBusy) return
    setGoogleFontCacheBusy(true)

    try {
      const stats = await fontaraConnector.clearGoogleFontCache()
      setGoogleFontCacheStats(stats)
      toast({ title: t("options.googleFonts.cacheCleared") })
    } catch (error) {
      toast({
        title: t("options.googleFonts.cacheClearError"),
        ...(typeof __DEBUG__ !== "undefined" &&
        __DEBUG__ &&
        error instanceof Error
          ? { description: error.message }
          : {})
      })
    } finally {
      setGoogleFontCacheBusy(false)
    }
  }
  return {
    googleFontConsentState,
    googleFontsToggleBusy,
    googleFontCacheBusy,
    googleFontCacheStats,
    systemFontsSupported,
    googleFontsSupported,
    googleFontsAvailable,
    googleFontsActive,
    handleSystemFontsToggle,
    handleGoogleFontsToggle,
    handleClearGoogleFontCache
  }
}
