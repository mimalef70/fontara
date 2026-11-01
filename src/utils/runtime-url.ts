/**
 * Keeps only the page identity needed by FontARA at runtime. Credentials,
 * query parameters, and fragments can contain secrets and are never retained.
 */
export function sanitizeRuntimePageURL(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null

  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    url.username = ""
    url.password = ""
    url.search = ""
    url.hash = ""
    url.hostname = url.hostname.toLowerCase()
    return url.href
  } catch {
    return null
  }
}

const RELATED_FRAME_PROTOCOLS = new Set([
  "about:",
  "blob:",
  "data:",
  "filesystem:"
])

/**
 * Resolves the HTTP(S) page identity inherited by a related frame.
 *
 * The content script uses this only for non-HTTP documents. A browser-provided
 * referrer preserves path-scoped settings. When ancestorOrigins is available,
 * it additionally constrains that referrer to the inherited origin; Firefox
 * versions without ancestorOrigins fall back to the already-sanitized
 * referrer. The background still authenticates message URLs independently.
 */
export function getRelatedFrameRuntimePageURL(
  locationHref = typeof location === "undefined" ? "" : location.href,
  referrer = typeof document === "undefined" ? "" : document.referrer,
  ancestorOrigin = typeof location === "undefined"
    ? undefined
    : location.ancestorOrigins?.[0]
): string | null {
  let protocol: string
  try {
    protocol = new URL(locationHref).protocol
  } catch {
    return null
  }
  if (!RELATED_FRAME_PROTOCOLS.has(protocol)) return null

  const sanitizedReferrer = sanitizeRuntimePageURL(referrer)
  const sanitizedAncestorOrigin = sanitizeRuntimePageURL(ancestorOrigin)
  if (!sanitizedAncestorOrigin) return sanitizedReferrer

  if (sanitizedReferrer) {
    try {
      if (
        new URL(sanitizedReferrer).origin ===
        new URL(sanitizedAncestorOrigin).origin
      ) {
        return sanitizedReferrer
      }
    } catch {}
  }

  return sanitizedAncestorOrigin
}
