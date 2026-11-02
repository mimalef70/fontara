#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createHash, createHmac, randomUUID } = require("node:crypto")
const { setTimeout: delay } = require("node:timers/promises")
const {
  LEGACY_RELEASE,
  durableProvenance,
  downloadPreparedPackages
} = require("./release-provenance")

const REPOSITORY = "mimalef70/fontara"
const REPOSITORY_ID = 141708904
const GUID = "{206079c5-9bab-485d-ad12-97298719c3f2}"
const AMO = "https://addons.mozilla.org/api/v5/addons/"
const AMO_RELEASE_NOTES_LIMIT = 3000
const REQUIRED_JOBS = [
  "verification / Check and build all packages",
  "verification / Chrome stable",
  "verification / Chrome minimum 130",
  "verification / Firefox stable",
  "verification / Firefox minimum 140 ESR",
  "Publish verified packages"
]

// The first release source omitted one build-input file. This reviewed supplement
// is additive: never replace the original release assets or accept a free-form
// source override. All later releases include .gitignore in their CI artifact.
const SOURCE_SUPPLEMENT = Object.freeze({
  tag: "v5.1.0",
  sha: "9e5770ca8272035d7fd453c776f2571b7b7a6b83",
  productionSha256:
    "14e8aba1e286ce012da831de59c487a407c6b334a74762e77419dec42742909a",
  originalSha256:
    "b21b28defd81df92c5597eb5622507501b3668758bb8a0d7c5067040c0dafbb8",
  name: "firefox-mv3-source-5.1.0-review.zip",
  sha256: "9d9f6df548148261fa1666b7917acced2525ea34aff85c50365addb604d80bf2",
  gitignoreSha256:
    "507d7d0794bbfaf770cd9a3e7ece7d6e943ece2b0ab89655356f6a7c5f128684"
})

function sourceSupplementFor(release) {
  if (release.tag !== SOURCE_SUPPLEMENT.tag) return null
  if (
    release.sha !== SOURCE_SUPPLEMENT.sha ||
    release.assets["firefox-mv3-prod.zip"]?.sha256 !==
      SOURCE_SUPPLEMENT.productionSha256 ||
    release.assets["firefox-mv3-source-5.1.0.zip"]?.sha256 !==
      SOURCE_SUPPLEMENT.originalSha256
  ) {
    throw new Error(
      "The reviewed source supplement does not match this release."
    )
  }
  return SOURCE_SUPPLEMENT
}

function verifySourceSupplement(original, corrected, gitignoreSha256) {
  try {
    execFileSync(
      "python3",
      [
        "-c",
        [
          "import hashlib,io,sys,zipfile",
          "data=sys.stdin.buffer.read(); split=int(sys.argv[1])",
          "a=zipfile.ZipFile(io.BytesIO(data[:split])); b=zipfile.ZipFile(io.BytesIO(data[split:]))",
          "an=a.namelist(); bn=b.namelist()",
          "assert len(an)==len(set(an)) and len(bn)==len(set(bn)), 'Duplicate source entry'",
          "assert '.gitignore' not in an and set(bn)==set(an)|{'.gitignore'}, 'Unexpected source entry changes'",
          "assert all(i.file_size<50*1024*1024 for z in (a,b) for i in z.infolist()), 'Oversized source entry'",
          "assert all(sum(i.file_size for i in z.infolist())<200*1024*1024 for z in (a,b)), 'Oversized source contents'",
          "assert all(a.read(n)==b.read(n) for n in an), 'Original source entry changed'",
          "assert hashlib.sha256(b.read('.gitignore')).hexdigest()==sys.argv[2], 'Unexpected ignore rules'"
        ].join("\n"),
        String(original.length),
        gitignoreSha256
      ],
      {
        input: Buffer.concat([original, corrected]),
        stdio: ["pipe", "pipe", "pipe"]
      }
    )
  } catch {
    throw new Error(
      "Reviewed source supplement must preserve every original entry and add only the pinned .gitignore."
    )
  }
}

function releaseVersion(tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || "")) {
    throw new Error("Select a release tag in vMAJOR.MINOR.PATCH format.")
  }
  return tag.slice(1)
}

