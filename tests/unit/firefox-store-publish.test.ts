import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { ZipFile } from "yazl"

const require = createRequire(import.meta.url)
const {
  GUID,
  REQUIRED_JOBS,
  jwt,
  SOURCE_SUPPLEMENT,
  sourceSupplementFor,
  verifySourceSupplement,
  createGitHubClient,
  prepareRelease,
  readVerifiedPackages,
  createAmoClient
} = require("../../tasks/publish-firefox-store.js")
const { load } = require("js-yaml")
const version = "5.1.0"
const sha = SOURCE_SUPPLEMENT.sha
const archive = Buffer.from("exact verified production zip")
const source = Buffer.from("exact matching source zip")
const packages = { archive, source, version, releaseNotes: "Release notes" }
const issuer = "user:1234:5678"
const secret = "test-amo-secret-never-print"
const addon = { guid: GUID, status: "public", is_disabled: false }
// FileUploadSerializer returns uuid.hex, without hyphens.
const uploadId = "abcdef12123442348234123456789abc"
const uploaded = {
  uuid: uploadId,
  channel: "listed",
  version,
  processed: true,
  valid: true,
  submitted: false
}
const detail = {
  id: 90,
  version,
  channel: "listed",
  file: { status: "unreviewed" },
  source: "https://addons.mozilla.org/source.zip",
  release_notes: { "en-US": packages.releaseNotes }
}
const missing = () => Response.json({ detail: "Not found" }, { status: 404 })
type Reply = Record<string, unknown> | Response

function harness(replies: Reply[]) {
  const requests: Array<{ url: string; init: RequestInit }> = []
  const client = createAmoClient({
    issuer,
    secret,
    pollAttempts: 2,
    sleep: async () => {},
    fetchImpl: async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      const reply = replies.shift()
      assert.ok(reply, `Unexpected network request: ${url}`)
      return reply instanceof Response ? reply : Response.json(reply)
    }
  })
  return { client, requests }
}

function githubFixture() {
  const run = {
    id: 7,
    repository: { id: 141708904 },
    head_repository: { id: 141708904 },
    workflow_id: 3,
    path: ".github/workflows/release.yml",
    event: "push",
    head_branch: "v5.1.0",
    head_sha: sha,
    status: "completed",
    conclusion: "success"
  }
  const data: Record<string, unknown> = {
    "": {
      id: 141708904,
      full_name: "mimalef70/fontara",
      default_branch: "master"
    },
    "git/ref/tags/v5.1.0": { object: { type: "tag", sha: "b".repeat(40) } },
    [`git/tags/${"b".repeat(40)}`]: { object: { type: "commit", sha } },
    [`compare/${sha}...master`]: { merge_base_commit: { sha } },
    "actions/workflows/release.yml": { id: 3 },
    "actions/runs/7": run,
    "actions/workflows/release.yml/runs?branch=v5.1.0&event=push&status=success&per_page=100":
      { workflow_runs: [run] },
    "actions/runs/7/jobs?filter=latest&per_page=100": {
      jobs: REQUIRED_JOBS.map((name: string) => ({
        name,
        conclusion: "success"
      }))
    },
    "actions/runs/7/artifacts?per_page=100": {
      artifacts: [
        {
          id: 8,
          name: "fontara-verified-packages",
          expired: false,
          workflow_run: { head_sha: sha }
        }
      ]
    },
    "releases/tags/v5.1.0": {
      tag_name: "v5.1.0",
      draft: false,
      prerelease: false,
      assets: [
        ["firefox-mv3-prod.zip", SOURCE_SUPPLEMENT.productionSha256],
        ["firefox-mv3-source-5.1.0.zip", SOURCE_SUPPLEMENT.originalSha256],
        [SOURCE_SUPPLEMENT.name, SOURCE_SUPPLEMENT.sha256]
      ].map(([name, hash]) => ({
        name,
        state: "uploaded",
        digest: `sha256:${hash}`,
        size: 10
      }))
    }
  }
  return {
    data,
    run,
    github: async (suffix: string) => {
      assert.ok(suffix in data, `Unexpected GitHub URL: ${suffix}`)
      return data[suffix]
    }
  }
}

test("AMO JWTs use short-lived HS256 and unique request nonces", () => {
  const token = jwt(issuer, secret, 1000)
  const [header, payload, signature] = token.split(".")
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), {
    alg: "HS256",
    typ: "JWT"
  })
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString())
  assert.equal(claims.iss, issuer)
  assert.equal(claims.iat, 1000)
  assert.equal(claims.exp, 1060)
  assert.equal(
    signature,
    createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url")
  )
  assert.notEqual(token, jwt(issuer, secret, 1000))
  assert.throws(() => jwt("", secret), /AMO_API_KEY/)
})

