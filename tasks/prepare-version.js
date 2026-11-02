#!/usr/bin/env node

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const REPOSITORY = "mimalef70/fontara"
const REPOSITORY_ID = 141708904
const RELEASE_FILES = ["package.json", "src/manifest.json", "CHANGELOG.md"]
const REQUIRED_JOBS = [
  "verification / Check and build all packages",
  "verification / Chrome minimum 130",
  "verification / Chrome stable",
  "verification / Firefox stable",
  "verification / Firefox minimum 140 ESR"
]

function versionParts(version) {
  if (
    typeof version !== "string" ||
    version !== version.trim() ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  ) {
    throw new Error("Use a stable three-part version, for example 5.2.0.")
  }
  const parts = version.split(".").map(Number)
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) {
    throw new Error("Version components must fit Chrome's 0–65535 limits.")
  }
  return parts
}

function assertNewerVersion(version, previous) {
  const parts = versionParts(version)
  const old = versionParts(previous)
  const firstDifference = parts.findIndex((part, index) => part !== old[index])
  if (firstDifference < 0 || parts[firstDifference] < old[firstDifference]) {
    throw new Error(`Version ${version} must be newer than ${previous}.`)
  }
}

function updateJSONVersion(source, version) {
  const parsed = JSON.parse(source)
  versionParts(parsed.version)
  let matches = 0
  const updated = source.replace(
    /^(\s{2}"version"\s*:\s*")[^"]+("\s*,?\s*)$/gm,
    (_match, prefix, suffix) => {
      matches += 1
      return `${prefix}${version}${suffix}`
    }
  )
  if (matches !== 1 || JSON.parse(updated).version !== version) {
    throw new Error("Expected exactly one top-level JSON version field.")
  }
  return updated
}

function releaseChangelog(source, version, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid release date.")
  const lines = source.split(/\r?\n/)
  const starts = lines.flatMap((line, index) =>
    line === "## Unreleased" ? [index] : []
  )
  if (starts.length !== 1) throw new Error("Expected one Unreleased heading.")
  if (
    lines.some(
      (line) => line === `## ${version}` || line.startsWith(`## ${version} - `)
    )
  ) {
    throw new Error("This version already has a changelog entry.")
  }
  const start = starts[0]
  let end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## ")
  )
  if (end < 0) end = lines.length
  const notes = lines
    .slice(start + 1, end)
    .join("\n")
    .trim()
  if (!notes) throw new Error("Unreleased must contain reviewed release notes.")
  return [
    ...lines.slice(0, start),
    "## Unreleased",
    "",
    `## ${version} - ${date}`,
    "",
    notes,
    "",
    ...lines.slice(end)
  ].join("\n")
}

function createPreparationPlan(files, version, date) {
  const previous = JSON.parse(files["package.json"]).version
  if (JSON.parse(files["src/manifest.json"]).version !== previous) {
    throw new Error("Package and source manifest versions disagree.")
  }
  assertNewerVersion(version, previous)
  return {
    action: "prepare",
    version,
    previous,
    tag: `v${version}`,
    branch: `codex/release-${version}`,
    files: {
      "package.json": updateJSONVersion(files["package.json"], version),
      "src/manifest.json": updateJSONVersion(
        files["src/manifest.json"],
        version
      ),
      "CHANGELOG.md": releaseChangelog(files["CHANGELOG.md"], version, date)
    }
  }
}

function assertCanonicalRemote(urls) {
  const accepted = new Set([
    `https://github.com/${REPOSITORY}.git`,
    `https://github.com/${REPOSITORY}`,
    `git@github.com:${REPOSITORY}.git`,
    `ssh://git@github.com/${REPOSITORY}.git`
  ])
  if (urls.length !== 1 || !accepted.has(urls[0])) {
    throw new Error(
      "origin must fetch and push only the canonical FontARA repository."
    )
  }
}

