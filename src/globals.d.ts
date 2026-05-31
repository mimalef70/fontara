declare module "*.css" {
  const content: string
  export default content
}

declare module "*.css?text" {
  const content: string
  export default content
}

declare module "*?text" {
  const content: string
  export default content
}

declare const __DEBUG__: boolean
declare const __PLATFORM__: string
declare const __CHROMIUM_MV3__: boolean
declare const __FIREFOX_MV3__: boolean
