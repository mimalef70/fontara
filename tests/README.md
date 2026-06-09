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

## Browser

Real browser extension smoke tests. The browser harness builds the debug
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

## All

Runs every local test layer. Browser tests are intentionally excluded from
`pnpm check` because they need a local browser binary, but `pnpm check` does run
both unit and inject tests.

```sh
pnpm test:all
```
