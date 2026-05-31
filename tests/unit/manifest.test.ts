import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

type Manifest = {
  content_scripts: Array<{
    all_frames?: boolean
    js: string[]
    match_about_blank?: boolean
    run_at?: string
  }>
  permissions: string[]
}

function readJSON<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T
}

test("manifest injects FontAra into all frames at document_start", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const contentScript = manifest.content_scripts.find((script) =>
    script.js.includes("inject/index.js")
  )

  assert.ok(contentScript)
  assert.equal(contentScript.run_at, "document_start")
  assert.equal(contentScript.all_frames, true)
  assert.equal(contentScript.match_about_blank, true)
})

test("manifest grants storage capacity for custom fonts without redundant activeTab", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")

  assert.ok(manifest.permissions.includes("storage"))
  assert.ok(manifest.permissions.includes("unlimitedStorage"))
  assert.ok(manifest.permissions.includes("tabs"))
  assert.equal(manifest.permissions.includes("activeTab"), false)
})
