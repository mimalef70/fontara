import { RTL_SCRIPT_REGEX } from "./text-direction"

const DEFAULT_TEXTUAL_SELECTORS = [
  "p",
  "div",
  "span",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol"
]

type ElementSnapshot = {
  classes: Map<string, boolean>
  dirAttr: string | null
  styleProperties: Map<string, string>
}

type StyleableElement = Element & ElementCSSInlineStyle

export type RtlEngineConfig = {
  applyToMessage?: (element: Element, engine: RtlEngine) => boolean | undefined
  excludeSelectors?: string[]
  isCodeLike?: (element: Element) => boolean
  isMessageElement?: (element: Element) => boolean
  messageSelectors?: string[]
  needsRTL?: (text: string, engine: RtlEngine) => boolean
  observeCharacterData?: boolean
  rtlClass?: string
  rtlRegex?: RegExp
  rtlStyle?: Partial<{
    direction: string
    textAlign: string
    unicodeBidi: string
  }>
  textSelectors?: string[]
}

export class RtlEngine {
  config: RtlEngineConfig
  enabled = false
  excludeSelector: string
  initialized = false
  messageSelector: string
  observeCharacterData: boolean
  observer: MutationObserver | null = null
  observeRetryScheduled = false
  pendingNodes = new Set<Node>()
  rafId: number | null = null
  rtlClass: string | null
  rtlRegex: RegExp
  rtlStyle: {
    direction: string
    textAlign: string
    unicodeBidi?: string
  }
  styledElements = new Map<Element, ElementSnapshot>()
  textSelector: string

  constructor(config: RtlEngineConfig = {}) {
    this.config = config
    this.observeCharacterData = config.observeCharacterData !== false

    const messageSelectors = Array.isArray(config.messageSelectors)
      ? config.messageSelectors
      : []
    const excludeSelectors = Array.isArray(config.excludeSelectors)
      ? config.excludeSelectors
      : []

    this.messageSelector = messageSelectors.join(", ")
    this.excludeSelector = excludeSelectors.join(", ")
    this.textSelector = Array.isArray(config.textSelectors)
      ? config.textSelectors.join(", ")
      : DEFAULT_TEXTUAL_SELECTORS.join(", ")
    this.rtlRegex = config.rtlRegex ?? RTL_SCRIPT_REGEX
    this.rtlClass = config.rtlClass ?? null
    this.rtlStyle = {
      direction: "rtl",
      textAlign: "right",
      unicodeBidi: "plaintext",
      ...config.rtlStyle
    }
  }

  init(): void {
    if (this.initialized) return

    this.initialized = true
    this.observeRetryScheduled = false
    this.observe()
    if (this.enabled) {
      this.scheduleScan(document.body || document.documentElement || document)
    }
  }

  dispose(): void {
    this.enabled = false
    this.initialized = false
    this.observeRetryScheduled = false
    this.observer?.disconnect()
    this.observer = null
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.pendingNodes.clear()
    this.restoreStyles()
  }

