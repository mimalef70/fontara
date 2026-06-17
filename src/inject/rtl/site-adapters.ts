import type { RtlSiteId } from "../../config/rtl-sites"
import {
  getElementText,
  getTextWithoutSelector,
  normalizeText,
  RtlEngine,
  type RtlEngineConfig
} from "./rtl-engine"
import {
  isLtrCharacter,
  isRtlCharacter,
  isStrongLetter,
  RTL_SCRIPT_REGEX
} from "./text-direction"

export type RtlSiteAdapter = {
  disable: () => void
  dispose: () => void
  enable: () => void
  siteId: RtlSiteId
}

type StandardAdapterConfig = {
  applyToMessage?: (element: Element, engine: RtlEngine) => boolean | undefined
  codeGuardSelectors?: string[]
  excludeSelectors?: string[]
  extraCss?: string
  mathGuardSelectors?: string[]
  messageSelectors: string[]
  rootSelector?: string
  rtlStyle?: RtlEngineConfig["rtlStyle"]
  siteId: RtlSiteId
  textSelectors?: string[]
  uiExcludeSelectors?: string[]
}

const DIRECTION_SAMPLE_CHAR_LIMIT = 1000
const DEFAULT_TEXTUAL_DESCENDANTS = [
  "p",
  "div",
  "span",
  "li",
  "ul",
  "ol",
  "blockquote",
  "figcaption",
  "strong",
  "em",
  "td",
  "th",
  "tr",
  "table",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]

const COMMON_CODE_GUARD_SELECTORS = [
  "code",
  "pre",
  '[class*="code"]',
  '[class*="Code"]',
  '[class*="language-"]',
  '[class*="hljs"]',
  ".monaco-editor",
  ".cm-editor"
]

const COMMON_MATH_GUARD_SELECTORS = [
  ".katex",
  ".katex-display",
  ".katex-html",
  ".katex-mathml",
  '[role="math"]'
]

function joinSelectors(selectors: string[]): string {
  return selectors.filter(Boolean).join(", ")
}

function appendStyle(style: HTMLStyleElement): void {
  ;(document.head || document.documentElement).appendChild(style)
}

function createStyle(css: string, siteId: RtlSiteId): HTMLStyleElement {
  const style = document.createElement("style")
  style.dataset.fontaraRtl = siteId
  style.textContent = css
  appendStyle(style)
  return style
}

function createCodeListTableCSS(
  codeGuardSelector: string,
  mathGuardSelector?: string,
  listPadding = "2rem"
): string {
  return `
    ${codeGuardSelector} {
      direction: ltr !important;
      text-align: left !important;
    }

    ${
      mathGuardSelector
        ? `
    [dir="rtl"] ${mathGuardSelector},
    [dir="rtl"] [role="math"] {
      direction: ltr !important;
      unicode-bidi: isolate;
    }

    [dir="rtl"] .katex-display {
      text-align: center !important;
    }
    `
        : ""
    }

    [dir="rtl"] ul,
    [dir="rtl"] ol {
      padding-right: ${listPadding};
      padding-left: 0;
    }

    [dir="rtl"] table {
      direction: rtl;
    }

    [dir="rtl"] li,
    [dir="rtl"] button,
    [dir="rtl"] a {
      text-align: right;
    }
  `
}

function isInSelector(element: Element, selector: string): boolean {
  return Boolean(selector && element.closest(selector))
}

function isLayoutContainer(element: HTMLElement): boolean {
  if (!element.isConnected) return false
  const style = window.getComputedStyle(element)
  const display = style.display || ""

  if (
    display.includes("grid") ||
    display === "table" ||
    display === "inline-grid"
  ) {
    return true
  }

  if (display.includes("flex")) {
    return (style.flexDirection || "row").startsWith("row")
  }

  return false
}

function detectDominantDirection(text: string): "ltr" | "rtl" | null {
  const normalized = normalizeText(text)
  if (!normalized) return null

  const sample =
    normalized.length > DIRECTION_SAMPLE_CHAR_LIMIT
      ? normalized.slice(0, DIRECTION_SAMPLE_CHAR_LIMIT)
      : normalized
  let rtlCount = 0
  let ltrCount = 0
  let firstStrong: string | null = null

  for (const char of sample) {
    if (!isStrongLetter(char)) continue
    firstStrong ??= char
    if (isRtlCharacter(char)) {
      rtlCount += 1
    } else if (isLtrCharacter(char)) {
      ltrCount += 1
    }
  }

  if (!rtlCount && !ltrCount) return null
  if (rtlCount === ltrCount) {
    return firstStrong && isRtlCharacter(firstStrong) ? "rtl" : "ltr"
  }

  return rtlCount > ltrCount ? "rtl" : "ltr"
}

