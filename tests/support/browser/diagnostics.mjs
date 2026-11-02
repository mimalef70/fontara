import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

function isFixtureUrl(value) {
  if (value === "about:blank") return true
  try {
    const url = new URL(value)
    return (
      ["chrome-extension:", "moz-extension:"].includes(url.protocol) ||
      (["http:", "https:"].includes(url.protocol) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  } catch {
    return false
  }
}

// Fresh test profiles contain synthetic fixtures only. Never collect an
// arbitrary website, browser profile, storage dump, or network response.
export function createBrowserDiagnostics(browser, testName) {
  const output = process.env.FONTARA_BROWSER_ARTIFACT_DIR
  const logs = new Map()
  const handlers = new Map()
  const observe = async (target) => {
    if (!output || target.type() !== "page") return
    const page = await target.page().catch(() => null)
    if (!page || handlers.has(page)) return
    const entries = []
    const add = (type, text) => {
      if (!isFixtureUrl(page.url())) return
      entries.push({ type, text: String(text).slice(0, 2000) })
      if (entries.length > 100) entries.shift()
    }
    const consoleHandler = (message) => add(message.type(), message.text())
    const errorHandler = (error) => add("pageerror", error.message)
    page.on("console", consoleHandler)
    page.on("pageerror", errorHandler)
    handlers.set(page, { consoleHandler, errorHandler })
    logs.set(page, entries)
  }
  if (output) {
    browser.on("targetcreated", observe)
    for (const target of browser.targets()) void observe(target)
  }

  return {
    async capture(error) {
      if (!output) return
      const slug = testName.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80)
      const suffix = createHash("sha256")
        .update(testName)
        .digest("hex")
        .slice(0, 10)
      const directory = path.join(output, `${slug}-${suffix}`)
      const deadline = Date.now() + 10000
      const bounded = async (operation) => {
        let timer
        try {
          return await Promise.race([
            operation,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Diagnostic capture timed out.")),
                Math.max(1, Math.min(2000, deadline - Date.now()))
              )
            })
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      try {
        await fs.mkdir(directory, { recursive: true })
        const pages = (await bounded(browser.pages()))
          .filter((page) => isFixtureUrl(page.url()))
          .slice(0, 12)
        const report = {
          test: testName,
          error: String(error?.stack || error).slice(0, 8000),
          pages: []
        }
        for (const [index, page] of pages.entries()) {
          if (Date.now() >= deadline) break
          if (!isFixtureUrl(page.url())) continue
          const url = new URL(page.url())
          const entry = {
            url: `${url.protocol}//${url.host}${url.pathname}`,
            console: logs.get(page) || []
          }
          report.pages.push(entry)
          try {
            const expectedUrl = page.url()
            await bounded(
              page.evaluate((expectedUrl) => {
                if (location.href !== expectedUrl)
                  throw new Error("Page navigated during diagnostics.")
                for (const input of document.querySelectorAll(
                  "input, textarea"
                )) {
                  input.value = ""
                  input.removeAttribute("value")
                }
              }, expectedUrl)
            )
            if (page.url() !== expectedUrl) continue
            const dom = await bounded(
              page.evaluate((expectedUrl) => {
                if (location.href !== expectedUrl)
                  throw new Error("Page navigated during diagnostics.")
                const clone = document.documentElement.cloneNode(true)
                for (const node of clone.querySelectorAll(
                  "script, style, input, textarea"
                ))
                  node.remove()
                return clone.outerHTML.slice(0, 150000)
              }, expectedUrl)
            )
            await fs.writeFile(path.join(directory, `page-${index}.html`), dom)
            if (page.url() !== expectedUrl) continue
            await bounded(
              page.screenshot({
                path: path.join(directory, `page-${index}.png`)
              })
            )
          } catch (captureError) {
            entry.captureError = String(captureError.message).slice(0, 1000)
          }
        }
        await fs.writeFile(
          path.join(directory, "failure.json"),
          JSON.stringify(report, null, 2)
        )
      } catch (captureError) {
        console.warn(
          "Could not capture browser failure diagnostics:",
          captureError.message
        )
      }
    },
    dispose() {
      browser.off("targetcreated", observe)
      for (const [page, { consoleHandler, errorHandler }] of handlers) {
        page.off("console", consoleHandler)
        page.off("pageerror", errorHandler)
      }
    }
  }
}