function amoReleaseNotes(notes, version) {
  const tag = `v${version}`
  releaseVersion(tag)
  if (typeof notes !== "string" || !notes.trim())
    throw new Error("Version release notes are empty.")
  // Django's max_length counts Unicode code points, not UTF-16 code units.
  if ([...notes].length <= AMO_RELEASE_NOTES_LIMIT) return notes
  const footer = `Full changelog: https://github.com/${REPOSITORY}/blob/${tag}/CHANGELOG.md`
  const budget = AMO_RELEASE_NOTES_LIMIT - [...footer].length - 2
  if (budget < 0) throw new Error("Release changelog URL exceeds AMO limits.")
  const hasOpenFence = (text) => {
    let fence
    for (const line of text.split(/\r?\n/u)) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u)
      if (!match) continue
      if (!fence) fence = match[1]
      else if (
        match[1][0] === fence[0] &&
        match[1].length >= fence.length &&
        !match[2].trim()
      )
        fence = undefined
    }
    return Boolean(fence)
  }
  let excerpt = ""
  // Cut only before a top-level list item or a new unindented paragraph.
  // Wrapped lines and indented continuation paragraphs stay with their item.
  const boundaries = /\r?\n(?=(?:[-*+]|\d+[.)]) )|\r?\n[ \t]*\r?\n(?=\S)/gu
  for (const boundary of notes.matchAll(boundaries)) {
    const candidate = notes.slice(0, boundary.index).trimEnd()
    if ([...candidate].length > budget) break
    if (!hasOpenFence(candidate)) excerpt = candidate
  }
  return excerpt ? `${excerpt}\n\n${footer}` : footer
}

function compareVersions(left, right) {
  const parse = (value) => {
    if (!/^\d+(\.\d+){0,3}$/.test(value)) {
      throw new Error("Cannot safely compare an unexpected AMO version.")
    }
    return [...value.split(".").map(Number), 0, 0, 0].slice(0, 4)
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 4; index++) {
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
  }
  return 0
}

function jwt(issuer, secret, now = Math.floor(Date.now() / 1000)) {
  if (!issuer || !secret || /[\r\n]/.test(issuer + secret)) {
    throw new Error(
      "Set AMO_API_KEY and AMO_API_SECRET in the mozilla-addons environment."
    )
  }
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: issuer,
    jti: randomUUID(),
    iat: now,
    exp: now + 60
  })}`
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

async function jsonResponse(
  response,
  label,
  secrets = [],
  allowMissing = false
) {
  if (allowMissing && response.status === 404) return null
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`${label} returned invalid JSON (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    let detail = JSON.stringify(data)
    for (const secret of secrets.filter(Boolean)) {
      detail = detail.split(secret).join("[REDACTED]")
      detail = detail.split(encodeURIComponent(secret)).join("[REDACTED]")
    }
    throw new Error(
      `${label} failed (HTTP ${response.status}): ${detail.slice(0, 2000)}`
    )
  }
  return data
}

function createGitHubClient(token, fetchImpl = fetch) {
  if (!token)
    throw new Error(
      "A read-only GITHUB_TOKEN is required to verify the release."
    )
  return async (suffix, { allowMissing = false } = {}) => {
    let response
    try {
      response = await fetchImpl(
        `https://api.github.com/repos/${REPOSITORY}${suffix ? `/${suffix}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
          },
          redirect: "error",
          signal: AbortSignal.timeout(60000)
        }
      )
    } catch {
      throw new Error(
        "GitHub release verification request failed or timed out."
      )
    }
    return jsonResponse(
      response,
      "GitHub release verification",
      [token],
      allowMissing
    )
  }
}

async function resolveTrustedTag(tag, github) {
  const version = releaseVersion(tag)
  const repository = await github("")
  if (
    repository.id !== REPOSITORY_ID ||
    repository.full_name !== REPOSITORY ||
    repository.default_branch !== "master"
  )
    throw new Error("Unexpected GitHub repository identity or default branch.")
  let object = (await github(`git/ref/tags/${encodeURIComponent(tag)}`)).object
  for (let depth = 0; object?.type === "tag" && depth < 5; depth++)
    object = (await github(`git/tags/${object.sha}`)).object
  if (object?.type !== "commit" || !/^[0-9a-f]{40}$/.test(object.sha))
    throw new Error("Release tag must resolve to a commit.")
  const sha = object.sha
  const comparison = await github(`compare/${sha}...master`)
  if (comparison.merge_base_commit?.sha !== sha)
    throw new Error(
      "Release tag is not an ancestor of the trusted master branch."
    )
  return { tag, version, sha }
}

