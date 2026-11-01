import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { build } from "esbuild"
import puppeteer from "puppeteer-core"

import { findChromeBinary } from "../support/browser/extension-harness.mjs"

let runtimeBundle

async function withRuntimePage(context, callback) {
  const executablePath = await findChromeBinary()
  if (!executablePath) {
    context.skip("Chrome or Chromium was not found on this machine.")
    return
  }
  runtimeBundle ??= build({
    bundle: true,
    format: "iife",
    globalName: "FontaraRegressionRuntime",
    stdin: {
      contents: `
        export { createRtlSiteAdapter } from "./src/inject/rtl/site-adapters";
        export { RtlEngine } from "./src/inject/rtl/rtl-engine";
        export { createTextStrokeCSS } from "./src/generators/text-stroke";
      `,
      resolveDir: process.cwd()
    },
    write: false
  })
  const browser = await puppeteer.launch({
    args:
      process.env.CI === "true"
        ? ["--no-sandbox", "--disable-dev-shm-usage"]
        : [],
    executablePath,
    headless: true,
    pipe: true
  })
  try {
    const page = await browser.newPage()
    await page.setContent("<html><head></head><body></body></html>")
    await page.addScriptTag({
      content: (await runtimeBundle).outputFiles[0].text
    })
    await callback(page)
  } finally {
    await browser.close()
  }
}

test("Chrome text stroke protects code and icon subtrees from inheritance", async (context) => {
  await withRuntimePage(context, async (page) => {
    const result = await page.evaluate(() => {
      document.body.innerHTML = `
        <p id="text">Readable text</p>
        <p id="owned-text" style="font-family: var(--fontara-font), serif">Readable FontARA text</p>
        <p style="font-family: serif"><span id="authored-font">Page-authored font</span></p>
        <pre id="pre"><code id="code"><span id="code-child">const x = 1</span></code></pre>
        <span id="icon" class="material-symbols-outlined">home</span>
        <span class="icon"><span id="icon-child">home</span></span>
        <span aria-hidden="true"><span id="hidden-child">symbol</span></span>
      `
      const style = document.createElement("style")
      style.textContent = FontaraRegressionRuntime.createTextStrokeCSS({
        widthPx: 0.5
      })
      document.head.appendChild(style)
      const read = () =>
        Object.fromEntries(
          [
            "text",
            "owned-text",
            "authored-font",
            "pre",
            "code",
            "code-child",
            "icon",
            "icon-child",
            "hidden-child"
          ].map((id) => [
            id,
            getComputedStyle(document.getElementById(id)).webkitTextStrokeWidth
          ])
        )
      const active = read()
      style.remove()
      return { active, removed: read() }
    })
    assert.equal(result.active.text, "0.5px")
    assert.equal(result.active["owned-text"], "0.5px")
    for (const [id, width] of Object.entries(result.active)) {
      if (id !== "text" && id !== "owned-text") {
        assert.equal(width, "0px", `${id} must stay protected`)
      }
    }
    assert.ok(Object.values(result.removed).every((width) => width === "0px"))
  })
})

const ADAPTER_FIXTURES = {
  chatgpt: '<div data-message-author-role="assistant">TEXT</div>',
  claude: '<div class="font-claude-message">TEXT</div>',
  gemini: '<div id="model-response-message-content-1">TEXT</div>',
  copilot: '<div data-message-id="message">TEXT</div>',
  perplexity: '<main><div data-testid="answer">TEXT</div></main>',
  openrouter:
    '<div data-testid="playground-chat-pane"><div data-testid="playground-message-list"><div data-message-id="message">TEXT</div></div></div>',
  deepseek: '<div class="ds-message">TEXT</div>',
  notebooklm: "<main>TEXT</main>",
  aistudio: "<ms-chat-session>TEXT</ms-chat-session>",
  qwen: '<div data-message-id="message">TEXT</div>',
  arena: '<div data-message-id="message">TEXT</div>'
}

