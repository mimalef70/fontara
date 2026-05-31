const fs = require("node:fs")
const path = require("node:path")
const postcss = require("postcss")
const tailwindcssPostcss = require("@tailwindcss/postcss")

const { absolutePath, getDestDir } = require("./paths")

async function bundleCSS({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })
  const sourceCSS = await fs.promises.readFile(
    absolutePath("src/style.css"),
    "utf8"
  )
  const result = await postcss([tailwindcssPostcss()]).process(sourceCSS, {
    from: absolutePath("src/style.css"),
    to: path.join(outDir, "ui/style.css")
  })

  await fs.promises.mkdir(path.join(outDir, "ui"), { recursive: true })
  await fs.promises.writeFile(path.join(outDir, "ui/style.css"), result.css)

  const fontsCSS = await fs.promises.readFile(
    absolutePath("src/fonts.css"),
    "utf8"
  )
  await fs.promises.writeFile(path.join(outDir, "fonts.css"), fontsCSS)
}

module.exports = bundleCSS
