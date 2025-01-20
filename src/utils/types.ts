export interface FontRecord {
  [key: string]: string
}

export interface UrlItem {
  id?: string
  src?: string
  isActive: boolean
  url: string
}

export interface MessageResponse {
  success: boolean
  error?: string
}

export interface FontUpdateMessage {
  action: "updateFont"
  fontName: string
}

export interface PopularUrlsMessage {
  action: "updatePopularActiveUrls"
  popularActiveUrls: UrlItem[]
}

export interface CustomUrlsMessage {
  action: "updateCustomUrlStatus"
  data: UrlItem[]
}

export interface ActiveStatusMessage {
  action: "setActiveStatus"
  isActive: boolean
}

export interface ToogleStatus {
  action: "toggle"
  isExtensionEnabled: boolean
}

export interface RefreshMessage {
  action: "refreshFonts"
}

export type BrowserMessage =
  | FontUpdateMessage
  | PopularUrlsMessage
  | CustomUrlsMessage
  | ActiveStatusMessage
  | ToogleStatus
  | RefreshMessage

export interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

export interface BoxItem {
  id?: string
  src?: string
  isActive: boolean
  url: string
}
