import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import puppeteer from "puppeteer-core"

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"
const PAGE_MARKER = "__fontaraWebDriverPageId"
const firefoxDrivers = new WeakMap()

export function getFirefoxDriver(page) {
  return firefoxDrivers.get(page.browser())
}

// Puppeteer currently always sends session.new when connecting. Geckodriver
// already owns the HTTP/BiDi session, so acknowledge that same session once.
// Every subsequent command and event goes through the real BiDi connection.
export function createFirefoxAttachTransport(socket, session) {
  let attached = false
  const transport = {
    onmessage: undefined,
    onclose: undefined,
    send(message) {
      const command = JSON.parse(message)
      if (command.method === "session.new") {
        const response = attached
          ? {
              type: "error",
              id: command.id,
              error: "session not created",
              message: "The Firefox driver session is already attached."
            }
          : { type: "success", id: command.id, result: session }
        attached = true
        queueMicrotask(() => transport.onmessage?.(JSON.stringify(response)))
        return
      }
      socket.send(message)
    },
    close() {
      socket.close()
    }
  }
  socket.addEventListener("message", (event) => {
    transport.onmessage?.(String(event.data))
  })
  socket.addEventListener("close", () => transport.onclose?.())
  return transport
}

export class FirefoxDriverClient {
  #baseUrl
  #sessionId
  #queue = Promise.resolve()
  #pageHandles = new WeakMap()

  constructor(baseUrl, sessionId) {
    this.#baseUrl = baseUrl
    this.#sessionId = sessionId
  }

  async request(method, route, body, timeout = 30_000) {
    const response = await fetch(`${this.#baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeout)
    })
    const { value } = await response.json()
    if (!response.ok || value?.error) {
      const error = new Error(
        `Firefox WebDriver ${method} ${route}: ${value?.message ?? response.statusText}`
      )
      error.code = value?.error
      throw error
    }
    return value
  }

  command(method, route, body, timeout) {
    return this.request(
      method,
      `/session/${encodeURIComponent(this.#sessionId)}${route}`,
      body,
      timeout
    )
  }

  #withPage(page, operation) {
    // Classic commands share one current window. Selecting it and dispatching
    // input must remain atomic even when two Puppeteer pages act concurrently.
    const run = async () => {
      let handle = this.#pageHandles.get(page)
      if (!handle) {
        const marker = randomUUID()
        await page.evaluate(
          (key, value) => {
            window[key] = value
          },
          PAGE_MARKER,
          marker
        )
        for (const candidate of await this.command("GET", "/window/handles")) {
          await this.command("POST", "/window", { handle: candidate })
          const candidateMarker = await this.command("POST", "/execute/sync", {
            script: "return window[arguments[0]]",
            args: [PAGE_MARKER]
          })
          if (candidateMarker === marker) {
            handle = candidate
            this.#pageHandles.set(page, handle)
            break
          }
        }
        assert.ok(
          handle,
          "Could not match the Firefox page to a WebDriver window."
        )
      }
      await this.command("POST", "/window", { handle })
      return operation()
    }
    const result = this.#queue.then(run, run)
    this.#queue = result.catch(() => {})
    return result
  }

  async #findElement(selector) {
    const element = await this.command("POST", "/element", {
      using: "css selector",
      value: selector
    })
    assert.ok(element?.[ELEMENT_KEY], `Firefox did not find ${selector}.`)
    return encodeURIComponent(element[ELEMENT_KEY])
  }

  click(page, selector) {
    return this.#withPage(page, async () => {
      const element = await this.#findElement(selector)
      await this.command("POST", `/element/${element}/click`, {})
    })
  }

  performActions(page, actions) {
    return this.#withPage(page, async () => {
      try {
        await this.command("POST", "/actions", { actions })
      } finally {
        await this.command("DELETE", "/actions")
      }
    })
  }

  uploadFiles(page, selector, filePaths) {
    return this.#withPage(page, async () => {
      assert.ok(
        filePaths.length > 0,
        "Firefox upload requires at least one file."
      )
      const element = await this.#findElement(selector)
      // Classic clear requires a visible control, while accessible upload UIs
      // commonly hide the native input. Clear only its old selection as setup;
      // SendKeys performs the real upload and emits trusted input/change events.
      await this.command("POST", "/execute/sync", {
        script:
          'if (arguments[0].type !== "file") throw new Error("Expected a file input"); arguments[0].value = ""',
        args: [{ [ELEMENT_KEY]: decodeURIComponent(element) }]
      })
      await this.command("POST", `/element/${element}/value`, {
        text: filePaths.map((filePath) => path.resolve(filePath)).join("\n")
      })
    })
  }
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

