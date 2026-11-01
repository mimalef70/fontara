# Changelog

All notable FontARA changes should be documented here.

This project follows a practical release-note format:

- User-visible changes
- Browser compatibility changes
- Site CSS and RTL support updates
- Migration notes
- Known issues

## Unreleased

- Restored Firefox stable/beta browser tests after extension-page input
  restrictions changed. The harness uses geckodriver for trusted clicks and
  uploads, with a checksum-verified driver installation in CI.
- Stabilized Chrome browser tests around animated mobile font pickers and
  asynchronously populated font menus while preserving trusted user input.
- Raised the desktop browser minimums to Chrome/Chromium 130 and Firefox 140
  ESR and derived JavaScript build targets from the manifests. UI CSS transforms
  remain enabled in all builds, including browser-test builds. Firefox for
  Android has a separate installation minimum of 142; Android devices are not
  included in the current validation.
- Unified CI and release verification with stable/minimum Chrome and Firefox
  browser gates. Tagged releases now publish the exact production packages
  smoke-tested by verification, without rebuilding them before upload.
- Fixed saved site-profile fonts being cleared during editing before external
  catalogs load. Profiles retain paused system-font choices, drafts survive
  section navigation, and delayed Google preparation preserves other profile
  changes. Split profile state/actions, rendering, and font catalogs into
  dedicated options modules.
- Fixed font previews in Dialog portals while preserving Drawer preview styles.
- Serialized startup/sync storage work with settings mutations, kept open
  options pages receiving changes after service-worker restarts, and registered
  context-menu click handling before asynchronous initialization.
- Kept background notifications paired with the settings revision they describe,
  preventing a delayed storage event from undoing a newer site exclusion.
- Fixed case-sensitive and percent-encoded site-path matching. Protected code
  and icon descendants from inherited text stroke, and restored RTL styles when
  reused messages become English or empty. RTL reconciliation now handles
  nested scopes and replaced document bodies with bounded, cancellable work.
- Fixed matched-selector CSS collisions to respect declaration importance and
  original selector specificity before capture order and fallback grouping.
- Added focused browser regressions for background, UI, and injection behavior,
  plus mobile/desktop accessibility checks for the public website and privacy
  page.
- Enabled Google Fonts on supported Firefox versions through a page-private
  binary pipeline: the background downloads and validates CSS/WOFF2 assets,
  publishes them to a bounded local cache, and content scripts register all
  faces atomically with `FontFace(ArrayBuffer)`. Page origins are no longer
  sent to Google, strict page CSP remains effective, and cached fonts survive
  reloads and work offline.
- Added explicit Firefox data-consent handling, immediate network cancellation
  on disable or permission revocation, stale-last-known-good recovery,
  transactional cache cleanup, and user-visible download/cache controls.
- Excluded non-text and oversized sliced font families from the Google picker
  until they can be loaded within the per-document memory budget.

## 5.1.0

- Rebuilt custom-font storage around multi-face family metadata while making
  the user flow intentionally small: enter a display name, add a required
  Regular file, and optionally add Bold. A Variable Regular file that covers
  weights 400 and 700 replaces both slots. Font files remain as content-addressed
  local blobs and load with `FontFace(ArrayBuffer)` instead of exposing base64
  data in the page DOM.
- Added transactional family imports, native font validation, strict
  per-face/family/library quotas, resumable legacy migration, orphan cleanup,
  backup format v3, and WOFF/WOFF2/TTF/OTF metadata extraction in an isolated
  worker.
- Reworked System Fonts around the browser model used by Dark Reader: standard
  CSS generic families are available everywhere, while Chromium additionally
  enumerates installed fonts through `fontSettings`. Refresh failures keep the
  last known list, and dormant or removed choices now show their real fallback.
- Removed the unnecessary `tabs` permission, made context menus optional,
  narrowed web scope to HTTP(S), removed persisted full tab URLs and remote
  favicons, and isolated the browser-test bridge from debug/production builds.
- Serialized settings mutations with monotonic revisions, race-safe optimistic
  UI rollback, revision-consistent sync snapshots, and 150 ms trailing slider
  persistence.
- Lazy-loaded the Google Fonts catalog from one generated JSON asset, cutting
  production runtime bundles below their release budgets. Google font requests
  now include useful regular, bold, and italic faces, use timeout-bounded and
  serialized stale-while-revalidate caching, and fall back without switching
  to an unavailable family. Safari remains disabled until its binary font path
  can be validated in a real Safari App Extension.
- Improved keyboard navigation, disabled states, loading skeletons, mobile
  navigation, ARIA state, contrast, visible scrollbars, RTL layout, and deletion
  confirmation across popup and options.
- Removed Google Analytics from the project website and published a concrete
  privacy policy covering local fonts, browser sync, URL handling, permissions,
  and opt-in Google Fonts requests.
- Added deterministic release archives, manifest/permission assertions,
  license and exact font provenance checks, a matched-selector site CSS
  generator/validator, Chrome/Firefox browser gates, and source-package upload.

Migration notes:

- Existing custom-font values are preserved so global and per-site selections
  continue to resolve. Legacy data URLs are moved to separate local face blobs
  and initially marked `legacy-unverified`.
- System-font selections are no longer deleted when the feature is disabled;
  they become dormant and resume when the user enables System Fonts again.
- AzarMehr is no longer bundled because the audited binary declared “All rights
  reserved” and no redistribution grant for that exact file was available.

Known limitations:

- The simple uploader accepts upright Regular/Bold faces only. Italic, Oblique,
  and Variable fonts that combine upright and italic through the `ital` axis
  are rejected with explicit guidance rather than guessed or synthesized.
- TTC and OTC collections are not accepted yet.
- Site captures with high-churn generated selectors remain exact to their
  source JSON; semantic rewrites require a separate, site-specific review.

## 5.0.0

- Added a multilingual, RTL-aware interface for English, Persian, and Arabic.
- Added smart RTL support for supported websites, including automatic direction
  handling for messages and editable fields.
- Added Google Fonts, Chromium system fonts, safer custom font uploads, and
  unicode range presets for custom fonts.
- Added per-site profiles so each website can use its own font, activation
  rules, and text stroke settings.
- Added adjustable text stroke controls and moved the popup toward a more compact
  daily-use layout.
- Added richer website management with domain, path, regex, and default-site
  controls, plus a larger 20-site default popup set.
- Added settings backup, import, reset, sync, context menu actions, and keyboard
  shortcuts.
- Expanded built-in site optimizations across AI tools, social sites, productivity
  apps, search, messaging, and writing platforms.
- Improved live updates so font, site, profile, RTL, and text effect changes can
  apply without reloading pages.
- Hardened the extension runtime, storage normalization, content lifecycle,
  shadow DOM handling, and cross-browser MV3 build pipeline.
- Added broader automated coverage, browser tests, release tooling, and
  contributor documentation.

Migration notes:

- Existing settings are normalized into the new settings model where possible.
- If a site behaves unexpectedly after upgrading, reset settings once from the
  options page to re-seed the new defaults.

Known issues and notes:

- Google Fonts requires network access only while preparing an uncached or
  stale family; verified font binaries are retained in local extension storage.
- Built-in site optimizations may need updates when target websites ship major UI
  changes.

## 4.3.0

- Added cross-browser MV3 release targets.
- Added centralized site configuration for activation, CSS fixes, profiles, and
  RTL site support.
- Added Google Fonts, system font, bundled font, and custom font flows.
- Added no-reload page update coverage for font changes, site toggles, profiles,
  and storage updates.
