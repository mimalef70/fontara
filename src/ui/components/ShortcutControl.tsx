import { ExternalLink } from "lucide-react"
import * as React from "react"

import { cn } from "../../utils/cn"
import { useI18n } from "../i18n"
import { Button } from "./ui/button"

export type ShortcutCommandName = "toggle" | "addSite"

type ShortcutControlProps = {
  commandName: ShortcutCommandName
  defaultLabel: string
  defaultShortcut: string
  description: string
  onShortcutChanged: () => Promise<void>
  onShortcutError: () => void
  onShortcutUpdated: () => void
  shortcut: string | null
  title: string
}

function isFirefoxBrowser(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox")
}

function isEdgeBrowser(): boolean {
  return navigator.userAgent.toLowerCase().includes("edg/")
}

function getShortcutSettingsURL(commandName: ShortcutCommandName): string {
  if (isEdgeBrowser()) {
    return "edge://extensions/shortcuts"
  }

  return `chrome://extensions/configureCommands#command-${chrome.runtime.id}-${commandName}`
}

function getShortcutKey(
  event: Pick<KeyboardEvent, "code" | "key">
): string | null {
  const namedKeys: Record<string, string> = {
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    Delete: "Delete",
    End: "End",
    Home: "Home",
    Insert: "Insert",
    PageDown: "PageDown",
    PageUp: "PageUp",
    Space: "Space"
  }

  if (event.key === ".") return "Period"
  if (event.key === ",") return "Comma"
  if (event.key === " " || event.code === "Space") return "Space"
  if (/^F(?:[1-9]|1[0-2])$/.test(event.key)) return event.key
  if (namedKeys[event.key]) return namedKeys[event.key]
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5, 6)
  if (!/^Key[A-Z]$/.test(event.code)) return null

  if (/^[A-Za-z]$/.test(event.key)) {
    return event.key.toUpperCase()
  }

  return event.code.slice(3)
}

type ShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "key" | "metaKey" | "ctrlKey" | "shiftKey"
>

function formatShortcutParts(parts: {
  alt: boolean
  command: boolean
  ctrl: boolean
  key: string | null
  shift: boolean
}): string {
  return `${parts.ctrl ? "Ctrl+" : ""}${parts.alt ? "Alt+" : ""}${
    parts.command ? "Command+" : ""
  }${parts.shift ? "Shift+" : ""}${parts.key ?? ""}`
}

export function getFirefoxShortcutFromKeyboardEvent(
  event: ShortcutKeyboardEvent,
  isMac = isMacBrowser()
): string | null {
  const key = getShortcutKey(event)
  if (!key) return null

  if (event.metaKey && !isMac) return null

  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push(isMac ? "MacCtrl" : "Ctrl")
  if (event.altKey) modifiers.push("Alt")
  if (event.metaKey) modifiers.push("Command")
  if (event.shiftKey) modifiers.push("Shift")
  const primaryModifierCount =
    Number(event.ctrlKey) + Number(event.altKey) + Number(event.metaKey)

  if (modifiers.length === 0 && /^F(?:[1-9]|1[0-2])$/.test(key)) {
    return key
  }

  if (
    primaryModifierCount === 0 ||
    modifiers.length === 0 ||
    modifiers.length > 2
  ) {
    return null
  }

  return [...modifiers, key].join("+")
}

export function isShortcutEditingExitKey(key: string): boolean {
  return key === "Escape" || key === "Tab"
}

function isMacBrowser(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.platform)
}

function formatShortcutForDisplay(shortcut: string): string {
  if (!isMacBrowser()) return shortcut

  return shortcut
    .split("+")
    .map((part) => {
      switch (part) {
        case "Alt":
          return "⌥"
        case "Command":
          return "⌘"
        case "Ctrl":
        case "MacCtrl":
          return "⌃"
        case "Shift":
          return "⇧"
        default:
          return part
      }
    })
    .join("")
}

async function setFirefoxShortcut(
  commandName: ShortcutCommandName,
  shortcut: string
): Promise<string | null> {
  if (
    typeof browser === "undefined" ||
    !browser.commands?.update ||
    !browser.commands?.getAll
  ) {
    return null
  }

  try {
    await browser.commands.update({ name: commandName, shortcut })
  } catch {
    return null
  }

  const commands = await browser.commands.getAll()
  const actualShortcut =
    commands.find((command) => command.name === commandName)?.shortcut ?? null

  return actualShortcut === shortcut ? actualShortcut : null
}

