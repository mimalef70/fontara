const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { copyDirectory, copyFile } = require("./utils")

async function copyAssets({ platform, debug, test = false }) {
  const outDir = getDestDir({ platform, debug, test })

  await copyDirectory(absolutePath("assets"), path.join(outDir, "assets"))
  await Promise.all(
    ["LICENSE", "THIRD_PARTY_NOTICES.md"].map((fileName) =>
      copyFile(absolutePath(fileName), path.join(outDir, fileName))
    )
  )
  await copyDirectory(
    absolutePath("FONT_LICENSES"),
    path.join(outDir, "FONT_LICENSES")
  )
}

module.exports = copyAssets
