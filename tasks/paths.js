const path = require("node:path")

const rootDir = path.resolve(__dirname, "..")

function absolutePath(...parts) {
  return path.join(rootDir, ...parts)
}

function getDestDir({ platform, debug, test = false }) {
  const mode = test ? "test" : debug ? "dev" : "prod"
  return absolutePath("build", `${platform}-${mode}`)
}

function getZipPath({ platform }) {
  return absolutePath("build", `${platform}-prod.zip`)
}

module.exports = {
  absolutePath,
  getDestDir,
  getZipPath,
  rootDir
}
