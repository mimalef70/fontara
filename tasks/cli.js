#!/usr/bin/env node

const { build, watch } = require("./build")
const { ALL_PLATFORMS, PLATFORM } = require("./platform")

function getPlatforms(args) {
  const platformFlags = {
    "--chrome": PLATFORM.CHROME_MV3,
    "--chrome-mv3": PLATFORM.CHROME_MV3,
    "--firefox": PLATFORM.FIREFOX_MV3,
    "--firefox-mv3": PLATFORM.FIREFOX_MV3,
    "--edge": PLATFORM.EDGE_MV3,
    "--edge-mv3": PLATFORM.EDGE_MV3,
    "--brave": PLATFORM.BRAVE_MV3,
    "--brave-mv3": PLATFORM.BRAVE_MV3,
    "--opera": PLATFORM.OPERA_MV3,
    "--opera-mv3": PLATFORM.OPERA_MV3,
    "--safari": PLATFORM.SAFARI_MV3,
    "--safari-mv3": PLATFORM.SAFARI_MV3
  }

  if (args.includes("--all")) {
    return ALL_PLATFORMS
  }

  const platforms = args.map((arg) => platformFlags[arg]).filter(Boolean)

  return platforms.length > 0 ? [...new Set(platforms)] : [PLATFORM.CHROME_MV3]
}

async function main() {
  const [, , command = "build", ...args] = process.argv

  if (command !== "build") {
    throw new Error(`Unknown command: ${command}`)
  }

  const debug = args.includes("--debug")
  const release = args.includes("--release")
  const watchMode = args.includes("--watch")
  const platforms = getPlatforms(args)
  const shouldZip = release || args.includes("--zip")

  await build({
    platforms,
    debug: debug && !release,
    zip: shouldZip
  })

  if (watchMode) {
    watch({
      platforms,
      debug: debug && !release,
      zip: shouldZip
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
