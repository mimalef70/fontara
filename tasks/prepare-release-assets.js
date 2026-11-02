#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createHash } = require("node:crypto")
const {
  GUID,
  SOURCE_SUPPLEMENT,
  sourceSupplementFor,
  verifySourceSupplement
} = require("./publish-firefox-store")

const {
  createProvenance,
  PROVENANCE_NAME,
  LEGACY_RELEASE
} = require("./release-provenance")
const { SBOM_NAME, MAX_SBOM_BYTES, validateSbom } = require("./generate-sbom")

const REPOSITORY = "mimalef70/fontara"
const TARGETS = ["chrome", "firefox", "edge", "brave", "opera", "safari"]
const START = "<!-- fontara-release-assets:start -->"
const END = "<!-- fontara-release-assets:end -->"
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

function readProductionInventory(file) {
  let descriptor
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK
    )
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
  try {
    const stat = fs.fstatSync(descriptor)
    if (!stat.isFile() || stat.size > MAX_SBOM_BYTES)
      throw new Error(
        "Production inventory must be a regular file within the size budget."
      )
    const bytes = Buffer.alloc(MAX_SBOM_BYTES + 1)
    let length = 0
    while (length < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        length,
        bytes.length - length,
        null
      )
      if (!count) break
      length += count
    }
    if (length > MAX_SBOM_BYTES)
      throw new Error("Production inventory exceeds the size budget.")
    return bytes.subarray(0, length)
  } finally {
    fs.closeSync(descriptor)
  }
}

function inspectZip(bytes, names) {
  if (bytes.length > 50 * 1024 * 1024)
    throw new Error("Release ZIP exceeds the 50 MiB archive budget.")
  try {
    return JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          [
            "import io,json,stat,sys,zipfile",
            "z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))",
            "entries=z.infolist(); names=[i.filename for i in entries]",
            "assert len(names)==len(set(names)), 'Duplicate ZIP member'",
            "assert all(not n.startswith('/') and '\\\\' not in n and '..' not in n.split('/') for n in names), 'Unsafe ZIP member'",
            "assert all(not stat.S_ISLNK(i.external_attr >> 16) for i in entries), 'ZIP symlink'",
            "assert all(i.file_size<50*1024*1024 for i in entries), 'Oversized ZIP member'",
            "assert sum(i.file_size for i in entries)<250*1024*1024, 'Oversized ZIP contents'",
            "assert z.testzip() is None, 'Corrupt ZIP member'",
            "wanted=json.loads(sys.argv[1])",
            "assert all(z.getinfo(n).file_size<2*1024*1024 for n in wanted), 'Oversized metadata'",
            "print(json.dumps({n:z.read(n).decode('utf-8') for n in wanted}))"
          ].join("\n"),
          JSON.stringify(names)
        ],
        {
          input: bytes,
          maxBuffer: 8 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"]
        }
      ).toString("utf8")
    )
  } catch {
    throw new Error("Release ZIP is invalid or is missing required metadata.")
  }
}

function changelogFor(changelog, version) {
  const lines = changelog.split(/\r?\n/u)
  const heading = `## ${version}`
  const start = lines.findIndex(
    (line) => line === heading || line.startsWith(`${heading} - `)
  )
  if (start < 0) throw new Error(`No changelog entry exists for ${version}.`)
  let end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## ")
  )
  if (end < 0) end = lines.length
  const notes = lines
    .slice(start + 1, end)
    .join("\n")
    .trim()
  if (!notes) throw new Error("Release changelog is empty.")
  return notes
}

function updateManagedSection(existing, section) {
  if (!section.startsWith(START) || !section.endsWith(END))
    throw new Error("Generated release section has invalid markers.")
  const count = (marker) => existing.split(marker).length - 1
  if (count(START) === 0 && count(END) === 0)
    return `${section}\n\n${existing.trim()}\n`
  if (count(START) !== 1 || count(END) !== 1)
    throw new Error(
      "Existing release body has ambiguous asset-section markers."
    )
  const start = existing.indexOf(START)
  const end = existing.indexOf(END)
  if (end < start)
    throw new Error("Existing release body has reversed asset-section markers.")
  return `${existing.slice(0, start)}${section}${existing.slice(end + END.length)}`
}

