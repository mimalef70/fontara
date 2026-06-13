#!/usr/bin/env node

const { spawnSync } = require("node:child_process")

const sourceDir = process.argv[2] || "./build/firefox-mv3-prod"

function isAllowedWarning(warning) {
  return (
    warning?.code === "UNSAFE_VAR_ASSIGNMENT" &&
    warning?.message === "Unsafe assignment to innerHTML" &&
    (warning?.file === "ui/options/index.js" ||
      warning?.file === "ui/popup/index.js") &&
    warning?.line === 9
  )
}

function formatIssue(issue) {
  const location = [issue.file, issue.line, issue.column]
    .filter((part) => part !== undefined && part !== null)
    .join(":")
  return `${location || "unknown"} ${issue.code || "UNKNOWN"} ${
    issue.message || ""
  }`.trim()
}

const result = spawnSync(
  "web-ext",
  ["lint", "--source-dir", sourceDir, "--output", "json"],
  {
    encoding: "utf8"
  }
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

let report
try {
  report = JSON.parse(result.stdout)
} catch (error) {
  console.error("Failed to parse web-ext lint JSON output.")
  if (result.stdout) console.error(result.stdout)
  if (result.stderr) console.error(result.stderr)
  console.error(error)
  process.exit(1)
}

const errors = Array.isArray(report.errors) ? report.errors : []
const warnings = Array.isArray(report.warnings) ? report.warnings : []
const unexpectedWarnings = warnings.filter(
  (warning) => !isAllowedWarning(warning)
)

if (errors.length > 0 || unexpectedWarnings.length > 0) {
  if (errors.length > 0) {
    console.error(`web-ext lint found ${errors.length} error(s):`)
    console.error(errors.map(formatIssue).join("\n"))
  }

  if (unexpectedWarnings.length > 0) {
    console.error(
      `web-ext lint found ${unexpectedWarnings.length} unexpected warning(s):`
    )
    console.error(unexpectedWarnings.map(formatIssue).join("\n"))
  }

  process.exit(1)
}

console.log(
  `web-ext lint passed with ${warnings.length} allowed third-party warning(s).`
)
