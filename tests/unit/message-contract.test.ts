import assert from "node:assert/strict"
import test from "node:test"

import type { FontaraExtensionData } from "../../src/definitions"
import {
  createFontaraBrowserTestPageErrorResponse,
  createFontaraBrowserTestPageResponse,
  createFontaraBrowserTestRelayMessage,
  FONTARA_BROWSER_TEST_PAGE_PING,
  FONTARA_BROWSER_TEST_PAGE_REQUEST,
  isFontaraBrowserTestPagePing,
  isFontaraBrowserTestPageRequest,
  isFontaraBrowserTestRelayMessage
} from "../../src/utils/browser-test-bridge"
import {
  createFontaraBackgroundChangesMessage,
  createFontaraMessageErrorResponse,
  createFontaraMessageResponse,
  isFontaraBackgroundMessage,
  isFontaraContentScriptMessage,
  isFontaraUIMessage,
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG,
  MESSAGE_TYPES_UI_TO_BG
} from "../../src/utils/message"

const extensionData: FontaraExtensionData = {
  activeTab: {
    favIconUrl: null,
    id: 1,
    isActive: true,
    isSupported: true,
    url: "https://example.com/"
  },
  isReady: true,
  settings: {
    selectedFont: "Vazirmatn-Fontara"
  },
  shortcuts: {
    toggle: "Alt+Shift+F"
  }
}

test("runtime message contract validates UI requests", () => {
  assert.equal(
    isFontaraUIMessage({ type: MESSAGE_TYPES_UI_TO_BG.GET_DATA }),
    true
  )
  assert.equal(
    isFontaraUIMessage({
      data: { selectedFont: "Estedad-Fontara" },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    }),
    true
  )
  assert.equal(
    isFontaraUIMessage({
      data: { command: "addSite", url: "https://example.com/" },
      type: MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND
    }),
    true
  )
  assert.equal(
    isFontaraUIMessage({
      data: { command: "toggle", url: null },
      type: MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND
    }),
    true
  )

  assert.equal(
    isFontaraUIMessage({
      type: "fontara-ui-bg-unknown"
    }),
    false
  )
  assert.equal(
    isFontaraUIMessage({
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    }),
    false
  )
  assert.equal(
    isFontaraUIMessage({
      data: { url: "https://example.com/" },
      type: MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND
    }),
    false
  )
  assert.equal(
    isFontaraUIMessage({
      data: { command: "addSite", url: 42 },
      type: MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND
    }),
    false
  )
})

test("runtime message contract validates content lifecycle requests", () => {
  assert.equal(
    isFontaraContentScriptMessage({
      data: {
        isTopFrame: true,
        url: "https://example.com/"
      },
      scriptId: "script-1",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    }),
    true
  )

  assert.equal(
    isFontaraContentScriptMessage({
      scriptId: "script-1",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    }),
    false
  )
  assert.equal(
    isFontaraContentScriptMessage({
      data: {
        isTopFrame: true,
        url: "https://example.com/"
      },
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    }),
    false
  )
  assert.equal(
    isFontaraContentScriptMessage({
      data: {
        isTopFrame: true,
        url: "https://example.com/"
      },
      scriptId: "script-1",
      type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
    }),
    false
  )
})

test("runtime message contract creates background responses", () => {
  const changesMessage = createFontaraBackgroundChangesMessage(extensionData)

  assert.equal(isFontaraBackgroundMessage(changesMessage), true)
  assert.equal(
    isFontaraBackgroundMessage({ ...changesMessage, data: null }),
    false
  )
  assert.deepEqual(createFontaraMessageResponse(true), { data: true })
  assert.deepEqual(createFontaraMessageErrorResponse("boom"), { error: "boom" })
})

test("browser test bridge validates wrapped UI messages", () => {
  const uiMessage = {
    data: { selectedFont: "Samim-Fontara" },
    type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
  } as const
  const relayMessage = createFontaraBrowserTestRelayMessage(uiMessage)

  assert.equal(isFontaraBrowserTestRelayMessage(relayMessage), true)
  assert.equal(
    isFontaraBrowserTestRelayMessage({
      ...relayMessage,
      data: { message: { type: "unknown" } }
    }),
    false
  )
  assert.equal(
    isFontaraBrowserTestPageRequest({
      message: uiMessage,
      requestId: "request-1",
      type: FONTARA_BROWSER_TEST_PAGE_REQUEST
    }),
    true
  )
  assert.equal(
    isFontaraBrowserTestPageRequest({
      message: { type: "unknown" },
      requestId: "request-1",
      type: FONTARA_BROWSER_TEST_PAGE_REQUEST
    }),
    false
  )
  assert.equal(
    isFontaraBrowserTestPagePing({
      requestId: "request-1",
      type: FONTARA_BROWSER_TEST_PAGE_PING
    }),
    true
  )
  assert.equal(
    isFontaraBrowserTestPagePing({
      requestId: 1,
      type: FONTARA_BROWSER_TEST_PAGE_PING
    }),
    false
  )
  assert.deepEqual(createFontaraBrowserTestPageResponse("request-1", true), {
    requestId: "request-1",
    response: true,
    type: "fontara-browser-test-page-response"
  })
  assert.deepEqual(
    createFontaraBrowserTestPageErrorResponse("request-1", "boom"),
    {
      error: "boom",
      requestId: "request-1",
      type: "fontara-browser-test-page-response"
    }
  )
})
