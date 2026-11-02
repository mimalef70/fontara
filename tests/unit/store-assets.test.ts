import assert from "node:assert/strict"
import { constants, generateKeyPairSync, sign } from "node:crypto"
import fs from "node:fs"
import { test } from "node:test"
import { ZipFile } from "yazl"

const { load } = require("js-yaml")
const {
  EXTENSION_ID,
  PUBLISHER_HASH,
  UPDATE_URL,
  SIGNATURE_FILES,
  digest,
  download,
  extensionId,
  verifyCrx,
  inspectZip,
  comparePayload,
  validReceipt,
  assertNotStale,
  plan,
  names,
  checksums,
  storeSection,
  mergeSection
} = require("../../tasks/sync-store-assets.js")
const GUID = "{206079c5-9bab-485d-ad12-97298719c3f2}"

async function zip(files: Record<string, string>): Promise<Buffer> {
  const archive = new ZipFile()
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk))
    archive.outputStream.on("end", () => resolve(Buffer.concat(chunks)))
    archive.outputStream.on("error", reject)
  })
  for (const [name, content] of Object.entries(files))
    archive.addBuffer(Buffer.from(content), name)
  archive.end()
  return done
}
function integer(value: number): Buffer {
  const bytes = []
  do {
    let byte = value % 128
    value = Math.floor(value / 128)
    if (value) byte |= 128
    bytes.push(byte)
  } while (value)
  return Buffer.from(bytes)
}
const field = (id: number, bytes: Buffer) =>
  Buffer.concat([integer(id * 8 + 2), integer(bytes.length), bytes])
function crxFixture(zipBytes: Buffer) {
  const developer = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const publisher = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  const devKey = developer.publicKey.export({ type: "spki", format: "der" })
  const pubKey = publisher.publicKey.export({ type: "spki", format: "der" })
  const signedHeader = field(1, Buffer.from(digest(devKey).slice(0, 32), "hex"))
  const length = Buffer.alloc(4)
  length.writeUInt32LE(signedHeader.length)
  const payload = Buffer.concat([
    Buffer.from("CRX3 SignedData\0"),
    length,
    signedHeader,
    zipBytes
  ])
  const proof = (key: Buffer, signature: Buffer) =>
    Buffer.concat([field(1, key), field(2, signature)])
  const header = Buffer.concat([
    field(
      2,
      proof(
        devKey,
        sign("sha256", payload, {
          key: developer.privateKey,
          padding: constants.RSA_PKCS1_PADDING
        })
      )
    ),
    field(3, proof(pubKey, sign("sha256", payload, publisher.privateKey))),
    field(10000, signedHeader)
  ])
  const prefix = Buffer.alloc(12)
  prefix.write("Cr24")
  prefix.writeUInt32LE(3, 4)
  prefix.writeUInt32LE(header.length, 8)
  return {
    bytes: Buffer.concat([prefix, header, zipBytes]),
    id: extensionId(devKey),
    publisher: digest(pubKey)
  }
}

test("CRX3 verifies both payload signatures, extension ID, and pinned publisher", () => {
  const archive = Buffer.from("signed test archive")
  const fixture = crxFixture(archive)
  assert.deepEqual(
    verifyCrx(fixture.bytes, fixture.id, fixture.publisher),
    archive
  )
  assert.throws(
    () => verifyCrx(fixture.bytes, EXTENSION_ID, fixture.publisher),
    /identity/
  )
  assert.throws(() => verifyCrx(fixture.bytes, fixture.id), /Web Store/)
  assert.equal(
    PUBLISHER_HASH,
    "61f7f2a6bfcf74cd0bc1fe2497cc9b04254c658f79f2145392867ea8366367cf"
  )
  const altered = Buffer.from(fixture.bytes)
  altered[altered.length - 1] ^= 1
  assert.throws(
    () => verifyCrx(altered, fixture.id, fixture.publisher),
    /signature verification/
  )
  const oversized = Buffer.from(fixture.bytes)
  oversized.writeUInt32LE(0xffffffff, 8)
  assert.throws(
    () => verifyCrx(oversized, fixture.id, fixture.publisher),
    /header size/
  )
  assert.throws(() => verifyCrx(Buffer.from("not a CRX")), /CRX3/)
})