function parseRemoteRefs(output) {
  const refs = new Map()
  for (const line of output.trim().split("\n").filter(Boolean)) {
    const match = /^([0-9a-f]{40})\s+(refs\/\S+)$/.exec(line)
    if (!match || refs.has(match[2]))
      throw new Error("Ambiguous remote references.")
    refs.set(match[2], match[1])
  }
  return refs
}

function runProcess(command, args, options) {
  return spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  })
}

function createContext({
  cwd = process.cwd(),
  run = runProcess,
  log = console.log
} = {}) {
  const raw = (command, args, extra = {}) =>
    run(command, args, { cwd, ...extra })
  const command = (executable, args, extra) => {
    const result = raw(executable, args, extra)
    if (result.error || result.status !== 0) {
      // Do not print subprocess stderr, which may contain credential-bearing URLs.
      throw new Error(
        `${executable} ${args[0]} failed; inspect local authentication/command output separately.`
      )
    }
    return String(result.stdout || "").trimEnd()
  }
  const git = (...args) => command("git", args)
  const github = (endpoint) =>
    JSON.parse(
      command("gh", [
        "api",
        "--hostname",
        "github.com",
        `repos/${REPOSITORY}/${endpoint}`
      ])
    )
  return { cwd, raw, command, git, github, log }
}

function assertClean(context) {
  if (context.git("status", "--porcelain=v1", "--untracked-files=all")) {
    throw new Error(
      "The worktree and index must be clean before release operations."
    )
  }
}

function inspectRepository(context, version) {
  versionParts(version)
  assertClean(context)
  for (const args of [
    ["remote", "get-url", "--all", "origin"],
    ["remote", "get-url", "--push", "--all", "origin"]
  ]) {
    assertCanonicalRemote(context.git(...args).split("\n"))
  }
  const repository = context.github("")
  if (
    repository.id !== REPOSITORY_ID ||
    repository.full_name !== REPOSITORY ||
    repository.default_branch !== "master"
  ) {
    throw new Error("Unexpected repository identity or default branch.")
  }
  const refs = parseRemoteRefs(
    context.git(
      "ls-remote",
      "--refs",
      "origin",
      "refs/heads/master",
      `refs/tags/v${version}`,
      `refs/heads/codex/release-${version}`
    )
  )
  if (!refs.has("refs/heads/master"))
    throw new Error("Remote master is missing.")
  if (refs.has(`refs/tags/v${version}`))
    throw new Error(
      "The release tag already exists; it will not be overwritten."
    )
  const localTag = context.raw("git", [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/tags/v${version}`
  ])
  if (localTag.status !== 1 || localTag.error)
    throw new Error("The local tag exists or could not be checked.")
  return refs
}

function assertPreparationBase(context, refs, branch) {
  const remote = refs.get("refs/heads/master")
  if (
    context.git("branch", "--show-current") !== "master" ||
    context.git("rev-parse", "HEAD") !== remote ||
    context.git("rev-parse", "origin/master") !== remote
  ) {
    throw new Error(
      "Prepare from clean master matching both origin/master and live remote master."
    )
  }
  if (refs.has(`refs/heads/${branch}`))
    throw new Error("The remote release branch already exists.")
  const local = context.raw("git", [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`
  ])
  if (local.status !== 1 || local.error)
    throw new Error("The local release branch exists or could not be checked.")
}

function showDiff(name, before, after) {
  const old = before.split("\n"),
    next = after.split("\n")
  let start = 0
  while (
    start < old.length &&
    start < next.length &&
    old[start] === next[start]
  )
    start++
  let oldEnd = old.length,
    newEnd = next.length
  while (
    oldEnd > start &&
    newEnd > start &&
    old[oldEnd - 1] === next[newEnd - 1]
  ) {
    oldEnd--
    newEnd--
  }
  const from = Math.max(0, start - 3)
  const tail = Math.min(3, old.length - oldEnd)
  return [
    `--- a/${name}`,
    `+++ b/${name}`,
    `@@ -${from + 1},${oldEnd + tail - from} +${from + 1},${newEnd + tail - from} @@`,
    ...old.slice(from, start).map((line) => ` ${line}`),
    ...old.slice(start, oldEnd).map((line) => `-${line}`),
    ...next.slice(start, newEnd).map((line) => `+${line}`),
    ...old.slice(oldEnd, oldEnd + tail).map((line) => ` ${line}`)
  ].join("\n")
}

