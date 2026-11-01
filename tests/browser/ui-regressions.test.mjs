import assert from "node:assert/strict"
import test from "node:test"

import {
  clickByTestId,
  STORAGE_KEYS,
  sendSettingsFromOptions,
  setValueByTestId,
  waitFor,
  waitForExtensionLocalValue,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

test("Chrome browser clicks wait for moving controls without repeating activation", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const page = await harness.createFixturePage()
    await page.evaluate(async () => {
      const button = document.createElement("button")
      button.dataset.testid = "fontara-moving-control"
      button.textContent = "Moving control"
      button.style.cssText =
        "position:fixed;top:20px;left:20px;width:160px;height:60px;z-index:2147483647"
      document.body.append(button)
      const movement = button.animate(
        { transform: ["translateX(0px)", "translateX(200px)"] },
        { duration: 500, fill: "forwards" }
      )
      window.__fontaraMovingControlClicks = []
      button.addEventListener("click", (event) => {
        window.__fontaraMovingControlClicks.push({
          trusted: event.isTrusted,
          movement: movement.playState
        })
      })
      await movement.ready
    })
    await clickByTestId(page, "fontara-moving-control")
    assert.deepEqual(
      await page.evaluate(() => window.__fontaraMovingControlClicks),
      [{ trusted: true, movement: "finished" }]
    )
  })
})

async function openProfiles(page) {
  await clickByTestId(page, "fontara-options-nav-sites")
  await clickByTestId(page, "fontara-sites-tab-profiles")
}

test("Chrome MV3 editing a saved system-font profile preserves its font without opening the catalog", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    for (const systemFontsEnabled of [false, true]) {
      await t.test(
        `source ${systemFontsEnabled ? "enabled" : "paused"}`,
        async () => {
          const page = await harness.createExtensionPage(
            "ui/options/index.html"
          )
          const profile = {
            font: "system-font:Arial",
            pattern: "example.com",
            textStroke: 0.1
          }
          await sendSettingsFromOptions(page, {
            uiLanguage: "en",
            [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
            [STORAGE_KEYS.SITE_PROFILES]: [profile],
            [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: systemFontsEnabled,
            [STORAGE_KEYS.SYNC_SETTINGS]: false
          })
          await page.reload({ waitUntil: "load" })
          await openProfiles(page)
          const rowSelector = `[data-testid="fontara-site-profile-row-${profile.pattern}"]`
          await page.waitForSelector(rowSelector)
          await page.click(`${rowSelector} button[aria-label*="Edit"]`)
          await waitFor(
            () =>
              page.$eval(
                '[data-testid="fontara-site-profile-font-select"]',
                (element) => element.textContent.includes("Arial")
              ),
            {
              message:
                "Editing replaced the saved system font with the global font."
            }
          )
          await setValueByTestId(
            page,
            "fontara-site-profile-stroke-range",
            "0.5"
          )
          // The extracted controller must retain a draft while another section is visible.
          await clickByTestId(page, "fontara-options-nav-general")
          await openProfiles(page)
          await page.waitForFunction(
            () =>
              document.querySelector(
                '[data-testid="fontara-site-profile-stroke-range"]'
              )?.value === "0.5"
          )
          await clickByTestId(page, "fontara-site-profile-save")
          await waitForExtensionLocalValue(page, STORAGE_KEYS.SITE_PROFILES, [
            { ...profile, textStroke: 0.5 }
          ])
          await page.close()
        }
      )
    }
  })
})

test("Chrome MV3 portaled font previews use each row's font in dialogs and drawers", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    for (const width of [360, 1440]) {
      await t.test(width < 768 ? "drawer" : "dialog", async () => {
        const page = await harness.createExtensionPage("ui/popup/index.html", {
          viewport: { height: 900, width }
        })
        await sendSettingsFromOptions(page, {
          uiLanguage: "en",
          [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara",
          [STORAGE_KEYS.SYNC_SETTINGS]: false
        })
        await page.waitForFunction(() =>
          document.documentElement.style
            .getPropertyValue("--fontara-ui-font")
            .includes("Samim-Fontara")
        )
        await clickByTestId(page, "fontara-font-selector-trigger")
        const rowSelector =
          '[data-testid="fontara-font-option-Vazirmatn-Fontara"]'
        await page.waitForSelector(rowSelector, { visible: true })
        const preview = await page.$eval(rowSelector, (row) => {
          const text = row.querySelector(".fontara-font-preview")
          return {
            fontFamily: getComputedStyle(text).fontFamily,
            insideRoot: Boolean(row.closest("#root"))
          }
        })
        if (width >= 768) {
          assert.equal(
            preview.insideRoot,
            false,
            "The dialog regression must exercise a portal outside the app root."
          )
        }
        assert.match(preview.fontFamily, /^"?Vazirmatn-Fontara"?(?:,|$)/)
        assert.doesNotMatch(preview.fontFamily, /Samim-Fontara/)
        await page.close()
      })
    }
  })
})

test("Chrome MV3 a delayed Google profile save preserves profiles changed during preparation", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const page = await harness.createExtensionPage("ui/options/index.html")
    const initialProfile = { font: "Samim-Fontara", pattern: "example.com" }
    await sendSettingsFromOptions(page, {
      uiLanguage: "en",
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
      [STORAGE_KEYS.SITE_PROFILES]: [initialProfile],
      [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await page.reload({ waitUntil: "load" })
    await openProfiles(page)
    await page.click(
      '[data-testid="fontara-site-profile-row-example.com"] button[aria-label*="Edit"]'
    )
    await clickByTestId(page, "fontara-site-profile-font-select")
    const robotoOptionTestId =
      "fontara-site-profile-font-option-google-font:Roboto"
    await page.waitForSelector(`[data-testid="${robotoOptionTestId}"]`)
    // Radix preserves the focused item when its scroll buttons mount. Use
    // typeahead so scrolling the long catalog and moving focus happen together.
    await page.keyboard.type("Roboto")
    await page.waitForFunction(
      (testId) =>
        document.activeElement?.getAttribute("data-testid") === testId,
      {},
      robotoOptionTestId
    )
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => {
      const select = document.querySelector(
        '[data-testid="fontara-site-profile-font-select"]'
      )
      return (
        select?.getAttribute("aria-expanded") === "false" &&
        select.textContent === "Roboto"
      )
    })
    // Hold the preparation acknowledgment at the transport boundary. The UI
    // race is independent of the font network/cache implementation.
    await page.evaluate(() => {
      const sendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)
      chrome.runtime.sendMessage = (message, ...args) => {
        if (message.type === "fontara-ui-bg-google-font-prepare") {
          window.__fontaraReleaseProfilePreparation = () =>
            args[0]({ data: {} })
          return
        }
        return sendMessage(message, ...args)
      }
    })
    await clickByTestId(page, "fontara-site-profile-save")
    await page.waitForFunction(
      () => typeof window.__fontaraReleaseProfilePreparation === "function"
    )
    const otherProfile = { pattern: "other.example", textStroke: 0.3 }
    await sendSettingsFromOptions(page, {
      [STORAGE_KEYS.SITE_PROFILES]: [initialProfile, otherProfile]
    })
    await page.waitForSelector(
      '[data-testid="fontara-site-profile-row-other.example"]'
    )
    await page.evaluate(() => window.__fontaraReleaseProfilePreparation())
    await waitForExtensionLocalValue(page, STORAGE_KEYS.SITE_PROFILES, [
      { ...initialProfile, font: "google-font:Roboto" },
      otherProfile
    ])
  })
})