function releaseSection(info) {
  const download = (name) =>
    `https://github.com/${REPOSITORY}/releases/download/${info.tag}/${name}`
  const packageRow = (target, label, use) => {
    const file = info.packages.find((entry) => entry.target === target)
    return `| ${label} | [${file.name}](${download(file.name)}) | ${use} |`
  }
  return [
    START,
    `## FontARA ${info.version}`,
    "",
    "### Install from a browser store",
    "",
    "Store installation is recommended for normal use and automatic browser updates.",
    "",
    "- [Chrome, Edge and Brave — Chrome Web Store](https://chromewebstore.google.com/detail/dcjdhicepiklefpimapdkbaeoocniemc)",
    "- [Firefox — Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fontara-font-changer/)",
    "- [Opera — Opera Add-ons](https://addons.opera.com/en/extensions/details/fontara-font-changer/)",
    "",
    "Store review and rollout schedules are independent of this GitHub release. A store link may still offer an earlier version. Store-signed CRX/XPI downloads, when available, are listed separately below.",
    "",
    "### Download verified release packages",
    "",
    "These versioned ZIPs contain the exact original build bytes, with no rebuild or repacking. They are developer/reviewer packages, not store-signed installers.",
    "",
    "| Package | Download | Intended use |",
    "| --- | --- | --- |",
    packageRow(
      "chrome",
      "Chrome / Chromium MV3",
      `Load unpacked for development; Chromium ${info.minimumBrowsers.chromium}+`
    ),
    packageRow(
      "firefox",
      "Firefox MV3",
      `Unsigned test/review archive; Firefox ${info.minimumBrowsers.firefox}+ desktop`
    ),
    packageRow("edge", "Edge MV3", "Chromium-compatible developer package"),
    packageRow("brave", "Brave MV3", "Chromium-compatible developer package"),
    packageRow(
      "opera",
      "Opera MV3",
      "Developer package; manual browser validation"
    ),
    packageRow(
      "safari",
      "Safari experimental output",
      "Conversion/development input only; not an installable Safari app or App Store submission"
    ),
    packageRow(
      "source",
      "Reviewer source",
      "Source, dependency lockfile and build instructions"
    ),
    "",
    "For Chromium developer testing, extract the ZIP, open the browser's extension manager, enable Developer mode and select **Load unpacked**. Unsigned Firefox ZIPs are for temporary development loading, not permanent installation in normal Firefox. Use Mozilla Add-ons or an available Mozilla-signed XPI for normal Firefox installation.",
    "",
    "Safari output has not been validated as a Safari App Extension. Firefox Android is not covered by the desktop browser test matrix.",
    "",
    "### Integrity and build provenance",
    "",
    `- [SHA256SUMS](${download("SHA256SUMS")}) covers the original ZIPs, versioned aliases, available dependency inventory and build metadata.`,
    `- [build-info.json](${download("build-info.json")}) records the release commit, package hashes, manifest versions and required toolchain.`,
    ...(info.dependencyInventory
      ? [
          `- [Production dependency inventory (CycloneDX 1.6)](${download(SBOM_NAME)}) records the frozen production dependency graph, including peer and optional packages. This is a conservative inventory, not an exact list of tree-shaken bundled code or non-package assets.`
        ]
      : []),
    `- Source commit: [${info.commit}](${`https://github.com/${REPOSITORY}/commit/${info.commit}`}).`,
    `- [Full changelog at ${info.tag}](https://github.com/${REPOSITORY}/blob/${info.tag}/CHANGELOG.md).`,
    "",
    "After downloading the files, use `sha256sum --check --ignore-missing SHA256SUMS` (GNU tools), or compare `shasum -a 256 <downloaded-file>` on macOS with its entry in SHA256SUMS. Hashes detect file changes; they do not replace browser-store signatures.",
    ...(info.sourceCorrection
      ? [
          "",
          "The original 5.1.0 source omitted `.gitignore`. The versioned reviewer-source download uses the pinned additive correction: every original source entry is unchanged and only that exact tag's `.gitignore` is added. Original release assets and the tag remain unchanged."
        ]
      : []),
    END
  ].join("\n")
}

