# FontARA Agent Rules

## Site CSS from matched-selector JSON

When a site CSS file is generated from inspected JSON, use only the JSON data.
Do not invent selectors, exceptions, or broad rules.

Required contract:

1. Read each JSON group with a `matchedSelector` and a font declaration.
   Prefer a `font-family` declaration. If the group only has a `font`
   shorthand, extract only its font-family part for the fallback.
2. Normalize every fallback font stack, then merge groups that resolve to the
   same fallback value. Define one fallback custom property in `:root` for each
   unique fallback value, not for each selector.
   The fallback value must be the original `font-family` value from that JSON
   group, or the extracted family part of its `font` shorthand.
   Never use a value that already contains `var(--fontara-font)` as a fallback;
   that means the captured JSON was already affected by FontARA, not the site's
   own CSS.
   Name the merged fallback semantically from the stack or role, such as
   `google-sans-ui`, `arial-ui`, `message-body`, or `gm3-text-button`; do not
   name it after one random selector when many selectors share it.
3. Before emitting CSS, strip volatile Angular scope attributes from selectors,
   including attributes whose names start with `_ngcontent-ng-c` or
   `_nghost-ng-c`.
   These hashes can change per build/user and must not appear in site CSS. If
   stripping them makes duplicate selectors, keep the rule that would have won
   in the source CSS cascade, usually the more specific or later rule.
   Also ignore per-message/session selectors that encode generated content ids,
   such as Gmail `div#m_...bd > div` selectors, and generated full DOM paths
   with ids plus positional selectors such as `:nth-of-type(...)`.
4. For each merged fallback group, emit exactly one CSS rule with the normalized
   selectors joined as a comma-separated selector list.
5. That rule must set:

   ```css
   font-family: var(--fontara-font), var(--site-selector-fallback) !important;
   ```

6. Do not add `body *`, `pre`, `code`, `svg`, icon, monospace, form, role, or
   any other selector unless it exists as a `matchedSelector` in the JSON.
7. Even if a selector exists in the JSON, skip it when it is clearly an icon,
   symbol, glyph, or pictogram font target. Examples include `mat-icon`,
   `google-symbols`, `lumi-symbols`, `material-symbols`, `icon`, `symbols`,
   and fallback values like `"Google Symbols"` or `"Luminous Symbols"`.
   FontARA site CSS should change readable text, not icon font rendering.
8. Do not change unrelated site CSS or unrelated tests just to make a task pass.
9. Add or update a contract test that reads the JSON fixture and verifies:
   fallback variables, exact selector coverage, and absence of extra
   `font-family` selector rules. If icon/symbol selectors were present in the
   source JSON, list them as ignored selectors in the fixture and assert that
   CSS does not target them.
   For volatile generated selectors, prefer an ignored selector pattern instead
   of copying exact session ids into the fixture.

Fixtures live at `tests/fixtures/*-font-rules.json`, and the contract test
lives at `tests/unit/site-css-json-contract.test.ts`.
