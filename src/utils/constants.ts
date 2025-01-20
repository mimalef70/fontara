import type { ExtensionState } from "./types"

export const excludedTags = [
  "script",
  "style",
  "img",
  "svg",
  "path",
  "circle",
  "rect",
  "polygon",
  "canvas",
  "video",
  "audio"
]

export const iconClasses = [
  "fa",
  "fas",
  "far",
  "fal",
  "fad",
  "fab",
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
]

export const DEFAULT_STATE: ExtensionState = {
  isEnabled: true,
  defaultFont: {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
}

export const ICON_PATHS = {
  default: {
    path: {
      "16": "../../assets/icon-16.png",
      "32": "../../assets/icon-32.png",
      "48": "../../assets/icon-48.png"
    }
  },
  active: {
    path: {
      "16": "../../assets/icon-active-16.png",
      "32": "../../assets/icon-active-32.png",
      "48": "../../assets/icon-active-48.png"
    }
  }
}
