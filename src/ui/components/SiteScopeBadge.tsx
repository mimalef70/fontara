import type { SitePatternScope } from "../../config/site-list"
import { cn } from "../../utils/cn"
import { useI18n } from "../i18n"
import type { MessageKey } from "../i18n/messages"

export type SiteScopeBadgeKind = SitePatternScope | "global"

const siteScopeBadgeLabels = {
  custom: "options.siteList.scopeCustom",
  domain: "options.siteList.scopeDomain",
  global: "customUrl.scopeGlobal",
  path: "options.siteList.scopePath",
  regex: "options.siteList.scopeRegex"
} satisfies Record<SiteScopeBadgeKind, MessageKey>

const siteScopeBadgeClasses = {
  custom: "border-slate-200 bg-slate-50 text-slate-600",
  domain: "border-blue-200 bg-blue-50 text-blue-700",
  global: "border-sky-200 bg-sky-50 text-sky-700",
  path: "border-emerald-200 bg-emerald-50 text-emerald-700",
  regex: "border-amber-200 bg-amber-50 text-amber-700"
} satisfies Record<SiteScopeBadgeKind, string>

type SiteScopeBadgeProps = {
  className?: string
  scope: SiteScopeBadgeKind
}

export function SiteScopeBadge({ className, scope }: SiteScopeBadgeProps) {
  const { t } = useI18n()

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-semibold leading-none",
        siteScopeBadgeClasses[scope],
        className
      )}>
      {t(siteScopeBadgeLabels[scope])}
    </span>
  )
}
