import assert from "node:assert/strict"
import { createHash } from "node:crypto"
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
  getExtensionLocalValues,
  getExtensionPageLayoutState,
  getExtensionSyncRawValues,
  installDownloadCapture,
  mountHardFixtureAdvancedText,
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  sendSettingsFromOptions,
  setExtensionLocalValues,
  setValueByTestId,
  stopChromeExtensionServiceWorkers,
  uploadFilesByTestId,
  waitFor,
  waitForCapturedDownload,
  waitForContentBridge,
  waitForExtensionLocalValue,
  waitForExtensionSyncValue,
  waitForInputChecked,
  waitForSwitchChecked,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

const CUSTOM_FONT_SAMPLE_TEXT = "سلام فارسی آزمایش فونت سفارشی پندار گسترش قلم"
let customFontMutationSequence = 0

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
      const quotedFamily = `"${escapeFamily(family)}"`
      const query = `400 32px ${quotedFamily}`
      const boldQuery = `700 32px ${quotedFamily}`
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
        boldChecked: document.fonts.check(boldQuery, sampleText),
        checked: document.fonts.check(query, sampleText),
        computedFamily: target ? getComputedStyle(target).fontFamily : "",
        customWidth: measure(query),
        dynamicStyleText:
          document.getElementById("fontara-dynamic-font")?.textContent ?? "",
        exposedMarkers: markers.filter(
          (marker) => marker.length > 0 && html.includes(marker)
        ),
        faceCount: familyFaces.length,
        faces: familyFaces.map((fontFace) => ({
          status: fontFace.status,
          stretch: fontFace.stretch,
          style: fontFace.style,
          weight: fontFace.weight
        })),
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

async function sendCustomFontMessage(extensionPage, message) {
  customFontMutationSequence += 1
  const request = {
    ...message,
    data: {
      ...message.data,
      clientMutationId: `browser-custom-font-${customFontMutationSequence}`
    }
  }
  const response = await extensionPage.evaluate(
    (request) =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(request, (messageResponse) => {
          const error = chrome.runtime.lastError
          if (error) {
            reject(new Error(error.message))
            return
          }
          resolve(messageResponse)
        })
      }),
    request
  )

  assert.ok(response, "FontARA did not acknowledge the custom-font message.")
  if (response.error) throw new Error(response.error)
  return response.data
}

