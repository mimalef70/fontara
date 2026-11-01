import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { ZipFile } from "yazl"

const require = createRequire(import.meta.url)
const { createStoreClient, deploymentPercentage, main, readVerifiedPackage } =
  require("../../tasks/publish-chrome-store.js")
const extensionId = "dcjdhicepiklefpimapdkbaeoocniemc"
const publisherId = "fontara-test-publisher"
const identity = {
  name: `publishers/${publisherId}/items/${extensionId}`,
  itemId: extensionId
}
const published = {
  ...identity,
  publishedItemRevisionStatus: {
    state: "PUBLISHED",
    distributionChannels: [{ crxVersion: "5.0.0", deployPercentage: 100 }]
  }
}
const archive = Buffer.from("verified zip bytes")
const token = "test-access-token-do-not-print"

type Reply = Record<string, unknown> | Response

function harness(replies: Reply[]) {
  const requests: Array<{ url: string; init: RequestInit }> = []
  let sleeps = 0
  const client = createStoreClient({
    publisherId,
    extensionId,
    token,
    pollAttempts: 2,
    sleep: async () => {
      sleeps++
    },
    fetchImpl: async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      const reply = replies.shift()
      assert.ok(reply, `Unexpected network request: ${url}`)
      return reply instanceof Response ? reply : Response.json(reply)
    }
  })
  return { client, requests, sleeps: () => sleeps }
}

function successfulUpload(version = "5.1.0") {
  return { ...identity, uploadState: "SUCCEEDED", crxVersion: version }
}

test("Chrome publishing uploads the original bytes and submits a reviewed 10% rollout", async () => {
  const { client, requests } = harness([
    published,
    successfulUpload(),
    { ...identity, state: "PENDING_REVIEW" }
  ])
  const result = await client.submit({ archive, version: "5.1.0" })
  assert.equal(result.state, "PENDING_REVIEW")
  assert.equal(requests.length, 3)
  assert.equal(
    requests[1].url,
    `https://chromewebstore.googleapis.com/upload/v2/${identity.name}:upload`
  )
  assert.equal(requests[1].init.method, "POST")
  assert.equal(requests[1].init.body, archive)
  assert.equal(requests[1].init.redirect, "error")
  assert.deepEqual(JSON.parse(String(requests[2].init.body)), {
    publishType: "DEFAULT_PUBLISH",
    deployInfos: [{ deployPercentage: 10 }],
    skipReview: false,
    blockOnWarnings: true
  })
})

test("Chrome publishing waits for an asynchronous upload to succeed", async () => {
  for (const state of ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"]) {
    const { client, requests, sleeps } = harness([
      published,
      { ...identity, uploadState: state },
      { ...published, lastAsyncUploadState: "IN_PROGRESS" },
      { ...published, lastAsyncUploadState: "SUCCEEDED" },
      { ...identity, state: "PENDING_REVIEW" }
    ])
    await client.submit({ archive, version: "5.1.0" })
    assert.equal(sleeps(), 2)
    assert.ok(requests[4].url.endsWith(":publish"))
  }
})

test("failed, unknown, or timed-out uploads never reach publication", async () => {
  for (const state of [
    "FAILED",
    "NOT_FOUND",
    "UPLOAD_STATE_UNSPECIFIED",
    "IN_PROGRESS"
  ]) {
    const { client, requests } = harness([
      published,
      { ...identity, uploadState: "IN_PROGRESS" },
      { ...published, lastAsyncUploadState: state },
      { ...published, lastAsyncUploadState: state }
    ])
    await assert.rejects(
      client.submit({ archive, version: "5.1.0" }),
      /Upload did not succeed/
    )
    assert.equal(
      requests.some(({ url }) => url.endsWith(":publish")),
      false
    )
  }
})

test("an uploaded version mismatch stops publication", async () => {
  const { client, requests } = harness([published, successfulUpload("5.2.0")])
  await assert.rejects(
    client.submit({ archive, version: "5.1.0" }),
    /does not match/
  )
  assert.equal(requests.length, 2)
})

test("publishing retries do not replace an existing review or change a live rollout", async () => {
  for (const state of ["PENDING_REVIEW", "STAGED", "PUBLISHED"]) {
    const revision = {
      state,
      distributionChannels: [{ crxVersion: "5.1.0", deployPercentage: 10 }]
    }
    const { client, requests } = harness([
      {
        ...published,
        [state === "PUBLISHED"
          ? "publishedItemRevisionStatus"
          : "submittedItemRevisionStatus"]: revision
      }
    ])
    const result = await client.submit({
      archive,
      version: "5.1.0",
      percentage: 100
    })
    assert.equal(result.unchanged, true)
    assert.equal(requests.length, 1)
  }
})

test("a different pending version, newer live version, or policy warning blocks uploads", async () => {
  const items = [
    {
      ...published,
      submittedItemRevisionStatus: {
        state: "PENDING_REVIEW",
        distributionChannels: [{ crxVersion: "5.2.0" }]
      }
    },
    {
      ...published,
      publishedItemRevisionStatus: {
        state: "PUBLISHED",
        distributionChannels: [{ crxVersion: "5.10.0" }]
      }
    },
    { ...published, warned: true },
    { ...published, takenDown: true },
    { ...published, lastAsyncUploadState: "IN_PROGRESS" }
  ]
  for (const item of items) {
    const { client, requests } = harness([item])
    await assert.rejects(client.submit({ archive, version: "5.1.0" }))
    assert.equal(requests.length, 1)
  }
})

