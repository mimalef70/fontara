# Architecture

FontARA is a Manifest V3 WebExtension with three primary runtime surfaces:

- Background runtime
- Content script runtime
- Extension UI

The shared configuration layer connects all three.

## High-Level Flow

```text
Popup / Options
  -> background messaging
  -> normalized settings storage
  -> tab manager notification
  -> content script runtime
  -> page style update without reload
```

At page load, the content script decides whether the current URL is active,
which font/profile should apply, whether RTL helpers are enabled, and whether
the site should use generic DOM processing or a site-specific CSS fix.

## Background Runtime

Main responsibilities:

- Initialize and normalize extension storage.
- Merge default site configuration with user settings.
- Mirror syncable settings while keeping local-only custom font files local.
- Route popup/options messages.
- Track tabs and content documents.
- Broadcast settings updates after tab delivery failures or service worker
  restarts.
- Maintain action icon state and extension commands.

Key folders:

- `src/background`
- `src/utils/storage.ts`
- `src/config/storage.ts`

## Content Script Runtime

Main responsibilities:

- Resolve activation for the current URL.
- Inject bundled, Google, system, or custom font CSS.
- Apply selected font without forcing page reloads.
- Process newly inserted DOM nodes.
- Protect code, icon, hidden, and editable surfaces.
- Apply optional RTL behavior and text stroke settings.

Key folders:

- `src/inject`
- `src/inject/rtl`
- `src/generators`

The content script has two application paths:

| Path | When used | Behavior |
| --- | --- | --- |
| Site CSS | A matching site fix exists. | Injects curated CSS from `assets/styles` and avoids generic DOM scanning. |
| Generic processing | No site CSS match. | Walks readable DOM text, writes font fallbacks, observes later mutations. |

## Extension UI

Main responsibilities:

- Toggle global extension state.
- Toggle current site include/exclude behavior.
- Select fonts and text stroke settings.
- Manage custom fonts.
- Manage site profiles, backup/import/export/reset, sync, RTL, and advanced
  options.

Key folders:

- `src/ui/popup`
- `src/ui/options`
- `src/ui/components`
- `src/ui/i18n`

All user-facing strings should go through `src/i18n/messages.json`.

## Configuration Layer

The config layer is the main difference between a simple font replacer and a
maintainable browser extension.

| File | Purpose |
| --- | --- |
| `src/config/sites.ts` | Default website list and activation metadata. |
| `src/config/site-fixes.ts` | Mapping from configured sites to CSS assets. |
| `src/config/site-profiles.ts` | Per-site default profile behavior. |
| `src/config/rtl-sites.ts` | Sites with curated RTL support. |
| `src/config/fonts.ts` | Bundled font metadata. |
| `src/config/storage.ts` | Storage keys, defaults, and normalization contracts. |

Site matching and profile resolution should stay centralized. UI, background,
and content code should consume resolved decisions instead of re-implementing
URL logic locally.

## Storage Model

Settings are normalized at startup and when imported. Important groups:

- Global state: extension enabled, selected font, text stroke, sync settings.
- Site activation: enabled-by-default mode, enabled list, disabled list, legacy
  website list migration.
- Per-site profiles: font and text-stroke overrides.
- Custom fonts: local-only font records and safe data URLs.
- Runtime state: tab/content document tracking for update delivery.

Custom font files are intentionally excluded from sync storage.

## Build System

Build tasks live in `tasks` and produce unpacked debug directories and release
zip packages. The pipeline:

1. Reads a base manifest and browser-specific manifest patches.
2. Bundles TypeScript and React entrypoints.
3. Copies assets, fonts, styles, locales, and HTML.
4. Generates release archives with reproducible metadata.
5. Produces review source packages where needed.

## Testing Strategy

FontARA uses layered tests:

- Unit tests for pure behavior and source contracts.
- Inject tests for content script DOM behavior.
- Browser tests for real extension installation and UI workflows.
- CI workflow tests for build and browser matrix contracts.

See [testing.md](testing.md) for commands and expectations.
