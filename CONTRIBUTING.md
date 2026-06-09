# Contributing to FontARA

Thank you for helping improve FontARA. This guide explains how to report issues,
prepare changes, test them, and keep site-specific fixes maintainable.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before Opening an Issue

- Search existing issues first.
- Reproduce the problem in a clean browser profile when possible.
- Disable other extensions before reporting page behavior.
- Include the affected URL, browser name and version, operating system, and
  FontARA version.
- Add screenshots or a short screen recording for visual bugs.

Use the GitHub issue templates:

- Bug report: extension behavior that is not tied to one website.
- Site issue: font, RTL, profile, or activation problems on one website.
- Performance issue: slow pages, high CPU, high memory, or layout stalls.
- Feature request: new capability or UX improvement.

## Development Setup

Requirements:

- Node.js 24
- pnpm 11

```sh
git clone https://github.com/mimalef70/fontara.git
cd fontara
pnpm install
pnpm dev
```

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `build/chrome-mv3-dev`.

Firefox:

1. Run `pnpm dev:firefox` or `pnpm debug:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click Load Temporary Add-on.
4. Select `build/firefox-mv3-dev/manifest.json`.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Watch Chrome MV3 debug build. |
| `pnpm dev:firefox` | Watch Firefox MV3 debug build. |
| `pnpm check` | Lint, typecheck, unit tests, and inject tests. |
| `pnpm build:all` | Build all release packages. |
| `pnpm lint:extension` | Build and run Firefox extension lint. |
| `pnpm verify` | Broad local verification before release. |
| `pnpm test:browser:chrome` | Chrome extension browser tests. |
| `FONTARA_FIREFOX_BROWSER_TESTS=1 pnpm test:browser:firefox` | Firefox extension browser tests. |

## Pull Requests

1. Keep a pull request focused on one purpose.
2. Avoid unrelated formatting and generated file churn.
3. Preserve existing architecture and naming patterns.
4. Add or update tests when behavior changes.
5. Run the smallest useful verification locally, and mention what passed.
6. Use the pull request template and explain risk clearly.

Recommended verification by change type:

| Change | Suggested verification |
| --- | --- |
| Pure docs | Read the rendered Markdown and run `node --import tsx --test tests/unit/documentation.test.ts` if touched. |
| Config or site CSS | `pnpm check` plus focused browser testing on the affected site. |
| Inject/runtime | `pnpm check` and `pnpm test:browser:chrome`. |
| Cross-browser behavior | Chrome and Firefox browser tests. |
| Release/build | `pnpm verify`. |

## Site Fix Contributions

Site fixes are intentionally stricter than ordinary CSS. Read
[docs/site-fixes.md](docs/site-fixes.md) before changing `src/config/sites.ts`,
`src/config/site-fixes.ts`, `src/config/site-profiles.ts`,
`src/config/rtl-sites.ts`, or `assets/styles/*.css`.

Core expectations:

- Scope fixes to the affected site.
- Preserve readable text while avoiding icons, symbols, code, and hidden UI.
- Do not use volatile build hashes when a stable selector is available.
- Keep fallback font stacks clean and free of `var(--fontara-font)`.
- Add or update tests for mapping, selector hygiene, and activation behavior.

## Code Style

- Use TypeScript for runtime code.
- Use the shared i18n catalog for visible extension UI strings.
- Prefer existing helpers and shadcn/ui components already present in the repo.
- Use small, readable modules instead of broad rewrites.
- Keep comments rare and useful.

## Security

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md)
so maintainers can investigate privately.
