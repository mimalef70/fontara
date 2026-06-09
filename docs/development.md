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
| Firefox MV3 | `build/firefox-mv3-dev` | `build/firefox-mv3-prod.zip` |
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
| `pnpm build:all` | Build every configured MV3 release package. |
| `pnpm build:firefox` | Build Firefox MV3 release package. |
| `pnpm package:firefox:source` | Create source package for Firefox review. |
| `pnpm package:firefox:review` | Build Firefox package and source package together. |

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
