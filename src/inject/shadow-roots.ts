export type FontaraFontRoot = HTMLElement | ShadowRoot
export type FontaraStyleRoot = Document | ShadowRoot

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement
}

function getElementShadowRoot(element: HTMLElement): ShadowRoot | null {
  const shadowRoot = element.shadowRoot

  return shadowRoot && typeof shadowRoot.querySelectorAll === "function"
    ? shadowRoot
    : null
}

export function collectOpenShadowRoots(root: ParentNode): ShadowRoot[] {
  const shadowRoots: ShadowRoot[] = []
  const seen = new WeakSet<ShadowRoot>()

  function collectFromRoot(currentRoot: ParentNode): void {
    const elements = [
      ...(isHTMLElement(currentRoot) ? [currentRoot] : []),
      ...Array.from(currentRoot.querySelectorAll?.<HTMLElement>("*") ?? [])
    ]

    for (const element of elements) {
      const shadowRoot = getElementShadowRoot(element)
      if (!shadowRoot || seen.has(shadowRoot)) continue

      seen.add(shadowRoot)
      shadowRoots.push(shadowRoot)
      collectFromRoot(shadowRoot)
    }
  }

  collectFromRoot(root)
  return shadowRoots
}

export function getDocumentAndShadowStyleRoots(): FontaraStyleRoot[] {
  return [document, ...collectOpenShadowRoots(document)]
}
