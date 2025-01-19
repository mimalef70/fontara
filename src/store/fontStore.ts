// store/fontStore.ts
import { Storage } from "@plasmohq/storage"

import type { UrlItem } from "../contents/plasmoContent/types"

interface FontState {
  currentFont: string
  activePopularUrls: string[]
  activeCustomUrls: string[]
  isExtensionEnabled: boolean
}

const storage = new Storage()

//? initialize from Storage
export const initializeState = async (): Promise<void> => {
  try {
    const storedFont = await storage.get<string>("selectedFont")
    const storedActivePopularUrls =
      await storage.get<UrlItem[]>("popularActiveUrls")
    const storedActiveCustomUrls =
      await storage.get<UrlItem[]>("customActiveUrls")
    const storedExtensionState =
      await storage.get<boolean>("isExtensionEnabled")
    state.currentFont = storedFont || "Estedad"
    state.activePopularUrls = storedActivePopularUrls
      ? storedActivePopularUrls
          .filter((item) => item.isActive)
          .map((item) => item.url)
      : ["*://*/*"]
    state.activeCustomUrls = storedActiveCustomUrls
      ? storedActiveCustomUrls
          .filter((item) => item.isActive)
          .map((item) => item.url)
      : []
    state.isExtensionEnabled = storedExtensionState || true
  } catch (error) {
    console.error("Error initializing state:", error)
  }
}

export const state: FontState = {
  currentFont: "Estedad",
  activePopularUrls: [],
  activeCustomUrls: [],
  isExtensionEnabled: true
}

export const getState = () => state

export const setCurrentFont = (font: string) => {
  state.currentFont = font
}

export const setActivePopularUrls = (urls: string[]) => {
  state.activePopularUrls = urls
}

export const setActiveCustomUrls = (urls: string[]) => {
  state.activeCustomUrls = urls
}

export const setExtensionEnabled = (enabled: boolean) => {
  state.isExtensionEnabled = enabled
}
