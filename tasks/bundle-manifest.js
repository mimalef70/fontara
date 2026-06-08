const { absolutePath, getDestDir } = require("./paths")
const { isChromiumPlatform, PLATFORM } = require("./platform")
const { readJSON, writeJSON } = require("./utils")

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

async function bundleManifest({ platform, debug }) {
  const manifest = await readJSON(absolutePath("src/manifest.json"))
  const patch = await readPatch(platform)
  const packageJSON = await readJSON(absolutePath("package.json"))
  const patchedManifest = {
    ...manifest,
    ...patch,
    version: packageJSON.version
  }

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
    patchedManifest.version_name = `${packageJSON.version} Debug`
  }

  const outDir = getDestDir({ platform, debug })
  await writeJSON(`${outDir}/manifest.json`, patchedManifest)
}

module.exports = bundleManifest
