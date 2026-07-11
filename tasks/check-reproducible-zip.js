#!/usr/bin/env node

const crypto = require("node:crypto")
const fs = require("node:fs")
const { spawnSync } = require("node:child_process")
const path = require("node:path")

const rootDir = path.resolve(__dirname, "..")
const packageJSON = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
)
const artifactNames = [
  "brave-mv3-prod.zip",
  "chrome-mv3-prod.zip",
  "edge-mv3-prod.zip",
  "firefox-mv3-prod.zip",
  `firefox-mv3-source-${packageJSON.version}.zip`,
  "opera-mv3-prod.zip",
  "safari-mv3-prod.zip"
]

function hashArtifact(artifactName) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, "build", artifactName)))
    .digest("hex")
}

function buildInTimezone(timezone) {
  const result = spawnSync(
    process.execPath,
    ["tasks/cli.js", "build", "--release", "--all"],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: { ...process.env, TZ: timezone }
    }
  )
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Release build failed.")
  }
  return new Map(
    artifactNames.map((artifactName) => [
      artifactName,
      hashArtifact(artifactName)
    ])
  )
}

const utcHashes = buildInTimezone("UTC")
const tehranHashes = buildInTimezone("Asia/Tehran")
for (const artifactName of artifactNames) {
  const utcHash = utcHashes.get(artifactName)
  const tehranHash = tehranHashes.get(artifactName)
  if (utcHash !== tehranHash) {
    throw new Error(
      `${artifactName} is not reproducible across timezones: ${utcHash} != ${tehranHash}`
    )
  }
}

console.log("Reproducible release ZIPs:")
for (const artifactName of artifactNames) {
  console.log(`${artifactName} ${utcHashes.get(artifactName)}`)
}
