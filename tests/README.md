# FontARA Test Layers

FontARA keeps its test layout organized by concern,
while keeping the toolchain lighter. Browser tests use Puppeteer; unit and
inject tests still use Node's native test runner.

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

The Chrome browser suite also includes viewport coverage for extension pages:
mobile, tablet, desktop, and wide desktop.

## All

Runs every local test layer. Browser tests are intentionally excluded from
`pnpm check` because they need a local browser binary, but `pnpm check` does run
both unit and inject tests.

```sh
pnpm test:all
```
