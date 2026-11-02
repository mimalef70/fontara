#!/usr/bin/env node

// Mirror store-signed packages, never create a new signing identity.
// Protocol: chromium/src/components/crx_file/{crx3.proto,crx_verifier.cc}.
const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const {
  createHash,
  createPublicKey,
  verify,
  constants
} = require("node:crypto")
const { isDeepStrictEqual } = require("node:util")
const {
  prepareRelease,
  createGitHubClient,
  releaseVersion,
  GUID
} = require("./publish-firefox-store")

const { downloadPreparedPackages } = require("./release-provenance")

const REPOSITORY = "mimalef70/fontara"
const EXTENSION_ID = "dcjdhicepiklefpimapdkbaeoocniemc"
const UPDATE_URL = "https://clients2.google.com/service/update2/crx"
const PUBLISHER_HASH =
  "61f7f2a6bfcf74cd0bc1fe2497cc9b04254c658f79f2145392867ea8366367cf"
const MAX_BYTES = 50 * 1024 * 1024
const SIGNATURE_FILES = [
  "META-INF/cose.manifest",
  "META-INF/cose.sig",
  "META-INF/manifest.mf",
  "META-INF/mozilla.sf",
  "META-INF/mozilla.rsa"
]
const STORE_METADATA_FILES = [
  "_metadata/verified_contents.json",
  "_metadata/computed_hashes.json"
]
const ORIGINALS = ["chrome-mv3-prod.zip", "firefox-mv3-prod.zip"]
const MARKERS = [
  "<!-- fontara-store-assets:start -->",
  "<!-- fontara-store-assets:end -->"
]
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const names = (version) => ({
  chrome: `fontara-${version}-chrome.crx`,
  firefox: `fontara-${version}-firefox.xpi`
})

async function download(url, hosts, fetchImpl = fetch, maxBytes = MAX_BYTES) {
  let current = new URL(url)
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (
      current.protocol !== "https:" ||
      (current.port && current.port !== "443") ||
      current.username ||
      current.password ||
      !hosts.includes(current.hostname)
    )
      throw new Error("Untrusted package download URL.")
    const response = await fetchImpl(current.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
      headers: { Accept: "application/octet-stream, application/json" }
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      await response.body?.cancel()
      if (!location) throw new Error("Download redirect has no location.")
      current = new URL(location, current)
      continue
    }
    if (!response.ok)
      throw new Error(`Package download failed (HTTP ${response.status}).`)
    if (Number(response.headers.get("content-length")) > maxBytes)
      throw new Error("Package exceeds download budget.")
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > maxBytes) throw new Error("Package exceeds download budget.")
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
  throw new Error("Too many package redirects.")
}

