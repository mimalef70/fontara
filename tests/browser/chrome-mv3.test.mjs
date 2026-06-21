import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  addHardFixtureDynamicText,
  assertStoredActivationSettings,
  BROWSER_VIEWPORTS,
  chooseFileByTestId,
  clickByTestId,
  createBasicPageStyleExpectation,
  createHardFixtureStyleExpectation,
  delay,
  evaluate,
  expectPageStyles,
  getExtensionPageLayoutState,
  getExtensionSyncRawValues,
  installDownloadCapture,
  mountHardFixtureAdvancedText,
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  sendSettingsFromOptions,
  setExtensionLocalValues,
  setValueByTestId,
  waitFor,
  waitForCapturedDownload,
  waitForContentBridge,
  waitForExtensionLocalValue,
  waitForExtensionSyncValue,
  waitForInputChecked,
  waitForSwitchChecked,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

test("Chrome MV3 applies font, updates font, and excludes site without page reload", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const sitePattern = `127.0.0.1:${harness.server.port}`

    const testPage = await harness.createFixturePage()
    await waitForContentBridge(testPage)

    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    const firstState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    await assertStoredActivationSettings(
      optionsPage,
      sitePattern,
      "Samim-Fontara",
      true
    )
    await delay(500)
    await assertStoredActivationSettings(
      optionsPage,
      sitePattern,
      "Samim-Fontara",
      true
    )

    assert.equal(firstState.loadId, initialLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    const secondState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: initialLoadId,
        textStroke: false
      })
    )
    assert.equal(secondState.loadId, initialLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    const removedState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )
    assert.equal(removedState.loadId, initialLoadId)
  })
})

test("Chrome MV3 handles contenteditable, shadow DOM, iframes, and dynamic nodes without reload", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const testPage = await harness.createFixturePage({ path: "/hard.html" })
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const crossOriginSitePattern = `127.0.0.1:${harness.crossOriginServer.port}`

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern, crossOriginSitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await expectPageStyles(
      testPage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    await addHardFixtureDynamicText(testPage)
    await expectPageStyles(
      testPage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        includeDynamic: true,
        loadId: initialLoadId
      })
    )

    await mountHardFixtureAdvancedText(testPage)
    await expectPageStyles(
      testPage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        includeAdvanced: true,
        includeDynamic: true,
        loadId: initialLoadId
      })
    )

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern, crossOriginSitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await expectPageStyles(
      testPage,
      createHardFixtureStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        includeAdvanced: true,
        includeDynamic: true,
        loadId: initialLoadId
      })
    )

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [sitePattern, crossOriginSitePattern],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await expectPageStyles(
      testPage,
      createHardFixtureStyleExpectation({
        applied: false,
        includeAdvanced: true,
        includeDynamic: true,
        loadId: initialLoadId
      })
    )
  })
})

test("Chrome MV3 popup UI toggles FontARA and changes fonts without page reload", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const testPage = await harness.createFixturePage()
    const sitePattern = `127.0.0.1:${harness.server.port}`

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 650, width: 360 }
    })

    await waitForSwitchChecked(
      popupPage,
      "fontara-extension-enabled-toggle",
      true
    )
    await clickByTestId(popupPage, "fontara-extension-enabled-toggle")
    await waitForExtensionLocalValue(
      popupPage,
      STORAGE_KEYS.EXTENSION_ENABLED,
      false
    )
    const disabledState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )
    assert.equal(disabledState.loadId, initialLoadId)

    await clickByTestId(popupPage, "fontara-extension-enabled-toggle")
    await waitForExtensionLocalValue(
      popupPage,
      STORAGE_KEYS.EXTENSION_ENABLED,
      true
    )
    const reenabledState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )
    assert.equal(reenabledState.loadId, initialLoadId)

    await clickByTestId(popupPage, "fontara-font-selector-trigger")
    await clickByTestId(popupPage, "fontara-font-option-Vazirmatn-Fontara")
    await waitForExtensionLocalValue(
      popupPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Vazirmatn-Fontara"
    )
    const selectedFontState = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: initialLoadId
      })
    )
    assert.equal(selectedFontState.loadId, initialLoadId)
  })
})

