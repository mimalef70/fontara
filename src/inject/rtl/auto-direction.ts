import { isRtlCharacter, isStrongDirectionalCharacter } from "./text-direction"

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number"
])
const EDITABLE_SELECTOR =
  'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="tel"], input[type="email"], input[type="password"], input[type="number"], [contenteditable]:not([contenteditable="false"])'

const GEMINI_UI_SKIP = [
  '[data-test-id="overflow-container"]',
  '[data-test-id="all-conversations"]',
  '[data-test-id="conversation"]',
  '[data-test-id="chats-expandable-section"]',
  '[data-test-id="notebooks-expandable-section"]',
  "conversations-list",
  "project-sidenav-list",
  "mat-nav-list[gem-sidenav-list]"
].join(", ")

type TrackedEditable = {
  cleanup: () => void
  dirAttr: string | null
  styleDirection: string
  styleTextAlign: string
}

export class RtlAutoDirection {
  private enabled = false
  private observer: MutationObserver | null = null
  private trackedInputs = new Map<HTMLElement, TrackedEditable>()

  enable(): void {
    if (this.enabled) return

    this.enabled = true
    this.scanEditableNodes()
    this.startObserver()
  }

  disable(): void {
    if (!this.enabled) return

    this.enabled = false
    this.stopObserver()
    this.detachAll()
  }

  dispose(): void {
    this.disable()
  }

  private isGeminiHost(): boolean {
    return window.location.hostname === "gemini.google.com"
  }

  private shouldSkipElement(element: Element): boolean {
    return this.isGeminiHost() && Boolean(element.closest(GEMINI_UI_SKIP))
  }

  private isEditable(element: unknown): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false
    if (element instanceof HTMLTextAreaElement) return true
    if (element instanceof HTMLInputElement) {
      return TEXT_INPUT_TYPES.has((element.type || "").toLowerCase())
    }

