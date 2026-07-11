import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  addHardFixtureDynamicText,
  clickByTestId,
  createBasicPageStyleExpectation,
  createHardFixtureStyleExpectation,
  evaluate,
  expectPageStyles,
  findFirefoxBinary,
  getExtensionLocalValues,
  getExtensionSyncRawValues,
  mountHardFixtureAdvancedText,
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  setValueByTestId,
  uploadFilesByTestId,
  waitFor,
  waitForContentBridge,
  waitForExtensionLocalValue,
  withFirefoxMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

const CUSTOM_FONT_SAMPLE_TEXT = "سلام فارسی آزمایش فونت سفارشی پندار گسترش قلم"

async function getCustomFontRuntimeState(
  page,
  familyValue,
  binaryMarkers = []
) {
  return evaluate(
    page,
    async (family, sampleText, markers) => {
      const escapeFamily = (value) =>
        value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
      const query = `400 32px "${escapeFamily(family)}"`
      const boldQuery = `700 32px "${escapeFamily(family)}"`
      const loadedFaces = Array.from(
        new Set([
          ...(await document.fonts.load(query, sampleText)),
          ...(await document.fonts.load(boldQuery, sampleText))
        ])
      )
      await document.fonts.ready
      const normalizeFamily = (value) => value.replace(/^["']|["']$/g, "")
      const familyFaces = Array.from(
        new Set(
          [...Array.from(document.fonts), ...loadedFaces].filter(
            (fontFace) => normalizeFamily(fontFace.family) === family
          )
        )
      )
      const registeredFaces = Array.from(document.fonts).map((fontFace) => ({
        family: fontFace.family,
        status: fontFace.status,
        style: fontFace.style,
        weight: fontFace.weight
      }))
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Canvas 2D context is unavailable.")
      const measure = (font) => {
        context.font = font
        return context.measureText(sampleText).width
      }
      const html = document.documentElement.outerHTML
      const target = document.getElementById("fontara-text")

      return {
        checked: document.fonts.check(query, sampleText),
        computedFamily: target ? getComputedStyle(target).fontFamily : "",
        customWidth: measure(query),
        dynamicStyleText:
          document.getElementById("fontara-dynamic-font")?.textContent ?? "",
        exposedMarkers: markers.filter(
          (marker) => marker.length > 0 && html.includes(marker)
        ),
        faceCount: familyFaces.length,
        registeredFaces,
        statuses: familyFaces.map((fontFace) => fontFace.status),
        hasDataFont: /data:font/i.test(html),
        loadedCount: loadedFaces.length,
        monospaceWidth: measure("400 32px monospace"),
        serifWidth: measure("400 32px serif")
      }
    },
    familyValue,
    CUSTOM_FONT_SAMPLE_TEXT,
    binaryMarkers
  )
}

function assertNoCustomFontBinary(serializedValue, binaryMarkers, label) {
  assert.doesNotMatch(
    serializedValue,
    /data:font/i,
    `${label} exposed data:font.`
  )
  for (const marker of binaryMarkers) {
    assert.equal(
      serializedValue.includes(marker),
      false,
      `${label} exposed a custom-font binary marker.`
    )
  }
}

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

test("Firefox MV3 recognizes the optional contextMenus permission", async (t) => {
  if (await skipUnlessFirefoxBrowserTestsAreEnabled(t)) return

  await withFirefoxMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const initialState = await optionsPage.evaluate(
      () =>
        new Promise((resolve) => {
          chrome.permissions.contains(
            { permissions: ["contextMenus"] },
            (granted) =>
              resolve({
                error: chrome.runtime.lastError?.message ?? null,
                granted
              })
          )
        })
    )
    assert.equal(initialState.error, null)
    assert.equal(typeof initialState.granted, "boolean")

    await optionsPage.evaluate(() => {
      const button = document.createElement("button")
      button.id = "fontara-firefox-permission-probe"
      button.style.cssText =
        "position:fixed;inset:8px auto auto 8px;z-index:2147483647;width:120px;height:40px"
      button.textContent = "Permission probe"
      button.addEventListener("click", () => {
        chrome.permissions.request(
          { permissions: ["contextMenus"] },
          (granted) => {
            window.__fontaraPermissionProbe = {
              error: chrome.runtime.lastError?.message ?? null,
              granted
            }
          }
        )
      })
      document.body.append(button)
    })
    await optionsPage.click("#fontara-firefox-permission-probe")
    await new Promise((resolve) => setTimeout(resolve, 250))
    const requestState = await optionsPage.evaluate(
      () => window.__fontaraPermissionProbe ?? { pending: true }
    )
    if (!requestState.pending) {
      assert.equal(requestState.error, null)
      assert.equal(typeof requestState.granted, "boolean")
    }

    if (!requestState.pending && requestState.granted) {
      const removed = await optionsPage.evaluate(
        () =>
          new Promise((resolve) => {
            chrome.permissions.remove(
              { permissions: ["contextMenus"] },
              (didRemove) => resolve(didRemove)
            )
          })
      )
      assert.equal(removed, true)
    }
  })
})

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

    const firstState = await expectPageStyles(
      fixturePage,
      createBasicPageStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
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

    const removedState = await expectPageStyles(
      fixturePage,
      createBasicPageStyleExpectation({
        applied: false,
        loadId: initialLoadId
      })
    )
    assert.equal(removedState.loadId, initialLoadId)
  })
})

