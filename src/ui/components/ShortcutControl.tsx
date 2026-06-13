import { ExternalLink } from "lucide-react"
import * as React from "react"

import { cn } from "../../utils/cn"
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

function getShortcutKey(event: KeyboardEvent): string | null {
  if (event.key === ".") return "Period"
  if (event.key === ",") return "Comma"
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5, 6)
  if (!/^Key[A-Z]$/.test(event.code)) return null

  if (/^[A-Za-z]$/.test(event.key)) {
    return event.key.toUpperCase()
  }

  return event.code.slice(3)
}

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
  } catch {}

  const commands = await browser.commands.getAll()
  return (
    commands.find((command) => command.name === commandName)?.shortcut ?? null
  )
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
  const [editing, setEditing] = React.useState(false)
  const [draftShortcut, setDraftShortcut] = React.useState("...")
  const buttonRef = React.useRef<HTMLButtonElement>(null)
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
      buttonRef.current?.blur()
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
      event.preventDefault()
      const nextState = {
        alt: event.altKey,
        command: event.metaKey,
        ctrl: event.ctrlKey,
        key: getShortcutKey(event),
        shift: event.shiftKey
      }
      modifierStateRef.current = nextState
      updateDraftShortcut()

      if (
        (nextState.alt ||
          nextState.command ||
          nextState.ctrl ||
          nextState.shift) &&
        nextState.key
      ) {
        finishShortcut(formatShortcutParts(nextState))
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
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

  return (
    <div className="space-y-2">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        onClick={handleClick}
        aria-label={title}
        className={cn(
          "h-14 w-full rounded-[3px] border-2 border-[#2f86a0] bg-[#f8fbff] px-4 text-[#111827] shadow-none hover:bg-[#eef7fb]",
          editing && "border-[#2374ff] text-[#2374ff]"
        )}>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-lg font-bold tracking-normal">
          {shortcutLabel}
        </span>
        {shortcutIsDefault && (
          <span className="rounded-sm bg-[#eaf2ff] px-2 py-1 text-[0.65rem] font-medium text-[#2374ff]">
            {defaultLabel}
          </span>
        )}
        {!isFirefox && <ExternalLink className="size-3.5" />}
      </Button>
      <div className="text-center">
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[#2f86a0]">{description}</p>
        {shortcutIsDefault && (
          <p className="mt-1 text-[0.7rem] leading-4 text-[#64748b]">
            {defaultLabel}: {rawShortcutLabel}
          </p>
        )}
      </div>
    </div>
  )
}