function protobuf(bytes) {
  let position = 0
  const fields = new Map()
  const integer = () => {
    let value = 0
    for (let shift = 0; shift <= 28; shift += 7) {
      if (position >= bytes.length) throw new Error("Truncated CRX protobuf.")
      const byte = bytes[position++]
      value += (byte & 127) * 2 ** shift
      if (!(byte & 128)) return value
    }
    throw new Error("Oversized CRX protobuf integer.")
  }
  while (position < bytes.length) {
    const key = integer()
    const field = Math.floor(key / 8)
    const wire = key % 8
    if (!field) throw new Error("Invalid CRX protobuf field.")
    if (wire !== 2) throw new Error("Unsupported CRX protobuf field.")
    const length = integer()
    if (length > bytes.length - position)
      throw new Error("Truncated CRX protobuf value.")
    const value = bytes.subarray(position, position + length)
    position += length
    fields.set(field, [...(fields.get(field) || []), value])
  }
  return fields
}
function single(fields, field) {
  if (fields.get(field)?.length !== 1)
    throw new Error("Missing or repeated CRX signature field.")
  return fields.get(field)[0]
}
function extensionId(key) {
  return digest(key)
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (n) =>
      String.fromCharCode(97 + Number.parseInt(n, 16))
    )
}
function verifyCrx(
  bytes,
  expectedId = EXTENSION_ID,
  publisherHash = PUBLISHER_HASH
) {
  if (
    bytes.length < 12 ||
    bytes.length > MAX_BYTES ||
    bytes.subarray(0, 4).toString() !== "Cr24" ||
    bytes.readUInt32LE(4) !== 3
  )
    throw new Error("Expected a bounded CRX3 package.")
  const length = bytes.readUInt32LE(8)
  if (length > 1024 * 1024 || length + 12 >= bytes.length)
    throw new Error("Invalid CRX3 header size.")
  const headerBytes = bytes.subarray(12, 12 + length)
  for (const marker of [
    Buffer.from([80, 75, 5, 6]),
    Buffer.from([80, 75, 6, 7]),
    Buffer.from([80, 75, 6, 6])
  ]) {
    if (headerBytes.includes(marker))
      throw new Error("ZIP end marker inside CRX header.")
  }
  const header = protobuf(headerBytes)
  const signedHeader = single(header, 10000)
  const id = single(protobuf(signedHeader), 1)
  if (
    id.length !== 16 ||
    id
      .toString("hex")
      .replace(/[0-9a-f]/g, (n) =>
        String.fromCharCode(97 + Number.parseInt(n, 16))
      ) !== expectedId
  )
    throw new Error("Wrong CRX extension identity.")
  const zip = bytes.subarray(12 + length)
  const size = Buffer.alloc(4)
  size.writeUInt32LE(signedHeader.length)
  const payload = Buffer.concat([
    Buffer.from("CRX3 SignedData\0"),
    size,
    signedHeader,
    zip
  ])
  let developer = false
  let publisher = false
  let count = 0
  for (const [field, type] of [
    [2, "rsa"],
    [3, "ec"]
  ]) {
    for (const proofBytes of header.get(field) || []) {
      if (++count > 20) throw new Error("Too many CRX proofs.")
      const proof = protobuf(proofBytes)
      const key = single(proof, 1)
      const signature = single(proof, 2)
      if (key.length > 8192 || signature.length > 8192)
        throw new Error("Oversized CRX proof.")
      const publicKey = createPublicKey({ key, type: "spki", format: "der" })
      if (
        publicKey.asymmetricKeyType !== type ||
        (type === "ec" &&
          publicKey.asymmetricKeyDetails.namedCurve !== "prime256v1")
      )
        throw new Error("Unexpected CRX signature algorithm.")
      if (
        !verify(
          "sha256",
          payload,
          {
            key: publicKey,
            ...(type === "rsa" ? { padding: constants.RSA_PKCS1_PADDING } : {})
          },
          signature
        )
      )
        throw new Error("CRX signature verification failed.")
      developer ||= extensionId(key) === expectedId
      publisher ||= digest(key) === publisherHash
    }
  }
  if (!developer || !publisher)
    throw new Error("Missing developer or Chrome Web Store signature proof.")
  return zip
}

function inspectZip(bytes) {
  if (bytes.length > MAX_BYTES) throw new Error("ZIP exceeds size budget.")
  try {
    return JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          [
            "import sys,io,zipfile,json,hashlib,stat,pathlib",
            "z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); infos=z.infolist(); names=[i.filename for i in infos]",
            "assert len(infos)<=5000 and len(names)==len(set(names)) and len(names)==len({n.casefold() for n in names}), 'Duplicate ZIP entry'",
            "assert all(not n.startswith('/') and '\\\\' not in n and '\\x00' not in n and '..' not in pathlib.PurePosixPath(n).parts for n in names), 'Unsafe ZIP path'",
            "assert all(not stat.S_ISLNK(i.external_attr>>16) and not i.flag_bits&1 and i.file_size<=50*1024*1024 for i in infos), 'Unsafe ZIP entry'",
            "assert sum(i.file_size for i in infos)<=200*1024*1024, 'ZIP expands beyond limit'",
            "files={i.filename:hashlib.sha256(z.read(i)).hexdigest() for i in infos if not i.is_dir()}",
            "m=json.loads(z.read('manifest.json')); print(json.dumps({'manifest':m,'files':files}))"
          ].join("\n")
        ],
        {
          input: bytes,
          maxBuffer: 2 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"]
        }
      ).toString()
    )
  } catch {
    throw new Error("Invalid, ambiguous, or oversized extension ZIP.")
  }
}
function comparePayload(original, signed, browser, version) {
  const a = inspectZip(original)
  const b = inspectZip(signed)
  if (
    a.manifest.version !== version ||
    b.manifest.version !== version ||
    a.manifest.manifest_version !== 3 ||
    b.manifest.manifest_version !== 3
  )
    throw new Error("Store package version or manifest mismatch.")
  if (browser === "firefox") {
    if (b.manifest.browser_specific_settings?.gecko?.id !== GUID)
      throw new Error("Wrong Firefox add-on GUID.")
    for (const name of SIGNATURE_FILES)
      if (!b.files[name] || b.files[name] === digest(Buffer.alloc(0)))
        throw new Error("Missing Mozilla signature file.")
  } else if (browser === "chrome") {
    for (const manifest of [a.manifest, b.manifest]) {
      if (
        manifest.key &&
        extensionId(Buffer.from(manifest.key, "base64")) !== EXTENSION_ID
      )
        throw new Error("Unexpected Chrome manifest key.")
      if (manifest.update_url && manifest.update_url !== UPDATE_URL)
        throw new Error("Unexpected Chrome update URL.")
      delete manifest.key
      delete manifest.update_url
    }
  } else throw new Error("Unsupported store browser.")
  if (!isDeepStrictEqual(a.manifest, b.manifest))
    throw new Error(
      "Store manifest changed executable behavior or permissions."
    )
  const extra = browser === "firefox" ? SIGNATURE_FILES : STORE_METADATA_FILES
  for (const [name, hash] of Object.entries(a.files)) {
    if (name !== "manifest.json" && b.files[name] !== hash)
      throw new Error(`Store payload differs from verified release: ${name}`)
  }
  for (const name of Object.keys(b.files))
    if (!a.files[name] && !extra.includes(name))
      throw new Error(`Unexpected store package entry: ${name}`)
  return { comparedFiles: Object.keys(a.files).length }
}

