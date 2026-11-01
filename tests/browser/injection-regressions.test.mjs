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

test("Chrome AI site font rules preserve code, math, and icon subtrees", async (context) => {
  await withRuntimePage(context, async (page) => {
    const wrappers = {
      aistudio: ["<ms-cmark-node>", "</ms-cmark-node>"],
      notebooklm: ['<div class="to-copy-content">', "</div>"],
      chatgpt: ['<main><div class="markdown">', "</div></main>"],
      claude: ['<div class="standard-markdown">', "</div>"]
    }
    for (const [site, [open, close]] of Object.entries(wrappers)) {
      const css = readFileSync(`assets/styles/${site}.css`, "utf8")
      const result = await page.evaluate(
        ({ css, open, close }) => {
          document.body.innerHTML = `${open}
            <p id="text">سلام دنیا</p>
            <pre><code id="code" class="Paragraph-code" data-sourcepos="1"><span id="code-child" dir="auto">const x = 1</span></code></pre>
            <span class="katex" data-row-label="math"><span id="math" class="TextBase-math" dir="auto">x + y</span></span>
            <span class="material-symbols-outlined" data-sourcepos="2"><span id="icon" class="Paragraph-icon">home</span></span>
            <mat-icon><span id="mat-icon" data-row-label="icon">home</span></mat-icon>
            <span class="fas"><span id="fa-icon">home</span></span>
            <div class="cm-editor"><span id="editor-code" data-sourcepos="3">const x = 1</span></div>
            <math><mi id="mathml">x</mi></math>
            <mjx-container><span id="mathjax">x</span></mjx-container>
          ${close}`
          document.head.querySelectorAll("style").forEach((style) => {
            style.remove()
          })
          const siteStyle = document.createElement("style")
          siteStyle.textContent = `
            :root { --fontara-font: "FontaraTest"; }
            code, .cm-editor { font-family: monospace; }
            .katex, math, mjx-container { font-family: "MathTest"; }
            .material-symbols-outlined, mat-icon, .fas { font-family: "IconTest"; }
          `
          document.head.append(siteStyle)
          const read = () =>
            Object.fromEntries(
              [
                "code",
                "code-child",
                "math",
                "icon",
                "mat-icon",
                "fa-icon",
                "editor-code",
                "mathml",
                "mathjax"
              ].map((id) => [
                id,
                getComputedStyle(document.getElementById(id)).fontFamily
              ])
            )
          const before = read()
          const fontStyle = document.createElement("style")
          fontStyle.textContent = css
          document.head.append(fontStyle)
          return {
            before,
            after: read(),
            textFont: getComputedStyle(document.getElementById("text"))
              .fontFamily
          }
        },
        { css, open, close }
      )
      assert.match(result.textFont, /FontaraTest/, `${site}: readable text`)
      assert.deepEqual(result.after, result.before, `${site}: protected fonts`)
    }
  })
})