test("Chrome MV3 popup and options UI update current-site include/exclude lists", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const testPage = await harness.createFixturePage()

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 650, width: 360 }
    })

    await testPage.bringToFront()
    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })

    await waitForInputChecked(
      popupPage,
      "fontara-current-site-toggle-input",
      true
    )
    await clickByTestId(popupPage, "fontara-current-site-toggle")
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.DISABLED_FOR, [
      sitePattern
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )

    await clickByTestId(popupPage, "fontara-current-site-toggle")
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.DISABLED_FOR, [])
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.ENABLED_FOR, [
      sitePattern
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })

    await clickByTestId(optionsPage, "fontara-options-nav-sites")
    await clickByTestId(optionsPage, "fontara-site-list-include-mode")
    await setValueByTestId(
      optionsPage,
      "fontara-site-list-pattern-input",
      sitePattern
    )
    await clickByTestId(optionsPage, "fontara-site-list-add")
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.ENABLED_FOR, [
      sitePattern
    ])
    await optionsPage.waitForSelector(
      `[data-testid="fontara-site-list-row-${sitePattern}"]`
    )

    await clickByTestId(optionsPage, `fontara-site-list-remove-${sitePattern}`)
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.ENABLED_FOR, [])
  })
})

test("Chrome MV3 options UI creates site profiles and applies them without page reload", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const testPage = await harness.createFixturePage()

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )

    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    await clickByTestId(optionsPage, "fontara-options-nav-sites")
    await clickByTestId(optionsPage, "fontara-site-profile-target-trigger")
    await setValueByTestId(
      optionsPage,
      "fontara-site-profile-target-search",
      sitePattern
    )
    await clickByTestId(optionsPage, "fontara-site-profile-target-add")
    await setValueByTestId(
      optionsPage,
      "fontara-site-profile-font-select",
      "Samim-Fontara"
    )
    await clickByTestId(optionsPage, "fontara-site-profile-stroke-toggle")
    await setValueByTestId(
      optionsPage,
      "fontara-site-profile-stroke-range",
      "0.5"
    )
    await clickByTestId(optionsPage, "fontara-site-profile-save")

    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Samim-Fontara",
        pattern: sitePattern,
        textStroke: 0.5
      }
    ])
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.ENABLED_FOR, [])
    await optionsPage.waitForSelector(
      `[data-testid="fontara-site-profile-row-${sitePattern}"]`
    )
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )

    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern]
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )

    await clickByTestId(
      optionsPage,
      `fontara-site-profile-enabled-${sitePattern}`
    )
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        enabled: false,
        font: "Samim-Fontara",
        pattern: sitePattern,
        textStroke: 0.5
      }
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: initialLoadId,
        textStroke: false
      })
    )

    await clickByTestId(
      optionsPage,
      `fontara-site-profile-enabled-${sitePattern}`
    )
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Samim-Fontara",
        pattern: sitePattern,
        textStroke: 0.5
      }
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )
  })
})

test("Chrome MV3 popup per-site settings save profiles without enabling sites", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const testPage = await harness.createFixturePage()

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 700, width: 360 }
    })
    await testPage.bringToFront()
    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await popupPage.waitForSelector(
      '[data-testid="fontara-per-site-settings-open"]'
    )
    await popupPage.bringToFront()
    await clickByTestId(popupPage, "fontara-per-site-settings-open")
    await popupPage.waitForSelector(
      '[data-testid="fontara-per-site-site-off-notice"]'
    )
    await setValueByTestId(
      popupPage,
      "fontara-per-site-font-select",
      "Samim-Fontara"
    )

    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Samim-Fontara",
        pattern: sitePattern
      }
    ])
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.DISABLED_FOR, [])
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.ENABLED_FOR, [])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )

    await sendSettingsFromOptions(popupPage, {
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern]
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )
  })
})

