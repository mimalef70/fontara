import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

test("JS bundler uses React production runtime for extension pages", () => {
  const bundleJS = fs.readFileSync(path.resolve("tasks/bundle-js.js"), "utf8")

  assert.match(
    bundleJS,
    /"process\.env\.NODE_ENV": JSON\.stringify\("production"\)/
  )
})
