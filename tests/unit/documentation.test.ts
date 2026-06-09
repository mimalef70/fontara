import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

function readText(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8")
}

function assertFileExists(filePath: string): void {
  assert.ok(fs.existsSync(path.resolve(filePath)), `${filePath} should exist`)
}

function readJSON<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T
}

test("project documentation exposes contributor and maintainer guides", () => {
  const requiredFiles = [
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "docs/development.md",
    "docs/architecture.md",
    "docs/site-fixes.md",
    "docs/testing.md",
    "docs/release.md",
    "docs/images/demo/logo.svg",
    "docs/images/demo/browsers/chrome.svg",
    "docs/images/demo/browsers/firefox.svg",
    "docs/images/demo/browsers/microsoft-edge.svg",
    "docs/images/demo/browsers/opera.svg",
    "docs/images/demo/browsers/safari.svg",
    "docs/images/sponsors/muchat-logo-type.svg",
    ".github/PULL_REQUEST_TEMPLATE.md"
  ]

  for (const filePath of requiredFiles) {
    assertFileExists(filePath)
  }

  const readme = readText("README.md")
  assert.match(readme, /docs\/development\.md/)
  assert.match(readme, /docs\/architecture\.md/)
  assert.match(readme, /docs\/site-fixes\.md/)
  assert.match(readme, /docs\/testing\.md/)
  assert.match(readme, /docs\/release\.md/)
  assert.match(readme, /CODE_OF_CONDUCT\.md/)
  assert.match(readme, /SECURITY\.md/)
  assert.match(
    readme,
    /github\.com\/mimalef70\/fontara\/actions\/workflows\/ci\.yml/
  )
  assert.match(
    readme,
    /github\.com\/mimalef70\/fontara\/actions\/workflows\/browser-tests\.yml/
  )
  assert.match(readme, /img\.shields\.io\/chrome-web-store\/users/)
  assert.match(readme, /img\.shields\.io\/amo\/users\/fontara-font-changer/)
  assert.match(readme, /Browser automation/)
  assert.match(readme, /## Contents/)
  assert.match(readme, /What Changes After Install/)
  assert.match(readme, /Built-in Site Optimizations/)
  assert.match(readme, /Browser Support/)
  assert.match(readme, /Privacy and Permissions/)
  assert.match(readme, /Troubleshooting/)
  assert.match(readme, /Known Limitations/)
  assert.match(readme, /Architecture at a Glance/)
  assert.match(readme, /Roadmap/)
  assert.match(readme, /CHANGELOG\.md/)
  assert.match(readme, /cross-browser WebExtension/)
  assert.match(readme, /Font replacement across the web/)
  assert.match(readme, /Smart RTL support/)
  assert.match(readme, /docs\/images\/demo\/logo\.svg/)
  assert.match(readme, /docs\/images\/demo\/browsers\/chrome\.svg/)
  assert.match(readme, /FontARA screenshot/)
  assert.match(readme, /30 site entries/)
  assert.match(readme, /26 bundled site CSS files/)
  assert.match(readme, /10 smart RTL site\s+adapters/)
  assert.match(readme, /Google Fonts network access/)
  assert.match(readme, /Browser-restricted pages/)
  assert.match(readme, /docs\/images\/demo\/screens\/Version4\.jpg/)
  assert.match(readme, /docs\/images\/demo\/screens\/Banner5\.jpg/)
  assert.match(readme, /github\.com\/mimalef70\/fontara\/graphs\/contributors/)
  assert.match(readme, /## Sponsors/)
  assert.match(readme, /docs\/images\/sponsors\/muchat-logo-type\.svg/)
  assert.doesNotMatch(readme, /Persian, Arabic, Kurdish, Dari/)
  assert.match(readme, /https:\/\/mu\.chat/)
  assert.match(readme, /linkedin\.com\/in\/mostafaalahyari/)
  assert.match(readme, /MIT License/)

  const contributing = readText("CONTRIBUTING.md")
  assert.match(contributing, /CODE_OF_CONDUCT\.md/)
  assert.match(contributing, /pnpm check/)
  assert.match(contributing, /pnpm verify/)
  assert.match(contributing, /docs\/site-fixes\.md/)
  assert.match(contributing, /SECURITY\.md/)

  const changelog = readText("CHANGELOG.md")
  assert.match(changelog, /## Unreleased/)
  assert.match(changelog, /## 4\.3\.0/)
  assert.match(changelog, /Known issues/)

  const releaseGuide = readText("docs/release.md")
  assert.match(releaseGuide, /CHANGELOG\.md/)
  assert.match(releaseGuide, /known\s+issues/)

  const packageJSON = readJSON<{
    bugs?: { url?: string }
    homepage?: string
    license?: string
    repository?: { url?: string }
  }>("package.json")
  assert.equal(packageJSON.license, "MIT")
  assert.equal(packageJSON.homepage, "https://mimalef70.github.io/fontara/")
  assert.equal(
    packageJSON.repository?.url,
    "git+https://github.com/mimalef70/fontara.git"
  )
  assert.equal(
    packageJSON.bugs?.url,
    "https://github.com/mimalef70/fontara/issues"
  )
})

test("site-fix documentation records the CSS safety contract", () => {
  const siteFixes = readText("docs/site-fixes.md")

  assert.match(siteFixes, /src\/config\/sites\.ts/)
  assert.match(siteFixes, /src\/config\/site-fixes\.ts/)
  assert.match(siteFixes, /src\/config\/site-profiles\.ts/)
  assert.match(siteFixes, /src\/config\/rtl-sites\.ts/)
  assert.match(siteFixes, /assets\/styles\/\*\.css/)
  assert.match(siteFixes, /var\(--fontara-font\)/)
  assert.match(siteFixes, /volatile selectors/i)
  assert.match(siteFixes, /Icon and Code Protection/)
})

test("GitHub templates collect reproducible extension reports", () => {
  const templates = [
    ".github/ISSUE_TEMPLATE/bug-report.yml",
    ".github/ISSUE_TEMPLATE/site-issue.yml",
    ".github/ISSUE_TEMPLATE/performance-issue.yml",
    ".github/ISSUE_TEMPLATE/feature-request.yml",
    ".github/ISSUE_TEMPLATE/config.yml"
  ]

  for (const filePath of templates) {
    assertFileExists(filePath)
  }

  const bugReport = readText(".github/ISSUE_TEMPLATE/bug-report.yml")
  const siteIssue = readText(".github/ISSUE_TEMPLATE/site-issue.yml")
  const performanceIssue = readText(
    ".github/ISSUE_TEMPLATE/performance-issue.yml"
  )
  const pullRequest = readText(".github/PULL_REQUEST_TEMPLATE.md")

  assert.match(bugReport, /Browser and version/)
  assert.match(bugReport, /Operating system/)
  assert.match(siteIssue, /Website URL/)
  assert.match(siteIssue, /Does it work after reloading the page/)
  assert.match(performanceIssue, /Does it happen when FontARA is disabled/)
  assert.match(pullRequest, /Site Fix Checklist/)
  assert.match(pullRequest, /pnpm test:browser:chrome/)
})
