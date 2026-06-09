## Summary

-

## Type

- [ ] Bug fix
- [ ] Site fix
- [ ] Feature
- [ ] Runtime architecture
- [ ] UI
- [ ] Build, CI, or release
- [ ] Documentation

## Testing

- [ ] Not run
- [ ] `pnpm check`
- [ ] `pnpm build:all`
- [ ] `pnpm lint:extension`
- [ ] `pnpm test:browser:chrome`
- [ ] `FONTARA_FIREFOX_BROWSER_TESTS=1 FONTARA_FIREFOX_HEADLESS=1 pnpm test:browser:firefox`

## Site Fix Checklist

- [ ] Not a site fix
- [ ] CSS file is mapped in `src/config/site-fixes.ts`
- [ ] Site entry exists in `src/config/sites.ts`
- [ ] Selectors avoid icons, code, hidden UI, and volatile hashes
- [ ] Fallback variables do not contain `var(--fontara-font)`
- [ ] Matching/profile/RTL behavior is covered by tests where relevant

## Risk

-