test("Chrome MV3 applies a real installed system font across reload and service-worker restart", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const testPage = await harness.createFixturePage()
    const sitePattern = `127.0.0.1:${harness.server.port}`
    await waitForContentBridge(testPage)

    const installedFont = await optionsPage.evaluate(
      () =>
        new Promise((resolve, reject) => {
          if (typeof chrome.fontSettings?.getFontList !== "function") {
            reject(new Error("chrome.fontSettings.getFontList is unavailable"))
            return
          }

          chrome.fontSettings.getFontList((fonts) => {
            const error = chrome.runtime.lastError
            if (error) {
              reject(new Error(error.message))
              return
            }

            const safeFonts = (fonts ?? []).filter(
              (font) =>
                typeof font.fontId === "string" &&
                font.fontId.length > 0 &&
                font.fontId.length <= 160 &&
                /^[\p{L}\p{N} ._+-]+$/u.test(font.fontId)
            )
            const preferredFamilies = [
              "Arial",
              "Helvetica",
              "Noto Sans",
              "DejaVu Sans",
              "Times New Roman"
            ]
            const selected =
              preferredFamilies
                .map((family) =>
                  safeFonts.find(
                    (font) => font.fontId.toLowerCase() === family.toLowerCase()
                  )
                )
                .find(Boolean) ?? safeFonts[0]

            resolve(selected ?? null)
          })
        })
    )
    assert.ok(installedFont?.fontId, "Chrome returned no safe installed font.")

    const systemFontValue = `system-font:${encodeURIComponent(installedFont.fontId)}`
    const initialLoadId = await evaluate(testPage, () => window.__fontaraLoadId)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: systemFontValue,
      [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: true,
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    const appliedWithoutReload = await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: installedFont.fontId,
        loadId: initialLoadId
      })
    )
    assert.equal(appliedWithoutReload.loadId, initialLoadId)
    assert.equal(
      await evaluate(
        testPage,
        (fontFamily) => {
          const quotedFamily = `"${fontFamily
            .replaceAll("\\", "\\\\")
            .replaceAll('"', '\\"')}"`
          return document.fonts.check(`16px ${quotedFamily}`, "FontARA")
        },
        installedFont.fontId
      ),
      true
    )

    await testPage.reload({ waitUntil: "load" })
    await waitForContentBridge(testPage)
    const reloadLoadId = await evaluate(testPage, () => window.__fontaraLoadId)
    assert.notEqual(reloadLoadId, initialLoadId)
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: installedFont.fontId,
        loadId: reloadLoadId
      })
    )

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: false
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: "Vazirmatn-Fontara",
        loadId: reloadLoadId
      })
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      systemFontValue
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SYNC_SETTINGS,
      false
    )

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: true
    })
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: installedFont.fontId,
        loadId: reloadLoadId
      })
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
      true
    )
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      systemFontValue
    )
    await delay(500)
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      systemFontValue
    )

    await stopChromeExtensionServiceWorkers(optionsPage)
    await testPage.reload({ waitUntil: "load" })
    const restartedResponse = await waitForContentBridge(testPage)
    const restartedData = restartedResponse.data ?? restartedResponse
    const restartedOptionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const restartedLocalValues = await getExtensionLocalValues(
      restartedOptionsPage,
      [
        STORAGE_KEYS.SELECTED_FONT,
        STORAGE_KEYS.SYNC_SETTINGS,
        STORAGE_KEYS.SYSTEM_FONTS_ENABLED
      ]
    )
    assert.deepEqual(
      {
        backgroundSelectedFont:
          restartedData.settings[STORAGE_KEYS.SELECTED_FONT],
        backgroundSystemFontsEnabled:
          restartedData.settings[STORAGE_KEYS.SYSTEM_FONTS_ENABLED],
        localSelectedFont: restartedLocalValues[STORAGE_KEYS.SELECTED_FONT],
        localSyncSettings: restartedLocalValues[STORAGE_KEYS.SYNC_SETTINGS],
        localSystemFontsEnabled:
          restartedLocalValues[STORAGE_KEYS.SYSTEM_FONTS_ENABLED]
      },
      {
        backgroundSelectedFont: systemFontValue,
        backgroundSystemFontsEnabled: true,
        localSelectedFont: systemFontValue,
        localSyncSettings: false,
        localSystemFontsEnabled: true
      }
    )
    assert.ok(
      restartedData.settings[STORAGE_KEYS.ENABLED_FOR].includes(sitePattern)
    )
    const restartedLoadId = await evaluate(
      testPage,
      () => window.__fontaraLoadId
    )
    await expectPageStyles(
      testPage,
      createBasicPageStyleExpectation({
        fontName: installedFont.fontId,
        loadId: restartedLoadId
      })
    )
  })
})

