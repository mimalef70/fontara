const chokidar = require("chokidar")

const bundleCSS = require("./bundle-css")
const bundleHTML = require("./bundle-html")
const bundleJS = require("./bundle-js")
const bundleLocales = require("./bundle-locales")
const bundleManifest = require("./bundle-manifest")
const copyAssets = require("./copy")
const { getDestDir } = require("./paths")
const { emptyDirectory } = require("./utils")
const validateBuild = require("./validate-build")
const zipBuild = require("./zip")

const watchRoots = [
  "assets",
  "src",
  "tailwind.config.js",
  "postcss.config.js",
  "package.json"
]

async function buildPlatform({ platform, debug, zip }) {
  const outDir = getDestDir({ platform, debug })
  await emptyDirectory(outDir)

  await bundleHTML({ platform, debug })
  await bundleJS({ platform, debug })
  await bundleCSS({ platform, debug })
  await bundleManifest({ platform, debug })
  await bundleLocales({ platform, debug })
  await copyAssets({ platform, debug })
  await validateBuild({ platform, debug })

  if (zip && !debug) {
    await zipBuild({ platform })
  }
}

async function build({ platforms, debug, zip }) {
  for (const platform of platforms) {
    await buildPlatform({ platform, debug, zip })
  }
}

function watch({ platforms, debug, zip }) {
  let timer = null
  let building = false
  let pending = false

  const rebuild = async () => {
    if (building) {
      pending = true
      return
    }

    building = true
    console.log("Rebuilding FontAra extension...")

    try {
      await build({ platforms, debug, zip })
      console.log("Build finished.")
    } catch (error) {
      console.error(error)
    } finally {
      building = false
      if (pending) {
        pending = false
        await rebuild()
      }
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(rebuild, 150)
  }

  const watcher = chokidar.watch(watchRoots, {
    awaitWriteFinish: {
      pollInterval: 25,
      stabilityThreshold: 100
    },
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "build/**"]
  })

  watcher.on("all", schedule)
  watcher.on("error", (error) => console.error(error))

  console.log("Watching source files...")
  return watcher
}

module.exports = {
  build,
  watch
}
