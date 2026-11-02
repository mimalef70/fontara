#!/usr/bin/env node

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createProvenance, verifyAttestation } = require("./release-provenance")
const { SBOM_NAME, validateSbom } = require("./generate-sbom")

const { values } = require("node:util").parseArgs({
  options: {
    action: { type: "string" },
    directory: { type: "string", default: "build" },
    file: { type: "string", default: "provenance-check.json" }
  }
})
const env = process.env
assert.equal(env.GITHUB_REPOSITORY, "mimalef70/fontara")
assert.equal(env.GITHUB_EVENT_NAME, "workflow_dispatch")
assert.equal(env.GITHUB_REF, "refs/heads/master")
assert.match(env.GITHUB_SHA || "", /^[a-f0-9]{40}$/)

if (values.action === "prepare") {
  const files = fs
    .readdirSync(values.directory)
    .filter((name) => name.endsWith(".zip"))
  assert.equal(
    files.length,
    7,
    "The self-test requires every verified production/source ZIP."
  )
  validateSbom(
    JSON.parse(fs.readFileSync(path.join(values.directory, SBOM_NAME), "utf8")),
    JSON.parse(fs.readFileSync("package.json", "utf8"))
  )
  files.push(SBOM_NAME)
  const proof = createProvenance(
    "v0.0.0",
    env.GITHUB_SHA,
    new Map(
      files.map((name) => [
        name,
        fs.readFileSync(path.join(values.directory, name))
      ])
    )
  )
  fs.writeFileSync(values.file, `${JSON.stringify(proof, null, 2)}\n`)
} else if (values.action === "verify") {
  execFileSync(
    "gh",
    [
      "attestation",
      "verify",
      values.file,
      "--repo",
      env.GITHUB_REPOSITORY,
      "--signer-workflow",
      `${env.GITHUB_REPOSITORY}/.github/workflows/release.yml`,
      "--signer-digest",
      env.GITHUB_SHA,
      "--source-ref",
      env.GITHUB_REF,
      "--source-digest",
      env.GITHUB_SHA,
      "--deny-self-hosted-runners"
    ],
    { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] }
  )
  // A valid master self-test proof must never authorize a production tag.
  assert.throws(
    () =>
      verifyAttestation(values.file, { tag: "v0.0.0", sha: env.GITHUB_SHA }),
    /attestation/
  )
  console.log(
    "Live GitHub attestation verified; production tag policy rejected the branch self-test proof."
  )
} else throw new Error("Select prepare or verify.")
