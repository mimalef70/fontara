import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const {
  SBOM_NAME,
  normalizeSbom,
  validateSbom,
  generateSbom
} = require("../../tasks/generate-sbom")
const pkg = {
  name: "font-ara",
  version: "5.2.0",
  packageManager: "pnpm@11.5.0",
  dependencies: { clsx: "^2.1.1" },
  devDependencies: { typescript: "6.0.3" }
}
function fixture() {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    serialNumber: "urn:uuid:build-specific",
    metadata: {
      timestamp: "2026-11-02T00:00:00Z",
      tools: {
        components: [{ type: "application", name: "pnpm", version: "11.5.0" }]
      },
      component: {
        type: "application",
        name: pkg.name,
        version: pkg.version,
        "bom-ref": "root"
      }
    },
    components: [
      {
        type: "library",
        name: "clsx",
        version: "2.1.1",
        purl: "pkg:npm/clsx@2.1.1",
        "bom-ref": "clsx",
        externalReferences: [
          {
            type: "distribution",
            url: "https://registry.npmjs.org/clsx/-/clsx-2.1.1.tgz",
            hashes: [{ alg: "SHA-512", content: "a".repeat(128) }]
          }
        ]
      }
    ],
    dependencies: [
      { ref: "root", dependsOn: ["clsx"] },
      { ref: "clsx", dependsOn: [] }
    ]
  }
}

test("production inventory normalization removes build randomness but preserves component evidence", () => {
  const original = fixture()
  const result = normalizeSbom(JSON.stringify(original), pkg)
  const reversed = fixture()
  reversed.serialNumber = "urn:uuid:another-build"
  reversed.metadata.timestamp = "2030-01-01T00:00:00Z"
  reversed.dependencies.reverse()
  assert.equal(normalizeSbom(JSON.stringify(reversed), pkg), result)
  const bom = JSON.parse(result)
  assert.equal(bom.serialNumber, undefined)
  assert.equal(bom.metadata.timestamp, undefined)
  assert.deepEqual(bom.components, original.components)
  assert.doesNotMatch(result, /typescript/)
})

test("inventory validation rejects wrong source identity, missing dependencies and dangling graph references", () => {
  assert.throws(
    () => validateSbom(fixture(), { ...pkg, version: "5.3.0" }),
    /identity/
  )
  assert.throws(
    () => validateSbom(fixture(), { ...pkg, dependencies: { react: "19" } }),
    /missing direct dependency/
  )
  const invalid = fixture()
  invalid.dependencies[0].dependsOn.push("missing")
  assert.throws(() => validateSbom(invalid, pkg), /dependency graph/)
  assert.throws(
    () =>
      normalizeSbom(JSON.stringify(fixture()), {
        ...pkg,
        packageManager: "pnpm@12.0.0"
      }),
    /unexpected pnpm/
  )
})

test("inventory generator uses only the production lockfile graph and writes the verified build file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-sbom-"))
  try {
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify(pkg))
    const output = generateSbom({
      directory,
      run: (command: string, args: string[], options: { cwd: string }) => {
        assert.equal(command, "pnpm")
        assert.deepEqual(args, [
          "sbom",
          "--sbom-format",
          "cyclonedx",
          "--sbom-spec-version",
          "1.6",
          "--prod",
          "--sbom-type",
          "application",
          "--lockfile-only"
        ])
        assert.equal(options.cwd, directory)
        return JSON.stringify(fixture())
      }
    })
    assert.equal(output, path.join(directory, "build", SBOM_NAME))
    assert.equal(
      fs.readFileSync(output, "utf8"),
      normalizeSbom(JSON.stringify(fixture()), pkg)
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
