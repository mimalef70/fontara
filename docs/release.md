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

Browser smoke tests:

```sh
pnpm test:browser:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:firefox
```

Nightly/manual CI also runs the browser version matrix.

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

Release archives are written to `build/*-prod.zip`.

## Firefox Review Package

```sh
pnpm package:firefox:review
```

This creates the Firefox release package and a source package for review.

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
| CI | push, pull request, manual | Lint, typecheck, unit, inject, build, extension lint, upload packages. |
| Browser Tests | manual, nightly | Browser matrix across Chrome and Firefox channels. |
| Release | tags, manual | Release package build, extension lint, GitHub release upload. |

## Release Checklist

- `pnpm check` passes.
- `pnpm build:all` passes.
- `pnpm lint:extension` passes with no errors.
- Chrome browser smoke passes.
- Firefox browser smoke passes when Firefox behavior changed.
- Browser matrix is green or reviewed if a browser channel has a known external
  failure.
- Store-facing text and screenshots are current.
- README and `docs/index.html` describe the current release accurately.
- `CHANGELOG.md` mentions user-visible changes, migration notes, and known
  issues.
