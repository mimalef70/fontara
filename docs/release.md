# Release Guide

This guide is a practical checklist for preparing FontARA release packages.

## Before Release

1. Confirm the intended version in `package.json` and `src/manifest.json`.
2. Review user-facing strings in `src/i18n/messages.json`.
3. Update `CHANGELOG.md` with user-visible changes, migration notes, and known
   issues.
4. Update public documentation surfaces such as `README.md`, `docs/index.html`,
   and release/store copy when the release changes user-visible behavior.
5. Confirm `_locales` output is generated from the shared catalog, not edited by
   hand.
6. Review site config migrations, default popup pins, and site rule versions.
7. Check whether the Google Fonts catalog needs a refresh.
8. Run local verification.

## Verification

Fast gate:

```sh
pnpm check
```

Full release gate:

```sh
pnpm verify
```

Determinism and version gates:

```sh
pnpm check:release-version
pnpm check:reproducible-zip
pnpm audit --prod
```

The reproducibility gate rebuilds every production target plus the Firefox
source-review archive in UTC and Asia/Tehran and compares each SHA-256 digest.

Browser smoke tests:

```sh
pnpm test:browser:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:firefox
pnpm test:browser:production:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:production:firefox
```

Run these with desktop Chrome/Chromium 130 or newer and Firefox 140 ESR or newer;
`CHROME_PATH` and `FIREFOX_PATH` select a particular installed binary. Firefox
tests also require geckodriver on `PATH` or at `GECKODRIVER_PATH`; see
[browser test setup](testing.md#browser-tests). The required CI matrix covers
both minimum versions and current stable releases.
The separate nightly/manual matrix adds beta and current ESR coverage.

Firefox for Android has an installation minimum of 142. Android device
validation is outside the current matrix, so desktop results do not establish
Android compatibility.

The `test:browser:production:*` scripts rebuild packages for local convenience.
To validate an existing distributable, unpack its ZIP into the matching
`build/<browser>-mv3-prod` directory and run the smoke test directly:

```sh
node --test --test-timeout=120000 --test-name-pattern='Chrome production artifact' tests/browser/production-artifacts.test.mjs
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 node --test --test-timeout=120000 --test-name-pattern='Firefox production artifact' tests/browser/production-artifacts.test.mjs
```

## Build Packages

All release targets:

```sh
pnpm build:all
```

Individual targets:

```sh
pnpm build:chrome
pnpm build:firefox
pnpm build:edge
pnpm build:brave
pnpm build:opera
pnpm build:safari
```

Release archives are written to `build/*-prod.zip`. When Firefox is part of the
build, the Firefox source review package is also written to
`build/firefox-mv3-source-<version>.zip`.

## Firefox Review Package

```sh
pnpm package:firefox:review
```

This creates the Firefox release package and a source package for review.

`pnpm build:firefox` and `pnpm build:all` create the same Firefox source review
package automatically.

## Extension Lint

```sh
pnpm lint:extension
```

This runs `web-ext lint` against `build/firefox-mv3-prod`.

Known warning category:

- Bundled UI code may produce `UNSAFE_VAR_ASSIGNMENT` warnings for generated
  `innerHTML` assignments. Treat new warning types or real errors as release
  blockers.

## GitHub Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| CI | push, pull request, manual | Calls the shared verification workflow. |
| Verify release packages | reusable workflow call | Runs `pnpm verify`, uploads production/source ZIPs, then runs stable/minimum browser suites and production smoke tests. |
| Browser Tests | manual, nightly | Browser matrix across Chrome and Firefox channels. |
| Release | tags, manual | Calls shared verification; publishes verified packages only for tags. |

[verify.yml](../.github/workflows/verify.yml) is the common gate for
[ci.yml](../.github/workflows/ci.yml) and
[release.yml](../.github/workflows/release.yml). Its browser jobs cover Chrome
stable/130 and Firefox stable/140 ESR. They download the
`fontara-verified-packages` artifact and smoke-test its unpacked production ZIPs.
The publish job waits for verification, downloads that same artifact, and
uploads it to GitHub Releases without another build. Manual runs on branches
perform verification without publishing a release.

## Release Checklist

- `pnpm check` passes.
- `pnpm build:all` passes and creates the Firefox source review package.
- `pnpm lint:extension` passes with no errors.
- Shared verification passes, including Chrome stable/130 and Firefox
  stable/140 ESR runtime and production smoke tests.
- Review the separate nightly matrix for beta/current-ESR compatibility issues.
- Store-facing text and screenshots are current.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, the OFL text, and
  `assets/fonts/provenance.json` are present in both production ZIPs.
- Chrome and Firefox production ZIPs install and pass smoke tests; neither
  contains the browser-test RPC strings.
- A real v5 backup migrates successfully, and no open High-severity finding
  remains.
- README and `docs/index.html` describe the current release accurately.
- `CHANGELOG.md` mentions user-visible changes, migration notes, and known
  issues.

## 5.1.0 Staged Rollout

1. Install the signed Chrome and Firefox artifacts in the internal test channel
   for three full days.
2. Publish Chrome Web Store at 10%, then advance to 25% after 48 hours, 50%
   after another 48 hours, and 100% after another 72 hours.
3. Publish Firefox only after Chrome has remained at 50% for 72 hours without a
   P0/P1 regression.
4. Stop rollout and roll back for any data loss, binary disclosure, extension
   startup failure, or three independent reports of the same regression.

Store publication, percentage changes, and rollback are manual external actions
and are never performed by the build or CI workflows.
