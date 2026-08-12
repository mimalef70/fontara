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
  setValueByTestId,
  uploadFilesByTestId,
  waitFor,
  waitForContentBridge,
  waitForExtensionLocalValue,
  withChromeMv3ExtensionHarness,
  withFirefoxMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

const SAMPLE_TEXT = "آزمایش خانواده فونت ایران یکان ۱۲۳۴۵"
const EXPECTED_WEIGHTS = [400, 700]

async function waitForPreparedFontFile(page, slot, filePath) {
  const expectedFileName = path.basename(filePath).normalize("NFKC")
  const readySelector = `[data-testid="fontara-custom-font-${slot}-ready"]`
  const inputSelector = `[data-testid="fontara-custom-font-${slot}-file"]`

  await waitFor(
    () =>
      page
        .$eval(
          readySelector,
          (element, expectedName) =>
            (element.textContent ?? "").includes(expectedName),
          expectedFileName
        )
        .catch(() => false),
    {
      message: `FontARA did not prepare ${expectedFileName}.`,
      timeout: 30_000
    }
  )

  await waitFor(
    () =>
      page.$eval(
        inputSelector,
        (element) => element instanceof HTMLInputElement && !element.disabled
      ),
    {
      message: `FontARA did not finish validating ${expectedFileName}.`,
      timeout: 30_000
    }
  )
}

function findRegularBoldPair(fontPaths) {
  const regularPath = fontPaths.find((filePath) =>
    path
      .basename(filePath, path.extname(filePath))
      .toLowerCase()
      .includes("regular")
  )
  const boldPath = fontPaths.find((filePath) => {
    const stem = path.basename(filePath, path.extname(filePath)).toLowerCase()
    return (
      stem.endsWith("bold") &&
      !/(?:extra|ultra|semi|demi)[-_\s]*bold$/i.test(stem)
    )
  })

  return regularPath && boldPath ? { regularPath, boldPath } : null
}

async function getLocalFontPair(testContext) {
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
  const pair = findRegularBoldPair(fontPaths)
  assert.ok(pair, "The local font directory needs Regular and Bold files.")
  return pair
}

async function collectFontPairs(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nestedPairs = []
  const filesByExtension = new Map()
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      nestedPairs.push(...(await collectFontPairs(entryPath)))
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

  const localPairs = [...filesByExtension.values()]
    .map((files) => findRegularBoldPair(files.sort()))
    .filter(Boolean)
  return [...localPairs, ...nestedPairs]
}

async function validateEveryLocalFontPair(testContext, withHarness) {
  const directory = process.env.FONTARA_LOCAL_FONT_FAMILY_DIR
  if (!directory) {
    testContext.skip(
      "Set FONTARA_LOCAL_FONT_FAMILY_DIR to a local font directory."
    )
    return
  }
  const pairs = await collectFontPairs(path.resolve(directory))
  assert.ok(pairs.length > 0)

  await withHarness(testContext, async (harness) => {
    const optionsPage = await harness.createExtensionPage(
      "ui/options/index.html"
    )
    await clickByTestId(optionsPage, "fontara-options-nav-fonts")
    await setValueByTestId(
      optionsPage,
      "fontara-custom-font-name",
      "Local package validation"
    )

    for (const { regularPath, boldPath } of pairs) {
      await uploadFilesByTestId(
        optionsPage,
        "fontara-custom-font-regular-file",
        [regularPath]
      )
      await waitForPreparedFontFile(optionsPage, "regular", regularPath)
      await uploadFilesByTestId(optionsPage, "fontara-custom-font-bold-file", [
        boldPath
      ])
      await waitForPreparedFontFile(optionsPage, "bold", boldPath)
      await waitFor(
        () =>
          optionsPage.$eval(
            '[data-testid="fontara-custom-font-add"]',
            (element) =>
              element instanceof HTMLButtonElement && !element.disabled
          ),
        {
          message: `FontARA did not validate ${path.basename(regularPath)} and ${path.basename(boldPath)}.`,
          timeout: 30_000
        }
      )
      const feedbackCount = await optionsPage.$$eval(
        '[role="alert"]',
        (elements) => elements.length
      )
      assert.equal(feedbackCount, 0)
    }

    const duplicatePath = pairs[0].regularPath
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-regular-file", [
      duplicatePath
    ])
    await waitForPreparedFontFile(optionsPage, "regular", duplicatePath)
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-bold-file", [
      duplicatePath
    ])
    const duplicateFeedback = await waitFor(
      () =>
        optionsPage
          .$eval(
            '[data-testid="fontara-custom-font-bold-error"]',
            (element) => element.textContent ?? ""
          )
          .then((text) => (text.trim() ? text : false)),
      { message: "The duplicate-file guidance was not shown." }
    )
    assert.match(duplicateFeedback, /already|قبلاً|مسبقًا/i)
  })
}

async function verifyLocalFontFamily(testContext, withHarness) {
  const pair = await getLocalFontPair(testContext)
  if (!pair) return

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
    await setValueByTestId(optionsPage, "fontara-custom-font-name", "IRANYekan")
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-regular-file", [
      pair.regularPath
    ])
    await waitForPreparedFontFile(optionsPage, "regular", pair.regularPath)
    await uploadFilesByTestId(optionsPage, "fontara-custom-font-bold-file", [
      pair.boldPath
    ])
    await waitForPreparedFontFile(optionsPage, "bold", pair.boldPath)
    await clickByTestId(optionsPage, "fontara-custom-font-add")

    const family = await waitFor(
      async () => {
        const values = await getExtensionLocalValues(optionsPage, [
          STORAGE_KEYS.CUSTOM_FONT_LIST
        ])
        const families = values[STORAGE_KEYS.CUSTOM_FONT_LIST]
        const candidate = Array.isArray(families) ? families[0] : null
        return candidate?.faces?.length === 2 ? candidate : false
      },
      {
        message: "The local Regular/Bold font pair was not committed.",
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
          return lastRuntimeState.checked && lastRuntimeState.faceCount === 2
            ? lastRuntimeState
            : false
        },
        {
          message: "The local Regular/Bold family did not load in the page.",
          timeout: 30_000
        }
      )
    } catch (error) {
      throw new Error(
        `The local Regular/Bold family did not load. Last state: ${JSON.stringify(lastRuntimeState)}`,
        { cause: error }
      )
    }
    assert.match(runtimeState.computedFamily, new RegExp(family.value))
    assert.equal(runtimeState.hasDataFont, false)
    assert.ok(runtimeState.statuses.every((status) => status === "loaded"))
  })
}

test("Chrome imports and applies a local Regular/Bold font pair", async (t) => {
  await verifyLocalFontFamily(t, withChromeMv3ExtensionHarness)
})

test("Chrome validates every local Regular/Bold package pair", async (t) => {
  await validateEveryLocalFontPair(t, withChromeMv3ExtensionHarness)
})

test("Firefox imports and applies a local Regular/Bold font pair", async (t) => {
  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip("Set FONTARA_FIREFOX_BROWSER_TESTS=1 to run Firefox.")
    return
  }
  await verifyLocalFontFamily(t, withFirefoxMv3ExtensionHarness)
})

test("Firefox validates every local Regular/Bold package pair", async (t) => {
  if (process.env.FONTARA_FIREFOX_BROWSER_TESTS !== "1") {
    t.skip("Set FONTARA_FIREFOX_BROWSER_TESTS=1 to run Firefox.")
    return
  }
  await validateEveryLocalFontPair(t, withFirefoxMv3ExtensionHarness)
})
