const PLATFORM = {
  CHROME_MV3: "chrome-mv3",
  FIREFOX_MV3: "firefox-mv3",
  EDGE_MV3: "edge-mv3",
  BRAVE_MV3: "brave-mv3",
  OPERA_MV3: "opera-mv3",
  SAFARI_MV3: "safari-mv3"
}

const ALL_PLATFORMS = Object.values(PLATFORM)

const CHROMIUM_PLATFORMS = new Set([
  PLATFORM.CHROME_MV3,
  PLATFORM.EDGE_MV3,
  PLATFORM.BRAVE_MV3,
  PLATFORM.OPERA_MV3,
  PLATFORM.SAFARI_MV3
])

function isChromiumPlatform(platform) {
  return CHROMIUM_PLATFORMS.has(platform)
}

module.exports = {
  PLATFORM,
  ALL_PLATFORMS,
  isChromiumPlatform
}