function createStandardAdapter(config: StandardAdapterConfig): RtlSiteAdapter {
  const codeGuardSelectors = config.codeGuardSelectors ?? []
  const mathGuardSelectors = config.mathGuardSelectors ?? []
  const uiExcludeSelectors = config.uiExcludeSelectors ?? []
  const excludeSelectors = [
    ...(config.excludeSelectors ?? []),
    ...uiExcludeSelectors,
    ...codeGuardSelectors,
    ...mathGuardSelectors
  ]
  const codeGuard = joinSelectors(codeGuardSelectors)
  const mathGuard = joinSelectors(mathGuardSelectors)
  const uiExclude = joinSelectors(uiExcludeSelectors)
  let globalStyle: HTMLStyleElement | null = null

  const engine = new RtlEngine({
    messageSelectors: config.messageSelectors,
    excludeSelectors,
    textSelectors: config.textSelectors ?? DEFAULT_TEXTUAL_DESCENDANTS,
    isCodeLike: (element) =>
      Boolean(
        (codeGuard && element.closest(codeGuard)) ||
          (mathGuard && element.closest(mathGuard)) ||
          (uiExclude && element.closest(uiExclude))
      ),
    rtlRegex: RTL_SCRIPT_REGEX,
    rtlStyle: config.rtlStyle ?? { unicodeBidi: "isolate" },
    applyToMessage: config.applyToMessage
  })

  const ensureGlobalStyle = () => {
    if (globalStyle) return
    const css = [
      codeGuard
        ? createCodeListTableCSS(codeGuard, mathGuard || undefined)
        : "",
      config.extraCss ?? ""
    ].join("\n")
    globalStyle = createStyle(css, config.siteId)
  }

  const disable = () => {
    if (!engine.enabled) return
    engine.setEnabled(false)
    engine.restoreStyles()
    globalStyle?.remove()
    globalStyle = null
  }

  return {
    siteId: config.siteId,
    enable() {
      if (engine.enabled) return
      engine.setEnabled(true)
      engine.init()
      ensureGlobalStyle()
      const root = config.rootSelector
        ? document.querySelector(config.rootSelector)
        : null
      engine.scheduleScan(root ?? document.body ?? document.documentElement)
    },
    disable,
    dispose() {
      disable()
      engine.dispose()
    }
  }
}

function createChatGptAdapter(): RtlSiteAdapter {
  const messageSelectors = [
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]",
    '[data-testid="assistant-turn"]',
    '[data-testid="user-turn"]',
    '[data-testid="message-text"]'
  ]
  const codeGuardSelectors = [
    ...COMMON_CODE_GUARD_SELECTORS,
    '[data-testid="code-block"]',
    '[data-testid="code-snippet"]',
    '[class*="code-block"]',
    '[class*="CodeBlock"]',
    ".react-code-block",
    ".ace_editor"
  ]
  const mathGuard = joinSelectors(COMMON_MATH_GUARD_SELECTORS)
  const textSelector = joinSelectors([
    ...DEFAULT_TEXTUAL_DESCENDANTS,
    "strong",
    "em"
  ])

  return createStandardAdapter({
    siteId: "chatgpt",
    messageSelectors,
    codeGuardSelectors,
    mathGuardSelectors: COMMON_MATH_GUARD_SELECTORS,
    excludeSelectors: [
      '[data-type="unified-composer"]',
      '[data-type="unified-composer"] *',
      'form[data-type="unified-composer"]',
      "input",
      "textarea",
      '[contenteditable="true"]'
    ],
    applyToMessage: (element, engine) => {
      const messageText = getTextWithoutSelector(element, mathGuard)
      if (!engine.needsRTL(messageText) || !engine.textSelector) return true

      element.querySelectorAll(textSelector).forEach((child) => {
        if (engine.isExcluded(child)) return
        const childText = getTextWithoutSelector(child, mathGuard)
        if (engine.needsRTL(childText)) {
          engine.applyRTL(child)
        }
      })
      return true
    }
  })
}

