import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

type Manifest = {
  content_security_policy: {
    extension_pages: string
  }
  content_scripts: Array<{
    all_frames?: boolean
    js: string[]
    match_about_blank?: boolean
    run_at?: string
  }>
  default_locale?: string
  description?: string
  name?: string
  permissions: string[]
  short_name?: string
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

test("manifest keeps extension page CSP locked down", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const csp = manifest.content_security_policy.extension_pages

  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /base-uri 'none'/)
  assert.match(csp, /form-action 'none'/)
  assert.match(csp, /font-src 'self' data:/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /object-src 'self'/)
})

test("manifest uses browser i18n messages for store-facing text", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")

  assert.equal(manifest.default_locale, "en")
  assert.equal(manifest.name, "__MSG_extensionName__")
  assert.equal(manifest.short_name, "__MSG_extensionShortName__")
  assert.equal(manifest.description, "__MSG_extensionDescription__")
})
