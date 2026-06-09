# Site Fixes and Configuration

Site fixes let FontARA apply fonts safely on complex websites without scanning
or rewriting every DOM node. They should be precise, documented, and tested.

## Files

| File | Purpose |
| --- | --- |
| `src/config/sites.ts` | Default website entries, labels, categories, URL patterns, versions. |
| `src/config/site-fixes.ts` | Maps configured sites to CSS files in `assets/styles`. |
| `src/config/site-profiles.ts` | Default per-site font/text-stroke profiles. |
| `src/config/rtl-sites.ts` | Curated RTL support by host or pattern. |
| `assets/styles/*.css` | Site-specific CSS loaded only for mapped sites. |
| `tests/unit/site-css.test.ts` | CSS mapping and selector hygiene tests. |
| `tests/unit/site-matching.test.ts` | URL matching, defaults, profiles, and RTL matching tests. |

## When to Add a Site Fix

Prefer a site fix when:

- Generic DOM processing is too expensive for a large SPA.
- A site uses Shadow DOM, nested editors, or virtualized content.
- The site needs carefully scoped selectors to avoid icons or code blocks.
- A built-in site needs a stable default profile.
- RTL behavior needs per-site handling.

Do not add a site fix just to target one temporary class name. If selectors look
high-churn, document the risk and prefer a stable site root with readable text
targets.

## Site Entry Rules

When editing `src/config/sites.ts`:

- Keep names and categories consistent with existing entries.
- Use explicit URL patterns.
- Bump a site rule version when changing shipped defaults for existing users.
- Preserve user activation state during migrations.
- Add tests for matching, aliases, and default merge behavior.

## CSS Mapping Rules

Every CSS file in `assets/styles` must be mapped through `site-fixes.ts` and a
configured site. Do not leave orphaned CSS files.

Each mapped CSS file should:

- Scope rules to the target site.
- Use `var(--fontara-font)` as the selected font.
- Provide a clean site fallback custom property.
- Avoid selectors for icons, symbols, pictograms, hidden UI, and code.
- Avoid broad global selectors when a stable site root exists.

Preferred pattern:

```css
:root {
  --fontara-example-ui-fallback: Arial, sans-serif;
}

.stable-site-root :where(p, span, a, button, input, textarea) {
  font-family: var(--fontara-font), var(--fontara-example-ui-fallback) !important;
}
```

## Selector Hygiene

Avoid volatile selectors:

- Angular scope attributes such as `_ngcontent-*` and `_nghost-*`.
- Full CSS Modules hashes when a readable prefix exists.
- Random CSS-in-JS hashes unless there is no stable alternative.
- Full DOM paths that depend on sibling position.

For readable CSS Modules classes, prefer a stable contains selector:

```css
[class*="MessageDate_container__"]
```

Do not rewrite opaque utility classes into invented semantic selectors during
the first pass. Preserve captured selectors unless they are volatile, icon
targets, explicitly ignored, or covered by a reviewed semantic refactor.

## Fallback Font Rules

Fallbacks should describe the site's original readable text stack:

- Prefer the captured `font-family`.
- If only a `font` shorthand exists, extract the family portion.
- Merge selectors that share the same fallback.
- Do not use a fallback that already contains `var(--fontara-font)`.
- Name fallback variables semantically, for example
  `--fontara-chat-message-fallback`.

Final declaration pattern:

```css
font-family: var(--fontara-font), var(--fontara-chat-message-fallback) !important;
```

## Icon and Code Protection

Never intentionally target icon or symbol fonts. Skip selectors and fallback
stacks containing names like:

- `icon`
- `symbols`
- `material-symbols`
- `google-symbols`
- `mat-icon`
- `fa-`
- `glyphicon`

Avoid code surfaces unless a site explicitly renders readable non-code text
inside them:

- `pre`
- `code`
- `kbd`
- `samp`
- syntax-highlighted token classes

## RTL Site Support

Use `src/config/rtl-sites.ts` for curated RTL behavior. Add or update tests when
adding a site so host aliases, wildcard behavior, and activation rules stay
clear.

RTL behavior should improve directionality without changing font activation
semantics. Font injection and RTL activation should remain independently
testable.

## Per-Site Profiles

Use `src/config/site-profiles.ts` when a site needs a default font or text
stroke override. Keep profiles small and predictable:

- Match only the intended site.
- Normalize patterns.
- Prefer the first matching profile.
- Test that profile changes apply without page reloads.

## Review Checklist

Before merging a site fix:

- `pnpm check` passes.
- Relevant unit tests cover mapping and matching.
- Browser behavior was checked on the affected site or fixture.
- Changes apply without reloading the page when triggered from popup/options.
- Icons and code blocks are still protected.
- Fallback variables do not contain `var(--fontara-font)`.
- No volatile selector was introduced.
