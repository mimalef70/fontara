export interface WebsiteItem {
  url: string
  regex: string
  icon?: string
  pattern?: string
  isActive?: boolean
  siteName?: string
}

export interface CustomFont {
  value: string
  name: string
  type: string
  fileHash: string
  originalFileName?: string
}
