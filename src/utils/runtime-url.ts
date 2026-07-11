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
