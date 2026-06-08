const { absolutePath, getDestDir } = require("./paths")
const { isChromiumPlatform, PLATFORM } = require("./platform")
const { readJSON, writeJSON } = require("./utils")

const DYNAMIC_WEB_ACCESSIBLE_RESOURCE_PLATFORMS = new Set([
  PLATFORM.CHROME_MV3,
  PLATFORM.EDGE_MV3,
  PLATFORM.BRAVE_MV3,
  PLATFORM.OPERA_MV3
])

async function readPatch(platform) {
  if (isChromiumPlatform(platform)) {
    return readJSON(absolutePath("src/manifest-chrome-mv3.json"))
  }

  if (platform === PLATFORM.FIREFOX_MV3) {
    return readJSON(absolutePath("src/manifest-firefox-mv3.json"))
  }

  return {}
}

function getMessageText(messages, key, fallback) {
  return typeof messages?.[key]?.message === "string"
    ? messages[key].message
    : fallback
}

function withDynamicWebAccessibleResourceURLs(manifest, platform) {
  if (
    !DYNAMIC_WEB_ACCESSIBLE_RESOURCE_PLATFORMS.has(platform) ||
    !Array.isArray(manifest.web_accessible_resources)
  ) {
    return manifest
  }

  return {
    ...manifest,
    web_accessible_resources: manifest.web_accessible_resources.map((rule) => ({
      ...rule,
      use_dynamic_url: true
    }))
  }
}

function withDebugCommandDescriptions(manifest, messages) {
  if (!manifest.commands) return manifest

  return {
    ...manifest,
    commands: Object.fromEntries(
      Object.entries(manifest.commands).map(([name, command]) => {
        if (typeof command.description !== "string") {
          return [name, command]
        }

        const messageKey = command.description.match(/^__MSG_(.+)__$/)?.[1]
        if (!messageKey) {
          return [name, command]
        }

        return [
          name,
          {
            ...command,
            description: getMessageText(
              messages,
              messageKey,
              command.description
            )
          }
        ]
      })
    )
  }
}

async function bundleManifest({ platform, debug }) {
  const manifest = await readJSON(absolutePath("src/manifest.json"))
  const patch = await readPatch(platform)
  const packageJSON = await readJSON(absolutePath("package.json"))
  let patchedManifest = {
    ...manifest,
    ...patch,
    version: packageJSON.version
  }
  patchedManifest = withDynamicWebAccessibleResourceURLs(
    patchedManifest,
    platform
  )

  if (debug) {
    const catalog = await readJSON(absolutePath("src/i18n/messages.json"))
    const defaultMessages = catalog.extension?.en

    patchedManifest.name = "FontAra Debug"
    patchedManifest.short_name = getMessageText(
      defaultMessages,
      "extensionShortName",
      "FontAra"
    )
    patchedManifest.description = getMessageText(
      defaultMessages,
      "extensionDescription",
      "FontAra debug build."
    )
    patchedManifest = withDebugCommandDescriptions(
      patchedManifest,
      defaultMessages
    )
    patchedManifest.version_name = `${packageJSON.version} Debug`
    delete patchedManifest.default_locale
  }

  const outDir = getDestDir({ platform, debug })
  await writeJSON(`${outDir}/manifest.json`, patchedManifest)
}

module.exports = bundleManifest
