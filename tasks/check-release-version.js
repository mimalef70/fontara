#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")

const rootDir = path.resolve(__dirname, "..")
const packageJSON = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
)
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src/manifest.json"), "utf8")
)

if (packageJSON.version !== sourceManifest.version) {
  throw new Error(
    `Version mismatch: package.json=${packageJSON.version}, manifest=${sourceManifest.version}`
  )
}

const tag = process.env.GITHUB_REF_NAME || process.env.FONTARA_RELEASE_TAG
if (tag?.startsWith("v") && tag.slice(1) !== packageJSON.version) {
  throw new Error(
    `Release tag ${tag} does not match package version ${packageJSON.version}.`
  )
}

for (const target of ["chrome-mv3", "firefox-mv3"]) {
  const builtManifestPath = path.join(
    rootDir,
    "build",
    `${target}-prod`,
    "manifest.json"
  )
  if (!fs.existsSync(builtManifestPath)) continue
  const builtManifest = JSON.parse(fs.readFileSync(builtManifestPath, "utf8"))
  if (builtManifest.version !== packageJSON.version) {
    throw new Error(
      `Built ${target} version ${builtManifest.version} does not match ${packageJSON.version}.`
    )
  }
}

console.log(`FontARA release version ${packageJSON.version} is consistent.`)
