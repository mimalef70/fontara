const fs = require("node:fs")
const path = require("node:path")
const yazl = require("yazl")

const { getDestDir, getZipPath } = require("./paths")

async function addDirectory(zipFile, directory, prefix = "") {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue

    const entryPath = path.join(directory, entry.name)
    const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      await addDirectory(zipFile, entryPath, zipPath)
    } else if (entry.isFile()) {
      zipFile.addFile(entryPath, zipPath)
    }
  }
}

async function zipBuild({ platform }) {
  const sourceDir = getDestDir({ platform, debug: false })
  const zipPath = getZipPath({ platform })
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true })

  await new Promise((resolve, reject) => {
    const zipFile = new yazl.ZipFile()
    const output = fs.createWriteStream(zipPath)

    output.on("close", resolve)
    output.on("error", reject)
    zipFile.outputStream.on("error", reject)
    zipFile.outputStream.pipe(output)

    addDirectory(zipFile, sourceDir)
      .then(() => zipFile.end())
      .catch(reject)
  })
}

module.exports = zipBuild
