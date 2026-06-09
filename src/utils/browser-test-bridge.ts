import type { FontaraUIMessage } from "../definitions"
import { isFontaraUIMessage } from "./message"

export const FONTARA_BROWSER_TEST_PAGE_REQUEST =
  "fontara-browser-test-page-request"
export const FONTARA_BROWSER_TEST_PAGE_RESPONSE =
  "fontara-browser-test-page-response"
export const FONTARA_BROWSER_TEST_PAGE_PING = "fontara-browser-test-page-ping"
export const FONTARA_BROWSER_TEST_RELAY_MESSAGE =
  "fontara-browser-test-relay-ui-message"

export type FontaraBrowserTestPagePing = {
  requestId: string
  type: typeof FONTARA_BROWSER_TEST_PAGE_PING
}

export type FontaraBrowserTestPageRequest = {
  message: FontaraUIMessage
  requestId: string
  type: typeof FONTARA_BROWSER_TEST_PAGE_REQUEST
}

export type FontaraBrowserTestPageResponse = {
  error?: string
  requestId: string
  response?: unknown
  type: typeof FONTARA_BROWSER_TEST_PAGE_RESPONSE
}

export type FontaraBrowserTestRelayMessage = {
  data: {
    message: FontaraUIMessage
  }
  type: typeof FONTARA_BROWSER_TEST_RELAY_MESSAGE
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isFontaraBrowserTestPageRequest(
  value: unknown
): value is FontaraBrowserTestPageRequest {
  return (
    isRecord(value) &&
    value.type === FONTARA_BROWSER_TEST_PAGE_REQUEST &&
    typeof value.requestId === "string" &&
    isFontaraUIMessage(value.message)
  )
}

export function isFontaraBrowserTestPagePing(
  value: unknown
): value is FontaraBrowserTestPagePing {
  return (
    isRecord(value) &&
    value.type === FONTARA_BROWSER_TEST_PAGE_PING &&
    typeof value.requestId === "string"
  )
}

export function createFontaraBrowserTestPageResponse(
  requestId: string,
  response: unknown
): FontaraBrowserTestPageResponse {
  return {
    requestId,
    response,
    type: FONTARA_BROWSER_TEST_PAGE_RESPONSE
  }
}

export function createFontaraBrowserTestPageErrorResponse(
  requestId: string,
  error: string
): FontaraBrowserTestPageResponse {
  return {
    error,
    requestId,
    type: FONTARA_BROWSER_TEST_PAGE_RESPONSE
  }
}

export function createFontaraBrowserTestRelayMessage(
  message: FontaraUIMessage
): FontaraBrowserTestRelayMessage {
  return {
    data: {
      message
    },
    type: FONTARA_BROWSER_TEST_RELAY_MESSAGE
  }
}

export function isFontaraBrowserTestRelayMessage(
  value: unknown
): value is FontaraBrowserTestRelayMessage {
  return (
    isRecord(value) &&
    value.type === FONTARA_BROWSER_TEST_RELAY_MESSAGE &&
    isRecord(value.data) &&
    isFontaraUIMessage(value.data.message)
  )
}