function validReleaseRun(run, workflowId, tag, sha) {
  return (
    run &&
    run.repository?.id === REPOSITORY_ID &&
    run.head_repository?.id === REPOSITORY_ID &&
    run.workflow_id === workflowId &&
    run.path === ".github/workflows/release.yml" &&
    ["push", "workflow_dispatch"].includes(run.event) &&
    run.head_branch === tag &&
    run.head_sha === sha &&
    run.status === "completed" &&
    ["success", "failure"].includes(run.conclusion)
  )
}

async function prepareRelease({
  tag,
  runId,
  github,
  requireSource = true,
  statusOnly = false,
  includeChrome = false,
  allowIncomplete = false,
  fetchImpl = fetch,
  run: execute = execFileSync
}) {
  const identity = await resolveTrustedTag(tag, github)
  const { version, sha } = identity
  if (statusOnly) {
    const published = await github(`releases/tags/${encodeURIComponent(tag)}`)
    if (published.draft || published.prerelease || published.tag_name !== tag)
      throw new Error("A published stable GitHub release is required.")
    return { ...identity, statusOnly: true, assets: {} }
  }
  const workflow = await github("actions/workflows/release.yml")
  // Historical proof is pinned to the original publication. A newer retry must
  // not hide it in the run listing or become the implicit provenance authority.
  if (!runId && tag === LEGACY_RELEASE.tag && sha === LEGACY_RELEASE.sha)
    runId = LEGACY_RELEASE.runId
  let candidates
  if (runId) {
    if (!/^\d+$/.test(String(runId))) throw new Error("Invalid release run ID.")
    const run = await github(`actions/runs/${runId}`)
    if (!validReleaseRun(run, workflow.id, tag, sha))
      throw new Error(
        "An original completed Release run is required for this exact tag commit."
      )
    candidates = [run]
  } else {
    const runs = await github(
      `actions/workflows/release.yml/runs?branch=${encodeURIComponent(tag)}&status=completed&per_page=100`
    )
    candidates = (runs.workflow_runs || []).filter((run) =>
      validReleaseRun(run, workflow.id, tag, sha)
    )
  }
  let run
  for (const candidate of candidates) {
    const jobs = await github(
      `actions/runs/${candidate.id}/jobs?filter=latest&per_page=100`
    )
    if (
      REQUIRED_JOBS.every((name) =>
        jobs.jobs?.some(
          (job) => job.name === name && job.conclusion === "success"
        )
      )
    ) {
      run = candidate
      break
    }
  }
  if (!run) {
    if (allowIncomplete) return { ...identity, eligible: false }
    throw new Error(
      "The release did not pass every required build/browser/publication gate."
    )
  }
  const release = await github(`releases/tags/${encodeURIComponent(tag)}`)
  if (release.draft || release.prerelease || release.tag_name !== tag)
    throw new Error("A published stable GitHub release is required.")
  const names = ["firefox-mv3-prod.zip"]
  if (requireSource) names.push(`firefox-mv3-source-${version}.zip`)
  if (includeChrome) names.push("chrome-mv3-prod.zip")
  const assets = {}
  for (const name of names) {
    const found = release.assets?.filter((asset) => asset.name === name) || []
    if (
      found.length !== 1 ||
      found[0].state !== "uploaded" ||
      !/^sha256:[0-9a-f]{64}$/.test(found[0].digest || "") ||
      !Number.isSafeInteger(found[0].size) ||
      found[0].size <= 0 ||
      found[0].size > 50 * 1024 * 1024
    )
      throw new Error(`Missing unique published release asset/digest: ${name}`)
    assets[name] = { sha256: found[0].digest.slice(7), size: found[0].size }
  }
  const prepared = {
    ...identity,
    runId: run.id,
    artifactId: null,
    assets,
    eligible: true,
    packageSource: "artifact"
  }
  const artifacts = await github(
    `actions/runs/${run.id}/artifacts?per_page=100`
  )
  const matches = (artifacts.artifacts || []).filter(
    (artifact) => artifact.name === "fontara-verified-packages"
  )
  if (
    matches.length > 1 ||
    (matches.length === 1 && matches[0].workflow_run?.head_sha !== sha)
  )
    throw new Error(
      "The exact verified release artifact is ambiguous or belongs to another commit."
    )
  if (matches.length === 1 && !matches[0].expired)
    prepared.artifactId = matches[0].id
  else {
    await durableProvenance(prepared, release, { fetchImpl, run: execute })
    prepared.packageSource = "release-assets"
  }
  const correction = requireSource ? sourceSupplementFor(prepared) : null
  if (correction) {
    const found =
      release.assets?.filter((asset) => asset.name === correction.name) || []
    if (
      found.length !== 1 ||
      found[0].state !== "uploaded" ||
      found[0].digest !== `sha256:${correction.sha256}` ||
      !Number.isInteger(found[0].size) ||
      found[0].size <= 0 ||
      found[0].size > 50 * 1024 * 1024
    )
      throw new Error(
        "The uniquely named, pinned reviewer source supplement is missing or mismatched."
      )
    assets[correction.name] = { sha256: correction.sha256, size: found[0].size }
    prepared.sourceSupplement = correction.name
  }
  return prepared
}

