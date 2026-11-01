#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createHash } = require("node:crypto")
const { setTimeout: delay } = require("node:timers/promises")

const ROOT = path.resolve(__dirname, "..")
const API = "https://chromewebstore.googleapis.com"
const ACCEPTED_STATES = new Set([
  "PENDING_REVIEW",
  "STAGED",
  "PUBLISHED",
  "PUBLISHED_TO_TESTERS"
])

function versionParts(version) {
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(version)) {
    throw new Error(`Invalid Chrome extension version: ${version}`)
  }
  const parts = version.split(".").map(Number)
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) {
    throw new Error(`Invalid Chrome extension version: ${version}`)
  }
  return [...parts, 0, 0, 0].slice(0, 4)
}

function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let index = 0; index < 4; index++) {
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
  }
  return 0
}

function deploymentPercentage(value) {
  const percentage = Number(value)
  if (!/^\d+$/.test(String(value)) || percentage < 1 || percentage > 100) {
    throw new Error("Deployment percentage must be an integer from 1 to 100.")
  }
  return percentage
}

function readVerifiedPackage(zipPath, expectedVersion) {
  versionParts(expectedVersion)
  const archive = fs.readFileSync(zipPath)
  if (!archive.length || archive.length > 2.5 * 1024 * 1024) {
    throw new Error("Chrome ZIP is empty or exceeds the release size budget.")
  }
  // Inspect the same bytes that will be uploaded, without extracting files.
  const manifest = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import io,sys,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.namelist().count('manifest.json') == 1, 'Expected one root manifest'; m=z.getinfo('manifest.json'); assert m.file_size < 1048576, 'Manifest too large'; sys.stdout.buffer.write(z.read(m))"
      ],
      { input: archive, maxBuffer: 1024 * 1024, encoding: "utf8" }
    )
  )
  if (manifest.manifest_version !== 3 || manifest.version !== expectedVersion) {
    throw new Error(
      `Chrome ZIP must contain Manifest V3 version ${expectedVersion}.`
    )
  }
  return {
    archive,
    version: expectedVersion,
    sha256: createHash("sha256").update(archive).digest("hex")
  }
}