test("signed Firefox payload allows only manifest formatting and five signature additions", async () => {
  const manifest = {
    manifest_version: 3,
    version: "5.1.0",
    browser_specific_settings: { gecko: { id: GUID } },
    permissions: ["storage"]
  }
  const original = {
    "manifest.json": JSON.stringify(manifest),
    "background.js": "original code"
  }
  const signatures = Object.fromEntries(
    SIGNATURE_FILES.map((name: string) => [name, "nonempty signature file"])
  )
  const signed = {
    ...original,
    ...signatures,
    "manifest.json": JSON.stringify(manifest, null, 2)
  }
  const base = await zip(original)
  assert.equal(
    comparePayload(base, await zip(signed), "firefox", "5.1.0").comparedFiles,
    2
  )
  // Exercise actual changed ZIPs, not merely malformed archives.
  await assert.rejects(
    async () =>
      comparePayload(
        base,
        await zip({ ...signed, "background.js": "changed" }),
        "firefox",
        "5.1.0"
      ),
    /payload differs/
  )
  await assert.rejects(
    async () =>
      comparePayload(
        base,
        await zip({ ...signed, "META-INF/extra.js": "code" }),
        "firefox",
        "5.1.0"
      ),
    /Unexpected store package entry/
  )
  await assert.rejects(
    async () =>
      comparePayload(
        base,
        await zip({
          ...signed,
          "manifest.json": JSON.stringify({
            ...manifest,
            permissions: ["tabs"]
          })
        }),
        "firefox",
        "5.1.0"
      ),
    /manifest changed/
  )
  await assert.rejects(
    async () =>
      comparePayload(
        base,
        await zip({ ...signed, "META-INF/mozilla.rsa": "" }),
        "firefox",
        "5.1.0"
      ),
    /signature file/
  )
})

test("Chrome comparison admits only store update metadata, never changed behavior", async () => {
  const manifest = {
    manifest_version: 3,
    version: "5.1.0",
    permissions: ["storage"]
  }
  const original = await zip({
    "manifest.json": JSON.stringify(manifest),
    "code.js": "same"
  })
  const store = {
    "manifest.json": JSON.stringify(
      { ...manifest, update_url: UPDATE_URL },
      null,
      2
    ),
    "code.js": "same",
    "_metadata/verified_contents.json": "signed metadata"
  }
  assert.equal(
    comparePayload(original, await zip(store), "chrome", "5.1.0").comparedFiles,
    2
  )
  await assert.rejects(
    async () =>
      comparePayload(
        original,
        await zip({ ...store, "_metadata/anything.js": "extra" }),
        "chrome",
        "5.1.0"
      ),
    /Unexpected/
  )
  await assert.rejects(
    async () =>
      comparePayload(
        original,
        await zip({
          ...store,
          "manifest.json": JSON.stringify({
            ...manifest,
            update_url: "https://attacker.example/update"
          })
        }),
        "chrome",
        "5.1.0"
      ),
    /update URL/
  )
  await assert.rejects(
    async () =>
      comparePayload(
        original,
        await zip({
          ...store,
          "manifest.json": JSON.stringify({ ...manifest, version: "5.0.0" })
        }),
        "chrome",
        "5.1.0"
      ),
    /version/
  )
  assert.throws(() => inspectZip(Buffer.from("invalid")), /Invalid/)
})

test("downloads reject untrusted redirects, credentials, and oversized payloads", async () => {
  const requests: string[] = []
  const fetchMock = async (
    url: string,
    options: { headers: Record<string, string>; redirect: string }
  ) => {
    requests.push(url)
    assert.equal(options.redirect, "manual")
    assert.equal(options.headers.Authorization, undefined)
    return new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example/data" }
    })
  }
  await assert.rejects(
    download(
      "https://addons.mozilla.org/file",
      ["addons.mozilla.org"],
      fetchMock
    ),
    /Untrusted/
  )
  assert.equal(requests.length, 1)
  await assert.rejects(
    download(
      "https://user:password@addons.mozilla.org/file",
      ["addons.mozilla.org"],
      fetchMock
    ),
    /Untrusted/
  )
  await assert.rejects(
    download(
      "https://addons.mozilla.org/file",
      ["addons.mozilla.org"],
      async () => new Response("too large"),
      3
    ),
    /budget/
  )
})

test("completed receipts bind the exact tag and every original/store asset digest", () => {
  const version = "5.1.0"
  const fixture = (name: string, hash: string) => ({
    name,
    digest: `sha256:${hash}`,
    size: 20,
    state: "uploaded"
  })
  const a = "a".repeat(64),
    b = "b".repeat(64),
    c = "c".repeat(64)
  const release = {
    body: "",
    tag_name: "v5.1.0",
    assets: [
      fixture("chrome-mv3-prod.zip", a),
      fixture("firefox-mv3-prod.zip", a),
      fixture(names(version).chrome, b),
      fixture(names(version).firefox, b),
      fixture("SHA256SUMS-store.txt", c)
    ]
  }
  const receipt = {
    schema: 1,
    repository: "mimalef70/fontara",
    tag: "v5.1.0",
    sha: "d".repeat(40),
    complete: true,
    originals: {
      "chrome-mv3-prod.zip": `sha256:${a}`,
      "firefox-mv3-prod.zip": `sha256:${a}`
    },
    packages: {
      chrome: {
        name: names(version).chrome,
        sha256: b,
        state: "available",
        size: 20
      },
      firefox: {
        name: names(version).firefox,
        sha256: b,
        state: "available",
        size: 20
      }
    },
    checksumsSha256: c
  }
  assert.equal(validReceipt(receipt, release, receipt.sha), false)
  release.body = storeSection(receipt)
  assert.equal(validReceipt(receipt, release, receipt.sha), true)
  assert.equal(validReceipt(receipt, release, "e".repeat(40)), false)
  assert.equal(
    validReceipt({ ...receipt, complete: false }, release, receipt.sha),
    false
  )
  assert.equal(
    validReceipt({ ...receipt, checksumsSha256: a }, release, receipt.sha),
    false
  )
  release.assets[2].digest = `sha256:${a}`
  assert.equal(validReceipt(receipt, release, receipt.sha), false)
})

