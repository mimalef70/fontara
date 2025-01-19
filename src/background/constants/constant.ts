import type { ExtensionState } from "../types/type"

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