test("GitHub repository identity request has no trailing slash or redirects", async () => {
  let requested = ""
  const github = createGitHubClient(
    "github-token",
    async (url: string, options: RequestInit) => {
      requested = url
      assert.equal(options.redirect, "error")
      return Response.json({ id: 141708904 })
    }
  )
  await github("")
  assert.equal(requested, "https://api.github.com/repos/mimalef70/fontara")
})

test("release preparation resolves annotated tags and exact verified run assets", async () => {
  const { github } = githubFixture()
  const automatic = await prepareRelease({ tag: "v5.1.0", runId: 7, github })
  const manual = await prepareRelease({ tag: "v5.1.0", github })
  assert.deepEqual(automatic, manual)
  assert.equal(automatic.sha, sha)
  assert.equal(automatic.artifactId, 8)
  assert.equal(automatic.sourceSupplement, SOURCE_SUPPLEMENT.name)
})

test("legacy source preparation pins its reviewed supplement while status needs none", async () => {
  const fixture = githubFixture()
  const release = fixture.data["releases/tags/v5.1.0"] as {
    assets: Array<{ name: string; digest: string }>
  }
  const supplement = release.assets.find(
    (asset) => asset.name === SOURCE_SUPPLEMENT.name
  )
  assert.ok(supplement)
  supplement.digest = `sha256:${"f".repeat(64)}`
  await assert.rejects(
    prepareRelease({ tag: "v5.1.0", github: fixture.github }),
    /supplement is missing or mismatched/
  )
  release.assets = release.assets.filter(
    (asset) => asset.name !== SOURCE_SUPPLEMENT.name
  )
  const status = await prepareRelease({
    tag: "v5.1.0",
    github: fixture.github,
    requireSource: false
  })
  assert.equal(status.sourceSupplement, undefined)
  await assert.rejects(
    prepareRelease({ tag: "v5.1.0", github: fixture.github }),
    /supplement is missing or mismatched/
  )
})

test("source correction identity cannot be retargeted by prepared metadata", () => {
  const release = {
    tag: SOURCE_SUPPLEMENT.tag,
    sha: SOURCE_SUPPLEMENT.sha,
    assets: {
      "firefox-mv3-prod.zip": { sha256: SOURCE_SUPPLEMENT.productionSha256 },
      "firefox-mv3-source-5.1.0.zip": {
        sha256: SOURCE_SUPPLEMENT.originalSha256
      }
    }
  }
  assert.equal(sourceSupplementFor(release).name, SOURCE_SUPPLEMENT.name)
  assert.equal(sourceSupplementFor({ ...release, tag: "v5.2.0" }), null)
  assert.throws(
    () => sourceSupplementFor({ ...release, sha: "f".repeat(40) }),
    /does not match/
  )
  release.assets["firefox-mv3-source-5.1.0.zip"].sha256 = "f".repeat(64)
  assert.throws(() => sourceSupplementFor(release), /does not match/)
})

test("release provenance rejects forks, wrong tags, unrelated workflows, and incomplete checks", async () => {
  for (const change of [
    { repository: { id: 1 } },
    { head_repository: { id: 1 } },
    { event: "pull_request" },
    { head_sha: "d".repeat(40) },
    { head_branch: "master" },
    { path: ".github/workflows/evil.yml" },
    { workflow_id: 4 },
    { conclusion: "failure" }
  ]) {
    const fixture = githubFixture()
    Object.assign(fixture.run, change)
    await assert.rejects(
      prepareRelease({ tag: "v5.1.0", runId: 7, github: fixture.github }),
      /successful Release/
    )
  }
  const fixture = githubFixture()
  fixture.data["actions/runs/7/jobs?filter=latest&per_page=100"] = { jobs: [] }
  await assert.rejects(
    prepareRelease({ tag: "v5.1.0", runId: 7, github: fixture.github }),
    /every required/
  )
  const other = githubFixture()
  other.data[`compare/${sha}...master`] = {
    merge_base_commit: { sha: "e".repeat(40) }
  }
  await assert.rejects(
    prepareRelease({ tag: "v5.1.0", github: other.github }),
    /ancestor/
  )
})

