import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  STORAGE_KEYS,
  sendSettingsFromOptions,
  waitForContentBridge,
  waitForFont,
  withChromeMv3ExtensionHarness
} from "../support/browser/extension-harness.mjs"

// Absolute budgets deliberately allow shared-runner noise. Keep the report so
// changes can be compared before tightening budgets; do not ratchet them up to
// hide regressions. Each round discards the previous DOM to reveal retention.
const BUDGET = {
  nodesPerRound: 1200,
  rounds: 12,
  settlingP95Ms: 4000,
  maxLongTaskMs: 1500,
  heapGrowthBytes: 12 * 1024 * 1024,
  cpuSeconds: 12
}

test("Chrome bounds settling time, long tasks and retained memory under repeated DOM churn", async (t) => {
  await withChromeMv3ExtensionHarness(t, async (harness) => {
    const options = await harness.createExtensionPage("ui/options/index.html")
    const page = await harness.createFixturePage()
    // A settings acknowledgement alone does not establish content/runtime
    // readiness. Keep startup storage listeners out of the measured workload.
    await waitForContentBridge(page)
    await sendSettingsFromOptions(options, {
      [STORAGE_KEYS.SYNC_SETTINGS]: false,
      [STORAGE_KEYS.EXTENSION_ENABLED]: true,
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
      [STORAGE_KEYS.ENABLED_FOR]: [`127.0.0.1:${harness.server.port}`],
      [STORAGE_KEYS.DISABLED_FOR]: [],
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara"
    })
    await page.bringToFront()
    await page.waitForFunction(() => document.visibilityState === "visible")
    await waitForFont(page, "Samim-Fontara")
    const client = await page.createCDPSession()
    await client.send("Performance.enable")
    await page.evaluate(() => {
      window.fontaraPerformanceLongTasks = []
      window.fontaraPerformanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.fontaraPerformanceLongTasks.push(entry.duration)
        }
      })
      window.fontaraPerformanceObserver.observe({ entryTypes: ["longtask"] })
      const host = document.createElement("section")
      host.id = "fontara-performance-fixture"
      document.body.append(host)
    })
    const metrics = async () => {
      await client.send("HeapProfiler.collectGarbage")
      const { metrics: values } = await client.send("Performance.getMetrics")
      return Object.fromEntries(values.map(({ name, value }) => [name, value]))
    }
    let baseline
    const durations = []
    for (let round = 0; round < BUDGET.rounds + 2; round++) {
      const start = performance.now()
      await page.evaluate(
        ({ count, round }) => {
          const fragment = document.createDocumentFragment()
          for (let index = 0; index < count; index++) {
            const row = document.createElement("p")
            row.textContent = `نمونهٔ متن فارسی برای بررسی کارایی ${round} ${index}`
            fragment.append(row)
          }
          document
            .getElementById("fontara-performance-fixture")
            .replaceChildren(fragment)
        },
        { count: BUDGET.nodesPerRound, round }
      )
      await page.waitForFunction(
        () => {
          const host = document.getElementById("fontara-performance-fixture")
          return [
            host.firstElementChild,
            host.children[Math.floor(host.children.length / 2)],
            host.lastElementChild
          ].every(
            (node) =>
              node &&
              getComputedStyle(node).fontFamily.includes("Samim-Fontara")
          )
        },
        { timeout: 15000, polling: "raf" }
      )
      if (round >= 2) durations.push(performance.now() - start)
      if (round === 1) baseline = await metrics()
    }
    await page.evaluate(() =>
      document.getElementById("fontara-performance-fixture").replaceChildren()
    )
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    )
    const final = await metrics()
    const longTasks = await page.evaluate(() => {
      window.fontaraPerformanceObserver.disconnect()
      return window.fontaraPerformanceLongTasks
    })
    const sorted = [...durations].sort((a, b) => a - b)
    const report = {
      browser: await harness.browser.version(),
      budget: BUDGET,
      durationsMs: durations,
      settlingP95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      maxLongTaskMs: Math.max(0, ...longTasks),
      heapGrowthBytes: final.JSHeapUsedSize - baseline.JSHeapUsedSize,
      cpuSeconds: final.TaskDuration - baseline.TaskDuration
    }
    const directory =
      process.env.FONTARA_BROWSER_ARTIFACT_DIR || "browser-artifacts"
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(
      path.join(directory, "performance-budget.json"),
      JSON.stringify(report, null, 2)
    )
    t.diagnostic(JSON.stringify(report))
    for (const key of [
      "settlingP95Ms",
      "maxLongTaskMs",
      "heapGrowthBytes",
      "cpuSeconds"
    ]) {
      assert.ok(
        report[key] <= BUDGET[key],
        `${key}: ${report[key]} exceeds ${BUDGET[key]}`
      )
    }
    await client.detach()
  })
})
