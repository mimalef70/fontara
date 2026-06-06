import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

test("JS bundler uses React production runtime for extension pages", () => {
  const bundleJS = fs.readFileSync(path.resolve("tasks/bundle-js.js"), "utf8")

  assert.match(
    bundleJS,
    /"process\.env\.NODE_ENV": JSON\.stringify\("production"\)/
  )
  assert.match(bundleJS, /src\/ui\/i18n\/bootstrap\.ts/)
  assert.match(bundleJS, /ui\/i18n\/bootstrap\.js/)
})

test("build pipeline generates WebExtension locales from the i18n catalog", () => {
  const buildSource = fs.readFileSync(path.resolve("tasks/build.js"), "utf8")
  const bundleLocalesSource = fs.readFileSync(
    path.resolve("tasks/bundle-locales.js"),
    "utf8"
  )

  assert.match(buildSource, /bundleLocales/)
  assert.match(bundleLocalesSource, /src\/i18n\/messages\.json/)
  assert.match(bundleLocalesSource, /_locales/)
})
