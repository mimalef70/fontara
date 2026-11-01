const fs = require("node:fs")
const path = require("node:path")

const PLATFORM = {
  CHROME_MV3: "chrome-mv3",
  FIREFOX_MV3: "firefox-mv3",
  EDGE_MV3: "edge-mv3",
  BRAVE_MV3: "brave-mv3",
  OPERA_MV3: "opera-mv3",
  SAFARI_MV3: "safari-mv3"
}

const ALL_PLATFORMS = Object.values(PLATFORM)

const CHROMIUM_MV3_PLATFORMS = new Set([
  PLATFORM.CHROME_MV3,
  PLATFORM.EDGE_MV3,
  PLATFORM.BRAVE_MV3,
  PLATFORM.OPERA_MV3
])

const FONT_SETTINGS_PLATFORMS = new Set(CHROMIUM_MV3_PLATFORMS)

function isChromiumMV3Platform(platform) {
  return CHROMIUM_MV3_PLATFORMS.has(platform)
}

function supportsFontSettings(platform) {
  return FONT_SETTINGS_PLATFORMS.has(platform)
}

function getBrowserTarget(platform) {
  if (platform === PLATFORM.SAFARI_MV3) return "safari16.4"
  const firefox = platform === PLATFORM.FIREFOX_MV3
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "src",
        `manifest-${firefox ? "firefox" : "chrome"}-mv3.json`
      ),
      "utf8"
    )
  )
  const minimumVersion = firefox
    ? manifest.browser_specific_settings.gecko.strict_min_version
    : manifest.minimum_chrome_version
  return `${firefox ? "firefox" : "chrome"}${minimumVersion.split(".")[0]}`
}

module.exports = {
  PLATFORM,
  ALL_PLATFORMS,
  getBrowserTarget,
  isChromiumMV3Platform,
  supportsFontSettings
}
