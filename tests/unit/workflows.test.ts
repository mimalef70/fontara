import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

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
  assert.match(workflowText, /actions\/checkout@v7/)
  assert.match(workflowText, /actions\/setup-node@v7/)
  assert.match(workflowText, /pnpm\/action-setup@v6/)
  assert.match(releaseGateText, /actions\/upload-artifact@v7/)
  assert.match(release, /softprops\/action-gh-release@v3/)
  assert.match(releaseGateText, /pnpm verify/)
  assert.match(releaseGateText, /firefox-mv3-source-\*\.zip/)
  assert.match(browser, /workflow_dispatch:/)
  assert.match(browser, /schedule:/)
  assert.match(browser, /fail-fast:\s*false/)
  assert.match(browser, /browser-actions\/setup-chrome@v2/)
  assert.match(browser, /browser-actions\/setup-firefox@v1/)
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

test("release publishes only packages from the shared completed verification", () => {
  const release = load(readWorkflow("release.yml"))
  const ci = load(readWorkflow("ci.yml"))
  const verification = load(readWorkflow("verify.yml"))
  assert.equal(ci.jobs.verification.uses, "./.github/workflows/verify.yml")
  assert.equal(release.jobs.verification.uses, ci.jobs.verification.uses)
  assert.equal(release.jobs.publish.needs, "verification")
  assert.equal(release.jobs.publish.if, "startsWith(github.ref, 'refs/tags/')")
  assert.equal(verification.jobs.browsers.needs, "build")
  const upload = verification.jobs.build.steps?.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@")
  )
  const download = release.jobs.publish.steps?.find((step) =>
    step.uses?.startsWith("actions/download-artifact@")
  )
  assert.ok(upload?.with?.name)
  assert.equal(download?.with?.name, upload.with.name)
  assert.equal(
    release.jobs.publish.steps?.some((step) => Boolean(step.run)),
    false,
    "Publishing must not rebuild or alter verified archives"
  )
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
