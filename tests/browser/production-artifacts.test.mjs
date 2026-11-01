import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  CHROME_PRODUCTION_EXTENSION_DIR,
  FIREFOX_PRODUCTION_EXTENSION_DIR,
  findFirefoxBinary,
  pathExists,
  waitFor,
  withChromeProductionExtensionHarness,
  withFirefoxProductionExtensionHarness
} from "../support/browser/extension-harness.mjs"

const FORBIDDEN_PRODUCTION_MARKERS = [
  "__TEST__",
  "fontara-browser-test-",
  "fontaraBrowserTest",
  "startContentTestBridge"
]

async function listFiles(directory) {
  const files = []
  const entries = await fs.readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}

async function assertProductionArtifactIsClean(extensionDir) {
  assert.equal(
    await pathExists(path.join(extensionDir, "manifest.json")),
    true,
    `Missing production artifact: ${extensionDir}`
  )

  const scriptPaths = (await listFiles(extensionDir)).filter((filePath) =>
    /\.(?:html|js|json)$/i.test(filePath)
  )
  assert.ok(scriptPaths.length > 0)

  for (const scriptPath of scriptPaths) {
    const source = await fs.readFile(scriptPath, "utf8")
    const relativePath = path.relative(extensionDir, scriptPath)
    for (const marker of FORBIDDEN_PRODUCTION_MARKERS) {
      assert.equal(
        source.includes(marker),
        false,
        `Production artifact leaked ${marker} into ${relativePath}`
      )
    }
  }
}

async function assertExtensionSurfaceLoads(
  harness,
  relativePath,
  titlePattern
) {
  const consoleErrors = []
  const pageErrors = []
  const page = await harness.createExtensionPage(relativePath, {
    onConsole: (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    },
    onPageError: (error) => pageErrors.push(error.message)
  })

  const surface = await waitFor(
    () =>
      page
        .evaluate(() => ({
          bodyText: document.body.textContent?.trim() ?? "",
          childCount: document.querySelector("#root")?.childElementCount ?? 0,
          direction: document.documentElement.dir,
          language: document.documentElement.lang,
          readyState: document.readyState,
          title: document.title
        }))
        .then((value) => (value.childCount > 0 ? value : null)),
    {
      message: `${relativePath} did not mount its application root.`,
      timeout: 15_000
    }
  )

  assert.equal(surface.readyState, "complete")
  assert.match(surface.title, titlePattern)
  assert.ok(surface.bodyText.length > 0)
  assert.match(surface.language, /^(?:ar|en|fa)$/)
  assert.match(surface.direction, /^(?:ltr|rtl)$/)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])

  await page.close()
}

async function assertProductionSurfacesLoad(harness) {
  await assertExtensionSurfaceLoads(
    harness,
    "ui/options/index.html",
    /^(?:Settings|تنظیمات|الإعدادات)$/
  )
  await assertExtensionSurfaceLoads(harness, "ui/popup/index.html", /FontAra/i)
}

test("Chrome production artifact installs without test RPC and loads its UI", async (t) => {
  await assertProductionArtifactIsClean(CHROME_PRODUCTION_EXTENSION_DIR)
  await withChromeProductionExtensionHarness(t, assertProductionSurfacesLoad)
})

test("Firefox production artifact installs without test RPC and loads its UI", async (t) => {
  await assertProductionArtifactIsClean(FIREFOX_PRODUCTION_EXTENSION_DIR)

  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip(
      "Firefox browser automation is opt-in. Set FONTARA_FIREFOX_BROWSER_TESTS=1."
    )
    return
  }
  if (!(await findFirefoxBinary())) {
    t.skip("Firefox was not found on this machine.")
    return
  }

  await withFirefoxProductionExtensionHarness(t, assertProductionSurfacesLoad)
})
