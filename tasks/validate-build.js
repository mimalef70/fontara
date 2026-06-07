const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { pathExists, readJSON } = require("./utils")

async function validateBuild({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })
  const manifest = await readJSON(path.join(outDir, "manifest.json"))
  const catalog = await readJSON(absolutePath("src/i18n/messages.json"))
  const extensionLocales = Object.keys(catalog.extension || {})

  if (!manifest.default_locale) return

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
