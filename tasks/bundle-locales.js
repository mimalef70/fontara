const path = require("node:path")

const { absolutePath, getDestDir } = require("./paths")
const { readJSON, writeJSON } = require("./utils")

async function bundleLocales({ platform, debug }) {
  if (debug) return

  const outDir = getDestDir({ platform, debug })
  const catalog = await readJSON(absolutePath("src/i18n/messages.json"))

  for (const [locale, messages] of Object.entries(catalog.extension)) {
    await writeJSON(
      path.join(outDir, "_locales", locale, "messages.json"),
      messages
    )
  }
}

module.exports = bundleLocales
