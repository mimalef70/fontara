const fs = require("node:fs")
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

async function addFile(zipFile, sourcePath, zipPath) {
  await fs.promises.access(sourcePath)
  zipFile.addFile(sourcePath, zipPath)
}

async function addDirectory(zipFile, directory, prefix) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) continue

    const entryPath = path.join(directory, entry.name)
    const zipPath = `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      await addDirectory(zipFile, entryPath, zipPath)
    } else if (entry.isFile()) {
      zipFile.addFile(entryPath, zipPath)
    }
  }
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

  await new Promise((resolve, reject) => {
    const zipFile = new yazl.ZipFile()
    const output = fs.createWriteStream(zipPath)

    output.on("close", resolve)
    output.on("error", reject)
    zipFile.outputStream.on("error", reject)
    zipFile.outputStream.pipe(output)

    Promise.all([
      ...SOURCE_PACKAGE_FILES.map((filePath) =>
        addFile(zipFile, absolutePath(filePath), filePath)
      ),
      ...SOURCE_PACKAGE_DIRECTORIES.map((directory) =>
        addDirectory(zipFile, absolutePath(directory), directory)
      )
    ])
      .then(() => zipFile.end())
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
