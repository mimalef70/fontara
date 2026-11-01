import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const driverUrl = new URL(
  "../support/browser/firefox-driver.mjs",
  import.meta.url
)

test("Firefox BiDi attachment reuses one driver session and forwards real commands and events", async () => {
  const { createFirefoxAttachTransport } = await import(driverUrl.href)
  class Socket extends EventTarget {
    sent: string[] = []
    send(message: string) {
      this.sent.push(message)
    }
    close() {
      this.dispatchEvent(new Event("close"))
    }
  }
  const socket = new Socket()
  const session = {
    sessionId: "existing",
    capabilities: { browserName: "firefox" }
  }
  const transport = createFirefoxAttachTransport(socket, session)
  const messages: unknown[] = []
  let closed = false
  transport.onmessage = (message: string) => messages.push(JSON.parse(message))
  transport.onclose = () => {
    closed = true
  }
  transport.send(JSON.stringify({ id: 1, method: "session.new", params: {} }))
  await Promise.resolve()
  assert.deepEqual(messages, [{ type: "success", id: 1, result: session }])
  assert.deepEqual(socket.sent, [])
  const command = JSON.stringify({
    id: 2,
    method: "browsingContext.getTree",
    params: {}
  })
  transport.send(command)
  assert.deepEqual(socket.sent, [command])
  const event = {
    type: "event",
    method: "browsingContext.contextCreated",
    params: { context: "page" }
  }
  socket.dispatchEvent(
    new MessageEvent("message", { data: JSON.stringify(event) })
  )
  assert.deepEqual(messages[messages.length - 1], event)
  transport.send(JSON.stringify({ id: 3, method: "session.new", params: {} }))
  await Promise.resolve()
  assert.deepEqual(messages[messages.length - 1], {
    type: "error",
    id: 3,
    error: "session not created",
    message: "The Firefox driver session is already attached."
  })
  transport.close()
  assert.equal(closed, true)
})

test("Firefox Classic input keeps window selection atomic, uploads files, and recovers after errors", async (context) => {
  const { FirefoxDriverClient } = await import(driverUrl.href)
  const markers = new Map<string, string>()
  const calls: Array<{
    method: string
    route: string
    body: Record<string, unknown>
    window: string
  }> = []
  let currentWindow = "first"
  let releaseClick: (() => void) | undefined
  let signalClick: (() => void) | undefined
  const clickStarted = new Promise<void>((resolve) => {
    signalClick = resolve
  })
  const server = http.createServer(async (request, response) => {
    let raw = ""
    for await (const chunk of request) raw += chunk
    const body = raw ? JSON.parse(raw) : {}
    const route = (request.url ?? "").replace("/session/test", "")
    const method = request.method ?? "GET"
    calls.push({ method, route, body, window: currentWindow })
    let value: unknown = null
    if (route === "/window/handles") value = ["first", "second"]
    else if (route === "/window") currentWindow = body.handle
    else if (route === "/execute/sync")
      value = markers.get(currentWindow) ?? null
    else if (route === "/element")
      value = {
        "element-6066-11e4-a52e-4f735466cecf": `${currentWindow}-element`
      }
    const reply = () => {
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ value }))
    }
    if (route.endsWith("/click")) {
      releaseClick = reply
      signalClick?.()
      return
    }
    if (route === "/actions" && method === "POST") {
      response.statusCode = 400
      value = { error: "invalid argument", message: "invalid input action" }
    }
    reply()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  context.after(
    () => new Promise<void>((resolve) => server.close(() => resolve()))
  )
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const client = new FirefoxDriverClient(
    `http://127.0.0.1:${address.port}`,
    "test"
  )
  const createPage = (handle: string) => ({
    async evaluate(_fn: unknown, _key: string, marker: string) {
      markers.set(handle, marker)
    }
  })
  const first = createPage("first")
  const second = createPage("second")
  const click = client.click(first, "#button")
  await clickStarted
  const files = client.uploadFiles(second, "input[type=file]", [
    "font-a.woff2",
    "font-b.woff2"
  ])
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(currentWindow, "first")
  assert.ok(releaseClick)
  releaseClick()
  await Promise.all([click, files])
  assert.deepEqual(
    calls.filter(
      (call) =>
        /\/element\/.+\/(click|value)$/.test(call.route) ||
        (call.route === "/execute/sync" &&
          String(call.body.script).includes('value = ""'))
    ),
    [
      {
        method: "POST",
        route: "/element/first-element/click",
        body: {},
        window: "first"
      },
      {
        method: "POST",
        route: "/execute/sync",
        body: {
          script:
            'if (arguments[0].type !== "file") throw new Error("Expected a file input"); arguments[0].value = ""',
          args: [{ "element-6066-11e4-a52e-4f735466cecf": "second-element" }]
        },
        window: "second"
      },
      {
        method: "POST",
        route: "/element/second-element/value",
        body: {
          text: [
            path.resolve("font-a.woff2"),
            path.resolve("font-b.woff2")
          ].join("\n")
        },
        window: "second"
      }
    ]
  )
  await assert.rejects(client.performActions(first, []), /invalid input action/)
  assert.deepEqual(calls[calls.length - 1], {
    method: "DELETE",
    route: "/actions",
    body: {},
    window: "first"
  })
  await assert.rejects(
    client.uploadFiles(second, "input[type=file]", []),
    /at least one file/
  )
  await client.uploadFiles(second, "input[type=file]", ["font-a.woff2"])
  assert.equal(calls[calls.length - 1]?.route, "/element/second-element/value")
  assert.equal(calls[calls.length - 1]?.window, "second")
})

