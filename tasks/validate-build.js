const fs = require("node:fs")
const crypto = require("node:crypto")
const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { pathExists, readJSON } = require("./utils")
const { supportsFontSettings } = require("./platform")

const PRODUCTION_BUNDLE_BUDGETS = {
  "background/index.js": 150 * 1024,
  "inject/index.js": 160 * 1024,
  "ui/options/custom-font-metadata-worker.js": 400 * 1024,
  "ui/options/index.js": 750 * 1024,
  "ui/popup/index.js": 600 * 1024
}

function assertManifestPermissions(manifest, platform) {
  const permissions = new Set(manifest.permissions || [])
  const optionalPermissions = new Set(manifest.optional_permissions || [])
  const expectedPermissions = new Set(["storage", "unlimitedStorage"])
  if (supportsFontSettings(platform)) {
    expectedPermissions.add("fontSettings")
  }

  if (
    permissions.size !== expectedPermissions.size ||
    [...expectedPermissions].some((permission) => !permissions.has(permission))
  ) {
    throw new Error(
      `Unexpected required permissions for ${platform}: ${[...permissions].join(", ")}`
    )
  }
  if (
    optionalPermissions.size !== 1 ||
    !optionalPermissions.has("contextMenus")
  ) {
    throw new Error(`contextMenus must be the only optional permission.`)
  }
  if (
    !Array.isArray(manifest.host_permissions) ||
    manifest.host_permissions.length !== 1 ||
    manifest.host_permissions[0] !== "*://*/*"
  ) {
    throw new Error("Production host permissions must be limited to *://*/*.")
  }
}

async function assertBundleBudgets(outDir) {
  for (const [relativePath, maxBytes] of Object.entries(
    PRODUCTION_BUNDLE_BUDGETS
  )) {
    const filePath = path.join(outDir, relativePath)
    if (!(await pathExists(filePath))) {
      throw new Error(`Required production bundle is missing: ${filePath}`)
    }

    const { size } = await fs.promises.stat(filePath)
    if (size > maxBytes) {
      throw new Error(
        `${relativePath} exceeds its ${maxBytes} byte budget (${size} bytes).`
      )
    }
  }
}

async function assertNoTestBridge(outDir) {
  const scriptPaths = [
    "background/index.js",
    "inject/index.js",
    "ui/options/index.js",
    "ui/popup/index.js"
  ]

  for (const relativePath of scriptPaths) {
    const source = await fs.promises.readFile(
      path.join(outDir, relativePath),
      "utf8"
    )
    if (source.includes("fontara-browser-test-")) {
      throw new Error(
        `Browser-test RPC leaked into a non-test artifact: ${relativePath}`
      )
    }
  }
}

async function collectFontFiles(directory, prefix = "") {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === "provenance.json") continue
    const entryPath = path.join(directory, entry.name)
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await collectFontFiles(entryPath, relativePath)))
    } else if (entry.isFile() && /\.(?:woff2?|ttf|otf)$/i.test(entry.name)) {
      files.push({ entryPath, relativePath })
    }
  }
  return files
}

async function assertFontProvenance() {
  const fontsDir = absolutePath("assets/fonts")
  const provenance = await readJSON(path.join(fontsDir, "provenance.json"))
  const entries = Array.isArray(provenance.files) ? provenance.files : []
  const provenanceByPath = new Map(entries.map((entry) => [entry.path, entry]))
  const fontFiles = await collectFontFiles(fontsDir)

  if (provenanceByPath.size !== fontFiles.length) {
    throw new Error("Every bundled font file must have one provenance entry.")
  }
  for (const fontFile of fontFiles) {
    const entry = provenanceByPath.get(fontFile.relativePath)
    if (entry?.license !== "OFL-1.1" || !entry.source) {
      throw new Error(`Missing font provenance: ${fontFile.relativePath}`)
    }
    const digest = crypto
      .createHash("sha256")
      .update(await fs.promises.readFile(fontFile.entryPath))
      .digest("hex")
    if (digest !== entry.sha256) {
      throw new Error(`Font provenance hash mismatch: ${fontFile.relativePath}`)
    }
  }
}

function hasWebExtensionMessagePlaceholder(value) {
  if (typeof value === "string") {
    return /__MSG_[A-Za-z0-9_@]+__/.test(value)
  }

  if (Array.isArray(value)) {
    return value.some(hasWebExtensionMessagePlaceholder)
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(hasWebExtensionMessagePlaceholder)
  }

  return false
}

async function validateBuild({ platform, debug, test = false }) {
  const outDir = getDestDir({ platform, debug, test })
  const manifest = await readJSON(path.join(outDir, "manifest.json"))
  const catalog = await readJSON(absolutePath("src/i18n/messages.json"))
  const extensionLocales = Object.keys(catalog.extension || {})
  const localesDir = path.join(outDir, "_locales")
  const hasLocalesDir = await pathExists(localesDir)

  await assertFontProvenance()
  for (const requiredNotice of [
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "FONT_LICENSES/OFL-1.1.txt",
    "assets/fonts/provenance.json"
  ]) {
    if (!(await pathExists(path.join(outDir, requiredNotice)))) {
      throw new Error(`Release notice is missing: ${requiredNotice}`)
    }
  }

  if (!test) {
    assertManifestPermissions(manifest, platform)
    await assertNoTestBridge(outDir)
  }
  if (!debug && !test) {
    await assertBundleBudgets(outDir)
  }

  if (hasLocalesDir && !manifest.default_locale) {
    throw new Error(
      `Manifest default_locale is missing while _locales exists: ${localesDir}`
    )
  }

  if (!manifest.default_locale) {
    if (hasWebExtensionMessagePlaceholder(manifest)) {
      throw new Error(
        `Manifest contains __MSG_* placeholders without default_locale: ${path.join(outDir, "manifest.json")}`
      )
    }

    return
  }

  if (!hasLocalesDir) {
    throw new Error(
      `Manifest default_locale is set but _locales is missing: ${localesDir}`
    )
  }

  if (!extensionLocales.includes(manifest.default_locale)) {
    throw new Error(
      `Manifest default_locale "${manifest.default_locale}" is missing from src/i18n/messages.json.`
    )
  }

  for (const locale of extensionLocales) {
    const catalogPath = path.join(outDir, "_locales", locale, "messages.json")
    if (!(await pathExists(catalogPath))) {
      throw new Error(
        `Catalog file is missing for locale ${locale}: ${catalogPath}`
      )
    }
  }
}

module.exports = validateBuild