async function openSocket(url) {
  const socket = new WebSocket(url)
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Firefox BiDi connection timed out.")),
        15_000
      )
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer)
          reject(new Error("Firefox BiDi connection failed."))
        },
        { once: true }
      )
    })
    return socket
  } catch (error) {
    socket.close()
    throw error
  }
}

export async function launchFirefoxDriver({ firefoxPath, headless, viewport }) {
  const driverPath = process.env.GECKODRIVER_PATH ?? "geckodriver"
  assert.ok(driverPath, "GECKODRIVER_PATH is empty.")
  if (process.env.GECKODRIVER_PATH !== undefined) {
    await fs.access(driverPath).catch(() => {
      throw new Error(
        `GECKODRIVER_PATH ${JSON.stringify(driverPath)} does not exist.`
      )
    })
  }
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-browser-firefox-")
  )
  let child
  let childClosed
  let client
  let browser
  let socket
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    try {
      await Promise.resolve()
        .then(() => browser?.disconnect())
        .catch(() => {})
      try {
        socket?.close()
      } catch {}
      await client?.command("DELETE", "", undefined, 5000).catch(() => {})
      if (child?.pid) {
        const kill = (signal) => {
          try {
            if (process.platform === "win32") child.kill(signal)
            else process.kill(-child.pid, signal)
          } catch {}
        }
        // Also reap Firefox descendants if the driver exited unexpectedly.
        kill("SIGTERM")
        await Promise.race([
          childClosed,
          delay(1000, undefined, { ref: false })
        ])
        kill("SIGKILL")
        await childClosed
      }
    } finally {
      await fs.rm(userDataDir, { force: true, recursive: true })
    }
  }

  try {
    const port = await freePort()
    const websocketPort = await freePort()
    let spawnError
    let output = ""
    child = spawn(
      driverPath,
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--websocket-port",
        String(websocketPort),
        "--allow-system-access"
      ],
      {
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      }
    )
    childClosed = new Promise((resolve) => child.once("close", resolve))
    child.once("error", (error) => {
      spawnError = error
    })
    const capture = (chunk) => {
      output = (output + chunk).slice(-8000)
    }
    child.stdout.on("data", capture)
    child.stderr.on("data", capture)
    const baseUrl = `http://127.0.0.1:${port}`
    const connection = new FirefoxDriverClient(baseUrl)
    const deadline = Date.now() + 15_000
    while (true) {
      if (spawnError)
        throw new Error(
          `Cannot start geckodriver. Set GECKODRIVER_PATH or install it on PATH: ${spawnError.message}`
        )
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`geckodriver exited before startup: ${output}`)
      if (
        await connection
          .request("GET", "/status", undefined, 1000)
          .then((value) => value.ready)
          .catch(() => false)
      )
        break
      if (Date.now() >= deadline)
        throw new Error(`geckodriver did not become ready: ${output}`)
      await delay(100)
    }
    const session = await connection.request("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          webSocketUrl: true,
          unhandledPromptBehavior: "ignore",
          "moz:firefoxOptions": {
            binary: firefoxPath,
            args: ["-profile", userDataDir, ...(headless ? ["-headless"] : [])]
          }
        }
      }
    })
    client = new FirefoxDriverClient(baseUrl, session.sessionId)
    socket = await openSocket(session.capabilities.webSocketUrl)
    browser = await puppeteer.connect({
      transport: createFirefoxAttachTransport(socket, session),
      protocol: "webDriverBiDi",
      defaultViewport: viewport
    })
    firefoxDrivers.set(browser, client)
    return { browser, userDataDir, close }
  } catch (error) {
    await close()
    throw error
  }
}
