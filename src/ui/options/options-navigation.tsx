import {
  AlignRight,
  Keyboard,
  ListChecks,
  Settings,
  SlidersHorizontal,
  Type
} from "lucide-react"
import React from "react"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "../components/ui/sidebar"
import { Skeleton } from "../components/ui/skeleton"
import { useI18n } from "../i18n"
import type { MessageKey } from "../i18n/messages"

export type SettingsSection =
  | "general"
  | "fonts"
  | "sites"
  | "rtl"
  | "hotkeys"
  | "advanced"

export type SiteSettingsTab = "access" | "profiles" | "optimized"

export const settingsNavigation: Array<{
  id: SettingsSection
  labelKey: MessageKey
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "general", labelKey: "options.nav.general", icon: Settings },
  { id: "fonts", labelKey: "options.nav.fonts", icon: Type },
  { id: "sites", labelKey: "options.nav.sites", icon: ListChecks },
  { id: "rtl", labelKey: "options.nav.rtl", icon: AlignRight },
  { id: "hotkeys", labelKey: "options.nav.hotkeys", icon: Keyboard },
  { id: "advanced", labelKey: "options.nav.advanced", icon: SlidersHorizontal }
]

export const sectionDescriptionKeys: Record<SettingsSection, MessageKey> = {
  general: "options.section.general.description",
  fonts: "options.section.fonts.description",
  sites: "options.section.sites.description",
  rtl: "options.section.rtl.description",
  hotkeys: "options.section.hotkeys.description",
  advanced: "options.section.advanced.description"
}

export const OPTIONS_LOADING_CARD_IDS = ["fonts", "sites", "styles", "rtl"]

export function getSettingsSectionFromHash(): SettingsSection {
  const hashSection = window.location.hash.replace(/^#/, "")
  return settingsNavigation.some((item) => item.id === hashSection)
    ? (hashSection as SettingsSection)
    : "general"
}

export function OptionsLoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 md:grid-cols-4">
        {OPTIONS_LOADING_CARD_IDS.map((id) => (
          <Skeleton key={id} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export function SettingsNavigation({
  activeSection,
  onSectionChange
}: {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}) {
  const { t } = useI18n()
  const { isMobile, setOpenMobile } = useSidebar()
  const buttonRefs = React.useRef(new Map<SettingsSection, HTMLButtonElement>())

  const selectSection = (section: SettingsSection, closeMobile: boolean) => {
    onSectionChange(section)
    if (closeMobile && isMobile) {
      setOpenMobile(false)
    }
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null

    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % settingsNavigation.length
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + settingsNavigation.length) % settingsNavigation.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = settingsNavigation.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextSection = settingsNavigation[nextIndex].id
    selectSection(nextSection, true)
    buttonRefs.current.get(nextSection)?.focus()
  }

  return (
    <SidebarContent
      role="navigation"
      aria-label={t("options.sidebar.navigation")}
      className="px-3 py-4">
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="mb-2 px-3 text-[0.6875rem] font-bold tracking-wide text-slate-400">
          {t("options.sidebar.sections")}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu
            role="tablist"
            aria-orientation="vertical"
            className="gap-1.5">
            {settingsNavigation.map((item, index) => {
              const Icon = item.icon
              const active = activeSection === item.id

              return (
                <SidebarMenuItem key={item.id} role="presentation">
                  <SidebarMenuButton
                    ref={(node) => {
                      if (node) {
                        buttonRefs.current.set(item.id, node)
                      } else {
                        buttonRefs.current.delete(item.id)
                      }
                    }}
                    role="tab"
                    id={`fontara-options-tab-${item.id}`}
                    aria-controls="fontara-options-panel"
                    aria-current={active ? "page" : undefined}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    isActive={active}
                    className="fontara-nav-button"
                    data-testid={`fontara-options-nav-${item.id}`}
                    tooltip={t(item.labelKey)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    onClick={() => selectSection(item.id, true)}>
                    <span className="fontara-nav-icon">
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                    </span>
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t(item.labelKey)}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
