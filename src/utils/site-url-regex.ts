export function createRegexFromUrl(url: string): string {
  try {
    const parsedURL = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`
    )
    const escapedHost = parsedURL.host
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return `^https?://${escapedHost}(?:[/?#].*)?$`
  } catch {
    return url
  }
}