test("store notes preserve the base release and describe pending packages honestly", () => {
  const result = {
    tag: "v5.1.0",
    packages: {
      chrome: {
        state: "pending",
        reason: "Store serves 5.0.0; waiting for 5.1.0."
      },
      firefox: {
        state: "available",
        name: "fontara-5.1.0-firefox.xpi",
        sha256: "f".repeat(64)
      }
    }
  }
  const section = storeSection(result)
  assert.match(section, /pending/)
  assert.doesNotMatch(section, /fontara-5.1.0-chrome.crx/)
  const body =
    "User notes\n\n<!-- fontara-release-assets:start -->\nbase package links\n<!-- fontara-release-assets:end -->"
  const once = mergeSection(body, section)
  assert.ok(once.startsWith(body))
  assert.equal(mergeSection(once, section), once)
  assert.throws(
    () => mergeSection("<!-- fontara-store-assets:start -->broken", section),
    /Ambiguous/
  )
  assert.equal(
    checksums(result.packages),
    `${"f".repeat(64)}  fontara-5.1.0-firefox.xpi\n`
  )
})

test("store workflow isolates publication rights and never accesses store secrets", () => {
  const source = fs.readFileSync(".github/workflows/store-assets.yml", "utf8")
  const workflow = load(source)
  const reusable = fs.readFileSync(
    ".github/workflows/store-assets-release.yml",
    "utf8"
  )
  const perRelease = load(reusable)
  assert.equal(workflow.name, "Store Release Assets")
  assert.equal(perRelease.jobs.collect.permissions.contents, "read")
  assert.equal(perRelease.jobs.publish.permissions.contents, "write")
  assert.equal(
    perRelease.jobs.publish.concurrency.group,
    "fontara-release-assets-" + "$" + "{{ needs.collect.outputs.release_tag }}"
  )
  assert.equal(perRelease.jobs.publish.concurrency["cancel-in-progress"], false)
  assert.match(workflow.jobs.plan.if, /head_repository.id == 141708904/)
  assert.match(workflow.jobs.plan.if, /refs\/heads\/master/)
  assert.doesNotMatch(
    source + reusable,
    /secrets\.|AMO_API|CWS_ACCESS|id-token: write/
  )
  assert.deepEqual(workflow.on.workflow_run.workflows, [
    "Release",
    "Firefox Release"
  ])
  assert.equal(workflow.on.schedule[0].cron, "17 */6 * * *")
})

test("a stale pending collection cannot overwrite a newly available signed asset", () => {
  const result = {
    version: "5.1.0",
    packages: { chrome: { state: "pending" }, firefox: { state: "available" } }
  }
  assert.doesNotThrow(() => assertNotStale(result, { assets: [] }))
  assert.throws(
    () =>
      assertNotStale(result, {
        assets: [{ name: "fontara-5.1.0-chrome.crx" }]
      }),
    /Stale/
  )
})

test("automatic queue keeps older pending releases after a newer tag appears", async () => {
  const release = (tag: string, date: string, eligible = true) => ({
    tag_name: tag,
    published_at: date,
    draft: false,
    prerelease: false,
    assets: eligible ? [{ name: "build-info.json" }] : []
  })
  const latest = release("v5.2.0", "2026-11-02T00:00:00Z")
  const rows = [
    latest,
    release("v5.1.0", "2026-11-01T00:00:00Z", false),
    release("v4.0.0", "2026-10-30T00:00:00Z", false),
    release("v3.0.0", "2025-10-01T00:00:00Z")
  ]
  const github = async (route: string) =>
    route === ""
      ? {
          id: 141708904,
          full_name: "mimalef70/fontara",
          default_branch: "master"
        }
      : route === "releases/latest"
        ? latest
        : rows
  assert.deepEqual(await plan("", github, Date.parse("2026-11-02T01:00:00Z")), [
    "v5.2.0",
    "v5.1.0"
  ])
  assert.deepEqual(await plan("v5.1.0", github), ["v5.1.0"])
  await assert.rejects(plan("../../wrong", github), /release tag/)
})