function createClaudeAdapter(): RtlSiteAdapter {
  const messageSelectors = [
    ".font-claude-message",
    "[data-test-render-count]",
    '[class*="Message"]',
    "article",
    '[role="article"]'
  ]
  const ignoreSelectors = [
    ...COMMON_CODE_GUARD_SELECTORS,
    ".code-block",
    '[data-test-id="code-block"]',
    ".katex",
    ".katex-html",
    ".katex-mathml"
  ]
  const ignoreSelector = joinSelectors(ignoreSelectors)
  const mathSelector = '.katex, [role="math"].katex'
  const targetTags = new Set([
    "P",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TD",
    "TH",
    "BLOCKQUOTE"
  ])
  let globalStyle: HTMLStyleElement | null = null
  let elementDirections = new WeakMap<Element, "ltr" | "rtl">()

  const engine = new RtlEngine({
    messageSelectors,
    textSelectors: [],
    applyToMessage: (container) => {
      Array.from(container.children).forEach((child) => {
        processElement(child)
      })
      return true
    }
  })

  const isolateMathInRtl = (container: Element) => {
    container.querySelectorAll(mathSelector).forEach((mathElement) => {
      if (!(mathElement instanceof HTMLElement)) return
      engine.rememberStyle(mathElement, [
        "direction",
        "text-align",
        "unicode-bidi"
      ])
      mathElement.setAttribute("dir", "ltr")
      engine.setStyle(mathElement, "direction", "ltr", "important")
      engine.setStyle(mathElement, "text-align", "left", "important")
      engine.setStyle(mathElement, "unicode-bidi", "isolate", "important")
    })
  }

  const applyLtrGuard = (element: HTMLElement) => {
    if (elementDirections.get(element) === "ltr") return
    engine.rememberStyle(element, ["direction", "text-align"])
    element.setAttribute("dir", "ltr")
    engine.setStyle(element, "direction", "ltr", "important")
    engine.setStyle(element, "text-align", "left", "important")
    elementDirections.set(element, "ltr")
  }

  const applyRtlText = (element: HTMLElement) => {
    engine.rememberStyle(
      element,
      ["direction", "text-align"],
      ["fontara-rtl-processed", "fontara-rtl-modified"]
    )
    element.setAttribute("dir", "rtl")
    engine.setStyle(element, "direction", "rtl", "important")
    engine.setStyle(element, "text-align", "right", "important")
    element.classList.add("fontara-rtl-processed", "fontara-rtl-modified")
    isolateMathInRtl(element)
  }

  const restoreIfModified = (element: HTMLElement) => {
    if (element.classList.contains("fontara-rtl-modified")) {
      engine.restoreElement(element)
    }
  }

  const processElement = (element: Element) => {
    if (!(element instanceof HTMLElement)) return

    if (element.matches(ignoreSelector) || element.closest(ignoreSelector)) {
      applyLtrGuard(element)
      return
    }

    if (element.tagName === "UL" || element.tagName === "OL") {
      let rtlCount = 0
      let ltrCount = 0
      element.querySelectorAll("li").forEach((listItem) => {
        const direction = detectDominantDirection(listItem.textContent || "")
        if (direction === "rtl") {
          rtlCount += 1
        } else {
          ltrCount += 1
        }
        processElement(listItem)
      })

      const finalDirection = rtlCount > ltrCount ? "rtl" : "ltr"
      if (elementDirections.get(element) === finalDirection) return

      if (finalDirection === "rtl") {
        engine.rememberStyle(
          element,
          ["direction", "text-align", "padding-right", "padding-left"],
          ["fontara-rtl-modified"]
        )
        element.setAttribute("dir", "rtl")
        engine.setStyle(element, "direction", "rtl", "important")
        engine.setStyle(element, "text-align", "right", "important")
        engine.setStyle(element, "padding-right", "2rem", "important")
        engine.setStyle(element, "padding-left", "0", "important")
        element.classList.add("fontara-rtl-modified")
        isolateMathInRtl(element)
      } else {
        restoreIfModified(element)
      }
      elementDirections.set(element, finalDirection)
      return
    }

    if (targetTags.has(element.tagName)) {
      const text = normalizeText(element.textContent)
      if (!text) return

      const direction = detectDominantDirection(text) ?? "ltr"
      if (elementDirections.get(element) === direction) return

      if (direction === "rtl") {
        applyRtlText(element)
      } else {
        restoreIfModified(element)
      }
      elementDirections.set(element, direction)
    }

    if (["DIV", "SECTION", "ARTICLE"].includes(element.tagName)) {
      Array.from(element.children).forEach((child) => {
        processElement(child)
      })
    }
  }

  const ensureGlobalStyle = () => {
    if (globalStyle) return
    globalStyle = createStyle(
      `
        ${ignoreSelector},
        [dir="rtl"] .katex,
        [dir="rtl"] .katex-html {
          direction: ltr !important;
          text-align: left !important;
          unicode-bidi: isolate;
        }
      `,
      "claude"
    )
  }

  const disable = () => {
    if (!engine.enabled) return
    engine.setEnabled(false)
    engine.restoreStyles()
    globalStyle?.remove()
    globalStyle = null
    elementDirections = new WeakMap()
  }

  return {
    siteId: "claude",
    enable() {
      if (engine.enabled) return
      engine.setEnabled(true)
      engine.init()
      ensureGlobalStyle()
      engine.scheduleScan(document.body || document.documentElement)
    },
    disable,
    dispose() {
      disable()
      engine.dispose()
    }
  }
}

