const GOOGLE_FONT_DATA_PERMISSION = "technicalAndInteraction" as const

type FirefoxDataCollectionPermissions = {
  data_collection?: string[]
}

type PermissionsWithFirefoxDataCollection = chrome.permissions.Permissions &
  FirefoxDataCollectionPermissions

function isFirefoxBuild(): boolean {
  return typeof __FIREFOX_MV3__ !== "undefined" && __FIREFOX_MV3__
}

function getRuntimeError(): Error | null {
  const error = chrome.runtime?.lastError
  return error ? new Error(error.message) : null
}

function getAllPermissions(): Promise<PermissionsWithFirefoxDataCollection> {
  return new Promise((resolve, reject) => {
    chrome.permissions.getAll((permissions) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve(permissions as PermissionsWithFirefoxDataCollection)
    })
  })
}

export async function getGoogleFontDataConsentState(): Promise<
  "granted" | "unsupported" | "not-granted"
> {
  if (!isFirefoxBuild()) return "granted"
  if (!chrome.permissions?.getAll) return "unsupported"

  const permissions = await getAllPermissions()
  if (!Array.isArray(permissions.data_collection)) return "unsupported"
  return permissions.data_collection.includes(GOOGLE_FONT_DATA_PERMISSION)
    ? "granted"
    : "not-granted"
}

export async function hasGoogleFontNetworkConsent(): Promise<boolean> {
  return (await getGoogleFontDataConsentState()) === "granted"
}

export function requestGoogleFontNetworkConsent(): Promise<boolean> {
  if (!isFirefoxBuild()) return Promise.resolve(true)
  if (!chrome.permissions?.request) return Promise.resolve(false)

  return new Promise((resolve, reject) => {
    chrome.permissions.request(
      {
        data_collection: [GOOGLE_FONT_DATA_PERMISSION]
      } as PermissionsWithFirefoxDataCollection,
      (granted) => {
        const error = getRuntimeError()
        if (error) {
          reject(error)
          return
        }
        resolve(granted)
      }
    )
  })
}

export function isGoogleFontDataPermissionRemoved(
  permissions: chrome.permissions.Permissions
): boolean {
  return (
    isFirefoxBuild() &&
    Array.isArray(
      (permissions as PermissionsWithFirefoxDataCollection).data_collection
    ) &&
    (
      permissions as PermissionsWithFirefoxDataCollection
    ).data_collection?.includes(GOOGLE_FONT_DATA_PERMISSION) === true
  )
}