test("Chrome RTL adapters restore reused messages after English and empty edits", async (context) => {
  await withRuntimePage(context, async (page) => {
    for (const [siteId, fixture] of Object.entries(ADAPTER_FIXTURES)) {
      await page.evaluate(
        ({ siteId, fixture }) => {
          document.body.innerHTML = fixture.replace(
            "TEXT",
            '<p id="message-text" style="text-align: center !important">سلام دنیا</p>'
          )
          window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter(siteId)
          window.adapter.enable()
        },
        { siteId, fixture }
      )
      await page.waitForFunction(
        () => document.querySelector("#message-text").dir === "rtl"
      )
      // A second RTL update exercises adapter caches as well as reconciliation.
      await page.$eval("#message-text", (element) => {
        element.firstChild.data = "سلام دوباره"
      })
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      assert.equal(
        await page.$eval("#message-text", (element) => element.dir),
        "rtl",
        siteId
      )
      await page.$eval("#message-text", (element) => {
        element.firstChild.data = "Hello world"
      })
      await page.waitForFunction(
        () => document.querySelector("#message-text").dir !== "rtl"
      )
      assert.deepEqual(
        await page.$eval("#message-text", (element) => ({
          align: element.style.textAlign,
          dir: element.getAttribute("dir"),
          priority: element.style.getPropertyPriority("text-align")
        })),
        { align: "center", dir: null, priority: "important" },
        siteId
      )
      await page.$eval("#message-text", (element) => {
        element.firstChild.data = "سلام دنیا"
      })
      await page.waitForFunction(
        () => document.querySelector("#message-text").dir === "rtl"
      )
      await page.$eval("#message-text", (element) => element.replaceChildren())
      await page.waitForFunction(
        () => document.querySelector("#message-text").dir !== "rtl"
      )
      await page.evaluate(() => window.adapter.dispose())
    }
  })
})

test("Chrome RTL queues yield during discovery/application and cancel pending work", async (context) => {
  await withRuntimePage(context, async (page) => {
    const result = await page.evaluate(() => {
      // Control only frame delivery: assertions measure work per turn rather
      // than timing thresholds that vary with CI CPU load.
      const frames = new Map()
      let nextFrame = 0
      window.requestAnimationFrame = (callback) => {
        frames.set(++nextFrame, callback)
        return nextFrame
      }
      window.cancelAnimationFrame = (id) => frames.delete(id)
      const runFrame = () => {
        const ready = [...frames.values()]
        frames.clear()
        ready.forEach((callback) => {
          callback(performance.now())
        })
      }
      document.body.innerHTML =
        "<i></i>".repeat(1500) + '<p class="message">سلام دنیا</p>'.repeat(120)
      let applications = 0
      const engine = new FontaraRegressionRuntime.RtlEngine({
        applyToMessage(element, currentEngine) {
          applications += 1
          currentEngine.applyRTL(element)
          return true
        },
        messageSelectors: [".message"]
      })
      engine.setEnabled(true)
      engine.scheduleScan(document.body)
      runFrame()
      const afterDiscoveryTurn = applications
      const continuationScheduled = frames.size > 0
      let turns = 1
      let maxApplicationsInOneTurn = 0
      while (frames.size > 0 && turns < 1000) {
        const before = applications
        runFrame()
        maxApplicationsInOneTurn = Math.max(
          maxApplicationsInOneTurn,
          applications - before
        )
        turns += 1
      }
      const fullyApplied = document.querySelectorAll(
        '.message[dir="rtl"]'
      ).length

      const removed = [...document.querySelectorAll(".message")].slice(0, 60)
      removed.forEach((element) => {
        element.remove()
      })
      engine.cleanupDetached()
      const largeTail = document.createElement("div")
      largeTail.innerHTML = "<i></i>".repeat(20_000)
      document.body.appendChild(largeTail)
      engine.scheduleScan(document.body)
      for (let turn = 0; turn < 20; turn += 1) runFrame()
      const cleanedWhileWorkPending =
        frames.size > 0 &&
        removed.every((element) => !element.hasAttribute("dir"))

      engine.scheduleScan(document.body)
      runFrame()
      const pendingCallback = [...frames.values()][0]
      engine.setEnabled(false)
      engine.restoreStyles()
      const beforeCancelled = applications
      pendingCallback?.(performance.now())
      const afterCancelled = applications
      const cancelledFrames = frames.size
      engine.dispose()
      return {
        afterCancelled,
        afterDiscoveryTurn,
        beforeCancelled,
        cancelledFrames,
        cleanedWhileWorkPending,
        continuationScheduled,
        fullyApplied,
        maxApplicationsInOneTurn,
        remainingStyles: document.querySelectorAll('.message[dir="rtl"]')
          .length,
        turns
      }
    })
    assert.equal(result.afterDiscoveryTurn, 0)
    assert.equal(result.continuationScheduled, true)
    assert.equal(result.fullyApplied, 120)
    assert.ok(result.turns > 1 && result.turns < 1000)
    assert.ok(
      result.maxApplicationsInOneTurn > 0 &&
        result.maxApplicationsInOneTurn <= 8
    )
    assert.equal(result.afterCancelled, result.beforeCancelled)
    assert.equal(result.cancelledFrames, 0)
    assert.equal(result.cleanedWhileWorkPending, true)
    assert.equal(result.remainingStyles, 0)
  })
})

