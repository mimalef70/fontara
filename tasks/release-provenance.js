const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createHash } = require("node:crypto")
const { SBOM_NAME } = require("./generate-sbom")

const REPOSITORY = "mimalef70/fontara"
const PROVENANCE_NAME = "release-provenance.json"
const WORKFLOW = ".github/workflows/release.yml"
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

// Reviewed historical release predates attestations. This exception is tied to
// the original tag, original CI run and immutable bytes, never just a version.
const LEGACY_RELEASE = Object.freeze({
  tag: "v5.1.0",
  sha: "9e5770ca8272035d7fd453c776f2571b7b7a6b83",
  runId: 41285062250,
  assets: {
    "chrome-mv3-prod.zip":
      "a7865d3d0a0fccb5530c65330c1bb7ff7cbc5c3e88857fc61b872ce0ae0e6c54",
    "firefox-mv3-prod.zip":
      "14e8aba1e286ce012da831de59c487a407c6b334a74762e77419dec42742909a",
    "firefox-mv3-source-5.1.0.zip":
      "b21b28defd81df92c5597eb5622507501b3668758bb8a0d7c5067040c0dafbb8"
  }
})

function createProvenance(tag, commit, files) {
  return {
    schema: 1,
    repository: REPOSITORY,
    workflow: WORKFLOW,
    tag,
    sha: commit,
    assets: Object.fromEntries(
      [...files]
        .filter(([name]) => name.endsWith(".zip") || name === SBOM_NAME)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([name, bytes]) => [
          name,
          { sha256: sha256(bytes), size: bytes.length }
        ])
    )
  }
}

async function downloadReleaseAsset(asset, tag, fetchImpl = fetch) {
  if (
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0 ||
    asset.size > MAX_PACKAGE_BYTES ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest || "") ||
    !/^[\w.-]+$/.test(asset.name) ||
    asset.browser_download_url !==
      `https://github.com/${REPOSITORY}/releases/download/${tag}/${asset.name}`
  )
    throw new Error("Invalid release asset identity, size or digest.")
  let url = new URL(asset.browser_download_url)
  const hosts = new Set([
    "github.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com"
  ])
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (
      url.protocol !== "https:" ||
      !hosts.has(url.hostname) ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password
    )
      throw new Error("Untrusted release asset redirect.")
    const response = await fetchImpl(url.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
      headers: { Accept: "application/octet-stream" }
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      await response.body?.cancel()
      if (!location) throw new Error("Missing release asset redirect.")
      url = new URL(location, url)
      continue
    }
    if (!response.ok)
      throw new Error(
        `Release asset download failed (HTTP ${response.status}).`
      )
    if (Number(response.headers.get("content-length")) > asset.size)
      throw new Error("Release asset exceeds expected size.")
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > asset.size)
        throw new Error("Release asset exceeds expected size.")
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    if (
      bytes.length !== asset.size ||
      `sha256:${sha256(bytes)}` !== asset.digest
    )
      throw new Error("Downloaded release asset digest mismatch.")
    return bytes
  }
  throw new Error("Too many release asset redirects.")
}

function verifyAttestation(file, { tag, sha }, run = execFileSync) {
  try {
    const result = JSON.parse(
      run(
        "gh",
        [
          "attestation",
          "verify",
          file,
          "--repo",
          REPOSITORY,
          "--signer-workflow",
          `${REPOSITORY}/${WORKFLOW}`,
          "--signer-digest",
          sha,
          "--source-ref",
          `refs/tags/${tag}`,
          "--source-digest",
          sha,
          "--deny-self-hosted-runners",
          "--format",
          "json"
        ],
        {
          encoding: "utf8",
          timeout: 120000,
          maxBuffer: 8 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"]
        }
      )
    )
    if (!Array.isArray(result) || result.length === 0)
      throw new Error("No verified attestation.")
  } catch {
    throw new Error(
      "Release provenance attestation is missing or does not match the trusted tag/workflow."
    )
  }
}