test("Chrome MV3 popup per-site settings edit the strongest matching profile", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const scopedPath = "/per-site/path"
    const scopedPattern = `${sitePattern}${scopedPath}`
    const testPage = await harness.createFixturePage({ path: scopedPath })

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          font: "Sahel-Fontara",
          pattern: sitePattern
        },
        {
          font: "Samim-Fontara",
          pattern: scopedPattern,
          textStroke: 0.5
        }
      ],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 700, width: 360 }
    })
    await testPage.bringToFront()
    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          font: "Sahel-Fontara",
          pattern: sitePattern
        },
        {
          font: "Samim-Fontara",
          pattern: scopedPattern,
          textStroke: 0.5
        }
      ],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await popupPage.waitForSelector(
      '[data-testid="fontara-per-site-settings-open"]'
    )
    await popupPage.bringToFront()
    await clickByTestId(popupPage, "fontara-per-site-settings-open")
    await waitFor(() =>
      popupPage.$eval(
        '[data-testid="fontara-per-site-font-select"]',
        (element) => element.value === "Samim-Fontara"
      )
    )
    await setValueByTestId(
      popupPage,
      "fontara-per-site-font-select",
      "Vazirmatn-Fontara"
    )

    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Sahel-Fontara",
        pattern: sitePattern
      },
      {
        font: "Vazirmatn-Fontara",
        pattern: scopedPattern,
        textStroke: 0.5
      }
    ])
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.ENABLED_FOR, [
      sitePattern
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )
  })
})

test("Chrome MV3 popup per-site settings disable profiles without deleting path settings", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const scopedPath = "/per-site/disable-path"
    const scopedPattern = `${sitePattern}${scopedPath}`
    const testPage = await harness.createFixturePage({ path: scopedPath })

    await waitForContentBridge(testPage)
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          font: "Sahel-Fontara",
          pattern: sitePattern
        },
        {
          font: "Samim-Fontara",
          pattern: scopedPattern,
          textStroke: 0.5
        }
      ],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 700, width: 360 }
    })
    await testPage.bringToFront()
    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          font: "Sahel-Fontara",
          pattern: sitePattern
        },
        {
          font: "Samim-Fontara",
          pattern: scopedPattern,
          textStroke: 0.5
        }
      ],
      [STORAGE_KEYS.SYNC_SETTINGS]: true,
      [STORAGE_KEYS.TEXT_STROKE]: 0
    })
    await popupPage.waitForSelector(
      '[data-testid="fontara-per-site-settings-open"]'
    )
    await popupPage.bringToFront()
    await clickByTestId(popupPage, "fontara-per-site-settings-open")
    await clickByTestId(popupPage, "fontara-per-site-custom-toggle")

    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Sahel-Fontara",
        pattern: sitePattern
      },
      {
        enabled: false,
        font: "Samim-Fontara",
        pattern: scopedPattern,
        textStroke: 0.5
      }
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Sahel-Fontara",
        loadId: initialLoadId,
        textStroke: false
      })
    )
    await popupPage.waitForSelector(
      '[data-testid="fontara-per-site-fallback-notice"]'
    )

    await setValueByTestId(
      popupPage,
      "fontara-per-site-font-select",
      "Vazirmatn-Fontara"
    )
    await waitForExtensionLocalValue(popupPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Sahel-Fontara",
        pattern: sitePattern
      },
      {
        font: "Vazirmatn-Fontara",
        pattern: scopedPattern,
        textStroke: 0.5
      }
    ])
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: initialLoadId,
        textStroke: 0.5
      })
    )
  })
})

