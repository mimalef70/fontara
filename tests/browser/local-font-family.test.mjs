import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  clickByTestId,
  evaluate,
  getExtensionLocalValues,
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  sendSettingsFromOptions,
  uploadFilesByTestId,
  waitFor,
  waitForContentBridge,
  waitForExtensionLocalValue,
  withChromeMv3ExtensionHarness,
  withFirefoxMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

const SAMPLE_TEXT = "آزمایش خانواده فونت ایران یکان ۱۲۳۴۵"
const EXPECTED_WEIGHTS = [100, 300, 400, 500, 700, 800, 900, 950]

async function getLocalFontPaths(testContext) {
  const directory = process.env.FONTARA_LOCAL_FONT_FAMILY_DIR
  if (!directory) {
    testContext.skip(
      "Set FONTARA_LOCAL_FONT_FAMILY_DIR to a local font directory."
    )
    return null
  }

  const absoluteDirectory = path.resolve(directory)
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true })
  const fontPaths = entries
    .filter(
      (entry) => entry.isFile() && /\.(?:otf|ttf|woff|woff2)$/i.test(entry.name)
    )
    .map((entry) => path.join(absoluteDirectory, entry.name))
    .sort()
  assert.ok(fontPaths.length > 0, "The local font directory has no font files.")
  return fontPaths
}

async function collectFontSelections(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nestedSelections = []
  const filesByExtension = new Map()
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      nestedSelections.push(...(await collectFontSelections(entryPath)))
      continue
    }
    if (!entry.isFile() || !/\.(?:otf|ttf|woff|woff2)$/i.test(entry.name)) {
      continue
    }
    const extension = path.extname(entry.name).toLowerCase()
    const files = filesByExtension.get(extension) ?? []
    files.push(entryPath)
    filesByExtension.set(extension, files)
  }

  return [
    ...[...filesByExtension.values()].map((files) => files.sort()),
    ...nestedSelections
  ]
}

async function validateEveryLocalFontSelection(testContext, withHarness) {
  const directory = process.env.FONTARA_LOCAL_FONT_FAMILY_DIR
  if (!directory) {
    testContext.skip(
      "Set FONTARA_LOCAL_FONT_FAMILY_DIR to a local font directory."
    )
    return
  }
  const selections = await collectFontSelections(path.resolve(directory))
  assert.ok(selections.length > 0)

  await withHarness(testContext, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    await clickByTestId(optionsPage, "fontara-options-nav-fonts")

    for (const fontPaths of selections) {
      await uploadFilesByTestId(
        optionsPage,
        "fontara-custom-font-file",
        fontPaths
      )
      await waitFor(
        () =>
          optionsPage
            .$eval(
              '[data-testid="fontara-custom-font-add"]',
              (element) =>
                element instanceof HTMLButtonElement && element.disabled
            )
            .catch(() => false),
        { message: "Font validation did not start." }
      )
      await waitFor(
        () =>
          optionsPage.$eval(
            '[data-testid="fontara-custom-font-add"]',
            (element) =>
              element instanceof HTMLButtonElement && !element.disabled
          ),
        {
          message: `FontARA did not validate ${fontPaths.map((filePath) => path.basename(filePath)).join(", ")}.`,
          timeout: 30_000
        }
      )
      await optionsPage.waitForSelector(
        '[data-testid="fontara-custom-font-selection-ready"]'
      )
      const feedbackCount = await optionsPage.$$eval(
        '[role="alert"]',
        (elements) => elements.length
      )
      assert.equal(feedbackCount, 0)
    }

    const absoluteDirectory = path.resolve(directory)
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-file", [
      path.join(absoluteDirectory, "IRANYekanRegular.ttf"),
      path.join(absoluteDirectory, "Farsi_numerals/IRANYekanRegularFaNum.ttf")
    ])
    const mixedFamilyFeedback = await waitFor(
      () =>
        optionsPage
          .$eval('[role="alert"]', (element) => element.textContent ?? "")
          .then((text) =>
            text.includes("IRANYekan") && text.includes("IRANYekanFN")
              ? text
              : false
          ),
      { message: "The mixed-family guidance was not shown." }
    )
    assert.match(mixedFamilyFeedback, /IRANYekanFN/)

    const duplicateFacePaths = [
      path.join(
        absoluteDirectory,
        "WebFonts/fonts/ttf/iranyekanwebregular.ttf"
      ),
      path.join(
        absoluteDirectory,
        "WebFonts/fonts/woff/iranyekanwebregular.woff"
      )
    ]
    await uploadFilesByTestId(
      optionsPage,
      "fontara-custom-font-file",
      duplicateFacePaths
    )
    const duplicateFaceFeedback = await waitFor(
      () =>
        optionsPage
          .$eval('[role="alert"]', (element) => element.textContent ?? "")
          .then((text) =>
            duplicateFacePaths.every((filePath) =>
              text.includes(path.basename(filePath))
            )
              ? text
              : false
          ),
      { message: "The duplicate-face guidance was not shown." }
    )
    assert.match(duplicateFaceFeedback, /iranyekanwebregular\.woff/)
  })
}