function prepareVersion(options, context = createContext()) {
  const refs = inspectRepository(context, options.version)
  const branch = `codex/release-${options.version}`
  assertPreparationBase(context, refs, branch)
  const files = Object.fromEntries(
    RELEASE_FILES.map((name) => {
      const file = path.join(context.cwd, name)
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
        throw new Error(`Unsafe release input: ${name}`)
      return [name, fs.readFileSync(file, "utf8")]
    })
  )
  const plan = createPreparationPlan(
    files,
    options.version,
    options.date || new Date().toISOString().slice(0, 10)
  )
  for (const name of RELEASE_FILES)
    context.log(showDiff(name, files[name], plan.files[name]))
  context.log(
    `Plan: ${plan.branch} → PR against master. pnpm-lock.yaml is unchanged: its importer does not store the root package version.`
  )
  if (options.dryRun) return plan

  assertClean(context)
  const freshRefs = inspectRepository(context, options.version)
  assertPreparationBase(context, freshRefs, branch)
  for (const name of RELEASE_FILES) {
    if (fs.readFileSync(path.join(context.cwd, name), "utf8") !== files[name])
      throw new Error("A release input changed while planning.")
  }
  context.git("switch", "-c", branch)
  for (const name of RELEASE_FILES)
    fs.writeFileSync(path.join(context.cwd, name), plan.files[name])
  context.command("pnpm", ["check:release-version", "--source-only"], {
    env: {
      ...process.env,
      GITHUB_REF_NAME: plan.tag,
      FONTARA_RELEASE_TAG: plan.tag
    }
  })
  context.git("diff", "--check")
  context.log(context.git("diff", "--", ...RELEASE_FILES))
  context.git("add", "--", ...RELEASE_FILES)
  const staged = context
    .git("diff", "--cached", "--name-only")
    .split("\n")
    .sort()
  if (JSON.stringify(staged) !== JSON.stringify([...RELEASE_FILES].sort()))
    throw new Error("Unexpected staged files; nothing was committed or pushed.")
  context.log(context.git("diff", "--cached", "--stat"))
  context.log(context.git("diff", "--cached", "--name-status"))
  context.log(context.git("diff", "--cached", "--", ...RELEASE_FILES))
  for (const name of RELEASE_FILES) {
    if (context.git("show", `:${name}`) !== plan.files[name].trimEnd())
      throw new Error("Staged release content differs from the reviewed plan.")
  }
  context.git("commit", "-m", `Prepare FontARA ${plan.version} release`)
  assertClean(context)
  if (context.git("rev-parse", "HEAD^") !== refs.get("refs/heads/master"))
    throw new Error("Release commit parent changed unexpectedly.")
  for (const name of RELEASE_FILES) {
    if (context.git("show", `HEAD:${name}`) !== plan.files[name].trimEnd())
      throw new Error(
        "Committed release content differs from the reviewed plan."
      )
  }
  context.log(context.git("log", "-1", "--oneline"))
  context.log(context.git("status", "--branch", "--short"))
  context.log(context.git("log", "--oneline", "origin/master..HEAD"))
  context.git("push", "--set-upstream", "origin", `HEAD:refs/heads/${branch}`)
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fontara-release-pr-")
  )
  try {
    const body = path.join(directory, "body.md")
    fs.writeFileSync(
      body,
      `Prepare FontARA ${plan.version} from ${refs.get("refs/heads/master")} with synchronized package/manifest versions and the reviewed Unreleased changelog. No dependencies change.\n\nValidation: source version consistency passed; the PR must pass the full CI matrix before merge. After merge, publish its exact merge commit with:\n\n\`pnpm release:publish --version ${plan.version} --pr <this PR number>\`\n\nThe publish command verifies merged PR identity, version, ancestry and successful CI before creating the release tag. Tag publication submits packages to both stores; approval remains with the stores.\n`,
      { mode: 0o600 }
    )
    plan.pullRequest = context.command("gh", [
      "pr",
      "create",
      "--repo",
      `https://github.com/${REPOSITORY}`,
      "--base",
      "master",
      "--head",
      branch,
      "--title",
      `Release FontARA ${plan.version}`,
      "--body-file",
      body
    ])
    context.log(plan.pullRequest)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
  return plan
}

