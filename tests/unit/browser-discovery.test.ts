import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const harnessUrl = new URL(
  "../support/browser/extension-harness.mjs",
  import.meta.url
)

async function createFakeChrome(
  directory: string,
  major: number
): Promise<string> {
  const suffix =
    process.platform === "darwin"
      ? "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
      : "chrome-linux64/chrome"
  const executable = path.join(directory, suffix)
  await fs.mkdir(path.dirname(executable), { recursive: true })
  await fs.writeFile(
    executable,
    `#!/usr/bin/env node\nconsole.log("Google Chrome for Testing ${major}.0.0.0")\n`,
    { mode: 0o700 }
  )
  return executable
}

test("browser discovery honors explicit Chrome paths and rejects incompatible or missing binaries", {
  skip: process.platform === "win32"
}, async (context) => {
  const { findChromeBinary, findFirefoxBinary } = await import(harnessUrl.href)
  const manifest = JSON.parse(
    await fs.readFile(
      new URL("../../src/manifest-chrome-mv3.json", import.meta.url),
      "utf8"
    )
  )
  const minimumMajor = Number.parseInt(manifest.minimum_chrome_version, 10)
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-discovery-")
  )
  const originalChromePath = process.env.CHROME_PATH
  const originalFirefoxPath = process.env.FIREFOX_PATH
  context.after(async () => {
    if (originalChromePath === undefined) delete process.env.CHROME_PATH
    else process.env.CHROME_PATH = originalChromePath
    if (originalFirefoxPath === undefined) delete process.env.FIREFOX_PATH
    else process.env.FIREFOX_PATH = originalFirefoxPath
    await fs.rm(directory, { force: true, recursive: true })
  })

  const supported = await createFakeChrome(
    path.join(directory, "supported"),
    minimumMajor
  )
  process.env.CHROME_PATH = supported
  assert.equal(await findChromeBinary(), supported)

  process.env.CHROME_PATH = await createFakeChrome(
    path.join(directory, "old"),
    minimumMajor - 1
  )
  await assert.rejects(
    findChromeBinary(),
    new RegExp(`CHROME_PATH .*requires Chrome ${minimumMajor} or newer`)
  )

  process.env.CHROME_PATH = path.join(directory, "missing chrome")
  await assert.rejects(findChromeBinary(), /CHROME_PATH .*does not exist/)
  process.env.CHROME_PATH = ""
  await assert.rejects(findChromeBinary(), /CHROME_PATH is empty/)

  process.env.FIREFOX_PATH = path.join(directory, "missing firefox")
  await assert.rejects(findFirefoxBinary(), /FIREFOX_PATH .*does not exist/)
})

test("automatic Chrome discovery chooses the newest supported version instead of the first cache path", {
  skip: process.platform === "win32"
}, async (context) => {
  const { findChromeBinary } = await import(harnessUrl.href)
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-discovery-")
  )
  const originalChromePath = process.env.CHROME_PATH
  const originalBrowserDirectory = process.env.FONTARA_E2E_BROWSER_DIR
  context.after(async () => {
    if (originalChromePath === undefined) delete process.env.CHROME_PATH
    else process.env.CHROME_PATH = originalChromePath
    if (originalBrowserDirectory === undefined)
      delete process.env.FONTARA_E2E_BROWSER_DIR
    else process.env.FONTARA_E2E_BROWSER_DIR = originalBrowserDirectory
    await fs.rm(directory, { force: true, recursive: true })
  })

  // Make cache path order the reverse of version order. Versions are above
  // any installed browser so this check does not depend on the host's setup.
  const newest = await createFakeChrome(
    path.join(directory, "a-newest"),
    10_001
  )
  await createFakeChrome(path.join(directory, "z-older"), 10_000)
  delete process.env.CHROME_PATH
  process.env.FONTARA_E2E_BROWSER_DIR = directory
  assert.equal(await findChromeBinary(), newest)
})

test("macOS Chrome discovery reads bundle metadata without launching the browser", {
  skip: process.platform !== "darwin"
}, async (context) => {
  const { findChromeBinary } = await import(harnessUrl.href)
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-discovery-bundle-")
  )
  const originalChromePath = process.env.CHROME_PATH
  context.after(async () => {
    if (originalChromePath === undefined) delete process.env.CHROME_PATH
    else process.env.CHROME_PATH = originalChromePath
    await fs.rm(directory, { force: true, recursive: true })
  })

  const executable = await createFakeChrome(directory, 10_001)
  const launchMarker = path.join(directory, "browser-was-launched")
  await fs.writeFile(
    executable,
    `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(launchMarker)}, "launched"); process.exit(77);\n`,
    { mode: 0o700 }
  )
  await fs.writeFile(
    path.join(path.dirname(path.dirname(executable)), "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleShortVersionString</key><string>10001.0.0.0</string>
</dict></plist>
`
  )
  process.env.CHROME_PATH = executable
  assert.equal(await findChromeBinary(), executable)
  await assert.rejects(fs.access(launchMarker), { code: "ENOENT" })
})
