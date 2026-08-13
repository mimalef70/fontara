export const EXCLUDED_TAGS = new Set([
  "script",
  "style",
  "pre",
  "code",
  "img",
  "svg",
  "path",
  "circle",
  "rect",
  "polygon",
  "canvas",
  "video",
  "audio",
  "mu"
])

export const ICON_CLASSES = new Set([
  "fa",
  "fab",
  "fad",
  "fal",
  "far",
  "fas",
  "fass",
  "fasr",
  "fat",
  "icofont",
  "typcn",
  "material-icons",
  "material-icons-outlined",
  "material-icons-round",
  "material-icons-sharp",
  "glyphicon",
  "icon",
  "iconfont",
  "mui-icon",
  "dashicons",
  "wp-menu-image"
])

export const ICON_CLASS_PREFIXES = ["fa-", "mu-", "vjs-"]

export const ICON_CLASS_SUBSTRINGS = [
  "icon",
  "Icon",
  "symbol",
  "Symbol",
  "material-symbol",
  "material-icon"
]

export const EXCLUDED_INLINE_FONT_STYLE_PATTERN =
  /(?:^|;)\s*font(?:-family)?\s*:/i

export const ICON_EXCLUDED_SELECTORS = [
  '[aria-hidden="true"]',
  '[class*="fa-"]',
  ".fa",
  ".fab",
  ".fad",
  ".fal",
  ".far",
  ".fas",
  ".fass",
  ".fasr",
  ".fat",
  ".icofont",
  '[class*="icon"]',
  '[class*="Icon"]',
  '[class*="symbol"]',
  '[class*="Symbol"]',
  ".glyphicon",
  '[class*="material-symbol"]',
  '[class*="material-icon"]',
  "mu",
  '[class*="mu-"]',
  ".typcn",
  '[class*="vjs-"]'
]

export const GLOBAL_TEXT_EFFECT_EXCLUDED_SELECTORS = [
  "pre",
  "pre *",
  "code",
  '[style*="font-"]',
  ...ICON_EXCLUDED_SELECTORS
]
