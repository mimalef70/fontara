import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { ICON_PATHS } from "../../src/config/storage"

const PNG_SIGNATURE = "89504e470d0a1a0a"

function readPNGSize(filePath: string): { height: number; width: number } {
  const file = fs.readFileSync(path.resolve(filePath.replace(/^\//, "")))
  assert.equal(file.subarray(0, 8).toString("hex"), PNG_SIGNATURE)

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20)
  }
}

test("action icons are valid PNG files with matching dimensions", () => {
  for (const iconSet of [ICON_PATHS.default, ICON_PATHS.active]) {
    for (const [size, filePath] of Object.entries(iconSet)) {
      assert.match(filePath, /^\/assets\/icon(?:-active)?-\d+\.png$/)
      assert.deepEqual(readPNGSize(filePath), {
        width: Number(size),
        height: Number(size)
      })
    }
  }
})