function createGeminiAdapter(): RtlSiteAdapter {
  const messageSelectors = [
    '[data-test-id="luminous-collapsed-bubble"]',
    '[id^="model-response-message-content"]',
    '[id^="model-user-message-content"]'
  ]
  const uiExcludeSelectors = [
    '[data-test-id="overflow-container"]',
    '[data-test-id="overflow-container"] *',
    '[data-test-id="all-conversations"]',
    '[data-test-id="all-conversations"] *',
    '[data-test-id="conversation"]',
    '[data-test-id="chats-expandable-section"]',
    '[data-test-id="chats-expandable-section"] *',
    '[data-test-id="notebooks-expandable-section"]',
    '[data-test-id="notebooks-expandable-section"] *',
    '[data-test-id="new-chat-button"]',
    '[data-test-id="search-chats-button"]',
    '[data-test-id="videos-side-nav-entry-button"]',
    '[data-test-id="my-stuff-side-nav-entry-button"]',
    "conversations-list",
    "conversations-list *",
    "project-sidenav-list",
    "project-sidenav-list *",
    "mat-nav-list[gem-sidenav-list]",
    "mat-nav-list[gem-sidenav-list] *",
    ".gds-sidenav-list",
    ".gds-sidenav-list *",
    "input",
    "textarea",
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable]:not([contenteditable="false"])'
  ]
  const codeGuardSelectors = [
    "code",
    "pre",
    '[data-test-id="code-content"]',
    ".code-container",
    ".formatted-code-block-internal-container",
    '[class*="code-block"]',
    '[class*="codeBlock"]',
    '[role="code"]',
    ".monaco-editor",
    ".cm-editor"
  ]
  const textualSelector = joinSelectors([
    "p",
    "ul",
    "ol",
    "li",
    "blockquote",
    "figcaption",
    "strong",
    "em",
    "td",
    "th",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    ".query-text-line",
    ".query-text"
  ])
  const uiExclude = joinSelectors(uiExcludeSelectors)
  const codeGuard = joinSelectors(codeGuardSelectors)
  let globalStyle: HTMLStyleElement | null = null
  let elementDirections = new WeakMap<Element, "rtl">()

  const engine = new RtlEngine({
    messageSelectors,
    excludeSelectors: [...uiExcludeSelectors, ...codeGuardSelectors],
    textSelectors: [],
    isCodeLike: (element) =>
      isInSelector(element, uiExclude) || isInSelector(element, codeGuard),
    rtlRegex: RTL_SCRIPT_REGEX,
    rtlStyle: { unicodeBidi: "isolate" },
    applyToMessage: (element, currentEngine) => {
      if (
        !(element instanceof HTMLElement) ||
        isInSelector(element, uiExclude)
      ) {
        return true
      }

      const candidates = new Set<HTMLElement>()
      if (element.matches('[data-test-id="luminous-collapsed-bubble"]')) {
        candidates.add(element)
      }

      element.querySelectorAll(textualSelector).forEach((node) => {
        if (node instanceof HTMLElement && !isInSelector(node, uiExclude)) {
          candidates.add(node)
        }
      })

      candidates.forEach((node) => {
        const direction = detectDominantDirection(getElementText(node))
        if (direction !== "rtl") {
          if (elementDirections.has(node)) {
            currentEngine.restoreElement(node)
            elementDirections.delete(node)
          }
          return
        }

        if (elementDirections.get(node) === "rtl") return
        currentEngine.applyRTL(node)
        elementDirections.set(node, "rtl")
      })

      return true
    }
  })

  const ensureGlobalStyle = () => {
    if (globalStyle) return
    const messageScope = `:is(${messageSelectors.join(", ")})`
    const codeScope = `:is(${codeGuardSelectors.join(", ")})`
    globalStyle = createStyle(
      `
        ${messageScope} ${codeScope} {
          direction: ltr !important;
          text-align: left !important;
          unicode-bidi: embed;
        }

        ${messageScope} :is(ul, ol)[dir="rtl"] {
          direction: rtl !important;
          text-align: right !important;
          list-style: none !important;
          margin-inline-start: 0 !important;
          margin-inline-end: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-inline-start: 0 !important;
          padding-inline-end: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        ${messageScope} :is(ul, ol)[dir="rtl"] > li {
          direction: rtl !important;
          text-align: right !important;
          list-style: none !important;
          position: relative !important;
          padding-inline-start: 1.55rem !important;
          padding-inline-end: 0 !important;
          padding-left: 0 !important;
          padding-right: 1.55rem !important;
        }

        ${messageScope} ol[dir="rtl"] {
          counter-reset: fontara-gemini-rtl-list;
        }

        ${messageScope} ol[dir="rtl"] > li {
          counter-increment: fontara-gemini-rtl-list;
        }

        ${messageScope} :is(ul, ol)[dir="rtl"] > li::before {
          display: block !important;
          position: absolute !important;
          right: 0 !important;
          left: auto !important;
          top: 0.72em !important;
          transform: translateY(-50%) !important;
          line-height: 1 !important;
          text-align: right !important;
          direction: rtl !important;
        }

        ${messageScope} ul[dir="rtl"] > li::before {
          content: "\\25E6" !important;
          width: 1rem !important;
        }

        ${messageScope} ol[dir="rtl"] > li::before {
          content: counter(fontara-gemini-rtl-list) "." !important;
          width: 1.15rem !important;
        }

        ${messageScope} [dir="rtl"] table {
          direction: rtl;
        }
      `,
      "gemini"
    )
  }

  const disable = () => {
    if (!engine.enabled) return
    engine.setEnabled(false)
    engine.restoreStyles()
    globalStyle?.remove()
    globalStyle = null
    elementDirections = new WeakMap()
  }

  return {
    siteId: "gemini",
    enable() {
      if (engine.enabled) return
      engine.setEnabled(true)
      engine.init()
      ensureGlobalStyle()
      engine.scheduleScan(document.body || document.documentElement)
    },
    disable,
    dispose() {
      disable()
      engine.dispose()
    }
  }
}