  observe(): void {
    if (!this.initialized || this.observer) return
    const target = document.body || document.documentElement
    if (!target) {
      this.scheduleObserveRetry()
      return
    }

    this.observeRetryScheduled = false

    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled) return

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            this.scheduleScan(node)
          })
          if (mutation.removedNodes.length > 0) {
            this.cleanupDetached()
          }
          continue
        }

        if (mutation.type === "characterData" && this.observeCharacterData) {
          this.scheduleScan(mutation.target.parentElement ?? mutation.target)
        }
      }
    })

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: this.observeCharacterData
    })
  }

  private scheduleObserveRetry(): void {
    if (this.observeRetryScheduled) return

    this.observeRetryScheduled = true
    queueMicrotask(() => {
      this.observeRetryScheduled = false
      this.observe()
    })
  }

  scheduleScan(node: Node | null | undefined): void {
    if (!node || !this.enabled) return

    this.pendingNodes.add(node)
    if (this.rafId !== null) return

    this.rafId = requestAnimationFrame(() => this.processQueue())
  }

  processQueue(): void {
    this.rafId = null

    if (!this.enabled) {
      this.pendingNodes.clear()
      return
    }

    const nodes = Array.from(this.pendingNodes)
    this.pendingNodes.clear()

    const candidates = new Set<Element>()
    nodes.forEach((node) => {
      this.collectCandidates(node, candidates)
    })
    candidates.forEach((element) => {
      this.applyToMessage(element)
    })
    this.cleanupDetached()
  }

  collectCandidates(node: Node, bucket: Set<Element>): void {
    const selector = this.messageSelector
    const isMessageElement =
      typeof this.config.isMessageElement === "function"
        ? this.config.isMessageElement
        : null

    const addIfCandidate = (element: Element | null | undefined) => {
      if (!element || !isDomElement(element)) return
      if (
        (selector && element.matches(selector)) ||
        isMessageElement?.(element)
      ) {
        bucket.add(element)
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement
      if (!parent || this.isExcluded(parent)) return

      addIfCandidate(parent)
      if (selector) {
        const container = parent.closest(selector)
        if (container) bucket.add(container)
      }
      if (isMessageElement) {
        let current: Element | null = parent
        while (current) {
          if (this.isExcluded(current)) break
          if (isMessageElement(current)) {
            bucket.add(current)
            break
          }
          current = current.parentElement
        }
      }
      return
    }

    if (isDomElement(node)) {
      if (this.isExcluded(node)) return

      addIfCandidate(node)
      if (selector) {
        const container = node.closest(selector)
        if (container) bucket.add(container)
        node.querySelectorAll(selector).forEach((element) => {
          bucket.add(element)
        })
      }
      if (isMessageElement) {
        node.querySelectorAll("*").forEach((element) => {
          if (!this.isExcluded(element) && isMessageElement(element)) {
            bucket.add(element)
          }
        })
      }
      return
    }

    if (isQueryableRoot(node)) {
      if (selector) {
        node.querySelectorAll(selector).forEach((element) => {
          if (!this.isExcluded(element)) bucket.add(element)
        })
      }
      if (isMessageElement) {
        node.querySelectorAll("*").forEach((element) => {
          if (!this.isExcluded(element) && isMessageElement(element)) {
            bucket.add(element)
          }
        })
      }
    }
  }

  applyToMessage(element: Element): void {
    if (!isDomElement(element) || !element.isConnected) return
    if (this.isExcluded(element)) return

    if (typeof this.config.applyToMessage === "function") {
      const handled = this.config.applyToMessage(element, this)
      if (handled === true) return
    }

    const text = getElementText(element)
    if (!this.needsRTL(text)) return

    this.applyRTL(element)

    if (!this.textSelector) return
    element.querySelectorAll(this.textSelector).forEach((child) => {
      if (!this.isExcluded(child)) {
        this.applyRTL(child)
      }
    })
  }

  needsRTL(text: string): boolean {
    if (typeof this.config.needsRTL === "function") {
      return this.config.needsRTL(text, this)
    }

    const normalized = normalizeText(text)
    return normalized.length >= 3 && this.rtlRegex.test(normalized)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isExcluded(node: Element): boolean {
    if (!isDomElement(node)) return false
    if (
      typeof this.config.isCodeLike === "function" &&
      this.config.isCodeLike(node)
    ) {
      return true
    }
    return Boolean(this.excludeSelector && node.closest?.(this.excludeSelector))
  }

  applyRTL(element: Element): void {
    if (!isDomElement(element)) return

    this.rememberStyle(element)
    element.setAttribute("dir", "rtl")
    this.setStyle(element, "direction", this.rtlStyle.direction)
    this.setStyle(element, "text-align", this.rtlStyle.textAlign)
    if (this.rtlStyle.unicodeBidi !== undefined) {
      this.setStyle(element, "unicode-bidi", this.rtlStyle.unicodeBidi)
    }
    if (this.rtlClass) {
      element.classList.add(this.rtlClass)
    }
  }

  rememberStyle(
    element: Element,
    styleProperties: string[] = ["direction", "text-align", "unicode-bidi"],
    classNames: string[] = []
  ): void {
    if (!isDomElement(element)) return

    const snapshot =
      this.styledElements.get(element) ??
      ({
        classes: new Map(),
        dirAttr: element.getAttribute("dir"),
        styleProperties: new Map()
      } satisfies ElementSnapshot)

    for (const property of styleProperties) {
      if (!snapshot.styleProperties.has(property)) {
        snapshot.styleProperties.set(
          property,
          element.style.getPropertyValue(property)
        )
      }
    }

    for (const className of [this.rtlClass, ...classNames]) {
      if (className && !snapshot.classes.has(className)) {
        snapshot.classes.set(className, element.classList.contains(className))
      }
    }

    this.styledElements.set(element, snapshot)
  }

  setStyle(
    element: Element,
    property: string,
    value: string,
    priority?: string
  ): void {
    if (!isDomElement(element)) return
    this.rememberStyle(element, [property])
    element.style.setProperty(property, value, priority)
  }

  restoreElement(element: Element): void {
    const snapshot = this.styledElements.get(element)
    if (!snapshot || !isDomElement(element)) return

    if (snapshot.dirAttr === null) {
      element.removeAttribute("dir")
    } else {
      element.setAttribute("dir", snapshot.dirAttr)
    }

    snapshot.styleProperties.forEach((value, property) => {
      if (value) {
        element.style.setProperty(property, value)
      } else {
        element.style.removeProperty(property)
      }
    })

    snapshot.classes.forEach((hadClass, className) => {
      if (hadClass) {
        element.classList.add(className)
      } else {
        element.classList.remove(className)
      }
    })

    this.styledElements.delete(element)
  }

  restoreStyles(): void {
    this.styledElements.forEach((_, element) => {
      if (element.isConnected) {
        this.restoreElement(element)
      }
    })
    this.styledElements.clear()
  }

  cleanupDetached(): void {
    this.styledElements.forEach((_, element) => {
      if (!element.isConnected) {
        this.styledElements.delete(element)
      }
    })
  }
}

export function normalizeText(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim()
}

export function getElementText(element: Element): string {
  return normalizeText(element.textContent)
}

export function getTextWithoutSelector(
  element: Element,
  selector: string
): string {
  const clone = element.cloneNode(true)
  if (isDomElement(clone)) {
    clone.querySelectorAll(selector).forEach((node) => {
      node.remove()
    })
    return getElementText(clone)
  }

  return getElementText(element)
}

function isDomElement(value: unknown): value is StyleableElement {
  return (
    typeof Element !== "undefined" &&
    value instanceof Element &&
    typeof value.matches === "function" &&
    "style" in value
  )
}

function isQueryableRoot(value: unknown): value is ParentNode {
  if (!value || typeof value !== "object") return false

  const node = value as Node & { querySelectorAll?: unknown }
  return (
    typeof node.querySelectorAll === "function" &&
    (node.nodeType === 9 || node.nodeType === 11)
  )
}
