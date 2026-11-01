/// <reference lib="webworker" />

import { extractCustomFontMetadataFromBytes } from "./custom-font-metadata"
import type {
  CustomFontMetadataWorkerRequest,
  CustomFontMetadataWorkerResponse
} from "./custom-font-metadata-types"

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

self.addEventListener(
  "message",
  (event: MessageEvent<CustomFontMetadataWorkerRequest>) => {
    const request = event.data
    let response: CustomFontMetadataWorkerResponse
    try {
      if (
        !request ||
        typeof request.id !== "string" ||
        typeof request.fileName !== "string" ||
        !(request.bytes instanceof ArrayBuffer)
      ) {
        throw new Error("invalid-font-metadata-request")
      }
      response = {
        id: request.id,
        ok: true,
        metadata: extractCustomFontMetadataFromBytes(
          new Uint8Array(request.bytes)
        )
      }
    } catch (error) {
      response = {
        id: request?.id ?? "",
        ok: false,
        error: getErrorMessage(error)
      }
    }
    self.postMessage(response)
  }
)
