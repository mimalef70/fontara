import { cn } from "../../utils/cn"
import { useI18n } from "../i18n"

type SiteModeBadgeProps = {
  className?: string
  customCss?: boolean
}

export function SiteModeBadge({
  className,
  customCss = false
}: SiteModeBadgeProps) {
  const { t } = useI18n()

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-semibold leading-none",
        customCss
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-slate-200 bg-slate-50 text-slate-600",
        className
      )}>
      {t(customCss ? "options.siteMode.customCss" : "options.siteMode.general")}
    </span>
  )
}