test("Chrome RTL reconciliation updates nested message scopes and mixed-language siblings", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      document.body.innerHTML =
        '<article><section><p id="message-text">سلام دنیا</p></section></article>'
      window.engine = new FontaraRegressionRuntime.RtlEngine({
        messageSelectors: ["article", "section"]
      })
      window.engine.setEnabled(true)
      window.engine.init()
    })
    await page.waitForFunction(
      () => document.querySelectorAll('[dir="rtl"]').length === 3
    )
    await page.$eval("#message-text", (element) => {
      element.firstChild.data = "Hello world"
    })
    await page.waitForFunction(
      () => document.querySelectorAll('[dir="rtl"]').length === 0
    )
    await page.evaluate(() => {
      window.engine.dispose()
      document.body.innerHTML = `
        <article data-testid="conversation-turn">
          <div data-message-author-role="assistant">
            <p id="edited">سلام دنیا</p><p id="unchanged">سلام دوباره</p>
          </div>
        </article>
      `
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("chatgpt")
      window.adapter.enable()
    })
    await page.waitForFunction(
      () => document.querySelectorAll('p[dir="rtl"]').length === 2
    )
    await page.$eval("#edited", (element) => {
      element.firstChild.data = "Hello world"
    })
    await page.waitForFunction(
      () => !document.querySelector("#edited").hasAttribute("dir")
    )
    assert.equal(
      await page.$eval("#unchanged", (element) => element.dir),
      "rtl"
    )
    await page.evaluate(() => window.adapter.dispose())
  })
})

test("Chrome RTL observers follow a replaced body", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("chatgpt")
      window.adapter.enable()
      const body = document.createElement("body")
      body.innerHTML =
        '<div data-message-author-role="assistant"><p id="message-text">سلام دنیا</p></div>'
      document.body.replaceWith(body)
    })
    await page.waitForFunction(
      () => document.querySelector("#message-text").dir === "rtl"
    )
    await page.evaluate(() => window.adapter.dispose())
  })
})

test("Chrome Gemini RTL lists retain native markers and restore page styling", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <style>ol, ul, li { list-style-type: none; }</style>
        <div id="model-response-message-content-1">
          <ol id="ordered" start="4" reversed>
            <li id="first">سلام دنیا</li>
            <li>سلام دوباره<ul id="nested"><li id="bullet">سلام</li></ul></li>
            <li id="english" dir="ltr">English text</li>
          </ol>
          <ol id="mixed">
            <li>English explanation with several long technical words</li>
            <li id="mixed-rtl">سلام</li>
            <li>Another English explanation with even more technical terms</li>
          </ol>
        </div>
      `
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("gemini")
      window.adapter.enable()
    })
    await page.waitForFunction(
      () =>
        document.querySelector("#ordered").dir === "rtl" &&
        document.querySelector("#bullet").dir === "rtl"
    )
    const active = await page.evaluate(() => {
      const ordered = document.querySelector("#ordered")
      const first = document.querySelector("#first")
      const bullet = document.querySelector("#bullet")
      return {
        orderedType: getComputedStyle(first).listStyleType,
        bulletType: getComputedStyle(bullet).listStyleType,
        firstDirection: getComputedStyle(first).direction,
        englishDirection: getComputedStyle(document.querySelector("#english"))
          .direction,
        start: ordered.start,
        reversed: ordered.reversed,
        before: getComputedStyle(first, "::before").content,
        mixedDirection: document.querySelector("#mixed").getAttribute("dir"),
        mixedType: getComputedStyle(document.querySelector("#mixed-rtl"))
          .listStyleType
      }
    })
    assert.deepEqual(active, {
      orderedType: "decimal",
      bulletType: "circle",
      firstDirection: "rtl",
      englishDirection: "ltr",
      start: 4,
      reversed: true,
      before: "none",
      mixedDirection: null,
      mixedType: "decimal"
    })
    await page.evaluate(() => window.adapter.disable())
    assert.deepEqual(
      await page.evaluate(() => ({
        direction: document.querySelector("#ordered").getAttribute("dir"),
        englishDirection: document
          .querySelector("#english")
          .getAttribute("dir"),
        marker: getComputedStyle(document.querySelector("#first"))
          .listStyleType,
        styles: document.querySelectorAll("style[data-fontara-rtl]").length
      })),
      { direction: null, englishDirection: "ltr", marker: "none", styles: 0 }
    )
    await page.evaluate(() => window.adapter.dispose())
  })
})

test("Chrome Claude code and math guards restore original direction and alignment", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <article>
          <p>سلام دنیا</p>
          <pre id="code" dir="auto" style="text-align: center !important">سلام</pre>
          <pre id="plain-code">const answer = 42</pre>
          <div class="katex-display" style="text-align: center">
            <span id="math" class="katex" dir="auto">x + y</span>
          </div>
          <div id="role-math" role="math" dir="auto" style="text-align: center !important">a + b</div>
        </article>
      `
      window.readGuards = () =>
        Object.fromEntries(
          ["code", "plain-code", "math", "role-math"].map((id) => {
            const element = document.getElementById(id)
            return [
              id,
              {
                dir: element.getAttribute("dir"),
                direction: element.style.getPropertyValue("direction"),
                directionPriority:
                  element.style.getPropertyPriority("direction"),
                align: element.style.getPropertyValue("text-align"),
                alignPriority: element.style.getPropertyPriority("text-align"),
                computedAlign: getComputedStyle(element).textAlign
              }
            ]
          })
        )
      window.originalGuards = window.readGuards()
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("claude")
    })
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await page.evaluate(() => window.adapter.enable())
      await page.waitForFunction(() =>
        ["code", "plain-code", "math", "role-math"].every(
          (id) => document.getElementById(id).dir === "ltr"
        )
      )
      const active = await page.evaluate(() => window.readGuards())
      assert.equal(active.code.computedAlign, "left")
      assert.equal(active["plain-code"].computedAlign, "left")
      assert.equal(active.math.computedAlign, "center")
      assert.equal(active["role-math"].computedAlign, "center")
      await page.evaluate(() => window.adapter.disable())
      assert.deepEqual(
        await page.evaluate(() => window.readGuards()),
        await page.evaluate(() => window.originalGuards)
      )
    }
    await page.evaluate(() => window.adapter.dispose())
  })
})

