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

Browser tests build debug extensions, install them in real browsers, drive popup
and options UI, open fixture pages, and verify page styles without reloads.

The Chrome suite covers:

- Global and current-site activation.
- Popup include/exclude and font selection.
- Options site profiles.
- Backup export/import/reset.
- Sync storage stress payloads.
- Viewport coverage for extension pages.
- Shadow DOM, same-origin iframes, cross-origin iframes, SPA navigation, lazy
  DOM, virtualized lists, adoptedStyleSheets, CSS variables, and editable text.

The Firefox suite covers the stabilized cross-browser runtime path and hard
fixture behavior.

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
2. `pnpm build:all`
3. `pnpm lint:extension`

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
