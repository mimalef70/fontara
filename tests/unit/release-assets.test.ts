import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const require = createRequire(import.meta.url)
const {
  main,
  prepareReleaseAssets,
  inspectZip,
  updateManagedSection,
  assertExistingAssets,
  checkExistingAssets
} = require("../../tasks/prepare-release-assets.js")
const { GUID } = require("../../tasks/publish-firefox-store.js")
const version = "5.2.0"
const tag = `v${version}`
const commit = "a".repeat(40)
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex")

function zip(files: Record<string, string>) {
  return execFileSync(
    "python3",
    [
      "-c",
      [
        "import io,json,sys,zipfile",
        "b=io.BytesIO()",
        "with zipfile.ZipFile(b,'w') as z:",
        " for n,v in json.load(sys.stdin).items(): z.writestr(zipfile.ZipInfo(n),v)",
        "sys.stdout.buffer.write(b.getvalue())"
      ].join("\n")
    ],
    { input: JSON.stringify(files) }
  )
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-release-bundle-"))
  const directory = path.join(root, "verified")
  const output = path.join(root, "prepared")
  fs.mkdirSync(directory)
  const manifests = Object.fromEntries(
    ["chrome", "firefox", "edge", "brave", "opera", "safari"].map((target) => [
      target,
      {
        manifest_version: 3,
        version,
        ...(target === "firefox"
          ? {
              browser_specific_settings: {
                gecko: { id: GUID, strict_min_version: "140.0" }
              }
            }
          : { minimum_chrome_version: "130.0.0.0" })
      }
    ])
  )
  for (const [target, manifest] of Object.entries(manifests)) {
    fs.writeFileSync(
      path.join(directory, `${target}-mv3-prod.zip`),
      zip({
        "manifest.json": JSON.stringify(manifest),
        "script.js": `/* ${target} verified bytes */`
      })
    )
  }
  const source = {
    "package.json": JSON.stringify({
      version,
      packageManager: "pnpm@11.5.0",
      engines: { node: ">=24 <25" }
    }),
    "src/manifest.json": JSON.stringify(manifests.chrome),
    "src/manifest-firefox-mv3.json": JSON.stringify(manifests.firefox),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    ".gitignore": "/build\n/node_modules\n",
    "FIREFOX_SOURCE_README.md": "Build instructions",
    "CHANGELOG.md": `# Changelog\n\n## Unreleased\n\nDo not publish this.\n\n## ${version} - 2026-11-02\n\n- Tested release change.\n\n## 5.1.0\n\nOlder changes.\n`
  }
  fs.writeFileSync(
    path.join(directory, `firefox-mv3-source-${version}.zip`),
    zip(source)
  )
  return {
    root,
    directory,
    output,
    source,
    manifests,
    options: { tag, commit, directory, output }
  }
}

