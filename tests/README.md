# FontARA Test Layers

FontARA keeps its test layout organized by concern,
while keeping the toolchain lighter. Browser tests use Puppeteer; unit and
inject tests still use Node's native test runner.

See also [docs/testing.md](../docs/testing.md) for CI, browser matrix, and
release verification guidance.

## Unit

Fast Node tests for pure logic, configuration, background modules, storage,
messaging, UI source checks, and build contracts.

```sh
pnpm test:unit
```

## Inject

Node-powered content script tests for DOM processing, runtime scheduling,
storage fallback behavior, mutation observer contracts, and performance
guardrails. These are separate from unit tests because they protect the page
injection pipeline directly.

```sh
pnpm test:inject
```

## Coverage

The Node coverage gate enforces a 90% line, 82% branch, and 88% function
budget across release-critical core modules. Font, storage, and tab modules
have a stricter 85% branch budget while retaining at least 90% line and 88%
function coverage. The generated Google Fonts catalog is excluded; browser-only
React surfaces are verified by the browser matrix instead of being counted as
uncovered Node code.

```sh
pnpm test:coverage
```

## Browser

Real browser extension smoke tests. The browser harness builds the dedicated test
extension, launches Chrome/Chromium through Puppeteer with the unpacked
extension installed, drives extension and fixture pages, and verifies
user-visible runtime behavior such as applying a selected font without
reloading the page.

Style assertions should go through the shared expectation DSL in
`tests/support/browser/extension-harness.mjs`. Prefer `expectPageStyles()` with
`createBasicPageStyleExpectation()` or `createHardFixtureStyleExpectation()` so
font application, text stroke, inline cleanup, Shadow DOM, iframe, and no-reload
checks stay expressed as one style contract instead of scattered selector
polling.

The hard browser fixture covers SPA route updates, Shadow DOM, same-origin and
cross-origin iframes, adoptedStyleSheets fallbacks, lazy DOM, virtualized rows,
nested contenteditable text, and heavier CSS variable font stacks. Keep new
runtime edge cases in that fixture when they exercise the injected page engine
rather than extension UI.

```sh
pnpm test:browser
```

Use Chrome for Testing when a local Chrome build refuses unpacked extension
automation:

```sh
pnpm test:browser:chrome:install
```

Firefox automation is available as an opt-in lane while it is stabilized:

```sh
FONTARA_FIREFOX_BROWSER_TESTS=1 pnpm test:browser:firefox
```

GitHub Actions runs browser automation in a separate manual and nightly
workflow, covering Chrome stable/beta and Firefox stable/beta/ESR. Keep broad
browser coverage there so pull requests stay fast while release signals still
exercise real extension installs across browser channels.

The Chrome browser suite also includes viewport coverage for extension pages:
mobile, tablet, desktop, and wide desktop.

Licensed local font packages can be exercised without committing their binary
files. Set `FONTARA_LOCAL_FONT_FAMILY_DIR` to a package whose root contains a
`Regular`/`Bold` pair, then run `pnpm test:browser:local-font-family` or the
matching Firefox script. The browser suite also validates the Regular/Bold
selection found in each nested directory/format and confirms that the two
upload slots cannot reuse one file.
`pnpm audit:font-family -- <directory>` remains the lower-level metadata audit
for every supported file.

It also runs axe against popup and options in English, Persian, and Arabic at
mobile and desktop sizes, plus browser-level keyboard navigation checks. The
production-artifact suite separately installs the unpacked contents represented
by the Chrome and Firefox release ZIPs and verifies that no test bridge ships.

```sh
pnpm test:browser:production:chrome
FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:production:firefox
```

## All

Runs every local test layer. Browser tests are intentionally excluded from
`pnpm check` because they need a local browser binary, but `pnpm check` does run
both unit and inject tests.

```sh
pnpm test:all
```
