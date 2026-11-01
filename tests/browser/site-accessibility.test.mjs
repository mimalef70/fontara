import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import puppeteer from "puppeteer-core"

import {
  findChromeBinary,
  ROOT_DIR
} from "../support/browser/extension-harness.mjs"

const require = createRequire(import.meta.url)
const docsRoot = path.join(ROOT_DIR, "docs")
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
}

test("public site and privacy page meet WCAG A/AA on mobile and desktop", async (t) => {
  const executablePath = await findChromeBinary()
  assert.ok(
    executablePath,
    "Install a supported Chrome browser before running site tests."
  )
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname
      )
      const filePath = path.resolve(
        docsRoot,
        `.${pathname === "/" ? "/index.html" : pathname}`
      )
      const relativePath = path.relative(docsRoot, filePath)
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        response.writeHead(403).end()
        return
      }
      const body = await fs.readFile(filePath)
      response.writeHead(200, {
        "content-type":
          contentTypes[path.extname(filePath)] ?? "application/octet-stream"
      })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"]
  })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const file of ["index.html", "privacy.html"]) {
    for (const width of [390, 1280]) {
      await t.test(`${file} at ${width}px`, async () => {
        await page.setViewport({ width, height: 844 })
        await page.goto(`http://127.0.0.1:${server.address().port}/${file}`, {
          waitUntil: "networkidle0"
        })
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js")
        })
        const result = await page.evaluate(async () => {
          const { violations } = await globalThis.axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
            }
          })
          return {
            violations: violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                reason: n.failureSummary
              }))
            })),
            overflow: document.documentElement.scrollWidth > innerWidth
          }
        })
        assert.deepEqual(
          result.violations,
          [],
          JSON.stringify(result.violations, null, 2)
        )
        assert.equal(
          result.overflow,
          false,
          "The page must not overflow horizontally."
        )
        assert.deepEqual(errors, [])
      })
    }
  }
})