function createOpenRouterAdapter(): RtlSiteAdapter {
  const rootSelector = '[data-testid="playground-chat-pane"]'
  const messageSelectors = [
    '[data-testid="playground-message-list"] [data-message-id]',
    '[data-testid="message-list-content"] [data-message-id]',
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]'
  ]
  const textSelectors = [
    '[data-message-bubble="user"]',
    '[data-message-bubble="assistant"]',
    "p",
    "span",
    "li",
    "blockquote",
    "figcaption",
    "strong",
    "em",
    "td",
    "th",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6"
  ]
  const codeGuardSelectors = [
    ...COMMON_CODE_GUARD_SELECTORS,
    "[data-language]",
    '[class*="syntax"]',
    '[class*="CodeMirror"]'
  ]
  const mathGuardSelectors = COMMON_MATH_GUARD_SELECTORS
  const uiExcludeSelectors = [
    "header",
    "nav",
    "aside",
    "footer",
    '[role="banner"]',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="search"]',
    '[data-testid="playground-composer"]',
    '[data-testid="playground-composer"] *',
    '[data-testid="composer-input"]',
    '[data-testid*="model"]',
    '[data-testid*="Model"]',
    "form",
    "button",
    "input",
    "textarea",
    "svg",
    '[data-slot="icon"]',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable]:not([contenteditable="false"])'
  ]
  const protectedSelector = joinSelectors([
    ...codeGuardSelectors,
    ...mathGuardSelectors,
    ...uiExcludeSelectors
  ])
  const textSelector = joinSelectors(textSelectors)

  return createStandardAdapter({
    siteId: "openrouter",
    messageSelectors,
    rootSelector,
    textSelectors: [],
    codeGuardSelectors,
    mathGuardSelectors,
    uiExcludeSelectors,
    rtlStyle: { unicodeBidi: "plaintext" },
    applyToMessage: (element, engine) => {
      if (!(element instanceof HTMLElement) || !element.closest(rootSelector)) {
        return true
      }

      if (
        detectDominantDirection(
          getTextWithoutSelector(element, protectedSelector)
        ) !== "rtl"
      ) {
        return true
      }

      element.querySelectorAll(textSelector).forEach((child) => {
        if (!(child instanceof HTMLElement)) return
        if (child.closest(protectedSelector)) return

        const childText = getTextWithoutSelector(child, protectedSelector)
        if (detectDominantDirection(childText) === "rtl") {
          engine.applyRTL(child)
        }
      })

      return true
    },
    extraCss: `
        [data-testid="playground-message-list"] [data-message-bubble][dir="rtl"] {
          direction: rtl !important;
          text-align: right !important;
          unicode-bidi: plaintext;
        }

        [data-testid="playground-message-list"] [dir="rtl"] :is(ul, ol),
        [data-testid="playground-message-list"] :is(ul, ol)[dir="rtl"] {
          padding-right: 1.6rem;
          padding-left: 0;
        }

        [data-testid="playground-message-list"] [dir="rtl"] :is(li, p, blockquote),
        [data-testid="playground-message-list"] :is(li, p, blockquote)[dir="rtl"] {
          text-align: right;
        }
      `
  })
}

