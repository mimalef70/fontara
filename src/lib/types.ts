export interface WebsiteItem {
  url: string
  regex: string
  icon?: string
  pattern?: string
  isActive?: boolean
  siteName?: string
  version?: string
  customCss?: string
}

export interface CustomFont {
  value: string
  name: string
  type: string
  fileHash: string
  originalFileName?: string
}

export interface FontData {
  value: string
  name: string
  data: string
  type: string
  // fileHash: string
  originalFileName: string
}