function asset(release, name) {
  const matches = release.assets?.filter((item) => item.name === name) || []
  if (
    matches.length !== 1 ||
    matches[0].state !== "uploaded" ||
    !/^sha256:[a-f0-9]{64}$/.test(matches[0].digest || "") ||
    !Number.isInteger(matches[0].size) ||
    matches[0].size <= 0 ||
    matches[0].size > MAX_BYTES
  )
    throw new Error(`Missing unique release asset/digest: ${name}`)
  return matches[0]
}
const githubDownload = (url, fetchImpl) =>
  download(
    url,
    [
      "github.com",
      "release-assets.githubusercontent.com",
      "objects.githubusercontent.com"
    ],
    fetchImpl
  )
function verifyAsset(bytes, meta) {
  if (
    bytes.length !== meta.size ||
    digest(bytes) !== meta.digest.replace(/^sha256:/, "")
  )
    throw new Error("Release asset digest/size mismatch.")
  return bytes
}
function validReceipt(receipt, release, sha) {
  try {
    if (
      receipt.schema !== 1 ||
      receipt.repository !== REPOSITORY ||
      receipt.tag !== release.tag_name ||
      receipt.sha !== sha ||
      receipt.complete !== true
    )
      return false
    const version = releaseVersion(release.tag_name)
    for (const name of ORIGINALS)
      if (receipt.originals[name] !== asset(release, name).digest) return false
    for (const browser of ["chrome", "firefox"]) {
      const name = names(version)[browser]
      if (
        receipt.packages[browser]?.name !== name ||
        receipt.packages[browser]?.state !== "available" ||
        receipt.packages[browser]?.size !== asset(release, name).size ||
        `sha256:${receipt.packages[browser]?.sha256}` !==
          asset(release, name).digest
      )
        return false
    }
    const sums = asset(release, "SHA256SUMS-store.txt")
    return (
      receipt.checksumsSha256 === sums.digest.slice(7) &&
      mergeSection(release.body, storeSection(receipt)) === release.body
    )
  } catch {
    return false
  }
}
async function prepare(tag, github, fetchImpl = fetch) {
  const release = await github(
    tag ? `releases/tags/${encodeURIComponent(tag)}` : "releases/latest"
  )
  if (tag && tag !== release.tag_name)
    throw new Error("Requested release tag mismatch.")
  tag = release.tag_name
  releaseVersion(tag)
  if (release.draft || release.prerelease)
    throw new Error("Select a stable published release.")
  // A completed receipt binds every store/original asset digest and the tag SHA.
  // No pending work means no dependency on GitHub's 30-day CI artifact retention.
  if (release.assets?.some((item) => item.name === "store-assets.json")) {
    const repo = await github("")
    if (
      repo.id !== 141708904 ||
      repo.full_name !== REPOSITORY ||
      repo.default_branch !== "master"
    )
      throw new Error("Unexpected repository identity.")
    let object = (await github(`git/ref/tags/${encodeURIComponent(tag)}`))
      .object
    for (let depth = 0; object?.type === "tag" && depth < 5; depth++)
      object = (await github(`git/tags/${object.sha}`)).object
    const meta = asset(release, "store-assets.json")
    const receipt = JSON.parse(
      verifyAsset(
        await githubDownload(meta.browser_download_url, fetchImpl),
        meta
      )
    )
    if (
      object?.type === "commit" &&
      /^[a-f0-9]{40}$/.test(object.sha) &&
      validReceipt(receipt, release, object.sha)
    ) {
      const ancestry = await github(`compare/${object.sha}...master`)
      if (ancestry.merge_base_commit?.sha !== object.sha)
        throw new Error("Completed release is not an ancestor of master.")
      return { tag, complete: true }
    }
  }
  const prepared = await prepareRelease({
    tag,
    github,
    requireSource: false,
    includeChrome: true
  })
  const chrome = asset(release, "chrome-mv3-prod.zip")
  prepared.assets[chrome.name] = {
    sha256: chrome.digest.slice(7),
    size: chrome.size
  }
  return { ...prepared, complete: false }
}
async function collect(metadata, directory, output, github, fetchImpl = fetch) {
  const release = await github(
    `releases/tags/${encodeURIComponent(metadata.tag)}`
  )
  const version = releaseVersion(metadata.tag)
  if (
    metadata.version !== version ||
    release.tag_name !== metadata.tag ||
    release.draft ||
    release.prerelease
  )
    throw new Error("Prepared release identity mismatch.")
  const original = {}
  for (const name of ORIGINALS) {
    const meta = asset(release, name)
    if (
      metadata.assets[name]?.sha256 !== meta.digest.slice(7) ||
      metadata.assets[name]?.size !== meta.size
    )
      throw new Error("Prepared original package digest changed.")
    original[name] = verifyAsset(
      fs.readFileSync(path.join(directory, name)),
      meta
    )
  }
  const result = {
    schema: 1,
    repository: REPOSITORY,
    tag: metadata.tag,
    version,
    sha: metadata.sha,
    runId: metadata.runId,
    artifactId: metadata.artifactId,
    originals: Object.fromEntries(
      ORIGINALS.map((name) => [name, asset(release, name).digest])
    ),
    packages: {}
  }
  fs.mkdirSync(output, { recursive: true })
  const record = (browser, bytes, details) => {
    const name = names(version)[browser]
    fs.writeFileSync(path.join(output, name), bytes)
    result.packages[browser] = {
      state: "available",
      name,
      size: bytes.length,
      sha256: digest(bytes),
      ...details
    }
  }
  const amoBase = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(GUID)}/`
  const addon = JSON.parse(
    await download(amoBase, ["addons.mozilla.org"], fetchImpl, 2 * 1024 * 1024)
  )
  if (addon.guid !== GUID || addon.status !== "public" || addon.is_disabled)
    throw new Error("Unexpected public AMO add-on identity/status.")
  const versionResponse = await fetchImpl(`${amoBase}versions/${version}/`, {
    redirect: "error",
    signal: AbortSignal.timeout(60000)
  })
  if (versionResponse.status === 404)
    result.packages.firefox = {
      state: "pending",
      reason: "Mozilla has not published this version."
    }
  else {
    if (!versionResponse.ok)
      throw new Error(`AMO version lookup failed (${versionResponse.status}).`)
    const detail = await versionResponse.json()
    if (
      detail.version !== version ||
      detail.channel !== "listed" ||
      detail.is_disabled === true
    )
      throw new Error("Unexpected AMO version/channel.")
    if (detail.file?.status !== "public")
      result.packages.firefox = {
        state: "pending",
        reason: "Mozilla review/signing is not complete."
      }
    else {
      if (
        !/^sha256:[a-f0-9]{64}$/.test(detail.file.hash || "") ||
        !Number.isInteger(detail.file.size) ||
        detail.file.size <= 0 ||
        detail.file.size > MAX_BYTES
      )
        throw new Error("Invalid AMO download digest/size.")
      const bytes = await download(
        detail.file.url,
        ["addons.mozilla.org", "addons.cdn.mozilla.net"],
        fetchImpl
      )
      verifyAsset(bytes, { digest: detail.file.hash, size: detail.file.size })
      const checked = comparePayload(
        original["firefox-mv3-prod.zip"],
        bytes,
        "firefox",
        version
      )
      record("firefox", bytes, {
        ...checked,
        amoVersionId: detail.id,
        amoFileId: detail.file.id,
        origin: detail.file.url
      })
    }
  }
  const chromeName = names(version).chrome
  const existingChrome = release.assets?.some(
    (item) => item.name === chromeName
  )
  const url = new URL(UPDATE_URL)
  url.search = new URLSearchParams({
    response: "redirect",
    prodversion:
      `${inspectZip(original["chrome-mv3-prod.zip"]).manifest.minimum_chrome_version || "130"}`
        .split(".")
        .concat(["0", "0", "0"])
        .slice(0, 4)
        .join("."),
    acceptformat: "crx3",
    x: `id=${EXTENSION_ID}&installsource=ondemand&uc`
  })
  const crx = existingChrome
    ? verifyAsset(
        await githubDownload(
          asset(release, chromeName).browser_download_url,
          fetchImpl
        ),
        asset(release, chromeName)
      )
    : await download(
        url.href,
        ["clients2.google.com", "clients2.googleusercontent.com"],
        fetchImpl
      )
  const chromeZip = verifyCrx(crx)
  const served = inspectZip(chromeZip).manifest.version
  if (existingChrome && served !== version)
    throw new Error("Existing signed Chrome asset has the wrong version.")
  if (served !== version)
    result.packages.chrome = {
      state: "pending",
      reason: `Chrome Web Store currently serves ${served}; requested ${version}. Review or staged rollout may still be pending.`
    }
  else
    record("chrome", crx, {
      ...comparePayload(
        original["chrome-mv3-prod.zip"],
        chromeZip,
        "chrome",
        version
      ),
      origin: UPDATE_URL
    })
  result.complete = Object.values(result.packages).every(
    (item) => item.state === "available"
  )
  fs.writeFileSync(
    path.join(output, "store-results.json"),
    `${JSON.stringify(result, null, 2)}\n`
  )
  console.log(JSON.stringify(result, null, 2))
  return result
}
function storeSection(result) {
  const lines = [
    MARKERS[0],
    "## Store-signed downloads",
    "",
    "These packages retain the existing store identity and update channel. ZIP packages above remain available for development/manual unpacked installation.",
    ""
  ]
  for (const browser of ["chrome", "firefox"]) {
    const item = result.packages[browser]
    const label = browser === "chrome" ? "Chrome CRX3" : "Firefox XPI"
    lines.push(
      item.state === "available"
        ? `- **${label}:** [${item.name}](https://github.com/${REPOSITORY}/releases/download/${result.tag}/${item.name})`
        : `- **${label}:** pending — ${item.reason}`
    )
  }
  lines.push(
    "",
    "Check downloads against `SHA256SUMS-store.txt`. Chrome CRX installation is subject to browser/OS policy; use the official store for normal installation. Store approval can finish after the GitHub release.",
    MARKERS[1]
  )
  return lines.join("\n")
}
function mergeSection(body, section) {
  body ||= ""
  const start = body.indexOf(MARKERS[0])
  const end = body.indexOf(MARKERS[1])
  if (
    start < 0 !== end < 0 ||
    (start >= 0 &&
      (end < start ||
        body.indexOf(MARKERS[0], start + 1) >= 0 ||
        body.indexOf(MARKERS[1], end + 1) >= 0))
  )
    throw new Error("Ambiguous managed store release section.")
  return start < 0
    ? `${body.trimEnd()}\n\n${section}\n`
    : `${body.slice(0, start)}${section}${body.slice(end + MARKERS[1].length)}`
}
function checksums(packages) {
  return Object.values(packages)
    .filter((item) => item.state === "available")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => `${item.sha256}  ${item.name}\n`)
    .join("")
}
function assertNotStale(result, release) {
  for (const browser of ["chrome", "firefox"]) {
    if (
      result.packages[browser]?.state === "pending" &&
      release.assets?.some(
        (item) => item.name === names(result.version)[browser]
      )
    )
      throw new Error(
        "Stale store collection would hide an existing signed asset; rerun synchronization."
      )
  }
}
async function plan(tag, github, now = Date.now()) {
  if (tag) {
    releaseVersion(tag)
    return [tag]
  }
  const repo = await github("")
  if (
    repo.id !== 141708904 ||
    repo.full_name !== REPOSITORY ||
    repo.default_branch !== "master"
  )
    throw new Error("Unexpected repository identity.")
  const latest = await github("releases/latest")
  const releases = await github("releases?per_page=100")
  if (!Array.isArray(releases)) throw new Error("Invalid release list.")
  const eligible = (release) =>
    !release.draft &&
    !release.prerelease &&
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(
      release.tag_name || ""
    ) &&
    (release.tag_name === "v5.1.0" ||
      release.assets?.some((item) => item.name === "build-info.json"))
  const since = now - 30 * 24 * 60 * 60 * 1000
  const tags = [
    ...new Set([
      ...(eligible(latest) ? [latest.tag_name] : []),
      ...releases
        .filter(
          (release) =>
            eligible(release) && Date.parse(release.published_at) >= since
        )
        .map((release) => release.tag_name)
    ])
  ]
  if (
    tags.length > 50 ||
    (releases.length === 100 && Date.parse(releases[99].published_at) >= since)
  )
    throw new Error(
      "Too many recent releases for a bounded automatic sync; select a manual release_tag."
    )
  return tags
}
async function publish(directory, github) {
  const result = JSON.parse(
    fs.readFileSync(path.join(directory, "store-results.json"), "utf8")
  )
  if (
    result.schema !== 1 ||
    result.repository !== REPOSITORY ||
    releaseVersion(result.tag) !== result.version
  )
    throw new Error("Invalid store artifact metadata.")
  if (
    Object.keys(result.packages || {})
      .sort()
      .join(",") !== "chrome,firefox" ||
    result.complete !==
      Object.values(result.packages).every((item) => item.state === "available")
  )
    throw new Error("Invalid store package set/completion state.")
  const prepared = await prepareRelease({
    tag: result.tag,
    github,
    requireSource: false,
    includeChrome: true
  })
  if (
    prepared.sha !== result.sha ||
    prepared.runId !== result.runId ||
    (prepared.artifactId !== null &&
      result.artifactId !== null &&
      prepared.artifactId !== result.artifactId)
  )
    throw new Error("Store artifact provenance mismatch.")
  let release = await github(`releases/tags/${encodeURIComponent(result.tag)}`)
  for (const name of ORIGINALS)
    if (result.originals[name] !== asset(release, name).digest)
      throw new Error("Original release asset changed during synchronization.")
  assertNotStale(result, release)
  for (const browser of ["chrome", "firefox"]) {
    const item = result.packages[browser]
    if (!item || !["available", "pending"].includes(item.state))
      throw new Error("Invalid store availability state.")
    if (item.state === "pending") continue
    if (
      item.name !== names(result.version)[browser] ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    )
      throw new Error("Invalid signed asset name or digest.")
    verifyAsset(fs.readFileSync(path.join(directory, item.name)), {
      size: item.size,
      digest: `sha256:${item.sha256}`
    })
    if (release.assets.some((existing) => existing.name === item.name)) {
      if (asset(release, item.name).digest !== `sha256:${item.sha256}`)
        throw new Error(
          `Refusing to replace immutable signed asset: ${item.name}`
        )
    } else
      execFileSync(
        "gh",
        [
          "release",
          "upload",
          result.tag,
          path.join(directory, item.name),
          "--repo",
          REPOSITORY
        ],
        { stdio: "inherit", timeout: 120000 }
      )
  }
  const sums = checksums(result.packages)
  result.checksumsSha256 = digest(Buffer.from(sums))
  if (sums) {
    const file = path.join(directory, "SHA256SUMS-store.txt")
    fs.writeFileSync(file, sums)
    execFileSync(
      "gh",
      [
        "release",
        "upload",
        result.tag,
        file,
        "--repo",
        REPOSITORY,
        "--clobber"
      ],
      { stdio: "inherit", timeout: 120000 }
    )
  }
  release = await github(`releases/tags/${encodeURIComponent(result.tag)}`)
  const body = mergeSection(release.body, storeSection(result))
  const notesFile = path.join(directory, "release-notes.md")
  fs.writeFileSync(notesFile, body)
  execFileSync(
    "gh",
    [
      "release",
      "edit",
      result.tag,
      "--repo",
      REPOSITORY,
      "--notes-file",
      notesFile
    ],
    { stdio: "inherit", timeout: 120000 }
  )
  const confirmed = await github(
    `releases/tags/${encodeURIComponent(result.tag)}`
  )
  if (confirmed.body !== body.trimEnd() && confirmed.body !== body)
    throw new Error("Release notes update was not confirmed.")
  for (const item of Object.values(result.packages))
    if (
      item.state === "available" &&
      asset(confirmed, item.name).digest !== `sha256:${item.sha256}`
    )
      throw new Error("Published signed asset digest mismatch.")
  if (
    sums &&
    asset(confirmed, "SHA256SUMS-store.txt").digest !==
      `sha256:${result.checksumsSha256}`
  )
    throw new Error("Store checksum manifest was not confirmed.")
  // Commit the completion receipt last: failed body/asset writes must remain retryable.
  const receiptText = `${JSON.stringify(result, null, 2)}\n`
  const receiptFile = path.join(directory, "store-assets.json")
  fs.writeFileSync(receiptFile, receiptText)
  execFileSync(
    "gh",
    [
      "release",
      "upload",
      result.tag,
      receiptFile,
      "--repo",
      REPOSITORY,
      "--clobber"
    ],
    { stdio: "inherit", timeout: 120000 }
  )
  const finalRelease = await github(
    `releases/tags/${encodeURIComponent(result.tag)}`
  )
  if (
    asset(finalRelease, "store-assets.json").digest !==
      `sha256:${digest(Buffer.from(receiptText))}` ||
    (result.complete && !validReceipt(result, finalRelease, result.sha))
  )
    throw new Error("Final store receipt was not confirmed.")
  console.log(
    `Published verified store assets for ${result.tag}; complete=${result.complete}.`
  )
}
async function main() {
  const { values } = require("node:util").parseArgs({
    options: {
      action: { type: "string", default: "collect" },
      tag: { type: "string", default: process.env.STORE_RELEASE_TAG || "" },
      metadata: { type: "string", default: "store-release.json" },
      directory: { type: "string", default: "verified-packages" },
      output: { type: "string", default: "store-assets" }
    }
  })
  const github = createGitHubClient(
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  )
  if (values.action === "plan") {
    const pendingTrigger =
      process.env.GITHUB_EVENT_NAME === "workflow_run" && values.tag
    const published = pendingTrigger
      ? await github(`releases/tags/${encodeURIComponent(values.tag)}`, {
          allowMissing: true
        })
      : true
    const tags = published ? await plan(values.tag, github) : []
    if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `tags=${JSON.stringify(tags)}\n`
      )
    console.log(`Store asset queue: ${JSON.stringify(tags)}`)
  } else if (values.action === "prepare") {
    const prepared = await prepare(values.tag, github)
    fs.writeFileSync(values.metadata, `${JSON.stringify(prepared, null, 2)}\n`)
    if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `complete=${prepared.complete}\npackage_source=${prepared.packageSource || ""}\nrun_id=${prepared.runId || ""}\nartifact_id=${prepared.artifactId || ""}\ntag=${prepared.tag}\n`
      )
    console.log(
      prepared.complete
        ? `${prepared.tag}: both store downloads already verified; no work remains.`
        : `${prepared.tag}: verified original Release run ${prepared.runId}.`
    )
  } else if (values.action === "download") {
    const metadata = JSON.parse(fs.readFileSync(values.metadata))
    if (metadata.packageSource !== "release-assets")
      throw new Error("Durable release download was not selected.")
    await downloadPreparedPackages(metadata, values.directory, github)
  } else if (values.action === "collect")
    await collect(
      JSON.parse(fs.readFileSync(values.metadata)),
      values.directory,
      values.output,
      github
    )
  else if (values.action === "publish") await publish(values.directory, github)
  else throw new Error("Select plan, prepare, download, collect, or publish.")
}
module.exports = {
  EXTENSION_ID,
  PUBLISHER_HASH,
  UPDATE_URL,
  SIGNATURE_FILES,
  names,
  digest,
  download,
  protobuf,
  extensionId,
  verifyCrx,
  inspectZip,
  comparePayload,
  validReceipt,
  assertNotStale,
  plan,
  prepare,
  collect,
  checksums,
  storeSection,
  mergeSection
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
