export function urlPatternToRegex(pattern: string): RegExp {
  return new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\//g, "\\/") + "$"
  )
}
