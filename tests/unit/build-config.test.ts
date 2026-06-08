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
  const validateBuildSource = fs.readFileSync(
    path.resolve("tasks/validate-build.js"),
    "utf8"
  )

  assert.match(buildSource, /bundleLocales/)
  assert.match(buildSource, /validateBuild/)
  assert.match(bundleLocalesSource, /src\/i18n\/messages\.json/)
  assert.match(bundleLocalesSource, /_locales/)
  assert.match(validateBuildSource, /manifest\.default_locale/)
  assert.match(validateBuildSource, /_locales/)
  assert.match(validateBuildSource, /messages\.json/)
})

test("debug manifests use literal strings without WebExtension locale catalogs", () => {
  const bundleManifestSource = fs.readFileSync(
    path.resolve("tasks/bundle-manifest.js"),
    "utf8"
  )
  const bundleLocalesSource = fs.readFileSync(
    path.resolve("tasks/bundle-locales.js"),
    "utf8"
  )
  const validateBuildSource = fs.readFileSync(
    path.resolve("tasks/validate-build.js"),
    "utf8"
  )

  assert.match(bundleManifestSource, /if \(debug\)/)
  assert.match(bundleManifestSource, /src\/i18n\/messages\.json/)
  assert.match(bundleManifestSource, /patchedManifest\.name = "FontAra Debug"/)
  assert.match(bundleManifestSource, /patchedManifest\.short_name =/)
  assert.match(bundleManifestSource, /patchedManifest\.description =/)
  assert.match(bundleManifestSource, /delete patchedManifest\.default_locale/)
  assert.match(bundleLocalesSource, /if \(debug\) return/)
  assert.match(
    validateBuildSource,
    /default_locale is missing while _locales exists/
  )
  assert.match(
    validateBuildSource,
    /default_locale is set but _locales is missing/
  )
})

test("Google Fonts catalog is generated at build time without shipping API secrets", () => {
  const generatorSource = fs.readFileSync(
    path.resolve("tasks/generate-google-fonts.js"),
    "utf8"
  )
  const packageSource = fs.readFileSync(path.resolve("package.json"), "utf8")
  const generatedSource = fs.readFileSync(
    path.resolve("src/config/generated/google-fonts.ts"),
    "utf8"
  )
  const gitignoreSource = fs.readFileSync(path.resolve(".gitignore"), "utf8")
  const envExampleSource = fs.readFileSync(path.resolve(".env.example"), "utf8")

  assert.match(packageSource, /generate:google-fonts/)
  assert.match(generatorSource, /GOOGLE_FONTS_API_KEY/)
  assert.match(generatorSource, /\.env\.local/)
  assert.match(generatorSource, /webfonts\/v1\/webfonts/)
  assert.match(gitignoreSource, /\.env\*/)
  assert.match(gitignoreSource, /!\.env\.example/)
  assert.match(envExampleSource, /^GOOGLE_FONTS_API_KEY=$/m)
  assert.doesNotMatch(envExampleSource, /AIza/)
  assert.match(generatedSource, /google-fonts-developer-api-v1/)
  assert.doesNotMatch(generatedSource, /AIza/)
  assert.doesNotMatch(generatedSource, /GOOGLE_FONTS_API_KEY/)
  assert.doesNotMatch(generatedSource, /fonts\.gstatic\.com/)
  assert.doesNotMatch(generatedSource, /"files"/)
})

test("release archives use reproducible file metadata", () => {
  const zipSource = fs.readFileSync(path.resolve("tasks/zip.js"), "utf8")
  const sourcePackageSource = fs.readFileSync(
    path.resolve("tasks/source-package.js"),
    "utf8"
  )

  for (const source of [zipSource, sourcePackageSource]) {
    assert.match(source, /git log -1 --format=%ct/)
    assert.match(source, /\.sort\(\(a, b\) =>/)
    assert.match(source, /mode: 0o644/)
    assert.match(source, /mtime/)
  }
})