test("AMO compact UUID submission polls the exact upload and attaches source atomically", async () => {
  const { client, requests } = harness([
    addon,
    missing(),
    { results: [], next: null },
    { ...uploaded, processed: false },
    uploaded,
    detail,
    detail,
    addon,
    detail
  ])
  const result = await client.submit(packages)
  assert.equal(result.state, "unreviewed")
  assert.equal(result.unchanged, false)
  assert.equal(result.uploadId, uploadId)
  assert.equal(
    requests[4].url,
    `https://addons.mozilla.org/api/v5/addons/upload/${uploadId}/`
  )
  const upload = requests[3].init.body as FormData
  assert.equal(upload.get("channel"), "listed")
  assert.deepEqual(
    Buffer.from(await (upload.get("upload") as Blob).arrayBuffer()),
    archive
  )
  const submission = requests[5].init.body as FormData
  assert.equal(submission.get("upload"), uploadId)
  assert.equal(submission.get("license"), "MIT")
  assert.deepEqual(
    Buffer.from(await (submission.get("source") as Blob).arrayBuffer()),
    source
  )
  assert.deepEqual(JSON.parse(String(requests[6].init.body)), {
    release_notes: { "en-US": "Release notes" }
  })
  assert.ok(requests[8].url.endsWith(`/versions/${version}/?show_source=true`))
  assert.ok(
    requests.every(
      ({ url, init }) =>
        url.startsWith("https://addons.mozilla.org/api/v5/addons/") &&
        init.redirect === "error"
    )
  )
})

test("hyphenated upload UUIDs remain supported without rewriting the identifier", async () => {
  const uuid = "abcdef12-1234-4234-8234-123456789abc"
  const { client, requests } = harness([
    addon,
    missing(),
    { results: [] },
    { ...uploaded, uuid, processed: false },
    { ...uploaded, uuid },
    detail,
    detail,
    addon,
    detail
  ])
  assert.equal((await client.submit(packages)).uploadId, uuid)
  assert.equal(
    requests[4].url,
    `https://addons.mozilla.org/api/v5/addons/upload/${uuid}/`
  )
  assert.equal((requests[5].init.body as FormData).get("upload"), uuid)
})

test("malformed upload identifiers cannot trigger polling or version creation", async () => {
  for (const uuid of [
    "",
    null,
    123,
    [uploadId],
    { value: uploadId },
    "a".repeat(31),
    "a".repeat(33),
    uploadId.toUpperCase(),
    "abcdef12-1234-4234-8234123456789abc",
    `${uploadId}/../addon`,
    `${uploadId}?channel=unlisted`,
    `${uploadId}\n`,
    `https://example.com/${uploadId}`
  ]) {
    const { client, requests } = harness([
      addon,
      missing(),
      { results: [] },
      { ...uploaded, uuid, processed: false }
    ])
    await assert.rejects(client.submit(packages), /invalid identifier/)
    assert.equal(requests.length, 4)
  }
})

test("polling a different valid UUID never submits a version", async () => {
  const { client, requests } = harness([
    addon,
    missing(),
    { results: [] },
    { ...uploaded, processed: false },
    { ...uploaded, uuid: "bbcdef12123442348234123456789abc" }
  ])
  await assert.rejects(client.submit(packages), /validation did not succeed/)
  assert.equal(requests.length, 5)
  assert.equal(requests.filter(({ init }) => init.method === "POST").length, 1)
})

test("same-version submission is read-only and does not overwrite dashboard metadata", async () => {
  const { client, requests } = harness([
    addon,
    { ...detail, release_notes: { "en-US": "Dashboard notes" } }
  ])
  const result = await client.submit(packages)
  assert.equal(result.unchanged, true)
  assert.ok(requests.every(({ init }) => init.method === "GET"))
})

test("retries repair metadata only for an interrupted submission with matching artifact markers", async () => {
  const marker = `FontARA verified ZIP SHA-256: ${createHash("sha256").update(archive).digest("hex")}; source SHA-256: ${createHash("sha256").update(source).digest("hex")}.`
  const owned = { ...detail, approval_notes: marker, release_notes: null }
  const { client, requests } = harness([addon, owned, detail, addon, detail])
  const result = await client.submit(packages)
  assert.equal(result.metadataUpdated, true)
  assert.equal(result.unchanged, true)
  assert.equal(requests.filter(({ init }) => init.method === "POST").length, 0)
})

test("new submissions and metadata repairs require release-note readback confirmation", async () => {
  const marker = `FontARA verified ZIP SHA-256: ${createHash("sha256").update(archive).digest("hex")}; source SHA-256: ${createHash("sha256").update(source).digest("hex")}.`
  const owned = { ...detail, approval_notes: marker, release_notes: null }
  for (const staleNotes of [null, { "en-US": "Old release notes" }]) {
    for (const replies of [
      [addon, missing(), { results: [] }, uploaded, detail],
      [addon, owned]
    ]) {
      const { client, requests } = harness([
        ...replies,
        detail,
        addon,
        { ...detail, release_notes: staleNotes }
      ])
      await assert.rejects(client.submit(packages), /intended release notes/)
      assert.equal(
        requests.filter(({ init }) => init.method === "PATCH").length,
        1
      )
    }
  }
})

