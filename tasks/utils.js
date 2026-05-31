const fs = require("node:fs")
const path = require("node:path")

async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJSON(filePath) {
  const text = await fs.promises.readFile(filePath, "utf8")
  return JSON.parse(text)
}

async function writeJSON(filePath, data) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

async function copyFile(source, destination) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.copyFile(source, destination)
}

async function copyDirectory(source, destination) {
  if (!(await pathExists(source))) return

  const entries = await fs.promises.readdir(source, { withFileTypes: true })
  await fs.promises.mkdir(destination, { recursive: true })

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue

    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath)
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath)
    }
  }
}

async function emptyDirectory(directory) {
  await fs.promises.rm(directory, { recursive: true, force: true })
  await fs.promises.mkdir(directory, { recursive: true })
}

module.exports = {
  copyDirectory,
  copyFile,
  emptyDirectory,
  pathExists,
  readJSON,
  writeJSON
}
