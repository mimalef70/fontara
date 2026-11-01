const fs = require("node:fs")
const { exec } = require("node:child_process")
const path = require("node:path")
const yazl = require("yazl")

const { getDestDir, getZipPath } = require("./paths")

const MAX_EXTENSION_ZIP_BYTES = 2.5 * 1024 * 1024

async function collectFiles(directory, prefix = "") {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue

    const entryPath = path.join(directory, entry.name)
    const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, archivePath)))
    } else if (entry.isFile()) {
      files.push({ archivePath, filePath: entryPath })
    }
  }

  return files
}

async function getLastCommitTime() {
  return new Promise((resolve) => {
    exec("git log -1 --format=%ct", (_error, stdout) => {
      const timestamp = Number(stdout)
      const seconds = Number.isFinite(timestamp) ? timestamp : 0
      const commitDate = new Date(Math.max(0, seconds) * 1000)
      resolve(
        new Date(
          commitDate.getUTCFullYear(),
          commitDate.getUTCMonth(),
          commitDate.getUTCDate(),
          commitDate.getUTCHours(),
          commitDate.getUTCMinutes(),
          commitDate.getUTCSeconds()
        )
      )
    })
  })
}

async function addDirectory(zipFile, directory) {
  const files = await collectFiles(directory)
  files.sort((a, b) => a.archivePath.localeCompare(b.archivePath))

  const mtime = await getLastCommitTime()
  for (const file of files) {
    zipFile.addFile(file.filePath, file.archivePath, {
      mode: 0o644,
      mtime
    })
  }
}

async function zipBuild({ platform }) {
  const sourceDir = getDestDir({ platform, debug: false })
  const zipPath = getZipPath({ platform })
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true })

  const originalTimezone = process.env.TZ
  process.env.TZ = "UTC"

  try {
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
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTimezone
    }
  }

  const { size } = await fs.promises.stat(zipPath)
  if (size > MAX_EXTENSION_ZIP_BYTES) {
    throw new Error(
      `${path.basename(zipPath)} exceeds the ${MAX_EXTENSION_ZIP_BYTES} byte release budget (${size} bytes).`
    )
  }
}

module.exports = zipBuild
