const fs = require("node:fs")
const { exec } = require("node:child_process")
const path = require("node:path")
const yazl = require("yazl")

const { absolutePath } = require("./paths")

const SOURCE_PACKAGE_FILES = [
  "FIREFOX_SOURCE_README.md",
  "README.md",
  "biome.json",
  "components.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "postcss.config.js",
  "tailwind.config.js",
  "tsconfig.json"
]

const SOURCE_PACKAGE_DIRECTORIES = ["assets", "src", "tasks", "tests"]

const EXCLUDED_NAMES = new Set([".DS_Store"])

async function collectDirectoryFiles(directory, prefix) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) continue

    const entryPath = path.join(directory, entry.name)
    const zipPath = `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      files.push(...(await collectDirectoryFiles(entryPath, zipPath)))
    } else if (entry.isFile()) {
      files.push({ sourcePath: entryPath, zipPath })
    }
  }

  return files
}

async function getLastCommitTime() {
  return new Promise((resolve) => {
    exec("git log -1 --format=%ct", (_error, stdout) => {
      const timestamp = Number(stdout)
      const seconds = Number.isFinite(timestamp) ? timestamp : 0
      resolve(new Date(Math.max(0, seconds) * 1000))
    })
  })
}

let zipFileOptionsPromise = null
async function getZipFileOptions() {
  if (!zipFileOptionsPromise) {
    zipFileOptionsPromise = getLastCommitTime().then((mtime) => ({
      mode: 0o644,
      mtime
    }))
  }

  return zipFileOptionsPromise
}

async function collectSourcePackageFiles() {
  const sourceFiles = SOURCE_PACKAGE_FILES.map((filePath) => ({
    sourcePath: absolutePath(filePath),
    zipPath: filePath
  }))
  const sourceDirectories = await Promise.all(
    SOURCE_PACKAGE_DIRECTORIES.map((directory) =>
      collectDirectoryFiles(absolutePath(directory), directory)
    )
  )

  return [...sourceFiles, ...sourceDirectories.flat()].sort((a, b) =>
    a.zipPath.localeCompare(b.zipPath)
  )
}

async function createSourcePackage() {
  const packageJSON = JSON.parse(
    await fs.promises.readFile(absolutePath("package.json"), "utf8")
  )
  const zipPath = absolutePath(
    "build",
    `firefox-mv3-source-${packageJSON.version}.zip`
  )

  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true })
  await fs.promises.rm(zipPath, { force: true })
  const files = await collectSourcePackageFiles()
  const options = await getZipFileOptions()

  await new Promise((resolve, reject) => {
    const zipFile = new yazl.ZipFile()
    const output = fs.createWriteStream(zipPath)

    output.on("close", resolve)
    output.on("error", reject)
    zipFile.outputStream.on("error", reject)
    zipFile.outputStream.pipe(output)

    Promise.resolve()
      .then(async () => {
        for (const file of files) {
          await fs.promises.access(file.sourcePath)
          zipFile.addFile(file.sourcePath, file.zipPath, options)
        }
        zipFile.end()
      })
      .catch(reject)
  })

  return zipPath
}

createSourcePackage()
  .then((zipPath) => {
    console.log(`Created Firefox source package: ${zipPath}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
