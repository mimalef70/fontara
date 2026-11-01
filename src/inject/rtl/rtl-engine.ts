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
  styleProperties: Map<string, StyleSnapshot>
}

type StyleSnapshot = {
  priority: string
  value: string
}

type StyleableElement = Element & ElementCSSInlineStyle

type CandidateScan = {
  iterator: Generator<Element | null>
  repeatRequested: boolean
  started: boolean
}

const QUEUE_OPERATIONS_PER_FRAME = 200
const MESSAGES_PER_FRAME = 8
const QUEUE_BUDGET_MS = 8
const QUEUE_TIMEOUT_MS = 100

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
  pendingNodes = new Set<Node>()
  rafId: number | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private candidateScans = new Map<Node, CandidateScan>()
  private pendingCandidates = new Set<Element>()
  private detachedCleanupIterator: Iterator<Element> | null = null
  private detachedCleanupRequested = false
  private messageTargets = new WeakMap<Element, Set<Element>>()
  private currentMessageTargets: Set<Element> | null = null
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
    this.observe()
    if (this.enabled) {
      this.scheduleScan(document.body || document.documentElement || document)
    }
  }

  dispose(): void {
    this.setEnabled(false)
    this.initialized = false
    this.observer?.disconnect()
    this.observer = null
    this.restoreStyles()
  }

  observe(): void {
    if (!this.initialized || this.observer) return
    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled) return

      let removedNodes = false
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            this.scheduleScan(node)
          })
          if (mutation.removedNodes.length > 0) {
            // Removing the final RTL text must reconcile its surviving
            // message too; there may be no added node to trigger a scan.
            this.scheduleScan(mutation.target)
            removedNodes = true
          }
          continue
        }

        if (mutation.type === "characterData" && this.observeCharacterData) {
          this.scheduleScan(mutation.target.parentElement ?? mutation.target)
        }
      }
      if (removedNodes) this.cleanupDetached()
    })

    // Document remains stable when an SPA replaces body/documentElement.
    this.observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: this.observeCharacterData
    })
  }

  scheduleScan(node: Node | null | undefined): void {
    if (!node || !this.enabled) return

    const existing = this.candidateScans.get(node)
    if (existing) {
      existing.repeatRequested ||= existing.started
      return
    }
    this.pendingNodes.add(node)
    this.candidateScans.set(node, {
      iterator: this.iterateCandidates(node),
      repeatRequested: false,
      started: false
    })
    this.scheduleQueue()
  }

  private scheduleQueue(): void {
    if (!this.enabled || this.rafId !== null || this.timeoutId !== null) return
    this.rafId = requestAnimationFrame(() => this.processQueue())
    // Hidden pages may not receive animation frames. Keep progress bounded
    // there too, and cancel the alternate callback when either one runs.
    this.timeoutId = setTimeout(() => this.processQueue(), QUEUE_TIMEOUT_MS)
  }

  private cancelQueueCallback(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    if (this.timeoutId !== null) clearTimeout(this.timeoutId)
    this.rafId = null
    this.timeoutId = null
  }

  private clearQueue(): void {
    this.cancelQueueCallback()
    this.pendingNodes.clear()
    this.candidateScans.clear()
    this.pendingCandidates.clear()
    this.detachedCleanupIterator = null
    this.detachedCleanupRequested = false
  }

  private processDetachedCleanupStep(): void {
    if (!this.detachedCleanupIterator) return
    const next = this.detachedCleanupIterator.next()
    if (next.done) {
      this.detachedCleanupIterator = this.detachedCleanupRequested
        ? this.styledElements.keys()
        : null
      this.detachedCleanupRequested = false
    } else if (!next.value.isConnected) {
      this.restoreElement(next.value)
    }
  }

  processQueue(): void {
    this.cancelQueueCallback()

    if (!this.enabled) {
      this.clearQueue()
      return
    }

    const startedAt = performance.now()
    let operations = 0
    let messages = 0
    while (
      this.enabled &&
      operations < QUEUE_OPERATIONS_PER_FRAME &&
      performance.now() - startedAt < QUEUE_BUDGET_MS
    ) {
      operations += 1
      // Streaming messages can keep the scan queues nonempty indefinitely.
      // Reserve progress for detached nodes instead of retaining their styles
      // until the page becomes idle.
      if (this.detachedCleanupIterator && operations % 8 === 1) {
        this.processDetachedCleanupStep()
        continue
      }
      const candidate = this.pendingCandidates.values().next().value
      if (candidate) {
        if (messages >= MESSAGES_PER_FRAME) break
        this.pendingCandidates.delete(candidate)
        this.applyToMessage(candidate)
        messages += 1
        continue
      }

      const entry = this.candidateScans.entries().next().value
      if (entry) {
        const [node, scan] = entry
        scan.started = true
        const next = scan.iterator.next()
        this.candidateScans.delete(node)
        if (next.done) {
          this.pendingNodes.delete(node)
          if (scan.repeatRequested) this.scheduleScan(node)
        } else {
          // Rotate scans so new streamed text need not wait for an earlier
          // whole-document traversal to finish.
          this.candidateScans.set(node, scan)
          if (next.value) this.pendingCandidates.add(next.value)
        }
        continue
      }

      if (this.detachedCleanupIterator) {
        this.processDetachedCleanupStep()
        continue
      }
      break
    }

    if (
      this.candidateScans.size > 0 ||
      this.pendingCandidates.size > 0 ||
      this.detachedCleanupIterator
    ) {
      this.scheduleQueue()
    }
  }

  collectCandidates(node: Node, bucket: Set<Element>): void {
    for (const candidate of this.iterateCandidates(node)) {
      if (candidate) bucket.add(candidate)
    }
  }

  private isCandidate(element: Element): boolean {
    return Boolean(
      (this.messageSelector && element.matches(this.messageSelector)) ||
        this.config.isMessageElement?.(element)
    )
  }

  private *iterateCandidates(node: Node): Generator<Element | null> {
    if (!node.isConnected) return
    const isText = node.nodeType === Node.TEXT_NODE
    const root = isText ? node.parentElement : node
    if (!root) return

    if (isDomElement(root)) {
      if (this.isExcluded(root)) return
      // A changed descendant invalidates every containing message scope.
      // Adapters can match nested containers that were both styled during
      // initial discovery; updating only the closest leaves the outer RTL.
      let ancestor: Element | null = root
      while (ancestor) {
        if (this.isExcluded(ancestor)) break
        const candidate = this.isCandidate(ancestor)
        yield candidate ? ancestor : null
        ancestor = ancestor.parentElement
      }
    } else if (!isQueryableRoot(root)) {
      return
    }
    if (isText) return

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (element) =>
        isDomElement(element) && this.isExcluded(element)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
    })
    let child = walker.nextNode()
    while (child) {
      yield isDomElement(child) && this.isCandidate(child) ? child : null
      child = walker.nextNode()
    }
  }

  applyToMessage(element: Element): void {
    if (!isDomElement(element) || !element.isConnected) return
    const previousTargets = this.messageTargets.get(element)
    const currentTargets = new Set<Element>()
    const parentTargets = this.currentMessageTargets
    this.currentMessageTargets = currentTargets
    try {
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
        if (!this.isExcluded(child)) this.applyRTL(child)
      })
    } finally {
      this.currentMessageTargets = parentTargets
      // Reconcile a complete message atomically. Adapters declare their
      // current targets via rememberStyle; an LTR/empty edit releases any
      // formerly RTL descendants even when the adapter returns early.
      for (const target of previousTargets ?? []) {
        if (!currentTargets.has(target)) this.restoreElement(target)
      }
      this.messageTargets.set(element, currentTargets)
    }
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
    if (!enabled) this.clearQueue()
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
    this.currentMessageTargets?.add(element)

    const snapshot =
      this.styledElements.get(element) ??
      ({
        classes: new Map(),
        dirAttr: element.getAttribute("dir"),
        styleProperties: new Map()
      } satisfies ElementSnapshot)

    for (const property of styleProperties) {
      if (!snapshot.styleProperties.has(property)) {
        snapshot.styleProperties.set(property, {
          priority: element.style.getPropertyPriority(property),
          value: element.style.getPropertyValue(property)
        })
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

    snapshot.styleProperties.forEach(({ priority, value }, property) => {
      if (value) {
        element.style.setProperty(property, value, priority)
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
      this.restoreElement(element)
    })
    this.styledElements.clear()
    this.messageTargets = new WeakMap()
  }

  cleanupDetached(): void {
    if (this.detachedCleanupIterator) this.detachedCleanupRequested = true
    else this.detachedCleanupIterator = this.styledElements.keys()
    this.scheduleQueue()
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
