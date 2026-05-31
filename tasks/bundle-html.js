const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { copyFile } = require("./utils")

const htmlEntries = [
  {
    src: "src/ui/popup/index.html",
    dest: "ui/popup/index.html"
  },
  {
    src: "src/ui/options/index.html",
    dest: "ui/options/index.html"
  }
]

async function bundleHTML({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })

  await Promise.all(
    htmlEntries.map((entry) =>
      copyFile(absolutePath(entry.src), path.join(outDir, entry.dest))
    )
  )
}

module.exports = bundleHTML
