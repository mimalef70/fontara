import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import { runInNewContext } from "node:vm"

const require = createRequire(import.meta.url)
const { load } = require("js-yaml") as { load: (source: string) => Workflow }
type Workflow = {
  jobs: Record<
    string,
    {
      uses?: string
      needs?: string | string[]
      if?: string
      permissions?: Record<string, string>
      strategy?: {
        matrix: { include: Array<{ browser: string; version: string }> }
      }
      steps?: Array<{
        if?: string
        uses?: string
        run?: string
        with?: Record<string, unknown>
      }>
    }
  >
}

function readWorkflow(name: string): string {
  return fs.readFileSync(path.resolve(".github/workflows", name), "utf8")
}

test("every Firefox browser lane installs geckodriver before running tests", () => {
  for (const name of ["verify.yml", "browser-tests.yml"]) {
    const workflow = load(readWorkflow(name))
    const jobs = Object.values(workflow.jobs).filter((job) =>
      job.strategy?.matrix.include.some((entry) => entry.browser === "firefox")
    )
    assert.ok(jobs.length > 0, `${name} must include Firefox coverage`)
    for (const job of jobs) {
      const steps = job.steps ?? []
      const installIndex = steps.findIndex(
        (step) => step.uses === "./.github/actions/setup-geckodriver"
      )
      const testIndex = steps.findIndex((step) =>
        step.run?.includes("pnpm test:browser:firefox")
      )
      assert.ok(installIndex >= 0 && installIndex < testIndex, name)
      assert.equal(steps[installIndex].if, "matrix.browser == 'firefox'")
    }
  }
})

