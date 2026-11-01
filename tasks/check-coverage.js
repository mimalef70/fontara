#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const rootDir = path.resolve(__dirname, "..")

function listTests(directory) {
  return fs
    .readdirSync(path.join(rootDir, directory))
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .sort()
    .map((fileName) => path.join(directory, fileName))
}

const testFiles = [...listTests("tests/unit"), ...listTests("tests/inject")]

// Browser-only React surfaces are verified by the browser matrix. This gate
// measures the release-critical logic that Node can instrument directly. The
// generated Google Fonts catalog is deliberately absent from every group.
const coverageGroups = [
  {
    name: "core",
    thresholds: { lines: 90, branches: 82, functions: 88 },
    includes: [
      "src/background/custom-font-*.ts",
      "src/background/settings-manager.ts",
      "src/background/storage-manager.ts",
      "src/background/tab-manager.ts",
      "src/utils/custom-font-*.ts",
      "src/utils/custom-fonts.ts",
      "src/utils/font-*.ts",
      "src/utils/settings-*.ts",
      "src/utils/storage*.ts",
      "src/utils/system-fonts.ts"
    ]
  },
  {
    name: "font",
    thresholds: { lines: 90, branches: 85, functions: 88 },
    includes: [
      "src/background/custom-font-*.ts",
      "src/utils/custom-font-*.ts",
      "src/utils/custom-fonts.ts",
      "src/utils/font-*.ts",
      "src/utils/system-fonts.ts"
    ]
  },
  {
    name: "google-local-font",
    thresholds: { lines: 90, branches: 78, functions: 90 },
    includes: [
      "src/background/google-font-*.ts",
      "src/google-font-binary-types.ts",
      "src/inject/local-font-manager.ts",
      "src/utils/google-font-*.ts"
    ]
  },
  {
    name: "storage",
    thresholds: { lines: 90, branches: 85, functions: 88 },
    includes: [
      "src/background/settings-manager.ts",
      "src/background/storage-manager.ts",
      "src/utils/settings-*.ts",
      "src/utils/storage*.ts"
    ]
  },
  {
    name: "tab",
    thresholds: { lines: 90, branches: 85, functions: 88 },
    includes: ["src/background/tab-manager.ts"]
  }
]

const failedGroups = []

function getCoverageReport(output) {
  const markerStart = output.indexOf("start of coverage report")
  if (markerStart < 0) return null
  const reportStart = output.lastIndexOf("\n", markerStart) + 1
  const markerEnd = output.indexOf("end of coverage report", markerStart)
  if (markerEnd < 0) return null
  const reportEndLine = output.indexOf("\n", markerEnd)
  return output
    .slice(reportStart, reportEndLine < 0 ? undefined : reportEndLine)
    .trim()
}

for (const group of coverageGroups) {
  const { branches, functions, lines } = group.thresholds
  console.log(
    `\nCoverage: ${group.name} (lines ${lines}%, branches ${branches}%, functions ${functions}%)`
  )

  const args = [
    "--experimental-test-coverage",
    `--test-coverage-lines=${lines}`,
    `--test-coverage-branches=${branches}`,
    `--test-coverage-functions=${functions}`,
    ...group.includes.map((include) => `--test-coverage-include=${include}`),
    "--import",
    "tsx",
    "--test",
    ...testFiles
  ]
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 32 * 1024 * 1024
  })

  if (result.error) {
    console.error(
      `Unable to run the ${group.name} coverage group:`,
      result.error
    )
    failedGroups.push(group.name)
  } else if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    failedGroups.push(group.name)
  } else {
    const report = getCoverageReport(result.stdout)
    if (!report) {
      console.error(`The ${group.name} coverage run returned no report.`)
      failedGroups.push(group.name)
    } else {
      console.log(report)
    }
  }
}

if (failedGroups.length > 0) {
  console.error(`\nCoverage gate failed: ${failedGroups.join(", ")}`)
  process.exitCode = 1
} else {
  console.log("\nAll FontARA coverage budgets passed.")
}
