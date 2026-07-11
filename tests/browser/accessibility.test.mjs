import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

import {
  clickByTestId,
  waitFor,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

const require = createRequire(import.meta.url)
const AXE_SOURCE_PATH = require.resolve("axe-core/axe.min.js")
const ACCESSIBILITY_LOCALES = ["en", "fa", "ar"]
const ACCESSIBILITY_VIEWPORTS = {
  desktop: { height: 800, width: 1280 },
  mobile: { height: 844, isMobile: true, width: 390 }
}

async function setUILanguage(page, language) {
  await page.evaluate(
    (nextLanguage) =>
      new Promise((resolve, reject) => {
        chrome.storage.local.set({ uiLanguage: nextLanguage }, () => {
          const error = chrome.runtime.lastError
          if (error) reject(new Error(error.message))
          else resolve(true)
        })
      }),
    language
  )
}

async function waitForSurfaceReady(page, surface) {
  if (surface === "options") {
    await page.waitForFunction(
      () =>
        document
          .querySelector("#fontara-options-panel")
          ?.getAttribute("aria-busy") === "false"
    )
    return
  }

  await page.waitForSelector("[data-testid='fontara-font-selector-trigger']")
}

async function runAxe(page) {
  const hasAxe = await page.evaluate(() => Boolean(globalThis.axe))
  if (!hasAxe) await page.addScriptTag({ path: AXE_SOURCE_PATH })
  return page.evaluate(async () => {
    const result = await globalThis.axe.run(document, {
      resultTypes: ["violations"],
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
      }
    })

    return result.violations.map((violation) => ({
      help: violation.help,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" "))
    }))
  })
}

function formatViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes.join("\n")}`
    )
    .join("\n\n")
}

test("Chrome MV3 popup and options pass axe in en/fa/ar on mobile and desktop", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    for (const [viewportName, viewport] of Object.entries(
      ACCESSIBILITY_VIEWPORTS
    )) {
      for (const language of ACCESSIBILITY_LOCALES) {
        for (const surface of ["options", "popup"]) {
          await t.test(`${surface} ${language} ${viewportName}`, async () => {
            const relativePath =
              surface === "options"
                ? "ui/options/index.html"
                : "ui/popup/index.html"
            const page = await harness.createExtensionPage(relativePath, {
              viewport
            })
            await page.setBypassCSP(true)
            await setUILanguage(page, language)
            await page.reload({ waitUntil: "load" })
            await waitForSurfaceReady(page, surface)

            const violations = await runAxe(page)
            assert.equal(violations.length, 0, formatViolations(violations))
            if (surface === "options" && language === "fa") {
              await clickByTestId(page, "fontara-font-selector-trigger")
              await page.waitForSelector("#fontara-font-selector-dialog")
              const openPickerViolations = await runAxe(page)
              assert.equal(
                openPickerViolations.length,
                0,
                formatViolations(openPickerViolations)
              )
            }
            await page.close()
          })
        }
      }
    }
  })
})

test("Chrome MV3 options navigation works by keyboard and closes on mobile", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const desktopPage = await harness.createExtensionPage(
      "ui/options/index.html",
      { viewport: ACCESSIBILITY_VIEWPORTS.desktop }
    )
    await waitForSurfaceReady(desktopPage, "options")
    await desktopPage.focus("[data-testid='fontara-options-nav-general']")
    await desktopPage.keyboard.press("ArrowDown")
    await waitFor(
      () =>
        desktopPage.$eval(
          "[data-testid='fontara-options-nav-fonts']",
          (element) => element.getAttribute("aria-selected") === "true"
        ),
      { message: "ArrowDown did not select the next settings section." }
    )
    assert.equal(new URL(desktopPage.url()).hash, "#fonts")

    const mobilePage = await harness.createExtensionPage(
      "ui/options/index.html",
      { viewport: ACCESSIBILITY_VIEWPORTS.mobile }
    )
    await waitForSurfaceReady(mobilePage, "options")
    await mobilePage.click("[data-sidebar='trigger']")
    await clickByTestId(mobilePage, "fontara-options-nav-sites")
    await waitFor(
      () =>
        mobilePage.$eval(
          "[data-sidebar='trigger']",
          (element) => element.getAttribute("aria-expanded") === "false"
        ),
      { message: "The mobile settings sheet remained open after navigation." }
    )
  })
})