test("Chrome MV3 options UI exports, imports, and resets settings backups", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sitePattern = `127.0.0.1:${harness.server.port}`
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )

    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [],
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Samim-Fontara"
    )
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.ENABLED_FOR, [
      sitePattern
    ])
    await installDownloadCapture(optionsPage)
    await clickByTestId(optionsPage, "fontara-options-nav-advanced")
    await clickByTestId(optionsPage, "fontara-settings-export")

    const download = await waitForCapturedDownload(optionsPage)
    const exportedBackup = JSON.parse(download.text)
    assert.match(
      download.download,
      /^fontara-settings-\d{4}-\d{2}-\d{2}\.json$/
    )
    assert.equal(exportedBackup.format, "fontara-settings")
    assert.equal(
      exportedBackup.settings[STORAGE_KEYS.SELECTED_FONT],
      "Samim-Fontara"
    )
    assert.deepEqual(exportedBackup.settings[STORAGE_KEYS.ENABLED_FOR], [
      sitePattern
    ])

    const importFilePath = path.join(
      os.tmpdir(),
      `fontara-settings-import-${Date.now()}.json`
    )
    await fs.writeFile(
      importFilePath,
      JSON.stringify({
        app: "FontAra",
        exportedAt: "2026-06-09T00:00:00.000Z",
        extensionVersion: "4.3.0",
        format: "fontara-settings",
        settings: {
          [STORAGE_KEYS.DISABLED_FOR]: [],
          [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
          [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
          [STORAGE_KEYS.EXTENSION_ENABLED]: true,
          [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara",
          [STORAGE_KEYS.SITE_PROFILES]: [
            {
              font: "Sahel-Fontara",
              pattern: sitePattern,
              textStroke: 0.4
            }
          ],
          [STORAGE_KEYS.SYNC_SETTINGS]: false,
          [STORAGE_KEYS.TEXT_STROKE]: 0.2
        },
        version: 1
      })
    )
    t.after(() => fs.rm(importFilePath, { force: true }))

    await clickByTestId(optionsPage, "fontara-settings-import-open")
    await chooseFileByTestId(
      optionsPage,
      "fontara-settings-import-choose",
      importFilePath
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Sahel-Fontara"
    )
    await waitForExtensionLocalValue(optionsPage, STORAGE_KEYS.SITE_PROFILES, [
      {
        font: "Sahel-Fontara",
        pattern: sitePattern,
        textStroke: 0.4
      }
    ])

    await clickByTestId(optionsPage, "fontara-settings-reset-open")
    await clickByTestId(optionsPage, "fontara-settings-reset-confirm")
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Vazirmatn-Fontara"
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SITE_PROFILES,
      []
    )
  })
})

test("Chrome MV3 sync storage handles large site-list payloads in the browser", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const disabledFor = Array.from(
      { length: 320 },
      (_, index) => `example-${index}.fontara.test/path/${index}`
    )

    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.DISABLED_FOR]: disabledFor,
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })

    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.DISABLED_FOR,
      disabledFor
    )
    await waitForExtensionSyncValue(
      optionsPage,
      STORAGE_KEYS.DISABLED_FOR,
      disabledFor
    )

    const rawSyncValues = await waitFor(async () => {
      const values = await getExtensionSyncRawValues(optionsPage)
      const meta = values[STORAGE_KEYS.DISABLED_FOR]
      return meta &&
        typeof meta === "object" &&
        meta.__meta_split_count > 1 &&
        typeof values.disabledFor_0 === "string"
        ? values
        : false
    })

    assert.ok(rawSyncValues.disabledFor.__meta_split_count > 1)
  })
})

test("Chrome MV3 options UI persists advanced switches through real clicks", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )

    await setExtensionLocalValues(optionsPage, {
      [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true,
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    })
    await optionsPage.reload({ waitUntil: "load" })

    await clickByTestId(optionsPage, "fontara-options-nav-advanced")
    await waitForSwitchChecked(
      optionsPage,
      "fontara-sync-settings-toggle",
      true
    )
    await waitForSwitchChecked(
      optionsPage,
      "fontara-context-menus-toggle",
      true
    )

    await clickByTestId(optionsPage, "fontara-sync-settings-toggle")
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SYNC_SETTINGS,
      false
    )
    await waitForSwitchChecked(
      optionsPage,
      "fontara-sync-settings-toggle",
      false
    )

    await clickByTestId(optionsPage, "fontara-context-menus-toggle")
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
      false
    )
    await waitForSwitchChecked(
      optionsPage,
      "fontara-context-menus-toggle",
      false
    )
  })
})

test("Chrome MV3 extension pages render across target viewports", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    for (const [name, viewport] of Object.entries(BROWSER_VIEWPORTS)) {
      await t.test(`options page renders at ${name}`, async () => {
        const page = await harness.createExtensionPage(
          "ui/options/index.html",
          {
            viewport
          }
        )
        const state = await getExtensionPageLayoutState(page)

        assert.equal(state.hasRootContent, true, JSON.stringify(state, null, 2))
        assert.ok(state.bodyTextLength > 0, JSON.stringify(state, null, 2))
        assert.equal(
          state.overflowElements.length,
          0,
          JSON.stringify(state, null, 2)
        )

        await page.close()
      })
    }
  })
})