function prepareReleaseAssets({
  tag,
  commit,
  directory,
  output,
  existingBody
}) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || ""))
    throw new Error("Select an exact vMAJOR.MINOR.PATCH release tag.")
  if (!/^[0-9a-f]{40}$/.test(commit || ""))
    throw new Error("An exact 40-character source commit is required.")
  if (path.resolve(directory) === path.resolve(output))
    throw new Error(
      "Use a separate output directory for prepared release assets."
    )
  const version = tag.slice(1)
  const originals = new Map()
  const manifests = new Map()
  // Read and validate everything before creating an output directory.
  for (const target of TARGETS) {
    const name = `${target}-mv3-prod.zip`
    const bytes = fs.readFileSync(path.join(directory, name))
    const manifest = JSON.parse(
      inspectZip(bytes, ["manifest.json"])["manifest.json"]
    )
    if (manifest.version !== version || manifest.manifest_version !== 3)
      throw new Error(`Unexpected manifest version in ${name}.`)
    if (
      target === "firefox" &&
      manifest.browser_specific_settings?.gecko?.id !== GUID
    )
      throw new Error("Firefox package has an unexpected add-on identity.")
    originals.set(name, bytes)
    manifests.set(target, manifest)
  }
  const originalSourceName = `firefox-mv3-source-${version}.zip`
  const originalSource = fs.readFileSync(
    path.join(directory, originalSourceName)
  )
  originals.set(originalSourceName, originalSource)
  let sourceName = originalSourceName
  let source = originalSource
  let sourceCorrection
  if (tag === SOURCE_SUPPLEMENT.tag) {
    const pin = sourceSupplementFor({
      tag,
      sha: commit,
      assets: Object.fromEntries(
        [...originals].map(([name, bytes]) => [name, { sha256: sha256(bytes) }])
      )
    })
    sourceName = pin.name
    source = fs.readFileSync(path.join(directory, sourceName))
    if (sha256(source) !== pin.sha256)
      throw new Error(
        "Reviewer source correction does not match its pinned hash."
      )
    verifySourceSupplement(originalSource, source, pin.gitignoreSha256)
    originals.set(sourceName, source)
    sourceCorrection = {
      original: originalSourceName,
      corrected: sourceName,
      originalSha256: sha256(originalSource),
      correctedSha256: sha256(source),
      addedEntry: ".gitignore"
    }
  }
  const metadata = inspectZip(source, [
    "package.json",
    "src/manifest.json",
    "src/manifest-firefox-mv3.json",
    "pnpm-lock.yaml",
    ".gitignore",
    "FIREFOX_SOURCE_README.md",
    "CHANGELOG.md"
  ])
  const pkg = JSON.parse(metadata["package.json"])
  const sourceManifest = JSON.parse(metadata["src/manifest.json"])
  const sourceFirefox = JSON.parse(metadata["src/manifest-firefox-mv3.json"])
  if (
    pkg.version !== version ||
    sourceManifest.version !== version ||
    sourceManifest.manifest_version !== 3 ||
    sourceFirefox.browser_specific_settings?.gecko?.id !== GUID
  )
    throw new Error("Reviewer source does not match the requested release.")
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager || ""))
    throw new Error("Reviewer source must declare an exact pnpm toolchain.")
  if (typeof pkg.engines?.node !== "string" || !pkg.engines.node.trim())
    throw new Error(
      "Reviewer source must declare its required Node.js version."
    )
  const chromium = manifests.get("chrome").minimum_chrome_version
  const firefox =
    manifests.get("firefox").browser_specific_settings?.gecko
      ?.strict_min_version
  if (
    ![chromium, firefox].every((minimum) =>
      /^\d+(\.\d+){0,3}$/.test(minimum || "")
    )
  )
    throw new Error("Release manifests must declare browser minimum versions.")
  const files = new Map(originals)
  const inventoryPath = path.join(directory, SBOM_NAME)
  let dependencyInventory
  const bytes = readProductionInventory(inventoryPath)
  if (bytes) {
    validateSbom(JSON.parse(bytes), pkg)
    files.set(SBOM_NAME, bytes)
    dependencyInventory = {
      name: SBOM_NAME,
      sha256: sha256(bytes),
      size: bytes.length
    }
  } else if (tag !== LEGACY_RELEASE.tag || commit !== LEGACY_RELEASE.sha)
    throw new Error(
      "The verified build is missing its production dependency inventory."
    )
  const packages = TARGETS.map((target) => {
    const original = `${target}-mv3-prod.zip`
    const name = `fontara-${version}-${target}${target === "safari" ? "-experimental" : ""}.zip`
    const bytes = originals.get(original)
    files.set(name, bytes)
    return { target, name, original, sha256: sha256(bytes), size: bytes.length }
  })
  const sourceAlias = `fontara-${version}-source.zip`
  files.set(sourceAlias, source)
  packages.push({
    target: "source",
    name: sourceAlias,
    original: sourceName,
    sha256: sha256(source),
    size: source.length
  })
  const info = {
    schemaVersion: 1,
    repository: REPOSITORY,
    tag,
    version,
    commit,
    manifestVersion: 3,
    minimumBrowsers: { chromium, firefox },
    requiredToolchain: {
      node: pkg.engines.node,
      packageManager: pkg.packageManager
    },
    preparation:
      "Byte-identical copies of supplied release ZIPs; no rebuild or repacking.",
    ...(sourceCorrection ? { sourceCorrection } : {}),
    ...(dependencyInventory ? { dependencyInventory } : {}),
    packages
  }
  const section = releaseSection(info)
  const notes = changelogFor(metadata["CHANGELOG.md"], version)
  const body = updateManagedSection(
    existingBody ?? `## Changes\n\n${notes}\n`,
    section
  )
  files.set(
    "build-info.json",
    Buffer.from(`${JSON.stringify(info, null, 2)}\n`)
  )
  files.set(
    PROVENANCE_NAME,
    Buffer.from(
      `${JSON.stringify(createProvenance(tag, commit, files), null, 2)}\n`
    )
  )
  const sums = [...files]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join("")
  files.set("SHA256SUMS", Buffer.from(sums))
  files.set("release-body.md", Buffer.from(body))
  fs.mkdirSync(output, { recursive: true })
  if (fs.readdirSync(output).some((name) => !files.has(name)))
    throw new Error("Prepared output directory contains unrelated files.")
  for (const [name, bytes] of files) {
    const destination = path.join(output, name)
    if (
      fs.existsSync(destination) &&
      !fs.readFileSync(destination).equals(bytes)
    )
      throw new Error(`Refusing to replace a different prepared asset: ${name}`)
  }
  for (const [name, bytes] of files)
    fs.writeFileSync(path.join(output, name), bytes)
  return { info, body, files: [...files.keys()] }
}