test("CI, release, and browser workflows use native build checks without Plasmo publish actions", () => {
  const ci = readWorkflow("ci.yml")
  const release = readWorkflow("release.yml")
  const browser = readWorkflow("browser-tests.yml")
  const verification = readWorkflow("verify.yml")
  const releaseGateText = `${ci}\n${release}\n${verification}`
  const workflowText = `${releaseGateText}\n${browser}`

  assert.match(workflowText, /version:\s*11\.5\.0/)
  assert.match(workflowText, /node-version:\s*24\.x/)
  assert.match(workflowText, /actions\/checkout@[0-9a-f]{40} # v7/)
  assert.match(workflowText, /actions\/setup-node@[0-9a-f]{40} # v7/)
  assert.match(workflowText, /pnpm\/action-setup@[0-9a-f]{40} # v6/)
  assert.match(releaseGateText, /actions\/upload-artifact@[0-9a-f]{40} # v7/)
  assert.match(release, /softprops\/action-gh-release@[0-9a-f]{40} # v3/)
  assert.match(releaseGateText, /pnpm verify/)
  assert.match(releaseGateText, /firefox-mv3-source-\*\.zip/)
  assert.match(browser, /workflow_dispatch:/)
  assert.match(browser, /schedule:/)
  assert.match(browser, /fail-fast:\s*false/)
  assert.match(browser, /browser-actions\/setup-chrome@[0-9a-f]{40} # v2/)
  assert.match(browser, /browser-actions\/setup-firefox@[0-9a-f]{40} # v1/)
  assert.match(browser, /version:\s*stable/)
  assert.match(browser, /version:\s*beta/)
  assert.match(browser, /version:\s*latest/)
  assert.match(browser, /version:\s*latest-beta/)
  assert.match(browser, /version:\s*latest-esr/)
  assert.match(browser, /sudo apt-get update && sudo apt-get install -y xvfb/)
  assert.match(browser, /CHROME_PATH:/)
  assert.match(browser, /FONTARA_BROWSER_HEADFUL:\s*"1"/)
  assert.match(browser, /xvfb-run --auto-servernum/)
  assert.match(browser, /FIREFOX_PATH:/)
  assert.match(browser, /FONTARA_FIREFOX_BROWSER_TESTS:\s*"1"/)
  assert.match(browser, /FONTARA_FIREFOX_HEADLESS:\s*"1"/)
  assert.match(browser, /pnpm test:browser:chrome/)
  assert.match(browser, /pnpm test:browser:firefox/)
  assert.doesNotMatch(workflowText, /plasmo/i)
  assert.doesNotMatch(workflowText, /PlasmoHQ/)
})

test("all external workflow actions use immutable commit references", () => {
  for (const name of fs
    .readdirSync(path.resolve(import.meta.dirname, "../../.github/workflows"))
    .filter((name) => name.endsWith(".yml"))) {
    for (const match of readWorkflow(name).matchAll(/uses:\s*([^\s#]+)/g)) {
      const reference = match[1]
      if (reference.startsWith("./")) continue
      assert.match(
        reference,
        /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/,
        `${name}: ${reference}`
      )
    }
  }
})

test("release publishes only packages from the shared completed verification", () => {
  const release = load(readWorkflow("release.yml"))
  const ci = load(readWorkflow("ci.yml"))
  const verification = load(readWorkflow("verify.yml"))
  assert.equal(ci.jobs.verification.uses, "./.github/workflows/verify.yml")
  assert.equal(release.jobs.verification.uses, ci.jobs.verification.uses)
  assert.equal(release.jobs.publish.needs, "verification")
  assert.equal(
    release.jobs.publish.if,
    "startsWith(github.ref, 'refs/tags/') && (github.event_name == 'push' || inputs.action == 'submit')"
  )
  assert.equal(verification.jobs.browsers.needs, "build")
  const upload = verification.jobs.build.steps?.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@")
  )
  const download = release.jobs.publish.steps?.find((step) =>
    step.uses?.startsWith("actions/download-artifact@")
  )
  assert.ok(upload?.with?.name)
  assert.match(
    String(upload.with.path),
    /build\/fontara-production-dependencies\.cdx\.json/
  )
  const buildSteps = verification.jobs.build.steps ?? []
  const inventoryIndex = buildSteps.findIndex(
    (step) => step.run === "node tasks/generate-sbom.js"
  )
  const verifyIndex = buildSteps.findIndex((step) => step.run === "pnpm verify")
  assert.ok(
    verifyIndex >= 0 &&
      inventoryIndex > verifyIndex &&
      inventoryIndex < buildSteps.indexOf(upload)
  )
  assert.equal(download?.with?.name, upload.with.name)
  const publishSteps = release.jobs.publish.steps ?? []
  const preparation = publishSteps.filter((step) =>
    step.run?.startsWith("node tasks/prepare-release-assets.js ")
  )
  assert.equal(preparation.length, 1)
  assert.ok(preparation[0].run)
  assert.match(preparation[0].run, /^node tasks\/prepare-release-assets\.js /)
  assert.match(preparation[0].run, /--check-existing/)
  assert.doesNotMatch(preparation[0].run, /pnpm|build:|tasks\/cli/)
  const publication = publishSteps.find((step) =>
    step.uses?.startsWith("softprops/action-gh-release@")
  )
  assert.ok(publication?.with)
  assert.equal(publication.with.overwrite_files, false)
  assert.equal(publication.with.body_path, "release-assets/release-body.md")
  assert.equal(typeof publication.with.files, "string")
  assert.match(String(publication.with.files), /release-assets\/SHA256SUMS/)
  assert.match(
    String(publication.with.files),
    /release-assets\/build-info\.json/
  )
  assert.match(
    String(publication.with.files),
    /release-assets\/release-provenance\.json/
  )
  assert.match(
    String(publication.with.files),
    /release-assets\/fontara-production-dependencies\.cdx\.json/
  )
  const attestation = publishSteps.findIndex((step) =>
    step.uses?.startsWith("actions/attest@")
  )
  const uploadIndex = publishSteps.indexOf(publication)
  assert.ok(attestation > 0 && attestation < uploadIndex)
  assert.equal(release.jobs.publish.permissions?.attestations, "write")
  const browserSteps = verification.jobs.browsers.steps ?? []
  assert.ok(browserSteps.some((step) => step.run?.startsWith("unzip ")))
  assert.equal(
    browserSteps.some(
      (step) =>
        step.run?.includes("pnpm build:chrome") ||
        step.run?.includes("pnpm build:firefox") ||
        step.run?.includes("pnpm test:browser:production")
    ),
    false
  )
  for (const browser of ["Chrome", "Firefox"]) {
    assert.ok(
      browserSteps.some((step) =>
        step.run?.includes(`${browser} production artifact`)
      )
    )
  }
})

test("live provenance self-test requires the full verifier and never authorizes a release tag", () => {
  const workflow = load(readWorkflow("release.yml"))
  const check = workflow.jobs["provenance-check"]
  assert.equal(check.needs, "verification")
  assert.equal(check.permissions?.contents, "read")
  assert.equal(check.permissions?.attestations, "write")
  for (const [ref, event, action, expected] of [
    ["refs/heads/master", "workflow_dispatch", "verify", true],
    ["refs/heads/master", "workflow_dispatch", "status", false],
    ["refs/tags/v5.2.0", "workflow_dispatch", "verify", false],
    ["refs/tags/v5.2.0", "push", "submit", false]
  ]) {
    assert.equal(
      runInNewContext(check.if || "false", {
        github: { repository: "mimalef70/fontara", ref, event_name: event },
        inputs: { action }
      }),
      expected
    )
  }
  assert.equal(
    check.steps?.some(
      (step) =>
        step.uses?.startsWith("softprops/") ||
        /publish-(chrome|firefox)-store/.test(step.run || "")
    ),
    false
  )
})

test("Chrome submission requires the verified GitHub publication milestone while status and rollout remain independent", () => {
  const job = load(readWorkflow("release.yml")).jobs["chrome-store"]
  assert.deepEqual(job.needs, ["verification", "publish"])
  const eligible = (
    event: string,
    action: string | undefined,
    verification: string,
    publish: string,
    cancelled = false
  ) =>
    runInNewContext(
      job.if || "false",
      {
        github: { event_name: event },
        inputs: { action },
        needs: {
          verification: { result: verification },
          publish: { result: publish }
        },
        always: () => true,
        cancelled: () => cancelled
      },
      { timeout: 1000 }
    )
  for (const [event, action] of [
    ["push", undefined],
    ["workflow_dispatch", "submit"]
  ]) {
    assert.equal(eligible(event || "", action, "success", "success"), true)
    for (const failed of ["failure", "cancelled", "skipped"])
      for (const [verification, publish] of [
        [failed, "success"],
        ["success", failed]
      ])
        assert.equal(
          eligible(event || "", action, verification, publish),
          false
        )
  }
  for (const action of ["status", "rollout"])
    assert.equal(
      eligible("workflow_dispatch", action, "skipped", "skipped"),
      true
    )
  assert.equal(
    eligible("workflow_dispatch", "verify", "success", "skipped"),
    false
  )
  assert.equal(
    eligible("workflow_dispatch", "submit", "success", "success", true),
    false
  )
})

test("manual verification and status runs never publish GitHub releases, even on tags", () => {
  const release = load(readWorkflow("release.yml"))
  const cases = [
    {
      ref: "refs/tags/v5.1.0",
      event: "push",
      action: undefined,
      expected: true
    },
    {
      ref: "refs/tags/v5.1.0",
      event: "workflow_dispatch",
      action: "submit",
      expected: true
    },
    {
      ref: "refs/tags/v5.1.0",
      event: "workflow_dispatch",
      action: "verify",
      expected: false
    },
    {
      ref: "refs/tags/v5.1.0",
      event: "workflow_dispatch",
      action: "status",
      expected: false
    },
    {
      ref: "refs/tags/v5.1.0",
      event: "workflow_dispatch",
      action: "rollout",
      expected: false
    },
    {
      ref: "refs/heads/master",
      event: "workflow_dispatch",
      action: "submit",
      expected: false
    }
  ]
  for (const { ref, event, action, expected } of cases) {
    const actual = runInNewContext(
      release.jobs.publish.if || "false",
      {
        github: { ref, event_name: event },
        inputs: { action },
        startsWith: (value: string, prefix: string) => value.startsWith(prefix)
      },
      { timeout: 1000 }
    )
    assert.equal(actual, expected, `${event} ${action || ""} on ${ref}`)
  }
})

test("verification covers stable browsers and the declared support floor", () => {
  const workflow = load(readWorkflow("verify.yml"))
  const matrix = workflow.jobs.browsers.strategy?.matrix.include ?? []
  const chrome = JSON.parse(
    fs.readFileSync("src/manifest-chrome-mv3.json", "utf8")
  )
  const firefox = JSON.parse(
    fs.readFileSync("src/manifest-firefox-mv3.json", "utf8")
  )
  const minimums = {
    chrome: chrome.minimum_chrome_version.split(".")[0],
    firefox:
      firefox.browser_specific_settings.gecko.strict_min_version.split(".")[0]
  }
  for (const [browser, major] of Object.entries(minimums)) {
    assert.ok(
      matrix.some(
        (entry) =>
          entry.browser === browser && entry.version.startsWith(`${major}.`)
      )
    )
    assert.ok(
      matrix.some(
        (entry) =>
          entry.browser === browser &&
          ["stable", "latest"].includes(entry.version)
      )
    )
  }
})
