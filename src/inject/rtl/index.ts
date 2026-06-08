import type { RtlSiteId } from "../../config/rtl-sites"
import type { FontaraRtlThemeCommandData } from "../../definitions"
import { RtlAutoDirection } from "./auto-direction"
import { createRtlSiteAdapter, type RtlSiteAdapter } from "./site-adapters"

let activeAdapter: RtlSiteAdapter | null = null
let activeSiteId: RtlSiteId | null = null
let disposed = false

const autoDirection = new RtlAutoDirection()

function disableCurrentRtl(): void {
  activeAdapter?.disable()
  autoDirection.disable()
}

function disposeCurrentAdapter(): void {
  activeAdapter?.dispose()
  activeAdapter = null
  activeSiteId = null
}

export function applyResolvedRtlSupport(
  data: FontaraRtlThemeCommandData
): void {
  if (disposed) return

  if (!data.active || !data.siteId) {
    disableCurrentRtl()
    return
  }

  if (activeSiteId !== data.siteId) {
    disposeCurrentAdapter()
    activeAdapter = createRtlSiteAdapter(data.siteId)
    activeSiteId = data.siteId
  }

  activeAdapter?.enable()
  autoDirection.enable()
}

export function pauseRtlSupport(): void {
  if (!disposed) {
    disableCurrentRtl()
  }
}

export function cleanupRtlSupport(): void {
  if (disposed) return

  disposed = true
  disableCurrentRtl()
  disposeCurrentAdapter()
  autoDirection.dispose()
}