function readVerifiedPackages(
  directory,
  release,
  { requireSource = true } = {}
) {
  if (releaseVersion(release.tag) !== release.version)
    throw new Error("Release metadata version mismatch.")
  const read = (name) => {
    const expected = release.assets[name]
    const bytes = fs.readFileSync(path.join(directory, name))
    const hash = createHash("sha256").update(bytes).digest("hex")
    if (
      !expected ||
      bytes.length !== expected.size ||
      hash !== expected.sha256
    ) {
      throw new Error(
        `Verified artifact does not match the published release digest: ${name}`
      )
    }
    return bytes
  }
  const archive = read("firefox-mv3-prod.zip")
  if (archive.length > 3 * 1024 * 1024) {
    throw new Error(
      "Firefox release archives exceed the expected size budgets."
    )
  }
  const inspect = (bytes, names) => {
    try {
      return JSON.parse(
        execFileSync(
          "python3",
          [
            "-c",
            [
              "import io,json,sys,zipfile",
              "z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))",
              "names=json.loads(sys.argv[1])",
              "assert all(z.namelist().count(n)==1 and z.getinfo(n).file_size<1048576 for n in names), 'Missing, duplicate, or oversized source metadata'",
              "print(json.dumps({n:z.read(n).decode('utf-8') for n in names}))"
            ].join(";"),
            JSON.stringify(names)
          ],
          {
            input: bytes,
            encoding: "utf8",
            maxBuffer: 4 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"]
          }
        )
      )
    } catch {
      throw new Error(
        "Missing, duplicate, oversized, or invalid ZIP/source metadata (including required .gitignore)."
      )
    }
  }
  const manifest = JSON.parse(
    inspect(archive, ["manifest.json"])["manifest.json"]
  )
  if (
    manifest.manifest_version !== 3 ||
    manifest.version !== release.version ||
    manifest.browser_specific_settings?.gecko?.id !== GUID
  ) {
    throw new Error(
      "Firefox ZIP version or add-on GUID does not match the release."
    )
  }
  if (!requireSource) return { archive, version: release.version }
  const originalSource = read(`firefox-mv3-source-${release.version}.zip`)
  if (originalSource.length > 50 * 1024 * 1024)
    throw new Error("Firefox source ZIP exceeds the expected size budget.")
  let source = originalSource
  let reviewSourceNote =
    "Source and production ZIPs are the exact artifacts from the verified GitHub release."
  if (release.sourceSupplement) {
    const correction = sourceSupplementFor(release)
    if (
      !correction ||
      release.sourceSupplement !== correction.name ||
      release.assets[correction.name]?.sha256 !== correction.sha256
    )
      throw new Error("Unexpected reviewer source supplement metadata.")
    source = read(correction.name)
    if (source.length > 50 * 1024 * 1024)
      throw new Error(
        "Firefox source supplement exceeds the expected size budget."
      )
    verifySourceSupplement(originalSource, source, correction.gitignoreSha256)
    reviewSourceNote =
      "The production ZIP is the unchanged verified v5.1.0 artifact. The reviewed source supplement preserves every original source entry and adds only .gitignore from that exact tag, restoring Tailwind scan exclusions. An isolated rebuild matched all 152 production file contents; ZIP timestamps can differ outside Git."
  }
  const files = inspect(source, [
    ".gitignore",
    "package.json",
    "src/manifest.json",
    "src/manifest-firefox-mv3.json",
    "pnpm-lock.yaml",
    "FIREFOX_SOURCE_README.md",
    "CHANGELOG.md"
  ])
  const sourcePackage = JSON.parse(files["package.json"])
  const sourceManifest = JSON.parse(files["src/manifest.json"])
  const sourceFirefox = JSON.parse(files["src/manifest-firefox-mv3.json"])
  if (
    manifest.manifest_version !== 3 ||
    manifest.version !== release.version ||
    manifest.browser_specific_settings?.gecko?.id !== GUID ||
    sourcePackage.version !== release.version ||
    sourceManifest.version !== release.version ||
    sourceFirefox.browser_specific_settings?.gecko?.id !== GUID
  ) {
    throw new Error(
      "Firefox ZIP/source version or add-on GUID does not match the release."
    )
  }
  const heading = `## ${release.version}`
  const lines = files["CHANGELOG.md"].split("\n")
  const start = lines.findIndex(
    (line) => line === heading || line.startsWith(`${heading} - `)
  )
  if (start < 0)
    throw new Error("Source archive has no release notes for this version.")
  let end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## ")
  )
  if (end < 0) end = lines.length
  const releaseNotes = amoReleaseNotes(
    lines
      .slice(start + 1, end)
      .join("\n")
      .trim(),
    release.version
  )
  return {
    archive,
    source,
    releaseNotes,
    reviewSourceNote,
    version: release.version
  }
}

