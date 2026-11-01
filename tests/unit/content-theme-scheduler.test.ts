import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { afterEach } from "node:test"

import type {
  FontaraContentCommandOrder,
  FontaraPageThemeCommandData
} from "../../src/definitions"

type CssModuleLoader = (module: { exports: string }) => void
type RequireWithCssExtensions = {
  extensions: Record<string, CssModuleLoader | undefined>
}

const require = createRequire(import.meta.url)
const requireWithCssExtensions = require as unknown as RequireWithCssExtensions
const originalCSSExtension = requireWithCssExtensions.extensions[".css"]

afterEach(() => {
  requireWithCssExtensions.extensions[".css"] = originalCSSExtension
})

function installCSSModuleMock(): void {
  requireWithCssExtensions.extensions[".css"] = (module) => {
    module.exports = ""
  }
}

function commandOrder(
  dispatcherId: string,
  sequence: number,
  settingsRevision: number
): FontaraContentCommandOrder {
  return { dispatcherId, sequence, settingsRevision }
}

function pageTheme(fontName: string): FontaraPageThemeCommandData {
  return {
    font: {
      active: true,
      applyMode: "full",
      customCSS: null,
      customFontFamilyRevision: null,
      customFontFamilyValue: null,
      fontFaceCSS: "",
      fontName,
      googleFontCSS: null,
      textStrokeCSS: ""
    },
    rtl: { active: false, siteId: null }
  }
}

test("content command ordering rejects stale, repeated, and retired dispatches", async () => {
  installCSSModuleMock()
  const { createContentCommandOrderTracker } = await import(
    "../../src/inject/content-theme-scheduler"
  )
  const tracker = createContentCommandOrderTracker()

  assert.equal(tracker.accept(), true, "legacy startup remains compatible")
  assert.equal(tracker.accept(commandOrder("worker-a", 1, 3)), true)
  assert.equal(tracker.accept(commandOrder("worker-a", 1, 3)), false)
  assert.equal(tracker.accept(commandOrder("worker-a", 2, 2)), false)
  assert.equal(tracker.accept(commandOrder("worker-a", 2, 3)), true)
  assert.equal(
    tracker.accept(),
    false,
    "legacy commands cannot bypass ordering"
  )

  assert.equal(tracker.accept(commandOrder("worker-b", 1, 3)), true)
  assert.equal(
    tracker.accept(commandOrder("worker-a", 99, 4)),
    false,
    "a delayed command from a retired worker cannot take control again"
  )
  assert.equal(tracker.accept(commandOrder("worker-c", 1, 2)), false)
  assert.equal(tracker.accept(commandOrder("worker-c", 1, 4)), true)
})

test("local fallback is consumed exactly once by an equivalent background command", async () => {
  installCSSModuleMock()
  const { createLocalThemeDuplicateGuard } = await import(
    "../../src/inject/content-theme-scheduler"
  )
  const guard = createLocalThemeDuplicateGuard()
  const firstTheme = pageTheme("First Font")
  const secondTheme = pageTheme("Second Font")

  guard.recordLocal(firstTheme)
  assert.equal(guard.consumeBackground(firstTheme), true)
  assert.equal(guard.consumeBackground(firstTheme), false)

  guard.recordLocal(firstTheme)
  assert.equal(guard.consumeBackground(secondTheme), false)
  assert.equal(guard.consumeBackground(firstTheme), false)

  const cleanUpTheme: FontaraPageThemeCommandData = {
    font: { ...firstTheme.font, active: false },
    rtl: { active: false, siteId: null }
  }
  guard.recordLocal(cleanUpTheme)
  assert.equal(guard.consumeBackground(), true)

  guard.recordLocal(firstTheme)
  guard.clear()
  assert.equal(guard.consumeBackground(firstTheme), false)
})
