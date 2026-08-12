import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

type Manifest = {
  commands?: Record<
    string,
    {
      description?: string
      suggested_key?: {
        default?: string
      }
    }
  >
  content_security_policy: {
    extension_pages: string
  }
  content_scripts: Array<{
    all_frames?: boolean
    js: string[]
    matches?: string[]
    match_about_blank?: boolean
    match_origin_as_fallback?: boolean
    run_at?: string
  }>
  default_locale?: string
  description?: string
  host_permissions?: string[]
  name?: string
  optional_permissions?: string[]
  permissions: string[]
  short_name?: string
  web_accessible_resources?: Array<{
    matches?: string[]
    resources: string[]
    use_dynamic_url?: boolean
  }>
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
  assert.equal(contentScript.match_origin_as_fallback, true)
})

test("chromium manifest retains the existing browser support baseline", () => {
  const chromeManifest = readJSON<{ minimum_chrome_version?: string }>(
    "src/manifest-chrome-mv3.json"
  )

  assert.equal(chromeManifest.minimum_chrome_version, "106.0.0.0")
})

test("manifest grants storage capacity without tabs or activeTab", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")

  assert.ok(manifest.permissions.includes("storage"))
  assert.ok(manifest.permissions.includes("unlimitedStorage"))
  assert.equal(manifest.permissions.includes("tabs"), false)
  assert.equal(manifest.permissions.includes("activeTab"), false)
})

test("manifest enables context menus for extension commands", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const firefoxManifest = readJSON<Manifest>("src/manifest-firefox-mv3.json")

  assert.equal(manifest.permissions.includes("contextMenus"), false)
  assert.ok(manifest.optional_permissions?.includes("contextMenus"))
  assert.equal(firefoxManifest.permissions.includes("contextMenus"), false)
  assert.ok(firefoxManifest.optional_permissions?.includes("contextMenus"))
})

test("manifest defines browser hotkeys with FontAra-specific defaults", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")

  assert.deepEqual(manifest.commands?.toggle, {
    suggested_key: {
      default: "Alt+Shift+F"
    },
    description: "__MSG_commandToggleExtension__"
  })
  assert.deepEqual(manifest.commands?.addSite, {
    suggested_key: {
      default: "Alt+Shift+S"
    },
    description: "__MSG_commandToggleCurrentSite__"
  })
})

test("manifest exposes only font assets to web pages", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const webAccessibleResources = manifest.web_accessible_resources ?? []

  assert.equal(webAccessibleResources.length, 1)
  assert.deepEqual(webAccessibleResources[0].matches, ["*://*/*"])
  assert.deepEqual(webAccessibleResources[0].resources, [
    "assets/fonts/*",
    "assets/fonts/*/*",
    "assets/fonts/*/*/*"
  ])
  assert.equal(webAccessibleResources[0].use_dynamic_url, undefined)
  assert.equal(webAccessibleResources[0].resources.includes("assets/*"), false)
  assert.equal(
    webAccessibleResources[0].resources.includes("assets/logos/*"),
    false
  )
  assert.equal(
    webAccessibleResources[0].resources.includes("assets/styles/*"),
    false
  )
})

test("manifest limits page access to HTTP and HTTPS hosts", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const contentScript = manifest.content_scripts.find((script) =>
    script.js.includes("inject/index.js")
  )

  assert.deepEqual(manifest.host_permissions, ["*://*/*"])
  assert.deepEqual(contentScript?.matches, ["*://*/*"])
})

test("chromium manifest grants system font access while firefox omits it", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const chromeManifest = readJSON<Manifest>("src/manifest-chrome-mv3.json")
  const firefoxManifest = readJSON<Manifest>("src/manifest-firefox-mv3.json")

  assert.ok(manifest.permissions.includes("fontSettings"))
  assert.notEqual(
    chromeManifest.optional_permissions?.includes("fontSettings"),
    true
  )
  assert.equal(firefoxManifest.permissions.includes("fontSettings"), false)
})

test("manifest keeps extension page CSP locked down", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")
  const csp = manifest.content_security_policy.extension_pages

  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /base-uri 'none'/)
  assert.match(csp, /form-action 'none'/)
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/)
  assert.doesNotMatch(csp, /font-src[^;]*\bdata:/)
  assert.match(csp, /connect-src https:\/\/fonts\.googleapis\.com/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.match(csp, /img-src 'self' data:/)
  assert.match(csp, /worker-src 'self'/)
  assert.doesNotMatch(csp, /img-src \*/)
  assert.doesNotMatch(csp, /object-src 'self'/)
  assert.doesNotMatch(csp, /connect-src 'none'/)
})

test("manifest uses browser i18n messages for store-facing text", () => {
  const manifest = readJSON<Manifest>("src/manifest.json")

  assert.equal(manifest.default_locale, "en")
  assert.equal(manifest.name, "__MSG_extensionName__")
  assert.equal(manifest.short_name, "__MSG_extensionShortName__")
  assert.equal(manifest.description, "__MSG_extensionDescription__")
})
