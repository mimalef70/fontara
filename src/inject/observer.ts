import { applyFontToTree } from "./dom-processor"

let observer: MutationObserver | null = null

export function startObserving(): void {
  stopObserving()

  if (!document.body) return

  observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue

      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          applyFontToTree(node)
        }
      }
    }
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true
  })
}

export function stopObserving(): void {
  if (!observer) return

  observer.disconnect()
  observer = null
}