function createStoreClient({
  publisherId,
  extensionId,
  token,
  fetchImpl = fetch,
  sleep = delay,
  pollAttempts = 30,
  pollIntervalMs = 10000
}) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(publisherId || "")) {
    throw new Error(
      "Set CWS_PUBLISHER_ID to the Chrome Web Store publisher ID."
    )
  }
  if (!/^[a-p]{32}$/.test(extensionId || "")) {
    throw new Error("Set CWS_EXTENSION_ID to the 32-character extension ID.")
  }
  if (!token || /[\r\n]/.test(token)) {
    throw new Error("A short-lived CWS_ACCESS_TOKEN is required.")
  }
  const name = `publishers/${publisherId}/items/${extensionId}`

  function verifyItem(response) {
    if (response?.name !== name || response?.itemId !== extensionId) {
      throw new Error("Chrome Web Store returned an unexpected item identity.")
    }
    return response
  }

  async function request(method, suffix, body, media = false) {
    let response
    try {
      response = await fetchImpl(
        `${API}${media ? "/upload" : ""}/v2/${name}:${suffix}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined
              ? {}
              : {
                  "Content-Type": media ? "application/zip" : "application/json"
                })
          },
          body: media || body === undefined ? body : JSON.stringify(body),
          redirect: "error",
          signal: AbortSignal.timeout(120000)
        }
      )
    } catch {
      // Do not print a request object, headers, or tokens in CI errors.
      throw new Error(`Chrome Web Store ${suffix} request failed or timed out.`)
    }
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(
        `Chrome Web Store ${suffix} returned invalid JSON (HTTP ${response.status}).`
      )
    }
    if (!response.ok) {
      const detail = String(
        data.error?.message || response.statusText || "Request rejected"
      )
        .split(token)
        .join("[REDACTED]")
        .split(encodeURIComponent(token))
        .join("[REDACTED]")
        .slice(0, 1000)
      throw new Error(
        `Chrome Web Store ${suffix} failed (HTTP ${response.status}): ${detail}`
      )
    }
    return data
  }

  async function status() {
    return verifyItem(await request("GET", "fetchStatus"))
  }

  function healthy(item) {
    if (item.takenDown || item.warned) {
      throw new Error(
        "The store item has a policy warning or takedown; resolve it in the developer dashboard first."
      )
    }
  }

  async function submit({ archive, version, percentage = 10 }) {
    versionParts(version)
    percentage = deploymentPercentage(percentage)
    const before = await status()
    healthy(before)
    const published = before.publishedItemRevisionStatus
    const pending = before.submittedItemRevisionStatus
    const publishedVersions =
      published?.distributionChannels?.map((channel) => channel.crxVersion) ||
      []
    if (
      publishedVersions.some((current) => compareVersions(current, version) > 0)
    ) {
      throw new Error(
        `Version ${version} is older than the published store version.`
      )
    }
    if (pending && ["PENDING_REVIEW", "STAGED"].includes(pending.state)) {
      const versions =
        pending.distributionChannels?.map((channel) => channel.crxVersion) || []
      if (versions.length && versions.every((current) => current === version)) {
        return { state: pending.state, version, unchanged: true }
      }
      throw new Error(
        "A different version is already pending review or staged; no upload was performed."
      )
    }
    if (
      publishedVersions.length &&
      publishedVersions.every((current) => current === version)
    ) {
      return { state: published.state, version, unchanged: true }
    }
    if (
      ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"].includes(
        before.lastAsyncUploadState
      )
    ) {
      throw new Error(
        "Another upload is still being processed; retry after it completes."
      )
    }

    const upload = verifyItem(await request("POST", "upload", archive, true))
    let uploadState = upload.uploadState
    if (upload.crxVersion && upload.crxVersion !== version) {
      throw new Error(
        `Uploaded version ${upload.crxVersion} does not match ${version}; publication stopped.`
      )
    }
    for (
      let attempt = 0;
      ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"].includes(uploadState) &&
      attempt < pollAttempts;
      attempt++
    ) {
      await sleep(pollIntervalMs)
      const progress = await status()
      healthy(progress)
      uploadState = progress.lastAsyncUploadState
    }
    if (uploadState !== "SUCCEEDED") {
      throw new Error(
        `Upload did not succeed (${uploadState || "missing state"}); publication stopped. Check status before retrying.`
      )
    }
    if (upload.uploadState === "SUCCEEDED" && upload.crxVersion !== version) {
      throw new Error(
        "Successful upload did not confirm the expected version; publication stopped."
      )
    }

    const result = verifyItem(
      await request("POST", "publish", {
        publishType: "DEFAULT_PUBLISH",
        deployInfos: [{ deployPercentage: percentage }],
        skipReview: false,
        blockOnWarnings: true
      })
    )
    if (!ACCEPTED_STATES.has(result.state)) {
      throw new Error(
        `Store submission was not accepted (${result.state || "missing state"}).`
      )
    }
    return { state: result.state, version, percentage, unchanged: false }
  }

  async function rollout({ version, percentage }) {
    versionParts(version)
    percentage = deploymentPercentage(percentage)
    const before = await status()
    healthy(before)
    if (
      ["PENDING_REVIEW", "STAGED"].includes(
        before.submittedItemRevisionStatus?.state
      )
    ) {
      throw new Error(
        "A submission is pending or staged; rollout requires the intended version to be published first."
      )
    }
    const published = before.publishedItemRevisionStatus
    const channels = published?.distributionChannels || []
    if (
      published?.state !== "PUBLISHED" ||
      channels.length !== 1 ||
      channels[0].crxVersion !== version
    ) {
      throw new Error(
        `Rollout requires published version ${version} on one public channel.`
      )
    }
    const previous = channels[0].deployPercentage
    if (!Number.isInteger(previous) || percentage < previous) {
      throw new Error(
        "Rollout percentage cannot be reduced or compared with an unknown current percentage."
      )
    }
    if (percentage === previous)
      return { state: "PUBLISHED", version, percentage, unchanged: true }
    await request("POST", "setPublishedDeployPercentage", {
      deployPercentage: percentage
    })
    return { state: "PUBLISHED", version, percentage, unchanged: false }
  }

  return { status, submit, rollout }
}

async function main(args = process.argv.slice(2), env = process.env) {
  const { parseArgs } = require("node:util")
  const { values } = parseArgs({
    args,
    options: {
      action: { type: "string", default: "status" },
      zip: {
        type: "string",
        default: path.join(ROOT, "build/chrome-mv3-prod.zip")
      },
      tag: {
        type: "string",
        default: env.FONTARA_RELEASE_TAG || env.GITHUB_REF_NAME || ""
      },
      "deploy-percentage": { type: "string" }
    }
  })
  const action = values.action
  if (!["status", "validate", "submit", "rollout"].includes(action)) {
    throw new Error("Action must be status, validate, submit, or rollout.")
  }
  const version = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  ).version
  if (action !== "status" && values.tag !== `v${version}`) {
    throw new Error(
      `Select release tag v${version}; store mutations and package validation require an exact version tag.`
    )
  }
  let release
  if (["validate", "submit"].includes(action)) {
    release = readVerifiedPackage(values.zip, version)
    console.log(`Verified Chrome ${version} ZIP SHA-256: ${release.sha256}`)
    if (action === "validate") return
  }
  const client = createStoreClient({
    publisherId: env.CWS_PUBLISHER_ID,
    extensionId: env.CWS_EXTENSION_ID,
    token: env.CWS_ACCESS_TOKEN
  })
  const percentage =
    values["deploy-percentage"] ||
    env.CWS_DEPLOY_PERCENTAGE ||
    (action === "submit" ? "10" : "")
  const result =
    action === "status"
      ? await client.status()
      : action === "rollout"
        ? await client.rollout({ version, percentage })
        : await client.submit({ ...release, percentage })
  if (action === "status") {
    const {
      publishedItemRevisionStatus,
      submittedItemRevisionStatus,
      lastAsyncUploadState,
      takenDown,
      warned
    } = result
    console.log(
      JSON.stringify(
        {
          publishedItemRevisionStatus,
          submittedItemRevisionStatus,
          lastAsyncUploadState,
          takenDown,
          warned
        },
        null,
        2
      )
    )
  } else {
    const message = `Chrome Web Store ${version}: ${result.state}${result.unchanged ? " (already submitted/published; unchanged)" : `, target rollout ${result.percentage}%`}.`
    console.log(message)
    if (env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        env.GITHUB_STEP_SUMMARY,
        `${message}\n\nGoogle review is asynchronous. PENDING_REVIEW does not mean the version is live.\n`
      )
  }
}

module.exports = {
  compareVersions,
  createStoreClient,
  deploymentPercentage,
  main,
  readVerifiedPackage
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