function withFixture(run: (f: ReturnType<typeof fixture>) => void) {
  const f = fixture()
  try {
    run(f)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
}

test("release bundle preserves verified bytes and emits deterministic complete checksums", () => {
  withFixture((f) => {
    const prepared = prepareReleaseAssets(f.options)
    const metadata = JSON.parse(
      fs.readFileSync(path.join(f.output, "build-info.json"), "utf8")
    )
    assert.equal(metadata.commit, commit)
    assert.equal(metadata.requiredToolchain.packageManager, "pnpm@11.5.0")
    assert.equal(metadata.minimumBrowsers.firefox, "140.0")
    for (const item of metadata.packages) {
      const original = fs.readFileSync(path.join(f.directory, item.original))
      const alias = fs.readFileSync(path.join(f.output, item.name))
      assert.deepEqual(alias, original)
      assert.equal(item.sha256, digest(alias))
      assert.equal(item.size, alias.length)
    }
    const sums = fs.readFileSync(path.join(f.output, "SHA256SUMS"), "utf8")
    const names = []
    for (const line of sums.trim().split("\n")) {
      const [hash, name] = line.split("  ")
      names.push(name)
      assert.equal(hash, digest(fs.readFileSync(path.join(f.output, name))))
    }
    assert.equal(names.length, 15)
    assert.ok(names.includes("build-info.json"))
    assert.ok(!names.includes("SHA256SUMS"))
    assert.ok(!names.includes("release-body.md"))
    assert.ok(!sums.includes(f.root))
    assert.ok(prepared.body.includes("Tested release change"))
    assert.ok(!prepared.body.includes("Do not publish this"))
    assert.ok(!prepared.body.includes("Older changes"))
    assert.ok(prepared.body.includes("not an installable Safari app"))
    assert.ok(prepared.body.includes("Unsigned test/review archive"))
    assert.ok(
      prepared.body.includes(
        "https://github.com/mimalef70/fontara/releases/download/v5.2.0/fontara-5.2.0-chrome.zip"
      )
    )
    const second = prepareReleaseAssets(f.options)
    assert.deepEqual(second, prepared)
    assert.equal(
      fs.readFileSync(path.join(f.output, "SHA256SUMS"), "utf8"),
      sums
    )
  })
})

test("release bundle rejects missing packages and mismatched production/source identity before output", () => {
  withFixture((f) => {
    const chrome = path.join(f.directory, "chrome-mv3-prod.zip")
    const bytes = fs.readFileSync(chrome)
    fs.rmSync(chrome)
    assert.throws(() => prepareReleaseAssets(f.options), /ENOENT/)
    fs.writeFileSync(
      chrome,
      zip({
        "manifest.json": JSON.stringify({
          ...f.manifests.chrome,
          version: "5.3.0"
        })
      })
    )
    assert.throws(
      () => prepareReleaseAssets(f.options),
      /Unexpected manifest version/
    )
    fs.writeFileSync(chrome, bytes)
    f.source["package.json"] =
      '{"version":"5.3.0","packageManager":"pnpm@11.5.0"}'
    fs.writeFileSync(
      path.join(f.directory, `firefox-mv3-source-${version}.zip`),
      zip(f.source)
    )
    assert.throws(
      () => prepareReleaseAssets(f.options),
      /source does not match/
    )
    assert.equal(fs.existsSync(f.output), false)
  })
  withFixture((f) => {
    fs.writeFileSync(
      path.join(f.directory, "firefox-mv3-prod.zip"),
      zip({
        "manifest.json": JSON.stringify({
          manifest_version: 3,
          version,
          browser_specific_settings: { gecko: { id: "wrong" } }
        })
      })
    )
    assert.throws(
      () => prepareReleaseAssets(f.options),
      /unexpected add-on identity/
    )
    assert.throws(
      () => prepareReleaseAssets({ ...f.options, tag: "../../v5.2.0" }),
      /release tag/
    )
    assert.throws(
      () => prepareReleaseAssets({ ...f.options, commit: "master" }),
      /source commit/
    )
    assert.throws(
      () => prepareReleaseAssets({ ...f.options, output: f.directory }),
      /separate output/
    )
  })
})

test("release bundle never silently replaces different prepared files or accepts unsafe ZIP paths", () => {
  withFixture((f) => {
    prepareReleaseAssets(f.options)
    const destination = path.join(f.output, `fontara-${version}-chrome.zip`)
    fs.writeFileSync(destination, "different bytes")
    assert.throws(() => prepareReleaseAssets(f.options), /Refusing to replace/)
    assert.equal(fs.readFileSync(destination, "utf8"), "different bytes")
  })
  withFixture((f) => {
    fs.mkdirSync(f.output)
    fs.writeFileSync(path.join(f.output, "unrelated.zip"), "leave me alone")
    assert.throws(() => prepareReleaseAssets(f.options), /unrelated files/)
    assert.equal(
      fs.readFileSync(path.join(f.output, "unrelated.zip"), "utf8"),
      "leave me alone"
    )
  })
  for (const name of ["../secret", "/absolute", "folder\\secret"]) {
    assert.throws(
      () =>
        inspectZip(zip({ [name]: "bad", "manifest.json": "{}" }), [
          "manifest.json"
        ]),
      /ZIP is invalid/
    )
  }
})

test("managed release section preserves existing changelog, correction notes and signed-store section", () => {
  withFixture((f) => {
    const existing =
      "Original release notes.\n\n<!-- fontara-store-assets:start -->\nSigned XPI\n<!-- fontara-store-assets:end -->\n\nSource correction note.\n"
    const result = prepareReleaseAssets({
      ...f.options,
      existingBody: existing
    })
    assert.ok(result.body.endsWith(existing))
    assert.ok(result.body.includes("Source correction note."))
    const section = result.body.slice(
      0,
      result.body.indexOf("<!-- fontara-release-assets:end -->") +
        "<!-- fontara-release-assets:end -->".length
    )
    assert.equal(updateManagedSection(result.body, section), result.body)
    assert.throws(
      () =>
        updateManagedSection("<!-- fontara-release-assets:start -->", section),
      /ambiguous/
    )
    assert.throws(
      () =>
        updateManagedSection(
          "<!-- fontara-release-assets:end --><!-- fontara-release-assets:start -->",
          section
        ),
      /reversed/
    )
  })
})

test("existing GitHub assets must match every planned immutable byte before publication", () => {
  withFixture((f) => {
    const result = prepareReleaseAssets(f.options)
    const name = `fontara-${version}-chrome.zip`
    const bytes = fs.readFileSync(path.join(f.output, name))
    const asset = {
      name,
      state: "uploaded",
      size: bytes.length,
      digest: `sha256:${digest(bytes)}`
    }
    const release = { tag_name: tag, assets: [asset] }
    assertExistingAssets(release, tag, f.output, result.files)
    for (const replacement of [
      { ...asset, size: 1 },
      { ...asset, digest: `sha256:${"0".repeat(64)}` },
      { ...asset, state: "starter" }
    ])
      assert.throws(
        () =>
          assertExistingAssets(
            { ...release, assets: [replacement] },
            tag,
            f.output,
            result.files
          ),
        /refusing replacement/
      )
    assert.throws(
      () =>
        assertExistingAssets(
          { ...release, assets: [asset, asset] },
          tag,
          f.output,
          result.files
        ),
      /refusing replacement/
    )
    assert.throws(
      () =>
        assertExistingAssets(
          { ...release, tag_name: "v0.0.0" },
          tag,
          f.output,
          result.files
        ),
      /identity/
    )
    checkExistingAssets(tag, f.output, result.files, () =>
      JSON.stringify(release)
    )
    checkExistingAssets(tag, f.output, result.files, () => {
      throw { stderr: "gh: Not Found (HTTP 404)\n" }
    })
    for (const stderr of [
      "gh: Forbidden (HTTP 403)",
      "gh: API rate limit exceeded (HTTP 403)",
      "network failure"
    ])
      assert.throws(
        () =>
          checkExistingAssets(tag, f.output, result.files, () => {
            throw { stderr }
          }),
        /refusing publication/
      )
  })
})

test("CLI reruns read the current remote body before preparing assets and preserve store downloads", () => {
  withFixture((f) => {
    const original = prepareReleaseAssets(f.options)
    const before =
      "Maintainer introduction.\n\n" +
      original.body +
      "\n<!-- fontara-store-assets:start -->\nFirefox XPI available.\n<!-- fontara-store-assets:end -->\nManual review note.\n"
    fs.rmSync(f.output, { recursive: true })
    const result = main(
      [
        "--tag",
        tag,
        "--commit",
        commit,
        "--directory",
        f.directory,
        "--output",
        f.output,
        "--check-existing"
      ],
      {
        run: (command: string, args: string[]) => {
          assert.equal(command, "gh")
          assert.deepEqual(args, [
            "api",
            `repos/mimalef70/fontara/releases/tags/${tag}`
          ])
          assert.equal(fs.existsSync(f.output), false)
          return JSON.stringify({ tag_name: tag, assets: [], body: before })
        }
      }
    )
    assert.equal(result.body, before)
    assert.equal(
      fs.readFileSync(path.join(f.output, "release-body.md"), "utf8"),
      before
    )
  })
})