function createMathAwareAdapter(
  siteId: RtlSiteId,
  messageSelectors: string[],
  extraConfig: Partial<StandardAdapterConfig> = {}
): RtlSiteAdapter {
  const codeGuardSelectors =
    extraConfig.codeGuardSelectors ?? COMMON_CODE_GUARD_SELECTORS
  const mathGuardSelectors =
    extraConfig.mathGuardSelectors ?? COMMON_MATH_GUARD_SELECTORS
  const codeGuard = joinSelectors(codeGuardSelectors)
  const mathGuard = joinSelectors(mathGuardSelectors)
  const textSelector = joinSelectors(
    extraConfig.textSelectors ?? DEFAULT_TEXTUAL_DESCENDANTS
  )

  return createStandardAdapter({
    siteId,
    messageSelectors,
    textSelectors: extraConfig.textSelectors ?? DEFAULT_TEXTUAL_DESCENDANTS,
    codeGuardSelectors,
    mathGuardSelectors,
    excludeSelectors: extraConfig.excludeSelectors,
    uiExcludeSelectors: extraConfig.uiExcludeSelectors,
    rootSelector: extraConfig.rootSelector,
    rtlStyle: extraConfig.rtlStyle,
    extraCss: extraConfig.extraCss,
    applyToMessage: (element, engine) => {
      if (
        extraConfig.rootSelector &&
        !element.closest(extraConfig.rootSelector)
      ) {
        return true
      }

      if (!engine.needsRTL(getTextWithoutSelector(element, mathGuard))) {
        return true
      }

      element.querySelectorAll(textSelector).forEach((child) => {
        if (child.closest(mathGuard)) return

        if (child.closest(codeGuard)) {
          const innerText = getTextWithoutSelector(child, mathGuard)
          if (!engine.needsRTL(innerText)) return
          engine.rememberStyle(child, ["direction", "text-align"])
          child.setAttribute("dir", "rtl")
          engine.setStyle(child, "direction", "rtl")
          engine.setStyle(child, "text-align", "right")
          return
        }

        const childText = getTextWithoutSelector(child, mathGuard)
        if (engine.needsRTL(childText)) {
          engine.applyRTL(child)
        }
      })
      return true
    }
  })
}

function createTextWalkerAdapter(config: {
  codeSelector: string
  messageSelectors: string[]
  rootAppliesRtl?: boolean
  rtlClass: string
  rtlStyle?: RtlEngineConfig["rtlStyle"]
  siteId: RtlSiteId
  textualTags: Set<string>
}): RtlSiteAdapter {
  let globalStyle: HTMLStyleElement | null = null

  const shouldStyleElement = (element: HTMLElement) => {
    return (
      config.textualTags.has(element.tagName) && !isLayoutContainer(element)
    )
  }

  const resolveTextTarget = (
    textNode: Node
  ): { element: HTMLElement; isCode: boolean } | null => {
    let current = textNode.parentElement
    while (current) {
      if (current.matches(config.codeSelector)) {
        return { element: current, isCode: true }
      }
      if (shouldStyleElement(current)) {
        return { element: current, isCode: false }
      }
      current = current.parentElement
    }
    return null
  }

  const engine = new RtlEngine({
    messageSelectors: config.messageSelectors,
    textSelectors: [],
    rtlRegex: RTL_SCRIPT_REGEX,
    rtlClass: config.rtlClass,
    rtlStyle: config.rtlStyle,
    applyToMessage: (element, currentEngine) => {
      if (!(element instanceof HTMLElement)) return true

      const text = getElementText(element)
      if (!currentEngine.needsRTL(text)) return true

      if (config.rootAppliesRtl && !isLayoutContainer(element)) {
        currentEngine.applyRTL(element)
      }

      const targets = new Set<HTMLElement>()
      const codeTargets = new Set<HTMLElement>()
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()

      while (node) {
        const content = normalizeText(node.textContent)
        if (content.length >= 3 && currentEngine.needsRTL(content)) {
          const target = resolveTextTarget(node)
          if (target?.isCode) {
            codeTargets.add(target.element)
          } else if (target) {
            targets.add(target.element)
          }
        }
        node = walker.nextNode()
      }

      targets.forEach((target) => {
        currentEngine.applyRTL(target)
      })
      codeTargets.forEach((codeElement) => {
        currentEngine.rememberStyle(codeElement, ["direction", "text-align"])
        codeElement.setAttribute("dir", "rtl")
        currentEngine.setStyle(codeElement, "direction", "rtl")
        currentEngine.setStyle(codeElement, "text-align", "right")
        codeElement.classList.add(config.rtlClass)
      })

      return true
    }
  })

  const ensureGlobalStyle = () => {
    if (globalStyle) return
    globalStyle = createStyle(
      `
        ${config.codeSelector} {
          direction: ltr !important;
          text-align: left !important;
        }

        .${config.rtlClass} ul,
        .${config.rtlClass} ol,
        [dir="rtl"] ul,
        [dir="rtl"] ol {
          padding-right: 2rem;
          padding-left: 0;
        }

        .${config.rtlClass} li,
        [dir="rtl"] li,
        [dir="rtl"] button,
        [dir="rtl"] a {
          text-align: right;
        }
      `,
      config.siteId
    )
  }

  const disable = () => {
    if (!engine.enabled) return
    engine.setEnabled(false)
    engine.restoreStyles()
    globalStyle?.remove()
    globalStyle = null
  }

  return {
    siteId: config.siteId,
    enable() {
      if (engine.enabled) return
      engine.setEnabled(true)
      engine.init()
      ensureGlobalStyle()
      engine.scheduleScan(document.body || document.documentElement)
    },
    disable,
    dispose() {
      disable()
      engine.dispose()
    }
  }
}