function assertMergedReleasePR(pr, version, number, files) {
  if (
    pr.number !== number ||
    !pr.merged ||
    !pr.merged_at ||
    pr.base?.ref !== "master" ||
    pr.base?.repo?.id !== REPOSITORY_ID ||
    pr.head?.ref !== `codex/release-${version}` ||
    pr.head?.repo?.full_name !== REPOSITORY ||
    !/^[0-9a-f]{40}$/.test(pr.merge_commit_sha || "")
  ) {
    throw new Error(
      "Expected a merged release-preparation PR from this repository into master."
    )
  }
  if (
    pr.changed_files !== RELEASE_FILES.length ||
    files.length !== RELEASE_FILES.length ||
    files.some((file) => file.status !== "modified") ||
    JSON.stringify(files.map((file) => file.filename).sort()) !==
      JSON.stringify([...RELEASE_FILES].sort())
  ) {
    throw new Error(
      "The release PR must change only package.json, src/manifest.json and CHANGELOG.md."
    )
  }
}

function assertReleaseCI(run, jobs, sha, workflowId) {
  if (
    !run ||
    run.head_sha !== sha ||
    run.head_branch !== "master" ||
    run.event !== "push" ||
    run.path !== ".github/workflows/ci.yml" ||
    run.workflow_id !== workflowId ||
    run.repository?.id !== REPOSITORY_ID ||
    run.head_repository?.id !== REPOSITORY_ID ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  ) {
    throw new Error(
      "The latest CI run for the exact release merge commit must succeed on master."
    )
  }
  for (const name of REQUIRED_JOBS) {
    const matches = jobs.filter((job) => job.name === name)
    if (
      matches.length !== 1 ||
      matches[0].conclusion !== "success" ||
      matches[0].status !== "completed"
    )
      throw new Error(`Required CI gate is not successful: ${name}`)
  }
}

function readRemoteFile(context, name, sha) {
  const file = context.github(`contents/${name}?ref=${sha}`)
  if (
    file.type !== "file" ||
    file.encoding !== "base64" ||
    file.size > 2 * 1024 * 1024 ||
    typeof file.content !== "string"
  )
    throw new Error(`Invalid reviewed release file: ${name}`)
  return Buffer.from(file.content, "base64").toString("utf8")
}

