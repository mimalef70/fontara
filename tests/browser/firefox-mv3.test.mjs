import assert from "node:assert/strict"
import test from "node:test"

import {
  addHardFixtureDynamicText,
  findFirefoxBinary,
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  waitForContentBridge,
  waitForFont,
  waitForFontRemoved,
  waitForHardFixtureFonts,
  waitForHardFixtureFontsRemoved,
  withFirefoxMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

async function skipUnlessFirefoxBrowserTestsAreEnabled(t) {
  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip(
      "Firefox browser automation is opt-in. Run FONTARA_FIREFOX_BROWSER_TESTS=1 pnpm test:browser:firefox."
    )
    return true
  }

  const firefoxPath = await findFirefoxBinary()
  if (!firefoxPath) {
    t.skip("Firefox was not found on this machine.")
    return true
  }

  return false
}

test("Firefox MV3 applies and excludes FontARA through the content bridge", async (t) => {
  if (await skipUnlessFirefoxBrowserTestsAreEnabled(t)) return

  await withFirefoxMv3ExtensionHarness(t, async (harness) => {
    assert.match(harness.extensionBaseUrl, /^moz-extension:\/\//)

    const fixturePage = await harness.createFixturePage()
    await fixturePage.waitForFunction(() => document.readyState === "complete")
    await waitForContentBridge(fixturePage)
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const initialLoadId = await fixturePage.evaluate(
      () => window.__fontaraLoadId
    )

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })

    const firstState = await waitForFont(
      fixturePage,
      "Samim-Fontara",
      initialLoadId
    )
    assert.equal(firstState.loadId, initialLoadId)

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })

    const removedState = await waitForFontRemoved(fixturePage, initialLoadId)
    assert.equal(removedState.loadId, initialLoadId)
  })
})

test("Firefox MV3 handles contenteditable, shadow DOM, iframes, and dynamic nodes without reload", async (t) => {
  if (await skipUnlessFirefoxBrowserTestsAreEnabled(t)) return

  await withFirefoxMv3ExtensionHarness(t, async (harness) => {
    assert.match(harness.extensionBaseUrl, /^moz-extension:\/\//)

    const fixturePage = await harness.createFixturePage({ path: "/hard.html" })
    await fixturePage.waitForFunction(() => document.readyState === "complete")
    await waitForContentBridge(fixturePage)
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const initialLoadId = await fixturePage.evaluate(
      () => window.__fontaraLoadId
    )

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await waitForHardFixtureFonts(fixturePage, "Samim-Fontara", initialLoadId)

    await addHardFixtureDynamicText(fixturePage)
    await waitForHardFixtureFonts(fixturePage, "Samim-Fontara", initialLoadId, {
      includeDynamic: true
    })

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await waitForHardFixtureFontsRemoved(fixturePage, initialLoadId, {
      includeDynamic: true
    })
  })
})
