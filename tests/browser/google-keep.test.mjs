import assert from "node:assert/strict"
import test from "node:test"

import {
  STORAGE_KEYS,
  sendSettingsFromContentBridge,
  waitForContentBridge,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

test("Chrome MV3 applies the selected font to a Keep-style notes grid", async (context) => {
  await withChromeMv3ExtensionHarness(context, async (harness) => {
    const page = await harness.createFixturePage()
    await waitForContentBridge(page)
    await page.evaluate(() => {
      document.body.innerHTML = `
        <main aria-label="Notes">
          <article aria-label="Test note">
            <div class="note-title" contenteditable="true">سلام عنوان آزمایشی</div>
            <div class="note-body" contenteditable="true"><span>سلام متن یادداشت</span></div>
          </article>
        </main>`
      const style = document.createElement("style")
      style.textContent =
        ".note-title, .note-body { font-family: Arial !important; }"
      document.head.append(style)
    })
    await sendSettingsFromContentBridge(page, {
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [`127.0.0.1:${harness.server.port}`],
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
    })
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".note-title, .note-body")].every(
        (element) =>
          getComputedStyle(element).fontFamily.includes("Vazirmatn-Fontara")
      )
    )
    const fonts = await page.$$eval(".note-title, .note-body", (elements) =>
      elements.map((element) => getComputedStyle(element).fontFamily)
    )
    assert.equal(fonts.length, 2)
    assert.equal(
      await page.evaluate(() =>
        document.fonts.check('16px "Vazirmatn-Fontara"', "سلام")
      ),
      true,
      "the selected font face must be loaded, not just named in computed CSS"
    )
  })
})