async function durableProvenance(
  metadata,
  release,
  { fetchImpl = fetch, run = execFileSync } = {}
) {
  if (metadata.tag === LEGACY_RELEASE.tag) {
    if (
      metadata.sha !== LEGACY_RELEASE.sha ||
      metadata.runId !== LEGACY_RELEASE.runId
    )
      throw new Error("Legacy release provenance identity mismatch.")
    for (const [name, hash] of Object.entries(LEGACY_RELEASE.assets)) {
      const assets = release.assets?.filter((item) => item.name === name) || []
      if (
        assets.length !== 1 ||
        assets[0].state !== "uploaded" ||
        assets[0].digest !== `sha256:${hash}`
      )
        throw new Error("Legacy release provenance digest mismatch.")
    }
    return Object.fromEntries(
      Object.entries(LEGACY_RELEASE.assets).map(([name, hash]) => {
        const asset = release.assets.find((item) => item.name === name)
        return [name, { sha256: hash, size: asset.size }]
      })
    )
  }
  const assets =
    release.assets?.filter((item) => item.name === PROVENANCE_NAME) || []
  if (
    assets.length !== 1 ||
    assets[0].state !== "uploaded" ||
    assets[0].size > 65536
  )
    throw new Error(
      "A unique bounded release provenance manifest is required after CI artifacts expire."
    )
  const bytes = await downloadReleaseAsset(assets[0], metadata.tag, fetchImpl)
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fontara-provenance-")
  )
  let manifest
  try {
    const file = path.join(directory, PROVENANCE_NAME)
    fs.writeFileSync(file, bytes, { mode: 0o600 })
    verifyAttestation(file, metadata, run)
    manifest = JSON.parse(bytes)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
  if (
    manifest.schema !== 1 ||
    manifest.repository !== REPOSITORY ||
    manifest.workflow !== WORKFLOW ||
    manifest.tag !== metadata.tag ||
    manifest.sha !== metadata.sha ||
    !manifest.assets ||
    Array.isArray(manifest.assets)
  )
    throw new Error("Attested release provenance identity mismatch.")
  for (const [name, expected] of Object.entries(metadata.assets)) {
    const pinned = manifest.assets[name]
    if (
      !pinned ||
      pinned.sha256 !== expected.sha256 ||
      pinned.size !== expected.size
    )
      throw new Error(
        "Published release asset differs from attested provenance."
      )
  }
  return manifest.assets
}

async function downloadPreparedPackages(
  metadata,
  directory,
  github,
  options = {}
) {
  const release = await github(
    `releases/tags/${encodeURIComponent(metadata.tag)}`
  )
  if (release.tag_name !== metadata.tag || release.draft || release.prerelease)
    throw new Error("Published release identity changed before download.")
  // Re-verify the durable proof in this process; metadata is not an authorization.
  const trusted = await durableProvenance(metadata, release, options)
  fs.mkdirSync(directory, { recursive: true })
  for (const [name, expected] of Object.entries(metadata.assets)) {
    if (name === metadata.sourceSupplement) continue
    if (
      trusted[name]?.sha256 !== expected.sha256 ||
      trusted[name]?.size !== expected.size
    )
      throw new Error("Requested package is absent from trusted provenance.")
    const assets = release.assets.filter((item) => item.name === name)
    if (
      assets.length !== 1 ||
      assets[0].digest !== `sha256:${expected.sha256}` ||
      assets[0].size !== expected.size
    )
      throw new Error("Published package changed before download.")
    fs.writeFileSync(
      path.join(directory, name),
      await downloadReleaseAsset(assets[0], metadata.tag, options.fetchImpl)
    )
  }
}

module.exports = {
  PROVENANCE_NAME,
  LEGACY_RELEASE,
  createProvenance,
  downloadReleaseAsset,
  verifyAttestation,
  durableProvenance,
  downloadPreparedPackages
}