test("authentication errors redact access tokens and never continue publishing", async () => {
  const { client, requests } = harness([
    Response.json(
      { error: { message: `Credential ${token} rejected` } },
      { status: 403 }
    )
  ])
  await assert.rejects(
    client.submit({ archive, version: "5.1.0" }),
    (error: Error) => {
      assert.match(error.message, /HTTP 403/)
      assert.match(error.message, /\[REDACTED\]/)
      assert.equal(error.message.includes(token), false)
      return true
    }
  )
  assert.equal(requests.length, 1)
})

test("unexpected item identities and rejected publication are errors", async () => {
  const wrongItem = harness([{ ...published, itemId: "a".repeat(32) }])
  await assert.rejects(
    wrongItem.client.submit({ archive, version: "5.1.0" }),
    /unexpected item/
  )
  assert.equal(wrongItem.requests.length, 1)
  const rejected = harness([
    published,
    successfulUpload(),
    { ...identity, state: "REJECTED" }
  ])
  await assert.rejects(
    rejected.client.submit({ archive, version: "5.1.0" }),
    /not accepted/
  )
})

test("rollout changes only the requested live version and only increases its percentage", async () => {
  const live = {
    ...identity,
    publishedItemRevisionStatus: {
      state: "PUBLISHED",
      distributionChannels: [{ crxVersion: "5.1.0", deployPercentage: 10 }]
    }
  }
  const { client, requests } = harness([live, {}])
  await client.rollout({ version: "5.1.0", percentage: 25 })
  assert.ok(requests[1].url.endsWith(":setPublishedDeployPercentage"))
  assert.deepEqual(JSON.parse(String(requests[1].init.body)), {
    deployPercentage: 25
  })
  for (const input of [
    { version: "5.2.0", percentage: 25 },
    { version: "5.1.0", percentage: 5 }
  ]) {
    const blocked = harness([live])
    await assert.rejects(blocked.client.rollout(input))
    assert.equal(blocked.requests.length, 1)
  }
})

test("missing credentials, invalid percentages, and non-version tags fail before network use", async () => {
  assert.throws(
    () => createStoreClient({ publisherId, extensionId }),
    /CWS_ACCESS_TOKEN/
  )
  assert.throws(
    () => createStoreClient({ publisherId, extensionId: "invalid", token }),
    /CWS_EXTENSION_ID/
  )
  for (const percentage of ["", "NaN", "0", "101", "1.5", "-1"]) {
    assert.throws(
      () => deploymentPercentage(percentage),
      /integer from 1 to 100/
    )
  }
  await assert.rejects(
    main(["--action", "submit", "--tag", "master"], {}),
    /Select release tag/
  )
})

async function writeArchive(file: string, manifest: Record<string, unknown>) {
  const zip = new ZipFile()
  const output = fs.createWriteStream(file)
  const finished = new Promise<void>((resolve, reject) => {
    output.on("close", resolve)
    output.on("error", reject)
    zip.outputStream.on("error", reject)
  })
  zip.outputStream.pipe(output)
  zip.addBuffer(Buffer.from(JSON.stringify(manifest)), "manifest.json")
  zip.end()
  await finished
}

test("package validation inspects the uploaded ZIP itself and rejects a wrong version or manifest", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-store-"))
  try {
    const file = path.join(directory, "chrome.zip")
    await writeArchive(file, { manifest_version: 3, version: "5.1.0" })
    const result = readVerifiedPackage(file, "5.1.0")
    assert.deepEqual(result.archive, fs.readFileSync(file))
    assert.match(result.sha256, /^[a-f0-9]{64}$/)
    assert.throws(
      () => readVerifiedPackage(file, "5.2.0"),
      /must contain Manifest V3 version/
    )
    await writeArchive(file, { manifest_version: 2, version: "5.1.0" })
    assert.throws(
      () => readVerifiedPackage(file, "5.1.0"),
      /must contain Manifest V3 version/
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test("Chrome release credentials are isolated from builds and used only after verification", () => {
  const { load } = require("js-yaml")
  const workflow = load(
    fs.readFileSync(".github/workflows/release.yml", "utf8")
  )
  const job = workflow.jobs["chrome-store"]
  assert.equal(job.needs, "verification")
  assert.match(job.if, /needs\.verification\.result == 'success'/)
  assert.equal(job.environment, "chrome-web-store")
  assert.deepEqual(job.permissions, { contents: "read", "id-token": "write" })
  assert.equal(job.concurrency["cancel-in-progress"], false)
  const steps = job.steps as Array<{
    id?: string
    uses?: string
    run?: string
    with?: Record<string, unknown>
  }>
  const authIndex = steps.findIndex((step) => step.id === "auth")
  const auth = steps[authIndex]
  assert.equal(auth.with?.create_credentials_file, false)
  assert.equal(auth.with?.token_format, "access_token")
  const scopeExpression = String(auth.with?.access_token_scopes)
    .replace(/^\$\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
  for (const action of ["status", "submit", "rollout"]) {
    const scope = runInNewContext(
      scopeExpression,
      { env: { CWS_ACTION: action } },
      { timeout: 1000 }
    )
    assert.equal(
      scope,
      `https://www.googleapis.com/auth/chromewebstore${action === "status" ? ".readonly" : ""}`
    )
  }
  const downloadIndex = steps.findIndex((step) =>
    step.uses?.startsWith("actions/download-artifact@")
  )
  assert.equal(steps[downloadIndex].with?.name, "fontara-verified-packages")
  assert.ok(downloadIndex < authIndex)
  assert.ok(
    steps.some(
      (step, index) =>
        index < authIndex && step.run?.includes("--action validate")
    )
  )
  assert.equal(
    steps.some((step) =>
      /pnpm (build|install)|npm (install|run)/.test(step.run || "")
    ),
    false
  )
})