test("Chrome chatbot font rules preserve code, math and nested symbol fonts", async (context) => {
  await withRuntimePage(context, async (page) => {
    for (const site of ["chatgpt", "claude", "gemini"]) {
      const css = readFileSync(`assets/styles/${site}.css`, "utf8")
      const result = await page.evaluate((css) => {
        document.body.innerHTML = `
          <style>
            :root { --fontara-font: "FontaraTest"; }
            .code-font, .code-font code { font-family: "CodeFont"; }
            .katex { font-family: "KaTeX_Main"; }
            [role="math"] { font-family: "MathFont"; }
            .material-symbols-outlined, .icon { font-family: "SymbolFont"; }
            [aria-hidden="true"] { font-family: "HiddenFont"; }
          </style>
          <article>
            <p id="text">Readable text</p>
            <div class="font-user-message"><p id="user-text">User message text</p></div>
            <pre class="code-font"><code><span id="code-font">const x = 1</span></code></pre>
            <span class="katex"><span id="math-font">x + y</span></span>
            <span role="math"><span id="role-math-font">a + b</span></span>
            <span class="material-symbols-outlined"><span id="symbol-font">home</span></span>
            <span class="icon"><span id="icon-font">home</span></span>
            <span aria-hidden="true"><span id="hidden-font">hidden</span></span>
            <span style='font-family: "AuthoredFont"'><span id="authored-font">special text</span></span>
          </article>
        `
        const style = document.createElement("style")
        style.textContent = css
        document.head.appendChild(style)
        const families = Object.fromEntries(
          [
            "text",
            "user-text",
            "code-font",
            "math-font",
            "role-math-font",
            "symbol-font",
            "icon-font",
            "hidden-font",
            "authored-font"
          ].map((id) => [
            id,
            getComputedStyle(document.getElementById(id)).fontFamily
          ])
        )
        style.remove()
        return families
      }, css)
      assert.match(result.text, /FontaraTest/, site)
      if (site === "claude") {
        assert.match(result.text, /Anthropic Serif/)
        assert.match(result["user-text"], /Anthropic Sans/)
        assert.doesNotMatch(result["user-text"], /Anthropic Serif/)
      }
      for (const [id, family] of Object.entries({
        "code-font": "CodeFont",
        "math-font": "KaTeX_Main",
        "role-math-font": "MathFont",
        "symbol-font": "SymbolFont",
        "icon-font": "SymbolFont",
        "hidden-font": "HiddenFont",
        "authored-font": "AuthoredFont"
      })) {
        assert.equal(result[id], family, `${site}: ${id}`)
      }
    }
  })
})