function publishVersion(options, context = createContext()) {
  const refs = inspectRepository(context, options.version)
  if (!Number.isSafeInteger(options.pr) || options.pr <= 0)
    throw new Error("A merged release PR number is required.")
  const pr = context.github(`pulls/${options.pr}`)
  const files = context.github(`pulls/${options.pr}/files?per_page=100`)
  assertMergedReleasePR(pr, options.version, options.pr, files)
  const sha = pr.merge_commit_sha
  const remoteMaster = refs.get("refs/heads/master")
  const comparison = context.github(`compare/${sha}...${remoteMaster}`)
  if (comparison.merge_base_commit?.sha !== sha)
    throw new Error("The release commit must remain an ancestor of master.")
  for (const name of ["package.json", "src/manifest.json"]) {
    if (
      JSON.parse(readRemoteFile(context, name, sha)).version !== options.version
    )
      throw new Error("The reviewed release commit has the wrong version.")
  }
  if (
    JSON.parse(readRemoteFile(context, "package.json", remoteMaster))
      .version !== options.version
  )
    throw new Error(
      "Master has moved to another version; this release would be stale."
    )
  const changelog = readRemoteFile(context, "CHANGELOG.md", sha)
  const heading = new RegExp(
    `^## ${options.version.replace(/\./g, "\\.")} - \\d{4}-\\d{2}-\\d{2}\\n\\n([^]+?)(?=^## |$)`,
    "m"
  )
  if (!heading.exec(changelog)?.[1]?.trim())
    throw new Error("The reviewed release has no versioned changelog notes.")
  const workflow = context.github("actions/workflows/ci.yml")
  const runs =
    context.github(
      `actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`
    ).workflow_runs || []
  const run = runs.find((candidate) => candidate.head_sha === sha)
  const jobs = run
    ? context.github(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`)
        .jobs || []
    : []
  assertReleaseCI(run, jobs, sha, workflow.id)
  const plan = {
    action: "publish",
    version: options.version,
    tag: `v${options.version}`,
    sha,
    pr: options.pr,
    ciRun: run.id
  }
  context.log(
    `Plan: annotated ${plan.tag} at reviewed PR #${plan.pr} merge ${sha}, verified by CI run ${run.id}. Pushing this tag starts real store submissions.`
  )
  if (options.dryRun) return plan
  assertClean(context)
  inspectRepository(context, options.version)
  context.git("fetch", "--no-tags", "origin", sha)
  if (context.git("rev-parse", `${sha}^{commit}`) !== sha)
    throw new Error("Fetched release commit mismatch.")
  context.git(
    "tag",
    "--annotate",
    plan.tag,
    sha,
    "--message",
    `FontARA ${plan.version} (reviewed PR #${plan.pr})`
  )
  context.log(context.git("status", "--branch", "--short"))
  context.log(context.git("log", "-1", "--oneline", sha))
  context.git("push", "origin", `refs/tags/${plan.tag}`)
  const published = parseRemoteRefs(
    context.git(
      "ls-remote",
      "origin",
      `refs/tags/${plan.tag}`,
      `refs/tags/${plan.tag}^{}`
    )
  )
  if (published.get(`refs/tags/${plan.tag}^{}`) !== sha)
    throw new Error(
      "Remote annotated tag does not resolve to the reviewed commit."
    )
  context.log(
    `Release triggered: https://github.com/${REPOSITORY}/actions/workflows/release.yml`
  )
  return plan
}

function parseArguments(argv) {
  const [action, ...args] = argv
  if (!["prepare", "publish"].includes(action))
    throw new Error(
      "Usage: prepare-version.js prepare|publish --version X.Y.Z [--pr N] [--dry-run]"
    )
  const options = { action }
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (key === "--dry-run" && options.dryRun === undefined)
      options.dryRun = true
    else if (
      ["--version", "--pr"].includes(key) &&
      options[key.slice(2)] === undefined &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    ) {
      options[key.slice(2)] = args[++index]
    } else throw new Error(`Invalid or duplicate argument: ${key}`)
  }
  versionParts(options.version)
  if (action === "publish") {
    if (!/^[1-9]\d*$/.test(options.pr || ""))
      throw new Error("Publish requires --pr N.")
    options.pr = Number(options.pr)
  } else if (options.pr !== undefined)
    throw new Error("--pr is only valid for publish.")
  return options
}

function main(argv = process.argv.slice(2), dependencies) {
  const options = parseArguments(argv)
  const context = createContext(dependencies)
  const top = context.git("rev-parse", "--show-toplevel")
  if (fs.realpathSync(top) !== fs.realpathSync(context.cwd))
    throw new Error("Run release commands from the repository root.")
  return options.action === "prepare"
    ? prepareVersion(options, context)
    : publishVersion(options, context)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = {
  RELEASE_FILES,
  REQUIRED_JOBS,
  versionParts,
  assertNewerVersion,
  updateJSONVersion,
  releaseChangelog,
  createPreparationPlan,
  assertCanonicalRemote,
  parseRemoteRefs,
  assertMergedReleasePR,
  assertReleaseCI,
  createContext,
  prepareVersion,
  publishVersion,
  parseArguments,
  main
}