const TEXT_WALKER_TAGS = new Set([
  "P",
  "DIV",
  "SPAN",
  "LI",
  "UL",
  "OL",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "FIGCAPTION",
  "A",
  "BUTTON"
])

const AISTUDIO_TEXT_WALKER_TAGS = new Set([
  ...TEXT_WALKER_TAGS,
  "DD",
  "DT",
  "LABEL"
])

export function createRtlSiteAdapter(siteId: RtlSiteId): RtlSiteAdapter {
  switch (siteId) {
    case "chatgpt":
      return createChatGptAdapter()
    case "claude":
      return createClaudeAdapter()
    case "gemini":
      return createGeminiAdapter()
    case "copilot":
      return createStandardAdapter({
        siteId,
        messageSelectors: [
          "cib-message",
          "cib-chat-turn",
          "[data-message-id]",
          '[data-content="ai-message"]',
          '[data-content="user-message"]',
          '[data-content*="message"]',
          '[data-testid*="message"]',
          '[class*="cib-message"]',
          '[class*="cib-chat-turn"]',
          '[class*="chat-turn"]',
          '[class*="ai-message"]',
          '[class*="message-item"]',
          '[role="article"]',
          "main [data-message-id]",
          'main [data-content*="message"]',
          'main [class*="cib-message"]',
          'main [class*="ai-message"]',
          'main [role="article"]',
          "span.font-ligatures-none"
        ],
        codeGuardSelectors: [
          ...COMMON_CODE_GUARD_SELECTORS,
          ".ace_editor",
          '[class*="language-"]'
        ]
      })
    case "perplexity":
      return createMathAwareAdapter(
        siteId,
        [
          '[data-testid*="answer"]',
          '[data-testid*="message"]',
          "[data-message-id]",
          'main div[class*="answer"]',
          'main div[class*="response"]',
          'main div[class*="markdown"]',
          'main div[class*="prose"]',
          '[class*="conversation"] article',
          '[class*="conversation"] [class*="markdown"]',
          '[class*="conversation"] [class*="prose"]'
        ],
        {
          rootSelector: "main",
          uiExcludeSelectors: [
            "header",
            "nav",
            "aside",
            "footer",
            '[role="banner"]',
            '[role="navigation"]',
            '[role="complementary"]',
            '[role="search"]',
            "#ask-input",
            '[data-testid="composer-input"]',
            '[data-testid*="composer"]',
            '[data-testid*="submit"]',
            '[data-testid*="sidebar"]',
            '[data-testid*="nav"]',
            '[data-testid*="header"]',
            '[data-testid*="thinking"]',
            '[data-testid*="home"]',
            '[data-testid*="input"]',
            '[class*="composer"]',
            '[class*="Composer"]',
            '[class*="sidebar"]',
            '[class*="Sidebar"]',
            '[class*="sidenav"]',
            '[class*="header"]',
            '[class*="Header"]',
            '[class*="thinking"]',
            '[class*="Thinking"]',
            "form",
            "input",
            "textarea",
            "button",
            '[contenteditable="true"]',
            '[contenteditable=""]',
            '[contenteditable]:not([contenteditable="false"])'
          ]
        }
      )
    case "openrouter":
      return createOpenRouterAdapter()
    case "deepseek":
      return createMathAwareAdapter(
        siteId,
        [
          "[data-message-id]",
          '[data-role="message"]',
          '[data-role="assistant"]',
          '[data-role="user"]',
          '[class*="ds-message"]',
          '[class*="ds-markdown"]',
          '[class*="markdown"]',
          '[class*="chat"]',
          "article",
          "section"
        ],
        {
          mathGuardSelectors: [
            ...COMMON_MATH_GUARD_SELECTORS,
            ".ds-markdown-math"
          ],
          rtlStyle: { unicodeBidi: "" },
          extraCss: `
            [dir="rtl"] .ds-markdown-math {
              direction: ltr !important;
              unicode-bidi: isolate;
              text-align: center !important;
            }
          `
        }
      )
    case "notebooklm":
      return createTextWalkerAdapter({
        siteId,
        messageSelectors: [
          "main",
          "article",
          "section",
          "[role='article']",
          "[role='listitem']",
          '[data-testid*="note"]',
          '[data-testid*="Note"]',
          '[data-test-id*="note"]',
          '[data-test-id*="Note"]',
          "[class*='note']",
          "[class*='Note']",
          "[class*='markdown']",
          "[class*='Markdown']",
          "[class*='editor']",
          "[class*='Editor']",
          "[class*='doc']",
          "[class*='Doc']",
          '[data-testid*="card"]',
          '[data-test-id*="card"]',
          '[data-testid*="notebook"]',
          '[data-test-id*="notebook"]',
          "[class*='NotebookCard']",
          "[class*='notebookCard']",
          "[class*='notebook-card']",
          "[class*='NotebookTile']",
          "[class*='notebookTile']",
          "[class*='notebook-tile']",
          "[class*='project-button']",
          "[class*='projectButton']",
          "[class*='project_button']",
          "[class*='project-button-title']",
          "[class*='projectButtonTitle']"
        ],
        codeSelector:
          "code, pre, [class*='code'], [class*='Code'], [class*='language-'], [class*='hljs'], .monaco-editor, .cm-editor",
        rtlClass: "fontara-rtl-text",
        rtlStyle: { unicodeBidi: "" },
        textualTags: TEXT_WALKER_TAGS
      })
    case "aistudio":
      return createTextWalkerAdapter({
        siteId,
        messageSelectors: [
          "ms-chat-session",
          "ms-chat-turn",
          "ms-text-chunk",
          "ms-prompt-chunk",
          "ms-chat-content",
          "ms-chat-body",
          "ms-message",
          "ms-cmark-node",
          '[class*="chat-session"]',
          '[class*="chatSession"]',
          '[class*="chat-turn"]',
          '[class*="chatTurn"]',
          '[class*="text-chunk"]',
          '[class*="textChunk"]',
          '[class*="prompt-chunk"]',
          '[class*="promptChunk"]',
          '[class*="chat-message"]',
          '[class*="chatMessage"]',
          '[class*="message-body"]',
          '[class*="messageBody"]',
          '[class*="response-card"]',
          "gen-ai-chat-message",
          "gen-ai-message"
        ],
        codeSelector:
          'code, pre, [class*="code"], [class*="Code"], [class*="language-"], [class*="hljs"], .monaco-editor, .cm-editor, [role="code"]',
        rootAppliesRtl: true,
        rtlClass: "fontara-rtl-text",
        rtlStyle: { unicodeBidi: "plaintext" },
        textualTags: AISTUDIO_TEXT_WALKER_TAGS
      })
    case "qwen":
      return createStandardAdapter({
        siteId,
        messageSelectors: [
          "[data-message-id]",
          "[data-msg-id]",
          '[data-role="message"]',
          '[data-role="assistant"]',
          '[data-role="user"]',
          '[data-testid*="message"]',
          '[class*="chat-message"]',
          '[class*="message-item"]',
          '[class*="messageItem"]',
          '[class*="response-message-content"]',
          '[class*="qwen-markdown"]',
          '[class*="markdown"]',
          '[class*="rendered-markdown"]',
          '[class*="chatContent"]'
        ],
        codeGuardSelectors: [
          ...COMMON_CODE_GUARD_SELECTORS,
          "[data-language]",
          '[class*="syntax"]'
        ],
        extraCss: `
          [dir="rtl"] ul,
          [dir="rtl"] ol {
            padding-right: 1.6rem;
            padding-left: 0;
          }

          [dir="rtl"] input,
          [dir="rtl"] textarea {
            text-align: right;
          }
        `
      })
    case "arena":
      return createStandardAdapter({
        siteId,
        messageSelectors: [
          "div.bg-surface-primary",
          "div.bg-surface-raised",
          ".prose",
          '[data-testid="message"]',
          "[data-message-id]",
          '[data-role="message"]',
          '[data-role="assistant"]',
          '[data-role="user"]',
          '[class*="message"]',
          '[class*="markdown"]',
          "article",
          "section"
        ],
        codeGuardSelectors: [
          ...COMMON_CODE_GUARD_SELECTORS,
          "[data-language]",
          '[class*="syntax"]'
        ],
        extraCss: `
          [dir="rtl"] ul,
          [dir="rtl"] ol {
            padding-right: 1.6rem;
            padding-left: 0;
          }

          [dir="rtl"] input,
          [dir="rtl"] textarea {
            text-align: right;
          }
        `
      })
  }
}
