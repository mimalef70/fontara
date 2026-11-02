import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const require = createRequire(import.meta.url)
const {
  RELEASE_FILES,
  REQUIRED_JOBS,
  versionParts,
  assertNewerVersion,
  createPreparationPlan,
  assertCanonicalRemote,
  assertReleaseCI,
  parseArguments,
  createContext,
  prepareVersion,
  publishVersion
} = require("../../tasks/prepare-version.js")

const sha = "a".repeat(40)
const repository = {
  id: 141708904,
  full_name: "mimalef70/fontara",
  default_branch: "master"
}
const inputs = {
  "package.json": '{\n  "name": "fontara",\n  "version": "5.1.0"\n}\n',
  "src/manifest.json": '{\n  "manifest_version": 3,\n  "version": "5.1.0"\n}\n',
  "CHANGELOG.md":
    "# Changelog\n\n## Unreleased\n\n- Keep RTL menus visible.\n\n## 5.1.0 - 2026-11-01\n\n- Original release.\n"
}
const options = { version: "5.2.0", date: "2026-11-02" }
const pr = {
  number: 190,
  merged: true,
  merged_at: "2026-11-02T12:00:00Z",
  base: { ref: "master", repo: repository },
  head: { ref: "codex/release-5.2.0", repo: repository },
  merge_commit_sha: sha,
  changed_files: 3
}
const run = {
  id: 800,
  head_sha: sha,
  head_branch: "master",
  event: "push",
  path: ".github/workflows/ci.yml",
  workflow_id: 100,
  repository,
  head_repository: repository,
  status: "completed",
  conclusion: "success"
}
const jobs = REQUIRED_JOBS.map((name: string) => ({
  name,
  status: "completed",
  conclusion: "success"
}))
type Command = { command: string; args: string[] }

