export interface WebsiteItem {
  url: string
  regex: string
  icon?: string
  pattern?: string
  isActive?: boolean
}

export interface CustomFont {
  value: string
  name: string
  type: string
  fileHash: string
  originalFileName?: string
}
