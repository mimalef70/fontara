import assert from "node:assert/strict"
import test from "node:test"
import type { Browser, LaunchOptions, ProtocolError } from "puppeteer-core"

const harnessUrl = new URL(
  "../support/browser/extension-harness.mjs",
  import.meta.url
)

async function loadLaunchHarness() {
  const [harness, { default: puppeteer, ProtocolError }] = await Promise.all([
    import(harnessUrl.href),
    import("puppeteer-core")
  ])
  return { ...harness, puppeteer, ProtocolError }
}

function unavailableCommand(ErrorType: typeof ProtocolError): ProtocolError {
  const error = new ErrorType(
    "Protocol error (Extensions.loadUnpacked): Method not available."
  )
  error.originalMessage = "Method not available."
  return error
}

test("Chrome extension launcher uses CDP when the command is available", async (context) => {
  const { launchChromeExtensionBrowser, puppeteer } = await loadLaunchHarness()
  const calls: unknown[] = []
  const browser = {
    installExtension: async (directory: string) => calls.push(directory),
    close: async () => calls.push("close")
  }
  context.mock.method(puppeteer, "launch", async (options?: LaunchOptions) => {
    calls.push(options)
    return browser as unknown as Browser
  })

  assert.equal(
    await launchChromeExtensionBrowser({ pipe: true }, "/extension"),
    browser
  )
  assert.deepEqual(calls, [
    { pipe: true, enableExtensions: true },
    "/extension"
  ])
})

test("unavailable Chrome extension command closes before relaunch with startup flags", async (context) => {
  const { launchChromeExtensionBrowser, puppeteer, ProtocolError } =
    await loadLaunchHarness()
  const events: string[] = []
  const launches: LaunchOptions[] = []
  const firstBrowser = {
    installExtension: async () => {
      events.push("install")
      throw unavailableCommand(ProtocolError)
    },
    close: async () => events.push("close")
  }
  const secondBrowser = {}
  context.mock.method(puppeteer, "launch", async (options: LaunchOptions) => {
    launches.push(options)
    events.push("launch")
    return (launches.length === 1 ? firstBrowser : secondBrowser) as Browser
  })
  const options = { args: ["--no-first-run"], userDataDir: "/test-profile" }

  assert.equal(
    await launchChromeExtensionBrowser(options, "/extension with spaces"),
    secondBrowser
  )
  assert.deepEqual(events, ["launch", "install", "close", "launch"])
  assert.deepEqual(launches[1], {
    ...options,
    enableExtensions: true,
    args: [
      "--no-first-run",
      "--disable-extensions-except=/extension with spaces",
      "--load-extension=/extension with spaces"
    ]
  })
  assert.deepEqual(options.args, ["--no-first-run"])
})

test("Chrome extension installation errors are not hidden by fallback", async (context) => {
  const { launchChromeExtensionBrowser, puppeteer, ProtocolError } =
    await loadLaunchHarness()
  const failure = new ProtocolError(
    "Protocol error (Extensions.loadUnpacked): Invalid manifest."
  )
  failure.originalMessage = "Invalid manifest."
  let launches = 0
  let closes = 0
  context.mock.method(puppeteer, "launch", async () => {
    launches += 1
    return {
      installExtension: async () => {
        throw failure
      },
      close: async () => {
        closes += 1
      }
    } as unknown as Browser
  })

  await assert.rejects(launchChromeExtensionBrowser({}, "/extension"), failure)
  assert.equal(launches, 1)
  assert.equal(closes, 1)
})

test("a failed fallback launch leaves the original Chrome closed", async (context) => {
  const { launchChromeExtensionBrowser, puppeteer, ProtocolError } =
    await loadLaunchHarness()
  const failure = new Error("Chrome launch failed")
  let launches = 0
  let closes = 0
  context.mock.method(puppeteer, "launch", async () => {
    launches += 1
    if (launches === 2) throw failure
    return {
      installExtension: async () => {
        throw unavailableCommand(ProtocolError)
      },
      close: async () => {
        closes += 1
      }
    } as unknown as Browser
  })

  await assert.rejects(launchChromeExtensionBrowser({}, "/extension"), failure)
  assert.equal(launches, 2)
  assert.equal(closes, 1)
})
