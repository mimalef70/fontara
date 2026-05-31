const path = require("node:path")

const rootDir = path.resolve(__dirname, "..")

function absolutePath(...parts) {
  return path.join(rootDir, ...parts)
}

function getDestDir({ platform, debug }) {
  return absolutePath("build", `${platform}-${debug ? "dev" : "prod"}`)
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
