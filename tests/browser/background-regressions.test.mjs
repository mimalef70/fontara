import assert from "node:assert/strict"
import test from "node:test"

import {
  STORAGE_KEYS,
  sendSettingsFromOptions,
  stopChromeExtensionServiceWorkers,
  waitFor,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

test("Chrome keeps the same open options page updated after a worker restart", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    await optionsPage.evaluate(() => {
      window.fontaraRegressionChanges = []
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "fontara-bg-ui-changes") {
          window.fontaraRegressionChanges.push(message.data)
        }
      })
    })
    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.SYNC_SETTINGS]: false,
      [STORAGE_KEYS.EXTENSION_ENABLED]: false
    })
    await waitFor(
      () =>
        optionsPage.evaluate(
          (key) =>
            window.fontaraRegressionChanges.some(
              (data) => data.settings[key] === false
            ) &&
            document
              .querySelector('header button[role="switch"]')
              ?.getAttribute("aria-checked") === "false",
          STORAGE_KEYS.EXTENSION_ENABLED
        ),
      {
        message: "The options page did not receive its initial settings change."
      }
    )

    await stopChromeExtensionServiceWorkers(optionsPage)
    await optionsPage.evaluate(() => {
      window.fontaraRegressionChanges = []
    })
    // Keep this exact document mounted: opening a new options page would hide
    // a worker-local subscription bug by sending another SUBSCRIBE request.
    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.EXTENSION_ENABLED]: true
    })
    await waitFor(
      () =>
        optionsPage.evaluate(
          (key) =>
            window.fontaraRegressionChanges.some(
              (data) => data.settings[key] === true
            ) &&
            document
              .querySelector('header button[role="switch"]')
              ?.getAttribute("aria-checked") === "true",
          STORAGE_KEYS.EXTENSION_ENABLED
        ),
      {
        message: "The existing options page lost updates after worker restart."
      }
    )
    const stored = await optionsPage.evaluate(
      (key) =>
        new Promise((resolve) =>
          chrome.storage.local.get(key, (values) => resolve(values[key]))
        ),
      STORAGE_KEYS.EXTENSION_ENABLED
    )
    assert.equal(stored, true)
  })
})
