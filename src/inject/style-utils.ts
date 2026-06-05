export function getStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

export function upsertStyle(id: string, textContent: string): HTMLStyleElement {
  let styleElement = document.getElementById(id) as HTMLStyleElement | null

  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = id
    getStyleHost().appendChild(styleElement)
  }

  if (styleElement.textContent !== textContent) {
    styleElement.textContent = textContent
  }

  return styleElement
}

export function removeStyle(id: string): void {
  document.getElementById(id)?.remove()
}
