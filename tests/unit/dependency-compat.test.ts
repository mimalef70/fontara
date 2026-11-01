import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const requireFromRoot = createRequire(path.resolve("package.json"))
const requireFromWebExt = createRequire(requireFromRoot.resolve("web-ext"))
const requireFromLinter = createRequire(
  requireFromWebExt.resolve("addons-linter")
)

type MergeOptions = {
  isMergeableObject?: (value: unknown) => boolean
  arrayMerge?: (
    target: unknown[],
    source: unknown[],
    options: MergeOptions & { isMergeableObject: (value: unknown) => boolean }
  ) => unknown[]
}
const merge = requireFromLinter("deepmerge") as (
  target: unknown,
  source: unknown,
  options?: MergeOptions
) => Record<string, unknown>

test("linter merge ignores prototype keys in both inputs and nested objects", () => {
  const malicious = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"nested":{"__proto__":{"polluted":true},"safe":1}}'
  )

  for (const [target, source] of [
    [{}, malicious],
    [malicious, {}]
  ]) {
    const result = merge(target, source)
    assert.deepEqual(result, { nested: { safe: 1 } })
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(Object.getPrototypeOf(result.nested), Object.prototype)
    assert.equal("polluted" in result, false)
    assert.equal("polluted" in {}, false)
  }

  assert.deepEqual(
    merge(Object.assign(Object.create(null), malicious), { safe: 2 }),
    { nested: { safe: 1 }, safe: 2 }
  )
})

test("linter merge preserves schema array hooks and leaves inputs unchanged", () => {
  const target = { choices: [{ type: "string", enum: ["one"] }], keep: true }
  const source = { choices: [{ enum: ["two"] }, { type: "number" }] }
  const before = structuredClone({ target, source })
  const arrayMerge: NonNullable<MergeOptions["arrayMerge"]> = (
    left,
    right,
    options
  ) => {
    const result = left.slice()
    for (const [index, value] of right.entries()) {
      if (result[index] === undefined) {
        result[index] = options.isMergeableObject(value)
          ? merge(Array.isArray(value) ? [] : {}, value, options)
          : value
      } else if (options.isMergeableObject(value)) {
        result[index] = merge(result[index], value, options)
      } else if (!left.includes(value)) {
        result.push(value)
      }
    }
    return result
  }

  assert.deepEqual(merge(target, source, { arrayMerge }), {
    choices: [{ type: "string", enum: ["one", "two"] }, { type: "number" }],
    keep: true
  })
  assert.deepEqual({ target, source }, before)
  assert.deepEqual(
    merge(
      { list: ["one"] },
      { list: ["one", "two"] },
      {
        arrayMerge: (left, right) => [...new Set([...left, ...right])]
      }
    ),
    { list: ["one", "two"] }
  )
})

test("legacy minimatch consumers retain callable and constructor APIs", () => {
  const requireFromEslint = createRequire(requireFromLinter.resolve("eslint"))
  const minimatch = requireFromEslint("minimatch")
  assert.equal(minimatch("src/index.ts", "src/*.{ts,tsx}"), true)
  assert.equal(minimatch("src/.hidden.ts", "src/*.ts"), false)
  assert.deepEqual(minimatch.match(["a.ts", "b.js"], "*.ts"), ["a.ts"])
  assert.equal(new minimatch.Minimatch("**/*.ts").match("src/a.ts"), true)
})

test("web-ext file matching supports ESM import, exclusions and dotfiles", async () => {
  const { default: multimatch } = await import(
    pathToFileURL(requireFromWebExt.resolve("multimatch")).href
  )
  assert.deepEqual(
    multimatch(
      ["src/a.js", "src/a.ts", "src/private.ts", "src/.hidden.ts", "a.css"],
      ["**/*.{js,ts}", "!**/private.*"]
    ),
    ["src/a.js", "src/a.ts"]
  )
  assert.deepEqual(multimatch([".hidden.ts"], "*.ts", { dot: true }), [
    ".hidden.ts"
  ])
})
