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