test("Chrome MV3 manually maps unusual Regular/Bold files, applies them, recovers, and deletes them without binary exposure", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const sourceRegularFontPath = path.resolve(
      "assets/fonts/shabnam/Shabnam.woff2"
    )
    const sourceBoldFontPath = path.resolve(
      "assets/fonts/parastoo/Parastoo-Bold.woff2"
    )
    await Promise.all([
      fs.access(sourceRegularFontPath),
      fs.access(sourceBoldFontPath)
    ])
    const uploadDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "fontara-simple-font-upload-")
    )
    t.after(() => fs.rm(uploadDirectory, { force: true, recursive: true }))
    const regularFontPath = path.join(uploadDirectory, "نام عجیب ✦ ۴۰۰.woff2")
    const boldFontPath = path.join(uploadDirectory, "BOLD @ 700!.woff2")
    const invalidFontPath = path.join(uploadDirectory, "فایل خراب.woff2")
    await Promise.all([
      fs.copyFile(sourceRegularFontPath, regularFontPath),
      fs.copyFile(sourceBoldFontPath, boldFontPath),
      fs.writeFile(invalidFontPath, "not-a-font")
    ])

    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const testPage = await harness.createFixturePage()
    const sitePattern = `127.0.0.1:${harness.server.port}`
    await waitForContentBridge(testPage)

    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await clickByTestId(optionsPage, "fontara-options-nav-fonts")
    await clickByTestId(optionsPage, "fontara-custom-font-coverage")
    await clickByTestId(
      optionsPage,
      "fontara-custom-font-coverage-latin-arabic"
    )
    await setValueByTestId(
      optionsPage,
      "fontara-custom-font-name",
      "E2E Manual Family"
    )
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-regular-file", [
      regularFontPath
    ])
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-regular-ready"]'
    )
    await waitFor(
      () =>
        optionsPage.$eval(
          '[data-testid="fontara-custom-font-preview"] [style]',
          (element) =>
            element instanceof HTMLElement &&
            element.style.fontFamily.startsWith("FontaraUploadPreview-")
        ),
      { message: "The local upload preview did not load the Regular file." }
    )
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-regular-file", [
      invalidFontPath
    ])
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-regular-error"]'
    )
    assert.match(
      await optionsPage.$eval(
        '[data-testid="fontara-custom-font-regular-ready"]',
        (element) => element.textContent ?? ""
      ),
      /نام عجیب/u,
      "An invalid replacement must not discard the prepared Regular file."
    )
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-bold-file", [
      boldFontPath
    ])
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-bold-ready"]'
    )
    assert.ok(
      await optionsPage.$eval(
        '[data-testid="fontara-custom-font-bold-remove"]',
        (element) => element.getAttribute("aria-label")
      )
    )
    await clickByTestId(optionsPage, "fontara-custom-font-bold-remove")
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-bold-ready"]',
      { hidden: true }
    )
    assert.equal(
      await optionsPage.$eval(
        '[data-testid="fontara-custom-font-add"]',
        (element) => element instanceof HTMLButtonElement && !element.disabled
      ),
      true,
      "A static Regular file must be addable without the optional Bold file."
    )
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-bold-file", [
      boldFontPath
    ])
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-bold-ready"]'
    )
    await waitFor(
      () =>
        optionsPage.$eval(
          '[data-testid="fontara-custom-font-add"]',
          (element) => element instanceof HTMLButtonElement && !element.disabled
        ),
      {
        message:
          "The real Shabnam files were not validated by the metadata worker."
      }
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
        message: "The custom-font family was not committed to the library.",
        timeout: 20_000
      }
    )
    assert.equal(family.displayName, "E2E Manual Family")
    assert.equal(family.sourceFamilyKey, "e2e manual family")
    assert.match(family.value, /^[A-Za-z0-9_-]+-Fontara$/)
    assert.ok(family.unicodeRange?.includes("U+0600-06FF"))
    assert.ok(family.unicodeRange?.includes("U+0000-00FF"))
    assert.equal(family.revision, 1)
    assert.deepEqual(
      family.faces.map((face) => ({
        style: face.style,
        validation: face.validation,
        weight: face.weight
      })),
      [
        {
          style: "normal",
          validation: "verified",
          weight: { min: 400, max: 400 }
        },
        {
          style: "normal",
          validation: "verified",
          weight: { min: 700, max: 700 }
        }
      ]
    )
    assert.deepEqual(
      family.faces.map((face) => face.fileName),
      ["نام عجیب ✦ ۴۰۰.woff2", "BOLD @ 700!.woff2"]
    )

    const selectionAfterAdd = await getExtensionLocalValues(optionsPage, [
      STORAGE_KEYS.SELECTED_FONT
    ])
    assert.equal(
      selectionAfterAdd[STORAGE_KEYS.SELECTED_FONT],
      "Vazirmatn-Fontara",
      "Adding a family must not auto-select it."
    )
    await clickByTestId(
      optionsPage,
      `fontara-custom-font-health-${family.value}`
    )
    await waitFor(
      () =>
        optionsPage.$eval(
          `[data-testid="fontara-custom-font-health-status-${family.value}"]`,
          (element) => element.classList.contains("text-emerald-700")
        ),
      { message: "The saved family health check did not become ready." }
    )
    assert.match(
      await optionsPage.$eval(
        `[data-testid="fontara-custom-font-health-status-${family.value}"]`,
        (element) => element.textContent ?? ""
      ),
      /ready/i,
      "The saved family health check did not verify its local blobs."
    )

    const allLocalValues = await getExtensionLocalValues(optionsPage, null)
    const blobKeys = family.faces.map(
      (face) => `customFontFace:${face.fileHash}`
    )
    const binaryMarkers = []
    for (const [index, face] of family.faces.entries()) {
      const blob = allLocalValues[blobKeys[index]]
      assert.equal(blob?.encoding, "base64")
      assert.equal(blob?.hash, face.fileHash)
      assert.equal(blob?.byteLength, face.byteLength)
      assert.equal(blob?.format, face.format)
      assert.ok(blob.data.length > 256)
      const markerOffset = Math.max(0, Math.floor(blob.data.length / 2) - 48)
      binaryMarkers.push(blob.data.slice(markerOffset, markerOffset + 96))
      assert.equal(Object.hasOwn(face, "data"), false)
      assert.equal(Object.hasOwn(face, "base64"), false)
    }
    assert.equal(
      Object.keys(allLocalValues).some((key) =>
        key.startsWith("customFontStaging:")
      ),
      false,
      "Committed uploads must not leave staging blobs behind."
    )

    const extensionDataResponse = await waitForContentBridge(testPage)
    const extensionData = extensionDataResponse.data ?? extensionDataResponse
    assert.equal(
      extensionData.settings[STORAGE_KEYS.CUSTOM_FONT_LIST][0].faces.length,
      2
    )
    assertNoCustomFontBinary(
      JSON.stringify(extensionData),
      binaryMarkers,
      "Background GET_DATA response"
    )
    const initialSyncValues = await getExtensionSyncRawValues(optionsPage)
    assertNoCustomFontBinary(
      JSON.stringify(initialSyncValues),
      binaryMarkers,
      "Sync storage"
    )
    assertNoCustomFontBinary(
      await evaluate(optionsPage, () => document.documentElement.outerHTML),
      binaryMarkers,
      "Options DOM"
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

    const appliedState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(
          testPage,
          family.value,
          binaryMarkers
        )
        return state.checked &&
          state.loadedCount >= 1 &&
          state.faceCount === 2 &&
          state.faces.every((face) => face.status === "loaded") &&
          state.computedFamily.includes(family.value)
          ? state
          : false
      },
      {
        message:
          "The uploaded Regular/Bold family was not registered with FontFace and applied.",
        timeout: 20_000
      }
    )
    assert.equal(
      appliedState.faces.some((face) => face.weight === "400"),
      true
    )
    assert.equal(
      appliedState.faces.some((face) => face.weight === "700"),
      true
    )
    assert.ok(appliedState.dynamicStyleText.includes(family.value))
    assert.ok(
      Math.max(
        Math.abs(appliedState.customWidth - appliedState.serifWidth),
        Math.abs(appliedState.customWidth - appliedState.monospaceWidth)
      ) > 0.5,
      "Canvas metrics did not distinguish the custom font from fallbacks."
    )
    assert.equal(appliedState.hasDataFont, false)
    assert.deepEqual(appliedState.exposedMarkers, [])
    assertNoCustomFontBinary(
      await evaluate(popupPage, () => document.documentElement.outerHTML),
      binaryMarkers,
      "Popup DOM"
    )

    const failedFaceBytes = Buffer.from(
      "not-a-valid-font-face-binary-for-partial-failure-e2e-".repeat(8)
    )
    const failedFaceHash = createHash("sha256")
      .update(failedFaceBytes)
      .digest("hex")
    const failedFaceBase64 = failedFaceBytes.toString("base64")
    const failedFace = {
      id: `${failedFaceHash.slice(0, 16)}-failed-face`,
      fileHash: failedFaceHash,
      fileName: "Corrupt-Italic.woff2",
      format: "woff2",
      byteLength: failedFaceBytes.byteLength,
      weight: { min: 900, max: 900 },
      style: "italic",
      stretch: { min: 100, max: 100 },
      axes: [],
      validation: "failed"
    }
    const partiallyBrokenFamilyDraft = {
      ...family,
      faces: [...family.faces, failedFace]
    }
    delete partiallyBrokenFamilyDraft.revision
    const transaction = await sendCustomFontMessage(optionsPage, {
      data: { family: partiallyBrokenFamilyDraft },
      type: "fontara-ui-bg-custom-font-begin"
    })
    for (const face of family.faces) {
      await sendCustomFontMessage(optionsPage, {
        data: {
          base64: allLocalValues[`customFontFace:${face.fileHash}`].data,
          faceId: face.id,
          transactionId: transaction.transactionId
        },
        type: "fontara-ui-bg-custom-font-put-face"
      })
    }
    await sendCustomFontMessage(optionsPage, {
      data: {
        base64: failedFaceBase64,
        faceId: failedFace.id,
        transactionId: transaction.transactionId
      },
      type: "fontara-ui-bg-custom-font-put-face"
    })
    const committedPartialTransaction = await sendCustomFontMessage(
      optionsPage,
      {
        data: { transactionId: transaction.transactionId },
        type: "fontara-ui-bg-custom-font-commit"
      }
    )
    const partiallyBrokenFamily = committedPartialTransaction.family
    assert.equal(partiallyBrokenFamily.revision, family.revision + 1)
    const failedBlobKey = `customFontFace:${failedFaceHash}`
    blobKeys.push(failedBlobKey)
    const failedMarkerOffset = Math.max(
      0,
      Math.floor(failedFaceBase64.length / 2) - 48
    )
    binaryMarkers.push(
      failedFaceBase64.slice(failedMarkerOffset, failedMarkerOffset + 96)
    )
    await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, [
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ])
        const storedFamily = values[STORAGE_KEYS.CUSTOM_FONT_LIST]?.[0]
        return storedFamily?.revision === partiallyBrokenFamily.revision &&
          storedFamily.faces?.length === 3
          ? storedFamily
          : false
      },
      {
        message: "The partial-failure fixture metadata was not persisted."
      }
    )

    const partialState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(
          testPage,
          family.value,
          binaryMarkers
        )
        return state.faceCount === 2 &&
          state.faces.every((face) => face.status === "loaded") &&
          state.computedFamily.includes(family.value)
          ? state
          : false
      },
      {
        message:
          "A missing secondary face prevented the valid family faces from applying.",
        timeout: 20_000
      }
    )
    assert.equal(partialState.checked, true)
    assert.equal(partialState.loadedCount >= 1, true)
    assert.deepEqual(partialState.exposedMarkers, [])

    await stopChromeExtensionServiceWorkers(optionsPage)
    const previousLoadId = await evaluate(
      testPage,
      () => window.__fontaraLoadId
    )
    await testPage.reload({ waitUntil: "load" })
    const reloadedExtensionDataResponse = await waitForContentBridge(testPage)
    const reloadedExtensionData =
      reloadedExtensionDataResponse.data ?? reloadedExtensionDataResponse
    assert.notEqual(
      await evaluate(testPage, () => window.__fontaraLoadId),
      previousLoadId
    )
    assert.equal(
      reloadedExtensionData.settings[STORAGE_KEYS.SELECTED_FONT],
      family.value
    )
    assertNoCustomFontBinary(
      JSON.stringify(reloadedExtensionData),
      binaryMarkers,
      "Reloaded background GET_DATA response"
    )

    const reloadedLocalValues = await getExtensionLocalValues(optionsPage, null)
    assert.equal(
      reloadedLocalValues[STORAGE_KEYS.CUSTOM_FONT_LIST]?.[0]?.revision,
      partiallyBrokenFamily.revision
    )
    assert.equal(
      reloadedLocalValues[STORAGE_KEYS.CUSTOM_FONT_LIST]?.[0]?.faces?.length,
      3
    )
    for (const blobKey of blobKeys) {
      assert.ok(reloadedLocalValues[blobKey], `${blobKey} was lost on restart.`)
    }

    let lastReloadedState = null
    let reloadedState
    try {
      reloadedState = await waitFor(
        async () => {
          const state = await getCustomFontRuntimeState(
            testPage,
            family.value,
            binaryMarkers
          )
          lastReloadedState = state
          return state.faceCount === 2 &&
            state.faces.every((face) => face.status === "loaded") &&
            state.computedFamily.includes(family.value)
            ? state
            : false
        },
        {
          message:
            "The valid custom-font faces did not survive page reload and service-worker restart.",
          timeout: 20_000
        }
      )
    } catch (error) {
      if (error instanceof Error) {
        error.message += `\n\nLast custom-font runtime state:\n${JSON.stringify(lastReloadedState, null, 2)}`
      }
      throw error
    }
    assert.equal(reloadedState.checked, true)
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
        return blobKeys.every((key) => !(key in values))
      },
      {
        message: "Deleting the family did not garbage-collect its face blobs."
      }
    )

    const deletedState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(
          testPage,
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
          "Deleting the selected custom family did not remove FontFace objects and restore the default.",
        timeout: 20_000
      }
    )
    assert.equal(deletedState.hasDataFont, false)
    assert.deepEqual(deletedState.exposedMarkers, [])

    const finalSyncValues = await getExtensionSyncRawValues(optionsPage)
    assertNoCustomFontBinary(
      JSON.stringify(finalSyncValues),
      binaryMarkers,
      "Final sync storage"
    )
    const finalExtensionDataResponse = await waitForContentBridge(testPage)
    const finalExtensionData =
      finalExtensionDataResponse.data ?? finalExtensionDataResponse
    assert.deepEqual(
      finalExtensionData.settings[STORAGE_KEYS.CUSTOM_FONT_LIST],
      []
    )
    assertNoCustomFontBinary(
      JSON.stringify(finalExtensionData),
      binaryMarkers,
      "Final background GET_DATA response"
    )
  })
})

