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
- Mirror syncable settings while keeping local-only custom font files and system
  font choices local.
- Route popup/options messages.
- Track tabs and content documents.
- Broadcast settings updates after tab delivery failures or service worker
  restarts.
- Maintain action icon state and extension commands.
- Download and strictly validate opted-in Google Fonts, then publish immutable
  WOFF2 blobs and versioned family manifests to a bounded local cache.

Key folders:

- `src/background`
- `src/utils/storage.ts`
- `src/config/storage.ts`

`settings-manager.ts` owns the settings operation queue. UI writes, startup
migration, sync repair/writes, and permission-driven settings changes use that
queue so a delayed normalization snapshot cannot overwrite a newer mutation.
Raw storage operations enter through `runBackgroundSettingsStorageOperation`,
invalidate the cached snapshot afterward, and must not call queued settings
APIs from inside their callback.

Changes are broadcast to open extension pages without a worker-local subscriber
list. An options page can therefore keep receiving updates after the MV3 worker
that first served it has been suspended and restarted.

## Content Script Runtime

Main responsibilities:

- Resolve activation for the current URL.
- Inject bundled/system CSS and register custom or Google font bytes locally.
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

Custom and Google families share one local-font state machine. Every requested
face is loaded from extension storage and registered before the CSS variable is
changed; the previous family remains active on a cache miss, race, corrupt
asset, or parse failure. Remote Google URLs are never inserted into page DOM.

RTL work is queued in bounded discovery/application batches. Reconciliation
restores styles when reused message nodes become English or empty, handles
nested message scopes, and follows a replaced document body. Disabling an
adapter cancels pending work. Text-stroke CSS explicitly resets protected
code/icon subtrees because excluding a selector alone does not stop inherited
stroke.

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

The options page delegates its profile workflow to:

| Module | Responsibility |
| --- | --- |
| [use-site-profiles.ts](../src/ui/options/use-site-profiles.ts) | Form state, target selection, validation, and profile mutations. The hook stays mounted with Options so section navigation preserves drafts. |
| [SiteProfilesSection.tsx](../src/ui/options/SiteProfilesSection.tsx) | Profile form/list rendering with shared shadcn components and i18n. |
| [use-font-catalogs.ts](../src/ui/options/use-font-catalogs.ts) | Lazy external-font catalogs, grouped choices, and saved-font/fallback labels used by profiles and the overview. |

A saved profile font remains selectable before its catalog loads, including
dormant system-font choices while that source is paused. Only the explicit
global-font option removes that override.
Google preparation completes before a new selection is saved; the subsequent
mutation merges into the latest profile snapshot. Preview styles cover both
Dialog portals outside the app root and Drawers mounted inside it.

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

The matched-selector generator in [tasks/site-css.js](../tasks/site-css.js)
normalizes captured Angular scope attributes and readable CSS Modules hashes.
When captured rules collapse to the same normalized selector, it selects the
fallback using declaration importance, original selector specificity, then
capture order. Specificity is calculated before normalization and separately
for each selector-list member. Equal fallbacks are grouped only after these
collisions are resolved; no semantic selectors are invented.

## Storage Model

Settings are normalized at startup and when imported. Important groups:

- Global state: extension enabled, UI language, selected font source, selected
  font, text stroke, Google/system font preferences, sync settings.
- Site activation: enabled-by-default mode, enabled list, disabled list, legacy
  website list migration.
- Per-site profiles: font, activation, and text-stroke overrides.
- Custom fonts: metadata-only family records plus content-addressed local face
  blobs, loaded into pages with `FontFace(ArrayBuffer)`.
- Google fonts: versioned family manifests plus content-addressed verified
  WOFF2 blobs, downloaded by the background only after explicit opt-in and
  loaded into pages with `FontFace(ArrayBuffer)`.
- RTL settings: global enablement and curated site adapter preferences.
- Runtime state: tab/content document tracking for update delivery.

Custom font files and system font choices are intentionally excluded from sync
storage.

## Build System

Build tasks live in `tasks` and produce unpacked debug directories and release
zip packages. The pipeline:

1. Reads a base manifest and browser-specific manifest patches.
2. Bundles TypeScript and React entrypoints.
3. Copies assets, fonts, styles, locales, and HTML.
4. Generates release archives with reproducible metadata.
5. Produces review source packages where needed.

Chrome/Chromium 130 and desktop Firefox 140 ESR are the manifest baselines.
JavaScript targets derive from those manifest values through `tasks/platform.js`.
UI CSS transforms stay enabled in `tasks/bundle-css.js` for every build,
including browser tests; debug mode only disables CSS minification. Firefox
for Android has a separate installation minimum of 142, without Android device
coverage in the current test matrix.
The reusable [verify.yml](../.github/workflows/verify.yml) preserves production
packages after source/build verification, then downloads and smoke-tests them
on stable and minimum browser versions. The release workflow publishes that
same artifact without rebuilding.

## Testing Strategy

FontARA uses layered tests:

- Unit tests for pure behavior and source contracts.
- Inject tests for content script DOM behavior.
- Browser tests for real extension installation and UI workflows.
- CI workflow tests for build and browser matrix contracts.

See [testing.md](testing.md) for commands and expectations.
