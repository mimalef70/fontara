import {
  AlignRight,
  ArrowUpRight,
  Check,
  Globe2,
  Languages,
  ListChecks,
  LockKeyhole,
  Sparkles,
  Type
} from "lucide-react"
import type React from "react"
import {
  type SupportedUILanguage,
  UI_LANGUAGE_AUTO,
  type UILanguagePreference
} from "../../config/i18n"
import { cn } from "../../utils/cn"
import FontSelector from "../components/FontSelector"
import { Button } from "../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/ui/card"
import type { MessageKey } from "../i18n/messages"

import type { OptionsController } from "./use-options-controller"

function OverviewMetric({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone: "blue" | "cyan" | "indigo" | "violet"
  value: string
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  } as const

  return (
    <Card className="fontara-metric-card border-0 shadow-none">
      <CardContent className="flex items-center gap-3 p-0">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            tones[tone]
          )}>
          <Icon aria-hidden="true" className="size-[1.125rem]" />
        </span>
        <span className="min-w-0">
          <strong className="block text-xl font-extrabold leading-none tracking-tight text-slate-950">
            {value}
          </strong>
          <span className="mt-1 block truncate text-xs font-medium text-slate-500">
            {label}
          </span>
        </span>
      </CardContent>
    </Card>
  )
}

const languageOptions: Array<{
  descriptionKey: MessageKey
  labelKey: MessageKey
  value: UILanguagePreference
}> = [
  {
    value: UI_LANGUAGE_AUTO,
    labelKey: "language.auto",
    descriptionKey: "language.autoDescription"
  },
  {
    value: "fa",
    labelKey: "language.fa",
    descriptionKey: "language.faDescription"
  },
  {
    value: "en",
    labelKey: "language.en",
    descriptionKey: "language.enDescription"
  },
  {
    value: "ar",
    labelKey: "language.ar",
    descriptionKey: "language.arDescription"
  }
]

function getLanguageLabelKey(language: SupportedUILanguage): MessageKey {
  switch (language) {
    case "fa":
      return "language.fa"
    case "ar":
      return "language.ar"
    case "en":
      return "language.en"
  }
}

export function GeneralSettingsSection({
  model
}: {
  model: Pick<
    OptionsController,
    | "extensionEnabled"
    | "t"
    | "handleSectionChange"
    | "activeFontLabel"
    | "formatNumber"
    | "customFontList"
    | "activeWebsiteCount"
    | "cssOnlyWebsiteCount"
    | "activeRtlSiteCount"
    | "preference"
    | "language"
    | "direction"
    | "setPreference"
  >
}) {
  const {
    extensionEnabled,
    t,
    handleSectionChange,
    activeFontLabel,
    formatNumber,
    customFontList,
    activeWebsiteCount,
    cssOnlyWebsiteCount,
    activeRtlSiteCount,
    preference,
    language,
    direction,
    setPreference
  } = model
  return (
    <div className="space-y-5">
      <Card className="fontara-hero-card overflow-hidden border-0">
        <CardContent className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-center lg:p-8">
          <div className="relative z-10 max-w-2xl">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                extensionEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              )}>
              <span
                className={cn(
                  "size-2 rounded-full",
                  extensionEnabled ? "bg-emerald-500" : "bg-slate-400"
                )}
              />
              {extensionEnabled
                ? t("options.overview.extensionOn")
                : t("options.overview.extensionOff")}
            </span>
            <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
              {t("options.overview.heroTitle")}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
              {t("options.overview.heroDescription")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button
                type="button"
                onClick={() => handleSectionChange("fonts")}
                className="h-10 rounded-xl bg-blue-600 px-4 text-white shadow-[0_8px_20px_rgb(37_99_235_/_20%)] hover:bg-blue-700">
                <Type className="size-4" />
                {t("options.overview.manageFonts")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSectionChange("sites")}
                className="h-10 rounded-xl border-slate-200 bg-white/80 px-4 text-slate-700 hover:bg-white hover:text-blue-700">
                <Globe2 className="size-4" />
                {t("options.overview.manageSites")}
              </Button>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-white/80 bg-white/88 p-4 shadow-[0_20px_50px_rgb(15_23_42_/_10%)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {t("options.overview.activeFont")}
                </p>
                <p className="mt-1 truncate text-base font-extrabold text-slate-950">
                  {activeFontLabel}
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                <Sparkles className="size-[1.125rem]" />
              </span>
            </div>
            <FontSelector />
          </div>
        </CardContent>
      </Card>

      <Card className="fontara-metrics-shell border-0">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
          <OverviewMetric
            icon={Type}
            label={t("options.status.customFonts")}
            tone="blue"
            value={formatNumber(customFontList.length)}
          />
          <OverviewMetric
            icon={Globe2}
            label={t("options.status.activeSites")}
            tone="cyan"
            value={formatNumber(activeWebsiteCount)}
          />
          <OverviewMetric
            icon={ListChecks}
            label={t("options.status.cssOnly")}
            tone="indigo"
            value={formatNumber(cssOnlyWebsiteCount)}
          />
          <OverviewMetric
            icon={AlignRight}
            label={t("options.status.rtlSites")}
            tone="violet"
            value={formatNumber(activeRtlSiteCount)}
          />
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="fontara-settings-card border-0">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle>{t("language.title")}</CardTitle>
              <CardDescription className="mt-1.5">
                {t("language.subtitle")}
              </CardDescription>
            </div>
            <span className="fontara-icon-tile">
              <Languages className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
            {languageOptions.map((option) => {
              const active = preference === option.value
              const description =
                option.value === UI_LANGUAGE_AUTO
                  ? `${t(option.descriptionKey)} ${t("language.resolved", {
                      language: t(getLanguageLabelKey(language))
                    })}`
                  : t(option.descriptionKey)

              return (
                <button
                  key={option.value}
                  type="button"
                  dir={direction}
                  aria-pressed={active}
                  onClick={() => void setPreference(option.value)}
                  className={cn(
                    "fontara-choice flex min-h-24 items-start justify-between gap-3 rounded-xl border p-4 text-start transition",
                    active && "border-blue-300 bg-blue-50/40"
                  )}>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">
                      {t(option.labelKey)}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      {description}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border",
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-transparent"
                    )}>
                    <Check className="size-4" />
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="fontara-privacy-card overflow-hidden border-0">
          <CardHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <LockKeyhole className="size-5" />
            </span>
            <CardTitle>{t("options.overview.privacyTitle")}</CardTitle>
            <CardDescription className="mt-2 leading-6">
              {t("options.overview.privacyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleSectionChange("advanced")}
              className="h-9 rounded-lg px-0 text-blue-700 hover:bg-transparent hover:text-blue-800">
              {t("options.nav.advanced")}
              <ArrowUpRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
