import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

function readWorkflow(name: string): string {
  return fs.readFileSync(path.resolve(".github/workflows", name), "utf8")
}

test("CI and release workflows use native build checks without Plasmo publish actions", () => {
  const ci = readWorkflow("ci.yml")
  const release = readWorkflow("release.yml")
  const workflowText = `${ci}\n${release}`

  assert.match(workflowText, /node-version:\s*22\.x/)
  assert.match(workflowText, /pnpm lint/)
  assert.match(workflowText, /pnpm typecheck/)
  assert.match(workflowText, /pnpm test/)
  assert.match(workflowText, /pnpm build:all/)
  assert.match(workflowText, /web-ext lint/)
  assert.doesNotMatch(workflowText, /plasmo/i)
  assert.doesNotMatch(workflowText, /PlasmoHQ/)
})
