#!/usr/bin/env node
const { spawnSync } = require("node:child_process")
const path = require("node:path")

const result = spawnSync(process.env.ACTIONLINT_PATH || "actionlint", [], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  timeout: 60000
})
if (result.error) {
  console.error(
    "Install actionlint (https://github.com/rhysd/actionlint), or set ACTIONLINT_PATH to its executable.",
    result.error.message
  )
}
process.exitCode = result.status ?? 1
