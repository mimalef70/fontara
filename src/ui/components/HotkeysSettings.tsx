import { Info, Keyboard } from "lucide-react"
import * as React from "react"

import { useToast } from "../hooks/use-toast"
import { useI18n } from "../i18n"
import { type ShortcutCommandName, ShortcutControl } from "./ShortcutControl"

type ShortcutMap = Partial<Record<ShortcutCommandName, string>>

const HOTKEY_COMMANDS: Array<{
  commandName: ShortcutCommandName
  defaultShortcut: string
  descriptionKey:
    | "options.hotkeys.toggleExtensionDescription"
    | "options.hotkeys.toggleSiteDescription"
  titleKey:
    | "options.hotkeys.toggleExtensionTitle"
    | "options.hotkeys.toggleSiteTitle"
}> = [
  {
    commandName: "toggle",
    defaultShortcut: "Alt+Shift+F",
    titleKey: "options.hotkeys.toggleExtensionTitle",
    descriptionKey: "options.hotkeys.toggleExtensionDescription"
  },
  {
    commandName: "addSite",
    defaultShortcut: "Alt+Shift+S",
    titleKey: "options.hotkeys.toggleSiteTitle",
    descriptionKey: "options.hotkeys.toggleSiteDescription"
  }
]

function isFirefoxBrowser(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox")
}

function getBrowserCommands(): Promise<chrome.commands.Command[]> {
  if (!chrome.commands?.getAll) {
    return Promise.resolve([])
  }

  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => {
      resolve(commands ?? [])
    })
  })
}

function createShortcutMap(commands: chrome.commands.Command[]): ShortcutMap {
  return commands.reduce<ShortcutMap>((map, command) => {
    if (command.name === "toggle" || command.name === "addSite") {
      map[command.name] = command.shortcut || ""
    }

    return map
  }, {})
}

export function HotkeysSettings() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [shortcuts, setShortcuts] = React.useState<ShortcutMap>({})
  const [commandsAvailable, setCommandsAvailable] = React.useState(true)

  const refreshShortcuts = React.useCallback(async () => {
    const commands = await getBrowserCommands()
    setCommandsAvailable(commands.length > 0)
    setShortcuts(createShortcutMap(commands))
  }, [])

  React.useEffect(() => {
    void refreshShortcuts()

    window.addEventListener("focus", refreshShortcuts)
    return () => {
      window.removeEventListener("focus", refreshShortcuts)
    }
  }, [refreshShortcuts])

  const shortcutHint = isFirefoxBrowser()
    ? t("options.hotkeys.firefoxHint")
    : t("options.hotkeys.chromiumHint")
  const hasMissingShortcuts = HOTKEY_COMMANDS.some(
    (command) => shortcuts[command.commandName] === ""
  )

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#e5e7eb] bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {t("options.hotkeys.title")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              {t("options.hotkeys.description")}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-md bg-[#eaf2ff] text-[#2374ff]">
            <Keyboard className="size-5" />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {HOTKEY_COMMANDS.map((command) => (
            <ShortcutControl
              key={command.commandName}
              commandName={command.commandName}
              defaultLabel={t("options.hotkeys.defaultLabel")}
              defaultShortcut={command.defaultShortcut}
              title={t(command.titleKey)}
              description={t(command.descriptionKey)}
              shortcut={shortcuts[command.commandName] ?? null}
              onShortcutChanged={refreshShortcuts}
              onShortcutUpdated={() =>
                toast({ title: t("options.toast.shortcutUpdated") })
              }
              onShortcutError={() =>
                toast({ title: t("options.toast.shortcutError") })
              }
            />
          ))}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-md border border-[#dbeafe] bg-[#f8fbff] px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[#2374ff]" />
          <p className="text-xs leading-5 text-[#334155]">
            {commandsAvailable
              ? hasMissingShortcuts
                ? t("options.hotkeys.missingDefaultHint")
                : shortcutHint
              : t("options.hotkeys.unavailable")}
          </p>
        </div>
      </section>
    </div>
  )
}
