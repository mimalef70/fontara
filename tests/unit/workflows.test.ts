import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

function readWorkflow(name: string): string {
  return fs.readFileSync(path.resolve(".github/workflows", name), "utf8")
}

test("CI, release, and browser workflows use native build checks without Plasmo publish actions", () => {
  const ci = readWorkflow("ci.yml")
  const release = readWorkflow("release.yml")
  const browser = readWorkflow("browser-tests.yml")
  const releaseGateText = `${ci}\n${release}`
  const workflowText = `${releaseGateText}\n${browser}`

  assert.match(workflowText, /version:\s*11\.5\.0/)
  assert.match(workflowText, /node-version:\s*24\.x/)
  assert.match(releaseGateText, /pnpm lint/)
  assert.match(releaseGateText, /pnpm typecheck/)
  assert.match(releaseGateText, /run:\s*pnpm test\s*(?:\n|$)/)
  assert.match(releaseGateText, /pnpm test:inject/)
  assert.match(releaseGateText, /pnpm build:all/)
  assert.match(releaseGateText, /web-ext lint/)
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
