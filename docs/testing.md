# Testing

FontARA has four practical test layers: unit, inject, browser, and extension
package lint.

## Unit Tests

```sh
pnpm test
```

Unit tests cover pure logic and source contracts:

- Storage normalization and sync chunking.
- Site matching and site profile resolution.
- Config and site CSS hygiene.
- Runtime messaging contracts.
- Manifest and build contracts.
- UI source expectations.
- CI workflow expectations.

Focused unit run:

```sh
node --import tsx --test tests/unit/site-matching.test.ts
```

## Inject Tests

```sh
pnpm test:inject
```

Inject tests run content script behavior in a Node-powered DOM environment. They
cover:

- Font application without reload.
- Mutation observer scheduling.
- Code, icon, aria-hidden, inline font, and contenteditable protection.
- Runtime command routing.
- Performance guardrails around read/write separation.

## Browser Tests

Chrome:

```sh
pnpm test:browser:chrome
```

Firefox:

```sh
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:firefox
```

Browser tests build dedicated test extensions, install them in real browsers, drive popup
and options UI, open fixture pages, and verify page styles without reloads.

The Chrome suite covers:

- Global and current-site activation.
- Popup include/exclude and font selection.
- Options site profiles.
- Backup export/import/reset.
- Sync storage stress payloads.
- Viewport coverage for extension pages.
- Axe WCAG A/AA checks for popup and options in en/fa/ar on mobile and desktop.
- Keyboard navigation and mobile navigation closure.
- Shadow DOM, same-origin iframes, cross-origin iframes, SPA navigation, lazy
  DOM, virtualized lists, adoptedStyleSheets, CSS variables, and editable text.

The Firefox suite covers the stabilized cross-browser runtime path and hard
fixture behavior.

### Local licensed font packages

Keep proprietary font packages outside version control. To audit every
TTF/OTF/WOFF/WOFF2 file in a local package, grouped by directory and format:

```sh
pnpm audit:font-family -- /path/to/font-package
```

Then validate the real Options upload flow, native `FontFace` loading, and the
Regular/Bold selection discovered in each nested directory and format. The
test also confirms that the same file cannot fill both slots:

```sh
FONTARA_LOCAL_FONT_FAMILY_DIR=/path/to/family pnpm test:browser:local-font-family
FONTARA_LOCAL_FONT_FAMILY_DIR=/path/to/family FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:local-font-family:firefox
```

The browser import test expects the package root itself to contain files whose
names include `Regular` and `Bold`. Nested directories are validated as
independent Regular/Bold selections grouped by file format. Internal OpenType
family names do not have to match because the user-provided display name and
the selected slot are authoritative.

Production package smoke tests install the unpacked release contents, open
popup/options, reject test-bridge markers, and monitor page/console errors:

```sh
pnpm test:browser:production:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:production:firefox
```

## Browser Matrix in CI

`.github/workflows/browser-tests.yml` runs manually and nightly across:

- Chrome stable
- Chrome beta
- Firefox latest
- Firefox beta
- Firefox ESR

This matrix is intentionally separate from the main CI workflow so normal pull
requests stay fast while release-quality checks still exercise real browsers.

## Package Lint

```sh
pnpm lint:extension
```

This builds the Firefox release package and runs `web-ext lint` against
`build/firefox-mv3-prod`.

## Full Local Verification

```sh
pnpm verify
```

`pnpm verify` runs:

1. `pnpm check`
2. `pnpm test:coverage`
3. `pnpm build:all`
4. `pnpm lint:extension`
5. Version consistency and production/full dependency audits.
6. Reproducible ZIP checks for every target and the Firefox source archive.

Use this before release or after broad runtime/build changes.

## Choosing the Right Test

| Change | Minimum useful verification |
| --- | --- |
| Docs only | Read rendered Markdown; run docs unit test if docs structure changed. |
| Site config | `pnpm check` and focused site matching tests. |
| Site CSS | `pnpm check` and manual/browser check on the affected site. |
| Inject runtime | `pnpm check` and `pnpm test:browser:chrome`. |
| Firefox behavior | Firefox browser test lane. |
| Build/release | `pnpm verify`. |

## Browser Test Helpers

Style assertions should use the shared DSL in
`tests/support/browser/extension-harness.mjs`:

- `expectPageStyles()`
- `createBasicPageStyleExpectation()`
- `createHardFixtureStyleExpectation()`

Prefer these helpers over one-off selector polling so font family, text stroke,
inline cleanup, Shadow DOM, iframe, and reload checks stay consistent.
