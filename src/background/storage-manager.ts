import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontData, WebsiteItem } from "../definitions"
import { getLocalValue, setLocalValue } from "../utils/storage"

export function mergeWebsiteLists(
  existingList: WebsiteItem[],
  defaultList: WebsiteItem[]
): WebsiteItem[] {
  const mergedList = [...existingList]

  for (const defaultSite of defaultList) {
    const existingIndex = mergedList.findIndex(
      (site) => site.url === defaultSite.url
    )

    if (existingIndex === -1) {
      mergedList.push(defaultSite)
      continue
    }

    if ("version" in defaultSite) {
      const existingSite = mergedList[existingIndex]

      if (
        !("version" in existingSite) ||
        existingSite.version !== defaultSite.version
      ) {
        mergedList[existingIndex] = {
          ...defaultSite,
          isActive: existingSite.isActive
        }
      }
    }
  }

  return mergedList
}

function dataURLToBytes(dataURL: string): Uint8Array {
  const [, base64Data] = dataURL.split(",", 2)
  if (!base64Data) {
    return new TextEncoder().encode(dataURL)
  }

  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function createSHA256Hash(data: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function normalizeCustomFontList(
  customFontList: unknown
): Promise<FontData[]> {
  if (!Array.isArray(customFontList)) {
    return DEFAULT_VALUES.CUSTOM_FONT_LIST
  }

  const normalizedFonts = await Promise.all(
    customFontList.map(async (font) => {
      const customFont = font as Partial<FontData>
      if (
        !customFont.value ||
        !customFont.name ||
        !customFont.data ||
        !customFont.type
      ) {
        return null
      }

      return {
        value: customFont.value,
        name: customFont.name,
        data: customFont.data,
        type: customFont.type,
        fileHash:
          customFont.fileHash ||
          (await createSHA256Hash(dataURLToBytes(customFont.data))),
        originalFileName: customFont.originalFileName || customFont.name
      }
    })
  )

  return normalizedFonts.filter((font): font is FontData => font !== null)
}

export async function ensureStorageValues(): Promise<void> {
  const storageUpdates: Record<string, unknown> = {}

  const extensionEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED
  )
  if (extensionEnabled === undefined) {
    storageUpdates[STORAGE_KEYS.EXTENSION_ENABLED] =
      DEFAULT_VALUES.EXTENSION_ENABLED
  }

  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  if (selectedFont === undefined) {
    storageUpdates[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  const websiteList = await getLocalValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST
  )
  if (websiteList === undefined) {
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = DEFAULT_VALUES.WEBSITE_LIST
  } else {
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = mergeWebsiteLists(
      websiteList,
      DEFAULT_VALUES.WEBSITE_LIST
    )
  }

  const customFontList = await getLocalValue(STORAGE_KEYS.CUSTOM_FONT_LIST)
  if (customFontList === undefined) {
    storageUpdates[STORAGE_KEYS.CUSTOM_FONT_LIST] =
      DEFAULT_VALUES.CUSTOM_FONT_LIST
  } else {
    storageUpdates[STORAGE_KEYS.CUSTOM_FONT_LIST] =
      await normalizeCustomFontList(customFontList)
  }

  await Promise.all(
    Object.entries(storageUpdates).map(([key, value]) =>
      setLocalValue(key, value)
    )
  )
}
