import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { runInNewContext } from "node:vm"

const require = createRequire(import.meta.url)

test("reviewer source archives retain build scan exclusions without packaging ignored data", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-source-package-"))
  const ignore = "/node_modules\n/build\n.env*\n!.env.example\n"
  try {
    for (const name of [
      "CHANGELOG.md",
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "FIREFOX_SOURCE_README.md",
      "LICENSE",
      "README.md",
      "SECURITY.md",
      "THIRD_PARTY_NOTICES.md",
      ".env.example",
      "biome.json",
      "components.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "postcss.config.js",
      "tailwind.config.js",
      "tsconfig.json"
    ]) {
      fs.writeFileSync(path.join(root, name), "fixture\n")
    }
    for (const directory of [
      ".github/actions",
      ".github/workflows",
      "FONT_LICENSES",
      "assets",
      "docs",
      "src",
      "tasks",
      "tests",
      "node_modules",
      "build"
    ]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true })
    }
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"5.1.0"}')
    fs.writeFileSync(path.join(root, ".gitignore"), ignore)
    fs.writeFileSync(path.join(root, ".env.local"), "private fixture")
    fs.writeFileSync(path.join(root, "node_modules/dependency.js"), "generated")
    fs.writeFileSync(path.join(root, "build/bundle.js"), "generated")
    fs.writeFileSync(path.join(root, "src/style.css"), '@import "tailwindcss";')

    const source = fs.readFileSync(
      path.resolve("tasks/source-package.js"),
      "utf8"
    )
    const module = { exports: {} }
    runInNewContext(source, {
      module,
      require: (name: string) => {
        if (name === "./paths") {
          return {
            absolutePath: (...parts: string[]) => path.join(root, ...parts)
          }
        }
        if (name === "node:child_process") {
          return {
            exec: (
              _command: string,
              callback: (error: null, result: string) => void
            ) => callback(null, "1793518209")
          }
        }
        return require(name)
      },
      process: { env: { ...process.env } }
    })
    const createSourcePackage = module.exports as () => Promise<string>
    const archive = await createSourcePackage()
    const contents = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))",
          archive
        ],
        { encoding: "utf8" }
      )
    ) as Record<string, string>
    const names = Object.keys(contents)

    assert.equal(contents[".gitignore"], ignore)
    assert.equal(contents["src/style.css"], '@import "tailwindcss";')
    assert.ok(names.includes(".env.example"))
    assert.equal(names.includes(".env.local"), false)
    assert.equal(
      names.some((name) => name.startsWith("node_modules/")),
      false
    )
    assert.equal(
      names.some((name) => name.startsWith("build/")),
      false
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
