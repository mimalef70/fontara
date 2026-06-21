# Changelog

All notable FontARA changes should be documented here.

This project follows a practical release-note format:

- User-visible changes
- Browser compatibility changes
- Site CSS and RTL support updates
- Migration notes
- Known issues

## Unreleased

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

- Google Fonts still requires network access to Google font endpoints.
- Built-in site optimizations may need updates when target websites ship major UI
  changes.

## 4.3.0

- Added cross-browser MV3 release targets.
- Added centralized site configuration for activation, CSS fixes, profiles, and
  RTL site support.
- Added Google Fonts, system font, bundled font, and custom font flows.
- Added no-reload page update coverage for font changes, site toggles, profiles,
  and storage updates.