function publishFixture(
  overrides: Record<string, unknown> = {},
  existingTag = false
) {
  const calls: Command[] = []
  const prepared = createPreparationPlan(
    inputs,
    options.version,
    options.date
  ).files
  const responses: Record<string, unknown> = {
    "": repository,
    "pulls/190": pr,
    "pulls/190/files?per_page=100": RELEASE_FILES.map((filename: string) => ({
      filename,
      status: "modified"
    })),
    [`compare/${sha}...${sha}`]: { merge_base_commit: { sha } },
    "actions/workflows/ci.yml": { id: 100 },
    [`actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`]: {
      workflow_runs: [run]
    },
    "actions/runs/800/jobs?filter=latest&per_page=100": { jobs },
    ...Object.fromEntries(
      Object.entries(prepared).map(([name, source]) => [
        `contents/${name}?ref=${sha}`,
        {
          type: "file",
          encoding: "base64",
          size: String(source).length,
          content: Buffer.from(String(source)).toString("base64")
        }
      ])
    ),
    ...overrides
  }
  const context = createContext({
    cwd: process.cwd(),
    log() {},
    run(command: string, args: string[]) {
      calls.push({ command, args })
      if (command === "gh" && args[0] === "api") {
        const endpoint = args[args.length - 1].replace(
          "repos/mimalef70/fontara/",
          ""
        )
        assert.ok(
          Object.getOwnPropertyDescriptor(responses, endpoint),
          `Unexpected endpoint: ${endpoint}`
        )
        return { status: 0, stdout: JSON.stringify(responses[endpoint]) }
      }
      if (command === "git") {
        if (args[0] === "status") return { status: 0, stdout: "" }
        if (args[0] === "remote")
          return { status: 0, stdout: "git@github.com:mimalef70/fontara.git\n" }
        if (args[0] === "show-ref") return { status: 1, stdout: "" }
        if (args[0] === "ls-remote") {
          return {
            status: 0,
            stdout: args.includes("--refs")
              ? `${sha}\trefs/heads/master\n${existingTag ? `${sha}\trefs/tags/v5.2.0\n` : ""}`
              : `${"b".repeat(40)}\trefs/tags/v5.2.0\n${sha}\trefs/tags/v5.2.0^{}\n`
          }
        }
        if (args[0] === "rev-parse") return { status: 0, stdout: sha }
        if (args[0] === "log")
          return { status: 0, stdout: `${sha} Reviewed release` }
        if (["fetch", "tag", "push"].includes(args[0]))
          return { status: 0, stdout: "" }
      }
      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`)
    }
  })
  return { context, calls }
}

function temporaryRepository(t: { after: (cleanup: () => void) => void }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fontara-version-test-"))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  fs.mkdirSync(path.join(cwd, "src"))
  fs.mkdirSync(path.join(cwd, "tasks"))
  for (const [name, source] of Object.entries(inputs))
    fs.writeFileSync(path.join(cwd, name), source)
  fs.writeFileSync(path.join(cwd, ".gitignore"), "build/\n")
  fs.copyFileSync(
    path.resolve("tasks/check-release-version.js"),
    path.join(cwd, "tasks/check-release-version.js")
  )
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git("init", "--initial-branch=master")
  git("config", "user.name", "FontARA test")
  git("config", "user.email", "test@example.invalid")
  git("config", "commit.gpgsign", "false")
  git("config", "core.hooksPath", "/dev/null")
  git(
    "add",
    "--",
    ...RELEASE_FILES,
    ".gitignore",
    "tasks/check-release-version.js"
  )
  git("commit", "-m", "Test baseline")
  const base = git("rev-parse", "HEAD")
  git("remote", "add", "origin", "https://github.com/mimalef70/fontara.git")
  git("update-ref", "refs/remotes/origin/master", base)
  const calls: Command[] = []
  const context = createContext({
    cwd,
    log() {},
    run(command: string, args: string[], extra: { env?: NodeJS.ProcessEnv }) {
      calls.push({ command, args })
      if (command === "gh") {
        if (args[0] === "api")
          return { status: 0, stdout: JSON.stringify(repository) }
        assert.deepEqual(args.slice(0, 2), ["pr", "create"])
        const bodyPath = args[args.indexOf("--body-file") + 1]
        assert.match(
          fs.readFileSync(bodyPath, "utf8"),
          /pnpm release:publish --version 5\.2\.0/
        )
        return {
          status: 0,
          stdout: "https://github.com/mimalef70/fontara/pull/190"
        }
      }
      if (command === "git" && args[0] === "ls-remote")
        return { status: 0, stdout: `${base}\trefs/heads/master\n` }
      if (command === "git" && args[0] === "push")
        return { status: 0, stdout: "" }
      if (command === "pnpm") {
        assert.deepEqual(args, ["check:release-version", "--source-only"])
        return spawnSync(
          process.execPath,
          ["tasks/check-release-version.js", "--source-only"],
          { cwd, env: extra.env, encoding: "utf8" }
        )
      }
      return spawnSync(command, args, { cwd, encoding: "utf8" })
    }
  })
  return { cwd, git, base, context, calls }
}

test("release versions are strict increasing stable Chrome-compatible triples", () => {
  assert.deepEqual(versionParts("5.2.0"), [5, 2, 0])
  assert.doesNotThrow(() => assertNewerVersion("6.0.0", "5.99.99"))
  for (const value of [
    "v5.2.0",
    "5.2",
    "05.2.0",
    "5.2.0-beta.1",
    "65536.0.0",
    "0.0.0",
    "5.2.0\n",
    "5.2.0;echo bad"
  ])
    assert.throws(() => versionParts(value))
  for (const value of ["5.1.0", "5.0.99", "4.99.99"])
    assert.throws(() => assertNewerVersion(value, "5.1.0"), /newer/)
  assert.throws(() =>
    parseArguments(["publish", "--version", "5.2.0", "--pr", "1x"])
  )
  assert.throws(() =>
    parseArguments(["prepare", "--version", "5.2.0", "--version", "5.3.0"])
  )
})

test("preparation moves notes and preserves all unrelated manifest/package metadata", () => {
  const plan = createPreparationPlan(inputs, options.version, options.date)
  assert.deepEqual(Object.keys(plan.files), RELEASE_FILES)
  assert.deepEqual(JSON.parse(plan.files["package.json"]), {
    name: "fontara",
    version: "5.2.0"
  })
  assert.match(
    plan.files["CHANGELOG.md"],
    /## Unreleased\n\n## 5\.2\.0 - 2026-11-02\n\n- Keep RTL menus visible\./
  )
  assert.ok(
    plan.files["CHANGELOG.md"].endsWith(
      "## 5.1.0 - 2026-11-01\n\n- Original release.\n"
    )
  )
  assert.throws(
    () =>
      createPreparationPlan(
        { ...inputs, "CHANGELOG.md": "## Unreleased\n\n## 5.1.0\n- Earlier" },
        options.version,
        options.date
      ),
    /reviewed release notes/
  )
  assert.throws(
    () =>
      createPreparationPlan(
        { ...inputs, "src/manifest.json": '{"version":"5.0.0"}' },
        options.version,
        options.date
      ),
    /disagree/
  )
})

test("release commands reject forks, credential-bearing remotes and multiple push URLs", () => {
  assert.doesNotThrow(() =>
    assertCanonicalRemote(["git@github.com:mimalef70/fontara.git"])
  )
  for (const urls of [
    ["https://github.com/fork/fontara.git"],
    ["https://token@github.com/mimalef70/fontara.git"],
    ["https://github.com/mimalef70/fontara.git", "https://other.example/repo"]
  ])
    assert.throws(() => assertCanonicalRemote(urls), /canonical/)
})

test("prepare dry-run leaves source, index, branch and HEAD untouched", (t) => {
  const fixture = temporaryRepository(t)
  const plan = prepareVersion({ ...options, dryRun: true }, fixture.context)
  assert.equal(plan.version, "5.2.0")
  for (const [name, source] of Object.entries(inputs))
    assert.equal(fs.readFileSync(path.join(fixture.cwd, name), "utf8"), source)
  assert.equal(fixture.git("status", "--porcelain"), "")
  assert.equal(fixture.git("rev-parse", "HEAD"), fixture.base)
  assert.equal(fixture.git("branch", "--show-current"), "master")
  assert.equal(
    fixture.calls.some(
      ({ command, args }) =>
        command === "git" &&
        ["switch", "add", "commit", "push", "fetch", "tag"].includes(args[0])
    ),
    false
  )
})

test("prepare rejects dirty worktrees and local branches that differ from remote master", (t) => {
  const fixture = temporaryRepository(t)
  fs.writeFileSync(path.join(fixture.cwd, "user-work.txt"), "do not stage")
  assert.throws(
    () => prepareVersion({ ...options, dryRun: true }, fixture.context),
    /clean/
  )
  fs.unlinkSync(path.join(fixture.cwd, "user-work.txt"))
  fixture.git("switch", "-c", "codex/some-feature")
  assert.throws(
    () => prepareVersion({ ...options, dryRun: true }, fixture.context),
    /matching/
  )
})

test("prepare creates one reviewed source-only commit and a release PR without staging build artifacts", (t) => {
  const fixture = temporaryRepository(t)
  fs.mkdirSync(path.join(fixture.cwd, "build/chrome-mv3-prod"), {
    recursive: true
  })
  fs.writeFileSync(
    path.join(fixture.cwd, "build/chrome-mv3-prod/manifest.json"),
    '{"version":"5.1.0"}'
  )
  const plan = prepareVersion(options, fixture.context)
  assert.equal(
    plan.pullRequest,
    "https://github.com/mimalef70/fontara/pull/190"
  )
  assert.equal(fixture.git("branch", "--show-current"), "codex/release-5.2.0")
  assert.equal(fixture.git("rev-parse", "HEAD^"), fixture.base)
  assert.deepEqual(
    fixture.git("diff", "--name-only", "HEAD^", "HEAD").split("\n").sort(),
    [...RELEASE_FILES].sort()
  )
  assert.equal(fixture.git("status", "--porcelain"), "")
  assert.ok(
    fixture.calls.some(
      ({ command, args }) =>
        command === "git" &&
        args[0] === "push" &&
        args[args.length - 1] === "HEAD:refs/heads/codex/release-5.2.0"
    )
  )
})

test("source-only version validation ignores stale build output without weakening normal validation", (t) => {
  const fixture = temporaryRepository(t)
  fs.mkdirSync(path.join(fixture.cwd, "build/chrome-mv3-prod"), {
    recursive: true
  })
  fs.writeFileSync(
    path.join(fixture.cwd, "build/chrome-mv3-prod/manifest.json"),
    '{"version":"5.0.0"}'
  )
  const validate = (...args: string[]) =>
    spawnSync(process.execPath, ["tasks/check-release-version.js", ...args], {
      cwd: fixture.cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REF_NAME: "master",
        FONTARA_RELEASE_TAG: ""
      }
    })
  assert.notEqual(validate().status, 0)
  assert.equal(validate("--source-only").status, 0)
  fs.writeFileSync(
    path.join(fixture.cwd, "src/manifest.json"),
    '{"version":"5.0.0"}'
  )
  assert.notEqual(validate("--source-only").status, 0)
})

test("publish dry-run verifies the exact merged commit without creating tags or fetching", () => {
  const fixture = publishFixture()
  const plan = publishVersion(
    { version: "5.2.0", pr: 190, dryRun: true },
    fixture.context
  )
  assert.equal(plan.sha, sha)
  assert.equal(plan.ciRun, 800)
  assert.equal(
    fixture.calls.some(
      ({ command, args }) =>
        command === "git" && ["tag", "push", "fetch"].includes(args[0])
    ),
    false
  )
})

test("publish rejects unmerged PRs, mismatched release branches and extra changed files", () => {
  for (const change of [
    { merged: false },
    { head: { ...pr.head, ref: "codex/other" } },
    { changed_files: 4 }
  ]) {
    const fixture = publishFixture({ "pulls/190": { ...pr, ...change } })
    assert.throws(
      () =>
        publishVersion(
          { version: "5.2.0", pr: 190, dryRun: true },
          fixture.context
        ),
      /release/
    )
  }
})

test("publish never overwrites an existing tag or releases a detached/stale version", () => {
  const existing = publishFixture({}, true)
  assert.throws(
    () =>
      publishVersion(
        { version: "5.2.0", pr: 190, dryRun: true },
        existing.context
      ),
    /already exists/
  )
  const detached = publishFixture({
    [`compare/${sha}...${sha}`]: { merge_base_commit: { sha: "c".repeat(40) } }
  })
  assert.throws(
    () =>
      publishVersion(
        { version: "5.2.0", pr: 190, dryRun: true },
        detached.context
      ),
    /ancestor/
  )
  const stale = publishFixture({
    [`contents/package.json?ref=${sha}`]: {
      type: "file",
      encoding: "base64",
      size: 21,
      content: Buffer.from('{"version":"5.3.0"}').toString("base64")
    }
  })
  assert.throws(
    () =>
      publishVersion(
        { version: "5.2.0", pr: 190, dryRun: true },
        stale.context
      ),
    /wrong version/
  )
  assert.equal(
    [existing, detached, stale].some(({ calls }) =>
      calls.some(
        ({ command, args }) =>
          command === "git" && ["tag", "push", "fetch"].includes(args[0])
      )
    ),
    false
  )
})

test("publication requires the latest exact commit CI and all five jobs, never an older green attempt", () => {
  assert.doesNotThrow(() => assertReleaseCI(run, jobs, sha, 100))
  for (const change of [
    { conclusion: "failure" },
    { status: "in_progress" },
    { event: "pull_request" },
    { head_sha: "b".repeat(40) }
  ])
    assert.throws(
      () => assertReleaseCI({ ...run, ...change }, jobs, sha, 100),
      /latest CI/
    )
  assert.throws(
    () => assertReleaseCI(run, jobs.slice(1), sha, 100),
    /Required CI/
  )
  const fixture = publishFixture({
    [`actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`]: {
      workflow_runs: [{ ...run, conclusion: "failure" }, run]
    }
  })
  assert.throws(
    () =>
      publishVersion(
        { version: "5.2.0", pr: 190, dryRun: true },
        fixture.context
      ),
    /latest CI/
  )
})

test("publish creates an annotated tag at the reviewed SHA and pushes only that tag", () => {
  const fixture = publishFixture()
  publishVersion({ version: "5.2.0", pr: 190 }, fixture.context)
  const tag = fixture.calls.find(
    ({ command, args }) => command === "git" && args[0] === "tag"
  )
  assert.deepEqual(tag?.args.slice(0, 4), ["tag", "--annotate", "v5.2.0", sha])
  const pushes = fixture.calls.filter(
    ({ command, args }) => command === "git" && args[0] === "push"
  )
  assert.deepEqual(
    pushes.map(({ args }) => args),
    [["push", "origin", "refs/tags/v5.2.0"]]
  )
})
