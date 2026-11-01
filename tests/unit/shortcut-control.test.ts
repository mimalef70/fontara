import assert from "node:assert/strict"
import test from "node:test"

import {
  getFirefoxShortcutFromKeyboardEvent,
  isShortcutEditingExitKey
} from "../../src/ui/components/ShortcutControl"

type ShortcutEvent = Parameters<typeof getFirefoxShortcutFromKeyboardEvent>[0]

function createShortcutEvent(
  overrides: Partial<ShortcutEvent> = {}
): ShortcutEvent {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    ...overrides
  }
}

function getShortcut(
  overrides: Partial<ShortcutEvent>,
  isMac = false
): string | null {
  return getFirefoxShortcutFromKeyboardEvent(
    createShortcutEvent(overrides),
    isMac
  )
}

test("Firefox shortcut editing lets Tab and Escape leave the editor", () => {
  assert.equal(isShortcutEditingExitKey("Tab"), true)
  assert.equal(isShortcutEditingExitKey("Escape"), true)
  assert.equal(isShortcutEditingExitKey("Enter"), false)
})

test("Firefox shortcut editing accepts only supported keys with a primary modifier", () => {
  assert.equal(getShortcut({ code: "KeyA", key: "a" }), null)
  assert.equal(getShortcut({ code: "KeyA", key: "A", shiftKey: true }), null)
  assert.equal(getShortcut({ code: "Tab", ctrlKey: true, key: "Tab" }), null)
  assert.equal(getShortcut({ code: "KeyA", ctrlKey: true, key: "a" }), "Ctrl+A")
  assert.equal(
    getShortcut({
      altKey: true,
      code: "KeyF",
      key: "f",
      shiftKey: true
    }),
    "Alt+Shift+F"
  )
  assert.equal(
    getShortcut({ code: "Digit7", key: "7", metaKey: true }, true),
    "Command+7"
  )
  assert.equal(
    getShortcut({ altKey: true, code: "Period", key: "." }),
    "Alt+Period"
  )
  assert.equal(
    getShortcut({
      altKey: true,
      code: "KeyA",
      ctrlKey: true,
      key: "a",
      shiftKey: true
    }),
    null
  )
  assert.equal(getShortcut({ code: "F2", key: "F2" }), "F2")
  assert.equal(
    getShortcut({ code: "ArrowDown", ctrlKey: true, key: "ArrowDown" }),
    "Ctrl+Down"
  )
})