    return element.matches('[contenteditable]:not([contenteditable="false"])')
  }

  private findFirstStrongChar(value: string): string | null {
    for (const char of value) {
      if (isStrongDirectionalCharacter(char)) return char
    }

    return null
  }

  private extractFromEditable(element: HTMLElement): string | null {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return this.findFirstStrongChar(element.value || "")
    }

    if (element.isContentEditable) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let current = walker.nextNode()

      while (current) {
        const candidate = this.findFirstStrongChar(current.textContent || "")
        if (candidate) return candidate
        current = walker.nextNode()
      }
    }

    return null
  }

  private detectDirection(firstChar: string | null): "ltr" | "rtl" {
    if (!firstChar) return "ltr"

    return isRtlCharacter(firstChar) ? "rtl" : "ltr"
  }

  private preserveNativeBidi(element: HTMLElement): void {
    const dirAttr = (element.getAttribute("dir") || "").toLowerCase()
    if (!dirAttr) {
      element.setAttribute("dir", "auto")
    }
    element.style.removeProperty("direction")
    element.style.removeProperty("text-align")
  }

  private applyDetectedDirection(
    element: HTMLElement,
    firstChar: string | null
  ): void {
    const direction = this.detectDirection(firstChar)
    element.dir = direction

    if (direction === "rtl") {
      element.style.direction = "rtl"
      element.style.textAlign = "right"
      return
    }

    element.style.removeProperty("direction")
    element.style.removeProperty("text-align")
  }

  private updateDirection(element: HTMLElement): void {
    if (!this.isEditable(element) || this.shouldSkipElement(element)) return

    const dirAttr = (element.getAttribute("dir") || "").toLowerCase()
    const firstChar = this.extractFromEditable(element)

    if (element.isContentEditable && this.isGeminiHost()) {
      if (!firstChar) {
        this.preserveNativeBidi(element)
        return
      }
      this.applyDetectedDirection(element, firstChar)
      return
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      if (!dirAttr) {
        this.preserveNativeBidi(element)
        return
      }

      if (dirAttr === "auto") {
        element.style.removeProperty("direction")
        element.style.removeProperty("text-align")
        return
      }
    }

    this.applyDetectedDirection(element, firstChar)
  }

  private attachAutoDirection(element: HTMLElement): void {
    if (
      !this.isEditable(element) ||
      !element.isConnected ||
      this.trackedInputs.has(element) ||
      this.shouldSkipElement(element)
    ) {
      return
    }

    const handler = () => this.updateDirection(element)
    element.addEventListener("input", handler)
    element.addEventListener("compositionend", handler)
    element.addEventListener("change", handler)
    this.trackedInputs.set(element, {
      cleanup: () => {
        element.removeEventListener("input", handler)
        element.removeEventListener("compositionend", handler)
        element.removeEventListener("change", handler)
      },
      dirAttr: element.getAttribute("dir"),
      styleDirection: element.style.direction,
      styleTextAlign: element.style.textAlign
    })
    this.updateDirection(element)
  }

  private detachTrackedInput(element: HTMLElement, restore = false): void {
    const tracked = this.trackedInputs.get(element)
    if (!tracked) return

    tracked.cleanup()
    if (restore) {
      if (tracked.dirAttr === null) {
        element.removeAttribute("dir")
      } else {
        element.setAttribute("dir", tracked.dirAttr)
      }
      element.style.direction = tracked.styleDirection
      element.style.textAlign = tracked.styleTextAlign
    }
    this.trackedInputs.delete(element)
  }

  private detachAll(): void {
    Array.from(this.trackedInputs.keys()).forEach((element) => {
      this.detachTrackedInput(element, true)
    })
    this.trackedInputs.clear()
  }

  private cleanupDisconnectedTrackedInputs(): void {
    Array.from(this.trackedInputs.keys()).forEach((element) => {
      if (!element.isConnected) {
        this.detachTrackedInput(element)
      }
    })
  }

  private cleanupTrackedInSubtree(root: Node): void {
    const nodes: HTMLElement[] = []

    if (root instanceof HTMLElement && this.trackedInputs.has(root)) {
      nodes.push(root)
    }

    if (hasQuerySelectorAll(root)) {
      root.querySelectorAll(EDITABLE_SELECTOR).forEach((node) => {
        if (node instanceof HTMLElement && this.trackedInputs.has(node)) {
          nodes.push(node)
        }
      })
    }

    nodes.forEach((node) => {
      this.detachTrackedInput(node)
    })
  }

  private scanEditableNodes(root: ParentNode | HTMLElement = document): void {
    this.cleanupDisconnectedTrackedInputs()

    const nodes: HTMLElement[] = []

    if (
      root instanceof HTMLElement &&
      root.isConnected &&
      this.isEditable(root) &&
      !this.shouldSkipElement(root)
    ) {
      nodes.push(root)
    }

    if (hasQuerySelectorAll(root)) {
      root.querySelectorAll(EDITABLE_SELECTOR).forEach((node) => {
        if (
          node instanceof HTMLElement &&
          node.isConnected &&
          !this.shouldSkipElement(node)
        ) {
          nodes.push(node)
        }
      })
    }

    nodes.forEach((node) => {
      this.attachAutoDirection(node)
    })
  }

  private startObserver(): void {
    if (this.observer || !this.enabled || !document.documentElement) return

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== 11) {
            return
          }

          if (node instanceof HTMLElement) {
            if (node.shadowRoot) this.scanEditableNodes(node.shadowRoot)
            if (
              node.isConnected &&
              this.isEditable(node) &&
              !this.shouldSkipElement(node)
            ) {
              this.attachAutoDirection(node)
            }
            this.scanEditableNodes(node)
            return
          }

          if (hasQuerySelectorAll(node)) {
            this.scanEditableNodes(node)
          }
        })

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === 11) {
            this.cleanupTrackedInSubtree(node)
          }
        })
      }

      this.cleanupDisconnectedTrackedInputs()
    })
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  private stopObserver(): void {
    this.observer?.disconnect()
    this.observer = null
  }
}

function hasQuerySelectorAll(value: unknown): value is ParentNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ParentNode).querySelectorAll === "function"
  )
}