function assertExistingAssets(release, tag, directory, names) {
  if (release.tag_name !== tag || !Array.isArray(release.assets))
    throw new Error("Existing release identity is unexpected.")
  for (const name of names.filter((entry) => entry !== "release-body.md")) {
    const matches = release.assets.filter((asset) => asset.name === name)
    if (matches.length === 0) continue
    const bytes = fs.readFileSync(path.join(directory, name))
    if (
      matches.length !== 1 ||
      matches[0].state !== "uploaded" ||
      matches[0].size !== bytes.length ||
      matches[0].digest !== `sha256:${sha256(bytes)}`
    )
      throw new Error(
        `Existing release asset differs; refusing replacement: ${name}`
      )
  }
}

function fetchExistingRelease(tag, run = execFileSync) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || ""))
    throw new Error("Select an exact vMAJOR.MINOR.PATCH release tag.")
  try {
    return JSON.parse(
      run("gh", ["api", `repos/${REPOSITORY}/releases/tags/${tag}`], {
        encoding: "utf8",
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"]
      })
    )
  } catch (error) {
    if (/^gh: .*\(HTTP 404\)$/m.test(String(error.stderr || ""))) return null
    throw new Error(
      "Could not verify existing GitHub release assets; refusing publication."
    )
  }
}

function checkExistingAssets(tag, directory, names, run = execFileSync) {
  const release = fetchExistingRelease(tag, run)
  if (release) assertExistingAssets(release, tag, directory, names)
}

function main(args = process.argv.slice(2), { run = execFileSync } = {}) {
  const { values } = require("node:util").parseArgs({
    args,
    options: {
      tag: { type: "string" },
      commit: { type: "string" },
      directory: { type: "string", default: "build" },
      output: { type: "string", default: "release-assets" },
      "existing-body": { type: "string" },
      "check-existing": { type: "boolean", default: false }
    }
  })
  const existingRelease = values["check-existing"]
    ? fetchExistingRelease(values.tag, run)
    : null
  const result = prepareReleaseAssets({
    ...values,
    existingBody: values["existing-body"]
      ? fs.readFileSync(values["existing-body"], "utf8")
      : (existingRelease?.body ?? undefined)
  })
  if (existingRelease)
    assertExistingAssets(
      existingRelease,
      values.tag,
      values.output,
      result.files
    )
  console.log(
    `Prepared ${result.files.length} release files for ${result.info.tag}.`
  )
  return result
}

module.exports = {
  main,
  fetchExistingRelease,
  assertExistingAssets,
  checkExistingAssets,
  inspectZip,
  changelogFor,
  updateManagedSection,
  prepareReleaseAssets,
  releaseSection
}
if (require.main === module)
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