function createAmoClient({
  issuer,
  secret,
  fetchImpl = fetch,
  sleep = delay,
  pollAttempts = 60
}) {
  // Validate credentials before any network request; never log a JWT or request headers.
  jwt(issuer, secret)
  const addonPath = `addon/${encodeURIComponent(GUID)}/`
  async function request(suffix, method = "GET", body, allowMissing = false) {
    const token = jwt(issuer, secret)
    let response
    try {
      response = await fetchImpl(`${AMO}${suffix}`, {
        method,
        headers: {
          Authorization: `JWT ${token}`,
          Accept: "application/json",
          ...(body && !(body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {})
        },
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(120000)
      })
    } catch {
      throw new Error(
        "AMO request failed or timed out. Check status before retrying submission."
      )
    }
    return jsonResponse(
      response,
      "AMO request",
      [issuer, secret, token],
      allowMissing
    )
  }
  async function addon() {
    const item = await request(addonPath)
    if (
      item.guid !== GUID ||
      item.is_disabled ||
      !["public", "nominated"].includes(item.status)
    ) {
      throw new Error(
        "AMO add-on identity/status is unexpected or disabled; inspect its dashboard."
      )
    }
    return item
  }
  async function status(version, { rawNotes = true } = {}) {
    releaseVersion(`v${version}`)
    await addon()
    const detail = await request(
      `${addonPath}versions/${encodeURIComponent(version)}/${rawNotes ? "?show_source=true" : ""}`,
      "GET",
      undefined,
      true
    )
    if (detail && (detail.version !== version || detail.channel !== "listed")) {
      throw new Error("AMO returned an unexpected version or channel.")
    }
    return detail
  }
  function accepted(detail, version) {
    if (
      detail?.version !== version ||
      !Number.isInteger(detail.id) ||
      detail.id <= 0 ||
      detail.channel !== "listed" ||
      detail.is_disabled ||
      !["unreviewed", "public"].includes(detail.file?.status) ||
      !detail.source
    ) {
      throw new Error(
        "AMO version is not an accepted listed submission with source attached; inspect its dashboard."
      )
    }
    return {
      version,
      versionId: detail.id,
      state: detail.file.status,
      sourceAttached: true
    }
  }
  async function updateReleaseNotes(version, versionId, releaseNotes) {
    const updated = await request(
      `${addonPath}versions/${versionId}/`,
      "PATCH",
      {
        release_notes: { "en-US": releaseNotes }
      }
    )
    accepted(updated, version)
    const canonicalNotes = updated.release_notes?.["en-US"]
    if (
      updated.id !== versionId ||
      typeof canonicalNotes !== "string" ||
      !canonicalNotes.trim()
    ) {
      throw new Error(
        "AMO did not confirm the release-note update; check status before retrying submission."
      )
    }
    // Released AMO servers return sanitized HTML; raw show_source support was
    // added later. Verify persistence against the canonical PATCH response using
    // the same representation, including Markdown and outbound-link rewriting.
    const confirmed = await status(version, { rawNotes: false })
    if (
      confirmed?.id !== versionId ||
      confirmed.release_notes?.["en-US"] !== canonicalNotes
    ) {
      throw new Error(
        "AMO did not persist the confirmed release notes; check status before retrying submission."
      )
    }
    return accepted(confirmed, version)
  }
  async function submit({
    archive,
    source,
    version,
    releaseNotes,
    reviewSourceNote = "Source and production ZIPs are the exact artifacts from the verified GitHub release."
  }) {
    releaseNotes = amoReleaseNotes(releaseNotes, version)
    const existing = await status(version)
    const marker = `FontARA verified ZIP SHA-256: ${createHash("sha256").update(archive).digest("hex")}; source SHA-256: ${createHash("sha256").update(source).digest("hex")}.`
    if (existing) {
      const result = accepted(existing, version)
      // Repair only metadata from our own interrupted submission. Existing
      // dashboard submissions are left untouched and never claim a fresh upload.
      if (
        existing.approval_notes?.includes(marker) &&
        existing.release_notes?.["en-US"] !== releaseNotes
      ) {
        return {
          ...(await updateReleaseNotes(version, existing.id, releaseNotes)),
          unchanged: true,
          metadataUpdated: true
        }
      }
      return { ...result, unchanged: true }
    }
    for (let page = 1; ; page++) {
      if (page > 20)
        throw new Error(
          "AMO version history exceeded the safety bound; inspect its dashboard."
        )
      const versions = await request(
        `${addonPath}versions/?filter=all_without_unlisted&page_size=50&page=${page}`
      )
      if (!Array.isArray(versions.results))
        throw new Error("AMO returned invalid version history.")
      if (
        versions.results.some(
          (entry) =>
            compareVersions(entry.version, version) > 0 ||
            entry.file?.status === "unreviewed"
        )
      ) {
        throw new Error(
          "A newer version or another pending review exists; no upload was performed."
        )
      }
      if (!versions.next) break
    }
    const form = new FormData()
    form.set("channel", "listed")
    form.set(
      "upload",
      new Blob([archive], { type: "application/zip" }),
      "firefox-mv3-prod.zip"
    )
    let upload = await request("upload/", "POST", form)
    const uploadId = upload?.uuid
    // AMO's FileUploadSerializer uses UUIDField(format='hex'). Retain the
    // hyphenated UUID form for compatibility without accepting arbitrary paths.
    if (
      typeof uploadId !== "string" ||
      !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(
        uploadId
      )
    )
      throw new Error("AMO upload returned an invalid identifier.")
    for (
      let attempt = 0;
      !upload.processed && attempt < pollAttempts;
      attempt++
    ) {
      await sleep(10000)
      upload = await request(`upload/${uploadId}/`)
    }
    if (
      upload.uuid !== uploadId ||
      upload.channel !== "listed" ||
      upload.version !== version ||
      upload.processed !== true ||
      upload.valid !== true ||
      upload.submitted === true
    ) {
      throw new Error(
        "AMO upload validation did not succeed for this version; no version was submitted."
      )
    }
    const submission = new FormData()
    submission.set("upload", uploadId)
    submission.set(
      "source",
      new Blob([source], { type: "application/zip" }),
      `firefox-mv3-source-${version}.zip`
    )
    submission.set("license", "MIT")
    submission.set(
      "approval_notes",
      `${marker} ${reviewSourceNote} See FIREFOX_SOURCE_README.md for Node.js/pnpm versions and build commands. No login is required. Google Fonts is optional and off by default; Firefox data consent is requested before its network access. No remote executable code is loaded.`
    )
    const created = await request(`${addonPath}versions/`, "POST", submission)
    if (
      created.version !== version ||
      created.channel !== "listed" ||
      !Number.isInteger(created.id)
    ) {
      throw new Error(
        "AMO did not confirm the intended version; check its dashboard before retrying."
      )
    }
    return {
      ...(await updateReleaseNotes(version, created.id, releaseNotes)),
      unchanged: false,
      uploadId
    }
  }
  return { status, submit }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const { values } = require("node:util").parseArgs({
    args,
    options: {
      action: { type: "string", default: "validate" },
      tag: { type: "string", default: env.AMO_RELEASE_TAG || "" },
      metadata: {
        type: "string",
        default: path.resolve("build/firefox-release.json")
      },
      directory: { type: "string", default: path.resolve("build") }
    }
  })
  const action = values.action
  if (
    ![
      "check-tag",
      "prepare",
      "download",
      "validate",
      "status",
      "submit"
    ].includes(action)
  )
    throw new Error("Unknown Firefox release action.")
  const version = releaseVersion(values.tag)
  if (action === "check-tag") {
    const identity = await resolveTrustedTag(
      values.tag,
      createGitHubClient(env.GITHUB_TOKEN)
    )
    if (
      identity.sha !== env.GITHUB_SHA ||
      env.GITHUB_REF !== `refs/tags/${values.tag}`
    )
      throw new Error(
        "The executing release commit does not match its trusted tag."
      )
    console.log(`Trusted release tag: ${identity.tag} (${identity.sha}).`)
    return
  }
  if (action === "prepare") {
    if (
      env.GITHUB_REPOSITORY !== REPOSITORY ||
      env.GITHUB_REF !== "refs/heads/master"
    ) {
      throw new Error(
        "Firefox publication must execute trusted workflow code on master."
      )
    }
    let runId
    if (env.GITHUB_EVENT_NAME === "workflow_run") {
      const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, "utf8"))
      runId = event.workflow_run?.id
      if (event.workflow_run?.head_branch !== values.tag)
        throw new Error("Trigger tag mismatch.")
    } else if (env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
      throw new Error("Unexpected Firefox workflow trigger.")
    }
    const release = await prepareRelease({
      tag: values.tag,
      runId,
      github: createGitHubClient(env.GITHUB_TOKEN),
      requireSource: env.AMO_ACTION !== "status",
      statusOnly: env.AMO_ACTION === "status",
      allowIncomplete: env.GITHUB_EVENT_NAME === "workflow_run"
    })
    fs.writeFileSync(values.metadata, `${JSON.stringify(release, null, 2)}\n`)
    if (env.GITHUB_OUTPUT)
      fs.appendFileSync(
        env.GITHUB_OUTPUT,
        `eligible=${release.eligible !== false}\npackage_source=${release.packageSource || ""}\nrun_id=${release.runId || ""}\nartifact_id=${release.artifactId || ""}\nsource_supplement=${release.sourceSupplement || ""}\n`
      )
    console.log(
      release.eligible === false
        ? `No verified publication milestone for ${values.tag}; no store action will run.`
        : `Verified release identity for ${values.tag} (${release.sha}).`
    )
    return
  }
  const release = JSON.parse(fs.readFileSync(values.metadata, "utf8"))
  if (release.tag !== values.tag)
    throw new Error("Prepared release tag mismatch.")
  if (action === "download") {
    if (release.packageSource !== "release-assets")
      throw new Error("Durable release download was not selected.")
    await downloadPreparedPackages(
      release,
      values.directory,
      createGitHubClient(env.GITHUB_TOKEN)
    )
    return
  }
  const packages =
    action === "status" ? null : readVerifiedPackages(values.directory, release)
  if (action === "status" && !release.statusOnly)
    throw new Error("Status requires a separately verified release identity.")
  if (packages)
    console.log(
      `Verified Firefox ${version} ZIP SHA-256: ${release.assets["firefox-mv3-prod.zip"].sha256}`
    )
  if (action !== "status")
    console.log(
      `Verified submission source SHA-256: ${createHash("sha256").update(packages.source).digest("hex")}${release.sourceSupplement ? " (reviewed additive supplement)" : ""}`
    )
  if (action === "validate") return
  const client = createAmoClient({
    issuer: env.AMO_API_KEY,
    secret: env.AMO_API_SECRET
  })
  const detail =
    action === "submit"
      ? await client.submit(packages)
      : await client.status(version)
  const result =
    action === "submit"
      ? detail
      : {
          version,
          state: detail?.file?.status || "not-submitted",
          versionId: detail?.id,
          sourceAttached: Boolean(detail?.source)
        }
  console.log(`AMO ${action}: ${JSON.stringify(result)}`)
  if (env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `## Firefox ${version}\n\nAction: ${action}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nMozilla review/signing can continue after this workflow completes.\n`
    )
}

module.exports = {
  GUID,
  REQUIRED_JOBS,
  releaseVersion,
  amoReleaseNotes,
  compareVersions,
  jwt,
  prepareRelease,
  resolveTrustedTag,
  validReleaseRun,
  readVerifiedPackages,
  createAmoClient,
  createGitHubClient,
  SOURCE_SUPPLEMENT,
  sourceSupplementFor,
  verifySourceSupplement,
  main
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