export function ShortcutControl({
  commandName,
  defaultLabel,
  defaultShortcut,
  description,
  onShortcutChanged,
  onShortcutError,
  onShortcutUpdated,
  shortcut,
  title
}: ShortcutControlProps) {
  const { t } = useI18n()
  const descriptionId = `fontara-shortcut-description-${commandName}`
  const editingHintId = `fontara-shortcut-editing-hint-${commandName}`
  const statusId = `fontara-shortcut-status-${commandName}`
  const [editing, setEditing] = React.useState(false)
  const [draftShortcut, setDraftShortcut] = React.useState("...")
  const modifierStateRef = React.useRef({
    alt: false,
    command: false,
    ctrl: false,
    key: null as string | null,
    shift: false
  })

  React.useEffect(() => {
    if (!editing) return

    let active = true
    const updateDraftShortcut = () => {
      setDraftShortcut(formatShortcutParts(modifierStateRef.current) || "...")
    }
    const finishShortcut = (nextShortcut: string) => {
      active = false
      setEditing(false)
      void setFirefoxShortcut(commandName, nextShortcut)
        .then(async (actualShortcut) => {
          await onShortcutChanged()
          if (actualShortcut) {
            onShortcutUpdated()
          } else {
            onShortcutError()
          }
        })
        .catch(() => {
          onShortcutError()
        })
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isShortcutEditingExitKey(event.key)) {
        active = false
        setEditing(false)
        return
      }

      const nextState = {
        alt: event.altKey,
        command: event.metaKey,
        ctrl: event.ctrlKey,
        key: getShortcutKey(event),
        shift: event.shiftKey
      }
      modifierStateRef.current = nextState
      updateDraftShortcut()

      const nextShortcut = getFirefoxShortcutFromKeyboardEvent(event)
      if (!nextShortcut) return

      event.preventDefault()
      finishShortcut(nextShortcut)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!active) return

      const nextState = { ...modifierStateRef.current }
      if (event.key === "Control") {
        nextState.ctrl = false
      } else if (event.key === "Alt") {
        nextState.alt = false
      } else if (event.key === "Command" || event.key === "Meta") {
        nextState.command = false
      } else if (event.key === "Shift") {
        nextState.shift = false
      } else {
        nextState.key = null
      }
      modifierStateRef.current = nextState
      updateDraftShortcut()
    }
    const handleBlur = () => {
      if (active) {
        active = false
        setEditing(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown, {
      capture: true,
      passive: false
    })
    window.addEventListener("keyup", handleKeyUp, {
      capture: true,
      passive: false
    })
    window.addEventListener("blur", handleBlur, { capture: true, once: true })

    return () => {
      active = false
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
      window.removeEventListener("keyup", handleKeyUp, { capture: true })
      window.removeEventListener("blur", handleBlur, { capture: true })
    }
  }, [
    commandName,
    editing,
    onShortcutChanged,
    onShortcutError,
    onShortcutUpdated
  ])

  const isFirefox = isFirefoxBrowser()

  const handleClick = () => {
    if (isFirefox) {
      if (editing) {
        setEditing(false)
        return
      }

      modifierStateRef.current = {
        alt: false,
        command: false,
        ctrl: false,
        key: null,
        shift: false
      }
      setDraftShortcut("...")
      setEditing(true)
      return
    }

    void chrome.tabs.create({
      active: true,
      url: getShortcutSettingsURL(commandName)
    })
  }

  const visibleShortcut = shortcut || defaultShortcut
  const shortcutLabel = editing
    ? draftShortcut
    : formatShortcutForDisplay(visibleShortcut)
  const rawShortcutLabel = editing ? draftShortcut : visibleShortcut
  const shortcutIsDefault = !editing && !shortcut
  const buttonLabel = editing
    ? t("options.hotkeys.editingAria", { title })
    : t("options.hotkeys.setShortcutAria", {
        shortcut: rawShortcutLabel,
        title
      })

  return (
    <div className="rounded-md border border-[#e8eef6] bg-white p-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        aria-label={buttonLabel}
        aria-describedby={`${descriptionId}${
          editing ? ` ${editingHintId}` : ""
        }`}
        aria-pressed={isFirefox ? editing : undefined}
        className={cn(
          "h-12 w-full rounded-md border border-[#d6e4f5] bg-[#fbfdff] px-4 text-[#111827] shadow-none hover:border-[#bfd3ef] hover:bg-white",
          editing && "border-[#175cd3] bg-white text-[#175cd3]"
        )}>
        <span
          id={statusId}
          aria-atomic="true"
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-center font-mono text-base font-bold tracking-normal">
          {shortcutLabel}
        </span>
        {shortcutIsDefault && (
          <span className="rounded-sm bg-[#eaf2ff] px-2 py-1 text-[0.65rem] font-medium text-[#175cd3]">
            {defaultLabel}
          </span>
        )}
        {!isFirefox && <ExternalLink aria-hidden="true" className="size-3.5" />}
      </Button>
      <div className="mt-3 text-center">
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        <p id={descriptionId} className="mt-1 text-xs leading-5 text-[#667085]">
          {description}
        </p>
        {editing && (
          <p
            id={editingHintId}
            className="mt-1 text-[0.7rem] leading-4 text-[#475467]">
            {t("options.hotkeys.editingHint")}
          </p>
        )}
        {shortcutIsDefault && (
          <p className="mt-1 text-[0.7rem] leading-4 text-[#64748b]">
            {defaultLabel}: {rawShortcutLabel}
          </p>
        )}
      </div>
    </div>
  )
}
