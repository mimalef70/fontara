const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { pathExists, readJSON } = require("./utils")

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

async function validateBuild({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })
  const manifest = await readJSON(path.join(outDir, "manifest.json"))
  const catalog = await readJSON(absolutePath("src/i18n/messages.json"))
  const extensionLocales = Object.keys(catalog.extension || {})
  const localesDir = path.join(outDir, "_locales")
  const hasLocalesDir = await pathExists(localesDir)

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