test("Firefox MV3 uploads, applies, reloads, and deletes a real custom-font family without binary exposure", async (t) => {
  if (await skipUnlessFirefoxBrowserTestsAreEnabled(t)) return

  await withFirefoxMv3ExtensionHarness(t, async (harness) => {
    const regularFontPath = path.resolve("assets/fonts/shabnam/Shabnam.woff2")
    const boldFontPath = path.resolve("assets/fonts/shabnam/Shabnam-Bold.woff2")
    await Promise.all([fs.access(regularFontPath), fs.access(boldFontPath)])

    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const fixturePage = await harness.createFixturePage()
    await fixturePage.waitForFunction(() => document.readyState === "complete")
    await waitForContentBridge(fixturePage)
    const sitePattern = `127.0.0.1:${harness.server.port}`

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await clickByTestId(optionsPage, "fontara-options-nav-fonts")
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-file", [
      regularFontPath,
      boldFontPath
    ])
    await waitFor(
      () =>
        optionsPage.$eval(
          '[data-testid="fontara-custom-font-add"]',
          (element) => element instanceof HTMLButtonElement && !element.disabled
        ),
      {
        message:
          "Firefox did not validate the real Shabnam files in the metadata worker.",
        timeout: 20_000
      }
    )
    await setValueByTestId(
      optionsPage,
      "fontara-custom-font-name",
      "Firefox E2E Shabnam"
    )
    await clickByTestId(optionsPage, "fontara-custom-font-add")

    const family = await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, [
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ])
        const families = values[STORAGE_KEYS.CUSTOM_FONT_LIST]
        const candidate = Array.isArray(families) ? families[0] : null
        return families?.length === 1 && candidate?.faces?.length === 2
          ? candidate
          : false
      },
      {
        message: "Firefox did not commit the custom-font family.",
        timeout: 20_000
      }
    )
    assert.equal(family.displayName, "Firefox E2E Shabnam")
    assert.equal(family.sourceFamilyKey, "shabnam")
    assert.equal(family.revision, 1)
    assert.deepEqual(
      family.faces.map((face) => face.weight),
      [
        { min: 400, max: 400 },
        { min: 700, max: 700 }
      ]
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Vazirmatn-Fontara"
    )

    const localValues = await getExtensionLocalValues(optionsPage, null)
    const blobKeys = family.faces.map(
      (face) => `customFontFace:${face.fileHash}`
    )
    const binaryMarkers = blobKeys.map((blobKey) => {
      const data = localValues[blobKey]?.data
      assert.equal(typeof data, "string")
      assert.ok(data.length > 256)
      const offset = Math.max(0, Math.floor(data.length / 2) - 48)
      return data.slice(offset, offset + 96)
    })
    assert.equal(
      family.faces.some(
        (face) => Object.hasOwn(face, "data") || Object.hasOwn(face, "base64")
      ),
      false
    )

    const extensionDataResponse = await waitForContentBridge(fixturePage)
    const extensionData = extensionDataResponse.data ?? extensionDataResponse
    assertNoCustomFontBinary(
      JSON.stringify(extensionData),
      binaryMarkers,
      "Firefox background GET_DATA response"
    )
    assertNoCustomFontBinary(
      JSON.stringify(await getExtensionSyncRawValues(optionsPage)),
      binaryMarkers,
      "Firefox sync storage"
    )

    const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
      viewport: { height: 650, width: 360 }
    })
    await clickByTestId(popupPage, "fontara-font-selector-trigger")
    await setValueByTestId(
      popupPage,
      "fontara-font-selector-search",
      family.displayName
    )
    await clickByTestId(popupPage, `fontara-font-option-${family.value}`)
    await waitForExtensionLocalValue(
      popupPage,
      STORAGE_KEYS.SELECTED_FONT,
      family.value
    )

    let lastAppliedState = null
    let appliedState
    try {
      appliedState = await waitFor(
        async () => {
          const state = await getCustomFontRuntimeState(
            fixturePage,
            family.value,
            binaryMarkers
          )
          lastAppliedState = state
          return state.checked &&
            state.loadedCount >= 1 &&
            state.faceCount === 2 &&
            state.statuses.every((status) => status === "loaded") &&
            state.computedFamily.includes(family.value)
            ? state
            : false
        },
        {
          message:
            "Firefox did not register and apply both real custom-font faces.",
          timeout: 30_000
        }
      )
    } catch (error) {
      if (error instanceof Error) {
        error.message += `\n\nLast Firefox custom-font runtime state:\n${JSON.stringify(lastAppliedState, null, 2)}`
      }
      throw error
    }
    assert.ok(appliedState.dynamicStyleText.includes(family.value))
    assert.ok(
      Math.max(
        Math.abs(appliedState.customWidth - appliedState.serifWidth),
        Math.abs(appliedState.customWidth - appliedState.monospaceWidth)
      ) > 0.5,
      "Firefox canvas metrics did not distinguish the custom font."
    )
    assert.equal(appliedState.hasDataFont, false)
    assert.deepEqual(appliedState.exposedMarkers, [])

    const previousLoadId = await evaluate(
      fixturePage,
      () => window.__fontaraLoadId
    )
    await fixturePage.reload({ waitUntil: "load" })
    await waitForContentBridge(fixturePage)
    assert.notEqual(
      await evaluate(fixturePage, () => window.__fontaraLoadId),
      previousLoadId
    )
    const reloadedState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(
          fixturePage,
          family.value,
          binaryMarkers
        )
        return state.checked &&
          state.faceCount === 2 &&
          state.statuses.every((status) => status === "loaded") &&
          state.computedFamily.includes(family.value)
          ? state
          : false
      },
      {
        message: "Firefox did not restore the custom family after reload.",
        timeout: 30_000
      }
    )
    assert.equal(reloadedState.hasDataFont, false)
    assert.deepEqual(reloadedState.exposedMarkers, [])

    await clickByTestId(
      optionsPage,
      `fontara-custom-font-delete-${family.value}`
    )
    await clickByTestId(
      optionsPage,
      `fontara-custom-font-delete-confirm-${family.value}`
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.CUSTOM_FONT_LIST,
      []
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      "Vazirmatn-Fontara"
    )
    await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, null)
        return blobKeys.every((blobKey) => !(blobKey in values))
      },
      { message: "Firefox did not garbage-collect deleted font blobs." }
    )
    const deletedState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(
          fixturePage,
          family.value,
          binaryMarkers
        )
        return state.faceCount === 0 &&
          !state.computedFamily.includes(family.value) &&
          state.dynamicStyleText.includes("Vazirmatn-Fontara")
          ? state
          : false
      },
      {
        message:
          "Firefox did not remove FontFace objects after deleting the selected family.",
        timeout: 30_000
      }
    )
    assert.equal(deletedState.hasDataFont, false)
    assert.deepEqual(deletedState.exposedMarkers, [])
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
    await expectPageStyles(
      fixturePage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        loadId: initialLoadId
      })
    )

    await addHardFixtureDynamicText(fixturePage)
    await expectPageStyles(
      fixturePage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        includeDynamic: true,
        loadId: initialLoadId
      })
    )

    await mountHardFixtureAdvancedText(fixturePage)
    await expectPageStyles(
      fixturePage,
      createHardFixtureStyleExpectation({
        fontName: "Samim-Fontara",
        includeAdvanced: true,
        includeCrossOriginFrame: false,
        includeDynamic: true,
        loadId: initialLoadId
      })
    )

    await sendSettingsFromContentBridge(fixturePage, {
      [STORAGE_KEYS.DISABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
      [STORAGE_KEYS.ENABLED_FOR]: [],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await expectPageStyles(
      fixturePage,
      createHardFixtureStyleExpectation({
        applied: false,
        includeAdvanced: true,
        includeCrossOriginFrame: false,
        includeDynamic: true,
        loadId: initialLoadId
      })
    )
  })
})
