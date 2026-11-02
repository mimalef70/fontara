# Development Guide

This guide covers the local setup for working on FontARA.

## Requirements

- Node.js 24
- pnpm 11
- Chrome, Chromium, or Chrome for Testing for Chrome browser tests
- Firefox for Firefox browser tests

Install dependencies:

```sh
pnpm install
```

## Repository Map

| Path | Purpose |
| --- | --- |
| `src/background` | Extension background runtime, storage bootstrap, tab messaging, icon state, commands. |
| `src/inject` | Content script runtime, font injection, DOM processing, observer lifecycle, RTL support. |
| `src/ui` | Popup, options, shared React components, i18n bootstrap. |
| `src/config` | Fonts, sites, site fixes, profiles, RTL sites, storage keys. |
| `src/generators` | CSS generation for bundled and custom font faces. |
| `src/utils` | Shared storage, URL, font, asset, and browser helpers. |
| `assets/fonts` | Bundled font files. |
| `assets/styles` | Site-specific CSS loaded through site fixes. |
| `tasks` | Build, copy, manifest, locale, zip, and source package tasks. |
| `tests` | Unit, inject, browser, and browser harness tests. |
| `docs` | Project documentation and the static website assets. |

## Development Builds

Chrome MV3 watch build:

```sh
pnpm dev
```

Firefox MV3 watch build:

```sh
pnpm dev:firefox
```

One-time debug builds:

```sh
pnpm debug
pnpm debug:firefox
```

Output directories:

| Target | Debug output | Release output |
| --- | --- | --- |
| Chrome MV3 | `build/chrome-mv3-dev` | `build/chrome-mv3-prod.zip` |
| Firefox MV3 | `build/firefox-mv3-dev` | `build/firefox-mv3-prod.zip` and `build/firefox-mv3-source-<version>.zip` |
| Edge MV3 | `build/edge-mv3-dev` when requested | `build/edge-mv3-prod.zip` |
| Brave MV3 | `build/brave-mv3-dev` when requested | `build/brave-mv3-prod.zip` |
| Opera MV3 | `build/opera-mv3-dev` when requested | `build/opera-mv3-prod.zip` |
| Safari MV3 package | `build/safari-mv3-dev` when requested | `build/safari-mv3-prod.zip` |

## Loading the Extension

Chrome:

1. Run `pnpm dev` or `pnpm debug`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `build/chrome-mv3-dev`.

Firefox:

1. Run `pnpm dev:firefox` or `pnpm debug:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click Load Temporary Add-on.
4. Select `build/firefox-mv3-dev/manifest.json`.

After changing extension code, rebuild and reload the extension from the browser
extension page. Page-level changes should apply without reloading the tab when
they go through the runtime settings pipeline.

## Build Commands

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build Chrome MV3 release package. |
| `pnpm build:all` | Build every configured MV3 release package, including the Firefox source review package. |
| `pnpm build:firefox` | Build Firefox MV3 release package and Firefox source review package. |
| `pnpm package:firefox:source` | Create only the source package for Firefox review. |
| `pnpm package:firefox:review` | Compatibility alias for the Firefox release and source review build. |

## Google Fonts Catalog

Normal builds use the committed generated catalog. To refresh the catalog:

```sh
GOOGLE_FONTS_API_KEY="your-key" pnpm generate:google-fonts
```

Use `.env.local` for local secrets and never commit API keys.

## Working With UI

- Visible UI text belongs in `src/i18n/messages.json`.
- Use the local React i18n layer from `src/ui/i18n`.
- Keep popup and options components aligned with existing shadcn/ui primitives.
- Use logical CSS and RTL-aware layout utilities for Persian and Arabic UI.

## Working With Runtime Code

- Keep background, content script, and UI message contracts explicit.
- Prefer normalized settings snapshots over ad hoc storage reads.
- Keep tab delivery resilient to MV3 service worker restarts.
- Avoid broad page selectors in inject code when a config or site fix can solve
  the problem more safely.

## Repository Controls

The default branch requires a PR, resolved review conversations, an up-to-date
base and all five shared verification checks. Force-push and deletion are
blocked, including for maintainers; the quality ruleset has no bypass actors.
CodeQL results are also required; unresolved security findings of medium or
higher severity and code-scanning errors block merging.
Independent review is encouraged, but a mandatory approval count is not imposed
on the active solo-maintainer workflow. CODEOWNERS identifies sensitive release,
manifest and messaging changes for review.

Release tags matching `v*` cannot be moved or deleted. Only repository admins
can create them. The release preparation/publishing commands use the maintainer's
local GitHub authentication; store credentials stay in GitHub environments.
Actions receive read access by default, and write/OIDC permissions are granted
only in the jobs that need them. Bot PR approval is disabled.

Dependabot checks npm and GitHub Actions weekly, with compatible updates grouped
and major upgrades reviewed individually. Automatic security updates, secret
scanning, push protection, private vulnerability reporting and CodeQL analysis
for JavaScript/TypeScript and Actions are enabled. A green dependency audit does
not replace review of new security findings or temporary dependency overrides.

## Preparing and Publishing a Version

Use an authenticated maintainer checkout (`gh auth status`) with a clean `master`
matching the live `origin/master`. Replace the example with the next intended
version. Start with a preview:

```sh
pnpm release:prepare --version 5.1.1 --dry-run
pnpm release:prepare --version 5.1.1
```

The second command creates `codex/release-5.1.1`, updates only `package.json`,
`src/manifest.json` and the Unreleased changelog, validates source versions,
commits the reviewed paths and opens a PR. The root package version is not stored
in the pnpm lockfile importer, so dependency resolution is unchanged. The
source-only version check ignores stale local build output; the full CI still
validates every production manifest.

Review and merge that PR after all checks pass. Then publish its exact reviewed
merge commit (replace `123` with the release PR number):

```sh
pnpm release:publish --version 5.1.1 --pr 123 --dry-run
pnpm release:publish --version 5.1.1 --pr 123
```

Publishing verifies the canonical repository, merged PR, its exact three changed
files, package/manifest/changelog consistency, ancestry and all five successful
CI jobs on that merge SHA. It creates an annotated tag and pushes only that tag,
starting the automatic GitHub/Chrome/Firefox release workflows. It never merges
a PR or skips tests. A newer version on master or an existing local/remote tag
stops the command. Later same-version commits on master do not change the reviewed
commit selected for release. Store approval remains independent of GitHub CI.

The local commands use the maintainer's GitHub authentication, so PR creation
triggers ordinary CI and tag creation honors the admin-only tag rule without
granting workflow tokens blanket repository bypass. No store login is needed.
If a command fails after creating a branch, commit or tag, it leaves that state
for inspection; it never resets the worktree, force-pushes or deletes a release
tag. Check `git status`, the PR and remote tag before retrying.