test("Chrome MV3 simple uploader uses one variable Regular file for Regular and Bold", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const variableFontPath = path.resolve(
      "assets/fonts/vazir/variable/Vazirmatn[wght].woff2"
    )
    await fs.access(variableFontPath)

    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    const testPage = await harness.createFixturePage()
    const sitePattern = `127.0.0.1:${harness.server.port}`
    await waitForContentBridge(testPage)
    await sendSettingsFromContentBridge(testPage, {
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [sitePattern],
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })

    await clickByTestId(optionsPage, "fontara-options-nav-fonts")
    await setValueByTestId(
      optionsPage,
      "fontara-custom-font-name",
      "E2E Variable Vazirmatn"
    )
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-regular-file", [
      variableFontPath
    ])
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-regular-ready"]'
    )
    assert.equal(
      await optionsPage.$eval(
        '[data-testid="fontara-custom-font-bold-file"]',
        (element) => element instanceof HTMLInputElement && element.disabled
      ),
      true
    )
    await clickByTestId(optionsPage, "fontara-custom-font-add")

    const family = await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, [
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ])
        const candidate = values[STORAGE_KEYS.CUSTOM_FONT_LIST]?.[0]
        return candidate?.faces?.length === 1 ? candidate : false
      },
      {
        message: "The variable custom font was not committed.",
        timeout: 20_000
      }
    )
    assert.equal(family.displayName, "E2E Variable Vazirmatn")
    assert.ok(family.unicodeRange?.includes("U+0600-06FF"))
    assert.equal(family.unicodeRange?.includes("U+0000-00FF"), false)
    assert.deepEqual(family.faces[0].weight, { min: 100, max: 900 })

    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.SELECTED_FONT]: family.value
    })
    const runtimeState = await waitFor(
      async () => {
        const state = await getCustomFontRuntimeState(testPage, family.value)
        return state.checked && state.boldChecked && state.faceCount === 1
          ? state
          : false
      },
      {
        message:
          "The one-face variable family did not load at Regular and Bold weights.",
        timeout: 20_000
      }
    )
    assert.match(runtimeState.computedFamily, new RegExp(family.value))
    assert.equal(runtimeState.faces[0].weight, "100 900")
    assert.equal(runtimeState.hasDataFont, false)
  })
})

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

