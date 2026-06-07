import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { isRtlText } from "../../src/inject/rtl/text-direction"

test("RTL runtime is wired as an independent feature", () => {
  const injectSource = fs.readFileSync(
    path.resolve("src/inject/index.ts"),
    "utf8"
  )
  const rtlManagerSource = fs.readFileSync(
    path.resolve("src/inject/rtl/index.ts"),
    "utf8"
  )

  assert.match(injectSource, /scheduleApplyRtlIfActive/)
  assert.match(injectSource, /STORAGE_KEYS\.RTL_ENABLED/)
  assert.match(injectSource, /STORAGE_KEYS\.RTL_SITE_SETTINGS/)
  assert.match(injectSource, /cleanupRtlSupport/)
  assert.match(rtlManagerSource, /getRtlActivationState/)
  assert.match(rtlManagerSource, /createRtlSiteAdapter/)
  assert.match(rtlManagerSource, /RtlAutoDirection/)
})

test("RTL adapters preserve sample platform coverage without font injection", () => {
  const siteAdaptersSource = fs.readFileSync(
    path.resolve("src/inject/rtl/site-adapters.ts"),
    "utf8"
  )
  const autoDirectionSource = fs.readFileSync(
    path.resolve("src/inject/rtl/auto-direction.ts"),
    "utf8"
  )

  for (const siteId of [
    "chatgpt",
    "claude",
    "gemini",
    "copilot",
    "perplexity",
    "deepseek",
    "notebooklm",
    "aistudio",
    "qwen",
    "arena"
  ]) {
    assert.match(siteAdaptersSource, new RegExp(`case "${siteId}"`))
  }

  assert.match(siteAdaptersSource, /\[data-testid="conversation-turn"\]/)
  assert.match(siteAdaptersSource, /fontara-gemini-rtl-list/)
  assert.match(siteAdaptersSource, /createTextWalkerAdapter/)
  assert.match(siteAdaptersSource, /ms-chat-session/)
  assert.match(autoDirectionSource, /EDITABLE_SELECTOR/)
  assert.match(autoDirectionSource, /GEMINI_UI_SKIP/)
  assert.doesNotMatch(siteAdaptersSource, /Vazirmatn/)
  assert.doesNotMatch(siteAdaptersSource, /@font-face/)
})

test("RTL text detection covers Arabic and Hebrew scripts", () => {
  assert.equal(isRtlText("سلام دنیا"), true)
  assert.equal(isRtlText("שלום עולם"), true)
  assert.equal(isRtlText("hello world"), false)
})
