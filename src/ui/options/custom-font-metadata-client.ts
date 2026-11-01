import type { CustomFontFormat } from "../../custom-font-types"
import type {
  CustomFontExtractedMetadata,
  CustomFontMetadataWorkerRequest,
  CustomFontMetadataWorkerResponse
} from "./custom-font-metadata-types"

const METADATA_WORKER_PATH = "ui/options/custom-font-metadata-worker.js"
const METADATA_TIMEOUT_MS = 10_000

type PendingRequest = {
  reject: (error: Error) => void
  resolve: (metadata: CustomFontExtractedMetadata) => void
  timeout: number
}

let worker: Worker | null = null
const pending = new Map<string, PendingRequest>()

function rejectPending(error: Error): void {
  for (const request of pending.values()) {
    window.clearTimeout(request.timeout)
    request.reject(error)
  }
  pending.clear()
}

function disposeWorker(error?: Error): void {
  worker?.terminate()
  worker = null
  if (error) rejectPending(error)
}

function createWorker(): Worker {
  const nextWorker = new Worker(chrome.runtime.getURL(METADATA_WORKER_PATH))
  nextWorker.addEventListener(
    "message",
    (event: MessageEvent<CustomFontMetadataWorkerResponse>) => {
      const response = event.data
      const request = pending.get(response.id)
      if (!request) return
      pending.delete(response.id)
      window.clearTimeout(request.timeout)
      if (response.ok) request.resolve(response.metadata)
      else request.reject(new Error(response.error))
    }
  )
  nextWorker.addEventListener("error", () => {
    disposeWorker(new Error("custom-font-metadata-worker-failed"))
  })
  return nextWorker
}

function getWorker(): Worker {
  worker ??= createWorker()
  return worker
}

export function extractCustomFontMetadata(
  fileName: string,
  bytes: ArrayBuffer
): Promise<CustomFontExtractedMetadata> {
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id)
      disposeWorker(new Error("custom-font-metadata-timeout"))
      reject(new Error("custom-font-metadata-timeout"))
    }, METADATA_TIMEOUT_MS)
    pending.set(id, { reject, resolve, timeout })
    const request: CustomFontMetadataWorkerRequest = { id, bytes, fileName }
    getWorker().postMessage(request, [bytes])
  })
}

export async function validateCustomFontWithNativeFontFace(
  bytes: ArrayBuffer,
  format: CustomFontFormat
): Promise<void> {
  if (typeof FontFace !== "function") {
    throw new Error("font-face-api-unavailable")
  }
  const alias = `FontaraValidation-${crypto.randomUUID()}`
  const fontFace = new FontFace(alias, bytes, {
    display: "block",
    style: "normal",
    weight: "400"
  })
  await fontFace.load()
  if (fontFace.status !== "loaded") {
    throw new Error(`invalid-${format}-font`)
  }
}

export function terminateCustomFontMetadataWorker(): void {
  disposeWorker()
}
