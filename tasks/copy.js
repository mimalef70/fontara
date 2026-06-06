const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { copyDirectory } = require("./utils")

async function copyAssets({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })

  await copyDirectory(absolutePath("assets"), path.join(outDir, "assets"))
}

module.exports = copyAssets