async function verifyLocalFontFamily(testContext, withHarness) {
  const fontPaths = await getLocalFontPaths(testContext)
  if (!fontPaths) return

  await withHarness(testContext, async (harness) => {
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
    await uploadFilesByTestId(
      optionsPage,
      "fontara-custom-font-file",
      fontPaths
    )
    await optionsPage.waitForSelector(
      '[data-testid="fontara-custom-font-selection-ready"]'
    )
    const detectedName = await optionsPage.$eval(
      '[data-testid="fontara-custom-font-name"]',
      (element) => element.value
    )
    assert.equal(detectedName, "IRANYekan")
    await clickByTestId(optionsPage, "fontara-custom-font-add")

    const family = await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, [
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ])
        const families = values[STORAGE_KEYS.CUSTOM_FONT_LIST]
        const candidate = Array.isArray(families) ? families[0] : null
        return candidate?.faces?.length === fontPaths.length ? candidate : false
      },
      {
        message: "The local multi-weight font family was not committed.",
        timeout: 30_000
      }
    )
    assert.equal(family.displayName, "IRANYekan")
    assert.equal(family.sourceFamilyKey, "iranyekan")
    assert.deepEqual(
      family.faces.map((face) => face.weight.min).sort((a, b) => a - b),
      EXPECTED_WEIGHTS
    )
    assert.ok(family.faces.every((face) => face.validation === "verified"))

    const selectionAfterAdd = await getExtensionLocalValues(optionsPage, [
      STORAGE_KEYS.SELECTED_FONT
    ])
    assert.equal(
      selectionAfterAdd[STORAGE_KEYS.SELECTED_FONT],
      "Vazirmatn-Fontara"
    )

    await sendSettingsFromOptions(optionsPage, {
      [STORAGE_KEYS.SELECTED_FONT]: family.value
    })
    await waitForExtensionLocalValue(
      optionsPage,
      STORAGE_KEYS.SELECTED_FONT,
      family.value
    )

    let lastRuntimeState = null
    let runtimeState
    try {
      runtimeState = await waitFor(
        async () => {
          lastRuntimeState = await evaluate(
            testPage,
            async (familyValue, weights, sampleText) => {
              const quotedFamily = `"${familyValue}"`
              const loadedFaces = (
                await Promise.all(
                  weights.map((weight) =>
                    document.fonts.load(
                      `${weight} 32px ${quotedFamily}`,
                      sampleText
                    )
                  )
                )
              ).flat()
              await document.fonts.ready
              const normalizeFamily = (value) =>
                value.replace(/^["']|["']$/g, "")
              const familyFaces = Array.from(
                new Set(
                  [...Array.from(document.fonts), ...loadedFaces].filter(
                    (fontFace) =>
                      normalizeFamily(fontFace.family) === familyValue
                  )
                )
              )
              const target = document.getElementById("fontara-text")
              return {
                checked: weights.every((weight) =>
                  document.fonts.check(
                    `${weight} 32px ${quotedFamily}`,
                    sampleText
                  )
                ),
                computedFamily: target
                  ? getComputedStyle(target).fontFamily
                  : "",
                faceCount: familyFaces.length,
                hasDataFont: /data:font/i.test(
                  document.documentElement.outerHTML
                ),
                statuses: familyFaces.map((face) => face.status)
              }
            },
            family.value,
            EXPECTED_WEIGHTS,
            SAMPLE_TEXT
          )
          return lastRuntimeState.checked &&
            lastRuntimeState.faceCount === fontPaths.length
            ? lastRuntimeState
            : false
        },
        {
          message: "The local multi-weight family did not load in the page.",
          timeout: 30_000
        }
      )
    } catch (error) {
      throw new Error(
        `The local multi-weight family did not load. Last state: ${JSON.stringify(lastRuntimeState)}`,
        { cause: error }
      )
    }
    assert.match(runtimeState.computedFamily, new RegExp(family.value))
    assert.equal(runtimeState.hasDataFont, false)
    assert.ok(runtimeState.statuses.every((status) => status === "loaded"))
  })
}

test("Chrome imports and applies a local multi-weight font family", async (t) => {
  await verifyLocalFontFamily(t, withChromeMv3ExtensionHarness)
})

test("Chrome validates every local font package selection", async (t) => {
  await validateEveryLocalFontSelection(t, withChromeMv3ExtensionHarness)
})

test("Firefox imports and applies a local multi-weight font family", async (t) => {
  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip("Set FONTARA_FIREFOX_BROWSER_TESTS=1 to run Firefox.")
    return
  }
  await verifyLocalFontFamily(t, withFirefoxMv3ExtensionHarness)
})

test("Firefox validates every local font package selection", async (t) => {
  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip("Set FONTARA_FIREFOX_BROWSER_TESTS=1 to run Firefox.")
    return
  }
  await validateEveryLocalFontSelection(t, withFirefoxMv3ExtensionHarness)
})