test("Chrome Gemini RTL leaves English text and excluded toolbars unchanged", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <model-response id="outer">
          <message-content><div id="model-response-message-content-1">
            <p id="persian">سلام این یک متن فارسی طولانی برای آزمایش جهت نوشته است</p>
            <p id="english">Hello world</p>
          </div></message-content>
          <div data-test-id="overflow-container" id="toolbar">Toolbar</div>
        </model-response>`
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("gemini")
      window.adapter.enable()
    })
    await page.waitForFunction(
      () => document.getElementById("persian").dir === "rtl"
    )
    const result = await page.evaluate(() => {
      const read = () =>
        Object.fromEntries(
          ["outer", "english", "toolbar"].map((id) => {
            const element = document.getElementById(id)
            return [
              id,
              {
                dir: element.getAttribute("dir"),
                direction: getComputedStyle(element).direction
              }
            ]
          })
        )
      const active = read()
      window.adapter.dispose()
      return {
        active,
        restored: read(),
        persianDir: document.getElementById("persian").getAttribute("dir")
      }
    })
    for (const state of [result.active, result.restored]) {
      for (const [id, value] of Object.entries(state)) {
        assert.deepEqual(value, { dir: null, direction: "ltr" }, id)
      }
    }
    assert.equal(result.persianDir, null)
  })
})

test("Chrome Claude nested lists bound traversal and restore their styles", async (context) => {
  await withRuntimePage(context, async (page) => {
    const depth = 12
    await page.evaluate((depth) => {
      document.body.innerHTML = `<div class="font-claude-message">${"<ul><li>سلام دنیا".repeat(depth)}${"</li></ul>".repeat(depth)}</div>`
      window.listQueries = 0
      window.originalQuerySelectorAll = Element.prototype.querySelectorAll
      Element.prototype.querySelectorAll = function (...args) {
        if (this.tagName === "UL") window.listQueries += 1
        return window.originalQuerySelectorAll.apply(this, args)
      }
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("claude")
      window.adapter.enable()
    }, depth)
    await page.waitForFunction(() =>
      [...document.querySelectorAll("li")].every((li) => li.dir === "rtl")
    )
    const result = await page.evaluate(() => {
      Element.prototype.querySelectorAll = window.originalQuerySelectorAll
      const queries = window.listQueries
      window.adapter.dispose()
      return {
        queries,
        restored: [...document.querySelectorAll("ul, li")].every(
          (element) =>
            !element.hasAttribute("dir") &&
            !element.style.cssText &&
            !element.className
        )
      }
    })
    assert.ok(
      result.queries <= depth * 5,
      `${result.queries} queries for depth ${depth}`
    )
    assert.equal(result.restored, true)
  })
})

test("Chrome ChatGPT writing blocks preserve mixed directions and composer sizing", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.setContent(`
      <style>.ProseMirror { font-size: 40px; line-height: 1.5; }</style>
      <div class="writing-block-editor"><div class="ProseMirror" contenteditable="true">
        <p id="persian">سلام دنیا</p><p id="english">Hello world</p>
        <pre><code id="code">const x = 1</code></pre>
      </div></div>
      <form data-mobile-composer data-composer-body data-composer-layout="single-line">
        <div id="composer" class="ProseMirror" contenteditable="true"><p>سلام</p></div>
      </form>`)
    await page.addStyleTag({
      content: readFileSync("assets/styles/chatgpt.css", "utf8")
    })
    await page.evaluate(() => {
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("chatgpt")
      window.adapter.enable()
    })
    await page.waitForFunction(
      () => document.getElementById("persian").dir === "rtl"
    )
    const result = await page.evaluate(() => {
      const result = {
        english: getComputedStyle(document.getElementById("english")).direction,
        code: getComputedStyle(document.getElementById("code")).direction,
        composer: getComputedStyle(document.getElementById("composer"))
          .lineHeight,
        overflow: getComputedStyle(document.getElementById("composer")).overflow
      }
      window.adapter.dispose()
      return result
    })
    assert.equal(result.english, "ltr")
    assert.equal(result.code, "ltr")
    assert.equal(result.composer, "60px")
    assert.notEqual(result.overflow, "hidden")
  })
})

test("Chrome Claude independent list-item scopes preserve mixed-language siblings", async (context) => {
  await withRuntimePage(context, async (page) => {
    await page.evaluate(() => {
      document.body.innerHTML = `<div class="standard-markdown"><ul id="list">
        <li id="english-first" data-sourcepos="1">Hello world</li>
        <li id="persian" data-sourcepos="2">سلام دنیا</li>
        <li id="english-last" data-sourcepos="3">Another English item</li>
      </ul></div>`
      window.adapter = FontaraRegressionRuntime.createRtlSiteAdapter("claude")
      window.adapter.enable()
    })
    await page.waitForFunction(
      () => document.getElementById("persian").dir === "rtl"
    )
    const directions = await page.evaluate(() => {
      const values = ["list", "english-first", "english-last"].map(
        (id) => getComputedStyle(document.getElementById(id)).direction
      )
      window.adapter.dispose()
      return values
    })
    assert.deepEqual(directions, ["ltr", "ltr", "ltr"])
  })
})