test("Chrome MV3 injects FontARA into about:blank, srcdoc, and blob related frames", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const testPage = await harness.createFixturePage()
    const sitePattern = `127.0.0.1:${harness.server.port}`

    await waitForContentBridge(testPage)
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
      createBasicPageStyleExpectation({ fontName: "Samim-Fontara" })
    )

    await evaluate(testPage, async () => {
      const mountFrame = (frame, configure) =>
        new Promise((resolve) => {
          const fallback = window.setTimeout(resolve, 1_000)
          frame.addEventListener(
            "load",
            () => {
              window.clearTimeout(fallback)
              resolve()
            },
            { once: true }
          )
          configure(frame)
          document.body.append(frame)
        })

      const blankFrame = document.createElement("iframe")
      blankFrame.id = "fontara-related-about-blank"
      await mountFrame(blankFrame, (frame) => {
        frame.src = "about:blank"
      })
      const blankText = blankFrame.contentDocument?.createElement("p")
      if (!blankText || !blankFrame.contentDocument?.body) {
        throw new Error("The about:blank fixture was not accessible.")
      }
      blankText.id = "fontara-related-about-blank-text"
      blankText.textContent = "متن فارسی در about blank"
      blankFrame.contentDocument.body.append(blankText)

      const srcdocFrame = document.createElement("iframe")
      srcdocFrame.id = "fontara-related-srcdoc"
      await mountFrame(srcdocFrame, (frame) => {
        frame.srcdoc =
          '<!doctype html><html><body><p id="fontara-related-srcdoc-text">متن فارسی در srcdoc</p></body></html>'
      })

      const blobUrl = URL.createObjectURL(
        new Blob(
          [
            '<!doctype html><html><body><p id="fontara-related-blob-text">متن فارسی در blob</p></body></html>'
          ],
          { type: "text/html" }
        )
      )
      window.__fontaraRelatedFrameBlobUrl = blobUrl
      const blobFrame = document.createElement("iframe")
      blobFrame.id = "fontara-related-blob"
      await mountFrame(blobFrame, (frame) => {
        frame.src = blobUrl
      })
    })

    const relatedFrameState = await waitFor(
      async () => {
        const state = await evaluate(testPage, () => {
          const fixtures = [
            [
              "about:blank",
              "#fontara-related-about-blank",
              "#fontara-related-about-blank-text"
            ],
            [
              "srcdoc",
              "#fontara-related-srcdoc",
              "#fontara-related-srcdoc-text"
            ],
            ["blob", "#fontara-related-blob", "#fontara-related-blob-text"]
          ]

          return fixtures.map(([name, frameSelector, textSelector]) => {
            const frame = document.querySelector(frameSelector)
            const target = frame?.contentDocument?.querySelector(textSelector)
            return {
              fontFamily: target ? getComputedStyle(target).fontFamily : "",
              hasFontaraStyle: Boolean(
                frame?.contentDocument?.getElementById("fontara-dynamic-font")
              ),
              name,
              url: frame?.contentWindow?.location.href ?? ""
            }
          })
        })

        return state.every(
          (frame) =>
            frame.hasFontaraStyle && frame.fontFamily.includes("Samim-Fontara")
        )
          ? state
          : false
      },
      {
        message:
          "FontARA did not initialize in every related about:blank, srcdoc, and blob frame.",
        timeout: 20_000
      }
    )

    assert.deepEqual(
      relatedFrameState.map((frame) => frame.name),
      ["about:blank", "srcdoc", "blob"]
    )
    assert.equal(relatedFrameState[0].url, "about:blank")
    assert.equal(relatedFrameState[1].url, "about:srcdoc")
    assert.match(relatedFrameState[2].url, /^blob:http:\/\/127\.0\.0\.1:/)

    await evaluate(testPage, () => {
      if (window.__fontaraRelatedFrameBlobUrl) {
        URL.revokeObjectURL(window.__fontaraRelatedFrameBlobUrl)
        delete window.__fontaraRelatedFrameBlobUrl
      }
    })
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
    await clickByTestId(optionsPage, "fontara-sites-tab-profiles")
    await clickByTestId(optionsPage, "fontara-site-profile-target-trigger")
    await setValueByTestId(
      optionsPage,
      "fontara-site-profile-target-search",
      sitePattern
    )
    await clickByTestId(optionsPage, "fontara-site-profile-target-add")
    await clickByTestId(optionsPage, "fontara-site-profile-font-select")
    await clickByTestId(
      optionsPage,
      "fontara-site-profile-font-option-Samim-Fontara"
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

    await clickByTestId(optionsPage, "fontara-context-menus-toggle")
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
      true
    )
    assert.equal(
      await optionsPage.evaluate(
        () =>
          new Promise((resolve) => {
            chrome.permissions.contains(
              { permissions: ["contextMenus"] },
              resolve
            )
          })
      ),
      true
    )

    await clickByTestId(optionsPage, "fontara-context-menus-toggle")
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
      false
    )
    assert.equal(
      await optionsPage.evaluate(
        () =>
          new Promise((resolve) => {
            chrome.permissions.contains(
              { permissions: ["contextMenus"] },
              resolve
            )
          })
      ),
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