test("missing sources, disabled versions, and conflicting pending releases stop submission", async () => {
  for (const current of [
    { ...detail, source: null },
    { ...detail, file: { status: "disabled" } }
  ]) {
    const { client, requests } = harness([addon, current])
    await assert.rejects(client.submit(packages), /source attached/)
    assert.ok(requests.every(({ init }) => init.method === "GET"))
  }
  for (const entry of [
    { version: "5.2.0", file: { status: "public" } },
    { version: "5.0.1", file: { status: "unreviewed" } }
  ]) {
    const { client, requests } = harness([
      addon,
      missing(),
      { results: [entry] }
    ])
    await assert.rejects(
      client.submit(packages),
      /newer version or another pending/
    )
    assert.ok(requests.every(({ init }) => init.method === "GET"))
  }
})

test("failed or mismatched upload validation never creates an AMO version", async () => {
  for (const invalid of [
    { ...uploaded, valid: false },
    { ...uploaded, version: "5.2.0" },
    { ...uploaded, channel: "unlisted" }
  ]) {
    const { client, requests } = harness([
      addon,
      missing(),
      { results: [] },
      invalid
    ])
    await assert.rejects(client.submit(packages), /validation did not succeed/)
    assert.equal(
      requests.filter(({ init }) => init.method === "POST").length,
      1
    )
  }
})

test("AMO status makes only GET requests and reports absence without creating a version", async () => {
  const { client, requests } = harness([addon, missing()])
  assert.equal(await client.status(version), null)
  assert.ok(requests.every(({ init }) => init.method === "GET"))
})

test("AMO errors redact credentials before truncating diagnostic output", async () => {
  const client = createAmoClient({
    issuer,
    secret,
    fetchImpl: async (_url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string>)
        .Authorization
      return Response.json(
        {
          detail: `${"x".repeat(1980)}${secret} ${encodeURIComponent(secret)} ${issuer} ${authorization}`
        },
        { status: 403 }
      )
    }
  })
  await assert.rejects(client.status(version), (error: Error) => {
    assert.ok(!error.message.includes("test-amo"))
    assert.ok(!error.message.includes(issuer))
    assert.ok(!error.message.includes("eyJ"))
    return true
  })
})

async function zip(files: Record<string, string>): Promise<Buffer> {
  const archive = new ZipFile()
  const chunks: Buffer[] = []
  const complete = new Promise<Buffer>((resolve, reject) => {
    archive.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk))
    archive.outputStream.on("end", () => resolve(Buffer.concat(chunks)))
    archive.outputStream.on("error", reject)
  })
  for (const [name, value] of Object.entries(files))
    archive.addBuffer(Buffer.from(value), name)
  archive.end()
  return complete
}

test("reviewed source supplement preserves all original entries and only adds pinned ignore rules", async () => {
  const original = {
    "src/index.ts": "original code",
    "package.json": '{"version":"5.1.0"}'
  }
  const rules = "/node_modules\n/build\n"
  const ignoreHash = createHash("sha256").update(rules).digest("hex")
  const originalZip = await zip(original)
  verifySourceSupplement(
    originalZip,
    await zip({ ...original, ".gitignore": rules }),
    ignoreHash
  )
  for (const changed of [
    { ...original, ".gitignore": rules, "src/index.ts": "changed code" },
    { ...original, ".gitignore": "different rules" },
    { ...original, ".gitignore": rules, "extra.txt": "extra" },
    { "package.json": original["package.json"], ".gitignore": rules }
  ]) {
    const corrected = await zip(changed)
    assert.throws(
      () => verifySourceSupplement(originalZip, corrected, ignoreHash),
      /preserve every original entry/
    )
  }
  const alreadyContainsIgnore = await zip({ ...original, ".gitignore": rules })
  assert.throws(
    () =>
      verifySourceSupplement(
        alreadyContainsIgnore,
        alreadyContainsIgnore,
        ignoreHash
      ),
    /preserve every original entry/
  )
})

