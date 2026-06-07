import type { RtlSiteId } from "../../config/rtl-sites"
import { getRtlActivationState } from "../../utils/rtl"
import { RtlAutoDirection } from "./auto-direction"
import { createRtlSiteAdapter, type RtlSiteAdapter } from "./site-adapters"

let activeAdapter: RtlSiteAdapter | null = null
let activeSiteId: RtlSiteId | null = null
let applyRtlQueued = false
let applyRtlRunning = false
let disposed = false

const autoDirection = new RtlAutoDirection()

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function disableCurrentRtl(): void {
  activeAdapter?.disable()
  autoDirection.disable()
}

function disposeCurrentAdapter(): void {
  activeAdapter?.dispose()
  activeAdapter = null
  activeSiteId = null
}

async function applyRtlIfActive(): Promise<void> {
  if (disposed) return

  try {
    const activationState = await getRtlActivationState(window.location.href)

    if (!activationState.active || !activationState.matchingSite) {
      disableCurrentRtl()
      return
    }

    if (activeSiteId !== activationState.matchingSite.id) {
      disposeCurrentAdapter()
      activeAdapter = createRtlSiteAdapter(activationState.matchingSite.id)
      activeSiteId = activationState.matchingSite.id
    }

    activeAdapter?.enable()
    autoDirection.enable()
  } catch (error) {
    disableCurrentRtl()
    debugWarn("Failed to apply FontAra RTL support.", error)
  }
}

async function flushScheduledRtl(): Promise<void> {
  if (applyRtlRunning) {
    applyRtlQueued = true
    return
  }

  applyRtlRunning = true
  try {
    do {
      applyRtlQueued = false
      await applyRtlIfActive()
    } while (applyRtlQueued && !disposed)
  } finally {
    applyRtlRunning = false
  }
}

export function scheduleApplyRtlIfActive(): void {
  if (disposed) return
  if (applyRtlQueued) return

  applyRtlQueued = true
  queueMicrotask(() => {
    if (!disposed) {
      void flushScheduledRtl()
    }
  })
}

export function pauseRtlSupport(): void {
  if (!disposed) {
    disableCurrentRtl()
  }
}

export function cleanupRtlSupport(): void {
  if (disposed) return

  disposed = true
  applyRtlQueued = false
  disableCurrentRtl()
  disposeCurrentAdapter()
  autoDirection.dispose()
}