test("Firefox launch failures close the driver, delete the session, and remove its profile", {
  skip: process.platform === "win32"
}, async () => {
  const { launchFirefoxDriver } = await import(driverUrl.href)
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-driver-test-")
  )
  const executable = path.join(directory, "geckodriver")
  const capturePath = path.join(directory, "capture.json")
  const originalDriver = process.env.GECKODRIVER_PATH
  try {
    for (const failure of ["session", "attachment"]) {
      await fs.writeFile(
        executable,
        `#!/usr/bin/env node
const http = require("node:http")
const fs = require("node:fs")
const capturePath = ${JSON.stringify(capturePath)}
const capture = { pid: process.pid, deleted: false }
const server = http.createServer(async (req, res) => {
  let raw = ""
  for await (const chunk of req) raw += chunk
  let value = { ready: true }
  if (req.url === "/session") {
    const body = JSON.parse(raw)
    const args = body.capabilities.alwaysMatch["moz:firefoxOptions"].args
    capture.profile = args[args.indexOf("-profile") + 1]
    fs.writeFileSync(capturePath, JSON.stringify(capture))
    if (${JSON.stringify(failure)} === "session") {
      res.statusCode = 500
      value = { error: "session not created", message: "fixture session failure" }
    } else value = { sessionId: "fixture", capabilities: { webSocketUrl: "invalid" } }
  }
  if (req.method === "DELETE") {
    capture.deleted = true
    fs.writeFileSync(capturePath, JSON.stringify(capture))
    value = null
  }
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({ value }))
})
server.listen(Number(process.argv[process.argv.indexOf("--port") + 1]), "127.0.0.1")
`,
        { mode: 0o700 }
      )
      process.env.GECKODRIVER_PATH = executable
      await assert.rejects(
        launchFirefoxDriver({
          firefoxPath: "/fixture/firefox",
          headless: true,
          viewport: null
        }),
        failure === "session" ? /fixture session failure/ : /invalid|URL/i
      )
      const capture = JSON.parse(await fs.readFile(capturePath, "utf8"))
      assert.equal(capture.deleted, failure === "attachment")
      await assert.rejects(fs.access(capture.profile), { code: "ENOENT" })
      assert.throws(() => process.kill(capture.pid, 0), { code: "ESRCH" })
    }
  } finally {
    if (originalDriver === undefined) delete process.env.GECKODRIVER_PATH
    else process.env.GECKODRIVER_PATH = originalDriver
    await fs.rm(directory, { recursive: true, force: true })
  }
})