test("production/source validation detects tampering and mismatched source versions", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-amo-test-"))
  try {
    const manifest = {
      manifest_version: 3,
      version,
      browser_specific_settings: { gecko: { id: GUID } }
    }
    const production = await zip({ "manifest.json": JSON.stringify(manifest) })
    const sourceFiles: Record<string, string> = {
      ".gitignore": "node_modules/\nbuild/\n",
      "package.json": JSON.stringify({ version }),
      "src/manifest.json": JSON.stringify(manifest),
      "src/manifest-firefox-mv3.json": JSON.stringify(manifest),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "FIREFOX_SOURCE_README.md": "Build instructions",
      "CHANGELOG.md":
        "## 5.1.0 - 2026-11-01\n\nRelease notes\n\n## 5.0.0\nOlder notes"
    }
    const sourceArchive = await zip(sourceFiles)
    const assets: Record<string, { sha256: string; size: number }> = {}
    for (const [name, bytes] of [
      ["firefox-mv3-prod.zip", production],
      ["firefox-mv3-source-5.1.0.zip", sourceArchive]
    ] as const) {
      fs.writeFileSync(path.join(directory, name), bytes)
      assets[name] = {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length
      }
    }
    const release = { tag: "v5.1.0", version, assets }
    assert.equal(
      readVerifiedPackages(directory, release).releaseNotes,
      "Release notes"
    )
    fs.appendFileSync(path.join(directory, "firefox-mv3-prod.zip"), "tampered")
    assert.throws(() => readVerifiedPackages(directory, release), /digest/)
    fs.writeFileSync(path.join(directory, "firefox-mv3-prod.zip"), production)
    sourceFiles["package.json"] = JSON.stringify({ version: "5.2.0" })
    const mismatch = await zip(sourceFiles)
    fs.writeFileSync(
      path.join(directory, "firefox-mv3-source-5.1.0.zip"),
      mismatch
    )
    assets["firefox-mv3-source-5.1.0.zip"] = {
      sha256: createHash("sha256").update(mismatch).digest("hex"),
      size: mismatch.length
    }
    assert.throws(
      () => readVerifiedPackages(directory, release),
      /version or add-on GUID/
    )
    delete sourceFiles[".gitignore"]
    sourceFiles["package.json"] = JSON.stringify({ version })
    const incomplete = await zip(sourceFiles)
    fs.writeFileSync(
      path.join(directory, "firefox-mv3-source-5.1.0.zip"),
      incomplete
    )
    assets["firefox-mv3-source-5.1.0.zip"] = {
      sha256: createHash("sha256").update(incomplete).digest("hex"),
      size: incomplete.length
    }
    assert.throws(
      () => readVerifiedPackages(directory, release),
      /ZIP.source metadata/
    )
    assert.equal(
      readVerifiedPackages(directory, release, { requireSource: false })
        .version,
      version
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test("Firefox workflow keeps secrets out of validation and auto-submission disabled until enabled", () => {
  const workflow = load(
    fs.readFileSync(".github/workflows/firefox-release.yml", "utf8")
  )
  const job = workflow.jobs["firefox-store"]
  const checkout = job.steps.find((step: { uses?: string }) =>
    step.uses?.startsWith("actions/checkout@")
  )
  assert.equal(checkout.with.ref, "master")
  assert.equal(workflow.permissions.contents, "read")
  assert.equal(workflow.permissions.actions, "read")
  const supplement = job.steps.find(
    (step: { name: string }) =>
      step.name ===
      "Download the pinned reviewer source supplement when required"
  )
  assert.equal(
    runInNewContext(supplement.if, {
      env: { AMO_ACTION: "status" },
      steps: {
        release: { outputs: { source_supplement: SOURCE_SUPPLEMENT.name } }
      }
    }),
    false
  )
  assert.equal(
    runInNewContext(supplement.if, {
      env: { AMO_ACTION: "submit" },
      steps: {
        release: { outputs: { source_supplement: SOURCE_SUPPLEMENT.name } }
      }
    }),
    true
  )
  const operation = job.steps.find(
    (step: { name: string }) => step.name === "Run Mozilla Add-ons operation"
  )
  for (const [action, event, enabled, expected] of [
    ["validate", "workflow_dispatch", "true", false],
    ["submit", "workflow_run", "", false],
    ["submit", "workflow_run", "true", true],
    ["status", "workflow_dispatch", "", true]
  ]) {
    const result = runInNewContext(operation.if, {
      env: { AMO_ACTION: action },
      github: { event_name: event },
      vars: { AMO_AUTO_SUBMIT_ENABLED: enabled }
    })
    assert.equal(result, expected)
  }
  assert.ok(
    !job.steps.some((step: { run?: string }) =>
      /pnpm|npm|web-ext sign|build:firefox/.test(step.run || "")
    )
  )
})
