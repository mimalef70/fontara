import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const {
  createProvenance,
  LEGACY_RELEASE,
  durableProvenance,
  downloadReleaseAsset,
  downloadPreparedPackages,
  verifyAttestation
} = require("../../tasks/release-provenance")
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex")
const { SBOM_NAME } = require("../../tasks/generate-sbom")

test("durable manifest is deterministic and binds every ZIP without mutable build/run metadata", () => {
  const files = new Map([
    ["b.zip", Buffer.from("b")],
    ["a.zip", Buffer.from("a")],
    [SBOM_NAME, Buffer.from("inventory")],
    ["release-body.md", Buffer.from("notes")]
  ])
  const result = createProvenance("v5.2.0", "c".repeat(40), files)
  assert.deepEqual(Object.keys(result.assets), ["a.zip", "b.zip", SBOM_NAME])
  assert.deepEqual(result.assets[SBOM_NAME], {
    sha256: digest(Buffer.from("inventory")),
    size: 9
  })
  assert.deepEqual(result.assets["a.zip"], {
    sha256: digest(Buffer.from("a")),
    size: 1
  })
  assert.deepEqual(
    result,
    createProvenance("v5.2.0", "c".repeat(40), new Map([...files].reverse()))
  )
})

test("legacy durable proof accepts only the reviewed original run, commit and all original hashes", async () => {
  const metadata = { ...LEGACY_RELEASE }
  const release = {
    assets: Object.entries(LEGACY_RELEASE.assets).map(([name, hash]) => ({
      name,
      digest: `sha256:${hash}`,
      state: "uploaded",
      size: 10
    }))
  }
  const result = await durableProvenance(metadata, release)
  assert.equal(
    result["chrome-mv3-prod.zip"].sha256,
    LEGACY_RELEASE.assets["chrome-mv3-prod.zip"]
  )
  for (const change of [{ sha: "d".repeat(40) }, { runId: 99 }])
    await assert.rejects(
      durableProvenance({ ...metadata, ...change }, release),
      /identity mismatch/
    )
  release.assets[0].digest = `sha256:${"f".repeat(64)}`
  await assert.rejects(durableProvenance(metadata, release), /digest mismatch/)
})

test("release download checks identity, bounds, redirects and exact bytes without forwarding credentials", async () => {
  const bytes = Buffer.from("verified archive")
  const tag = "v5.2.0"
  const asset = {
    name: "firefox-mv3-prod.zip",
    size: bytes.length,
    digest: `sha256:${digest(bytes)}`,
    browser_download_url: `https://github.com/mimalef70/fontara/releases/download/${tag}/firefox-mv3-prod.zip`
  }
  const received: string[] = []
  const fetchImpl = async (url: string, init: RequestInit) => {
    received.push(url)
    assert.equal(new Headers(init.headers).get("authorization"), null)
    return received.length === 1
      ? new Response(null, {
          status: 302,
          headers: {
            location: "https://release-assets.githubusercontent.com/object"
          }
        })
      : new Response(bytes)
  }
  assert.deepEqual(await downloadReleaseAsset(asset, tag, fetchImpl), bytes)
  await assert.rejects(
    downloadReleaseAsset(
      {
        ...asset,
        browser_download_url: asset.browser_download_url.replace(
          "fontara/",
          "attacker/"
        )
      },
      tag,
      fetchImpl
    ),
    /identity/
  )
  await assert.rejects(
    downloadReleaseAsset(asset, tag, async () => new Response("bad")),
    /digest/
  )
  await assert.rejects(
    downloadReleaseAsset(
      asset,
      tag,
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.example/file" }
        })
    ),
    /Untrusted/
  )
  await assert.rejects(
    downloadReleaseAsset(
      asset,
      tag,
      async () => new Response(Buffer.alloc(bytes.length + 1))
    ),
    /size/
  )
})

test("an empty or failed CLI attestation verification never authorizes a package", () => {
  const identity = { tag: "v5.2.0", sha: "a".repeat(40) }
  for (const output of ["[]", "{}", "not-json"])
    assert.throws(
      () => verifyAttestation("file", identity, () => output),
      /attestation/
    )
})

test("durable package download rejects a manifest hash mismatch before writing any ZIP", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fontara-durable-test-")
  )
  try {
    const assets = Object.fromEntries(
      Object.entries(LEGACY_RELEASE.assets).map(([name, sha256]) => [
        name,
        { sha256, size: 10 }
      ])
    )
    const metadata = { ...LEGACY_RELEASE, assets }
    const release = {
      tag_name: LEGACY_RELEASE.tag,
      draft: false,
      prerelease: false,
      assets: Object.entries(assets).map(([name, info]) => ({
        name,
        digest: `sha256:${info.sha256}`,
        size: info.size,
        state: "uploaded"
      }))
    }
    metadata.assets["chrome-mv3-prod.zip"].sha256 = "a".repeat(64)
    await assert.rejects(
      downloadPreparedPackages(metadata, directory, async () => release),
      /absent from trusted/
    )
    assert.deepEqual(fs.readdirSync(directory), [])
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
