# FontARA Agent Rules

## UI components and shadcn/ui

For extension UI work, prefer shadcn/ui primitives over one-off custom
components when a matching primitive exists. Add only the components that are
needed for the current change. For new shadcn/ui components, use the official
CLI as the default source of truth:

```sh
pnpm dlx shadcn@latest add <component>
```

Keep `components.json` aliases aligned with the real project layout before
running the CLI. For this extension the shadcn aliases point to `src` through
`@/*`, with `ui` at `@/ui/components/ui`, `hooks` at `@/ui/hooks`, and `utils`
at `@/utils/cn`.

When the repo's aliases or output paths do not match the extension layout, first
run the CLI with `--dry-run`, `--diff`, or `--view`, then adapt the generated
component into the project structure. Do not hand-write a shadcn component from
memory when the CLI can provide the current implementation.

Project convention:

1. shadcn/ui components live in `src/ui/components/ui`.
2. Import them from that local component module, matching the existing project
   style. For example, from `src/ui/options/index.tsx` use:

   ```ts
   import { Button } from "../components/ui/button"
   import { SidebarProvider } from "../components/ui/sidebar"
   ```

3. Keep generated shadcn component APIs recognizable and close to the upstream
   component names, so future `shadcn add <component>` output can be compared
   or merged without guesswork.
4. When adding a new shadcn component, run the CLI first, then use the official
   shadcn docs and CLI output as the source of truth. If the component behavior,
   composition, or API is unclear, ask DeepWiki about the shadcn/ui repository
   before inventing a local pattern.
5. Do not introduce unrelated UI libraries for primitives already covered by
   shadcn/ui.
6. For Persian or RTL extension surfaces, apply the shadcn RTL guidance before
   shipping: pass `dir="rtl"` where the component accepts direction, keep
   controls on the visual start side, flip directional icons with RTL variants,
   and prefer logical Tailwind utilities such as `text-start`, `start/end`,
   `ps/pe`, and `border-s/e` over physical left/right utilities unless the
   component documentation explicitly requires physical positioning.

## Site CSS from matched-selector JSON

When a site CSS file is generated from inspected JSON, use the captured JSON as
the source of truth for font stacks and text targets. In the default mode, use
the JSON `matchedSelector` values after the required normalizations below. Do
not invent selectors, exceptions, or broad rules.

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
   Also normalize readable CSS Modules class hashes in the same first pass.
   When a captured selector contains a stable readable local class followed by
   a volatile build suffix, such as `.Component_part__a1B2c` or
   `.Component_part___a1B2c`, the emitted selector must use the stable prefix:
   `[class*="Component_part__"]`. This direction is mandatory; never emit the
   full hashed class in site CSS when a readable CSS Modules prefix exists.
   Do not reverse this transformation.
   Use `[class*="...__"]` instead of `[class^="...__"]`, because these classes
   usually appear in a multi-class `class` attribute. This is a mechanical
   normalization, not a semantic rewrite: keep the original combinators,
   pseudo-elements, and surrounding selector structure unless the user
   explicitly asks to simplify a path. Do not apply this rule to short opaque
   classes, utility classes, ids, or generated-looking selectors that do not
   expose a readable stable CSS Modules prefix. For example, Poe-style
   `.MessageDate_container__HJE_V` becomes
   `[class*="MessageDate_container__"]`, but an Ant/CSS-in-JS hash like
   `:where(.css-mncuj7).ant-select` stays as captured. If normalization makes
   duplicate selectors, keep one.
   Do not drop selectors only because they contain an id or look generated. If
   the JSON captured a selector, preserve it in the first CSS pass unless it is
   normalized by the Angular/CSS Modules rules above, an explicitly ignored
   icon/symbol target, or an explicitly configured ignored pattern.
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

### High-churn selector warning

Some sites, especially Google Search, ship most readable text selectors as
short generated class names or generated full DOM paths. For these sites, using
`matchedSelector` verbatim creates CSS that is correct for one build and brittle
for the next build.

Do not automatically rewrite these sites into semantic selectors. First build
the CSS normally from the JSON `matchedSelector` values, even when selectors
contain ids, generated-looking classes, or positional paths. If the captured
payload includes HTML, do not use it to invent selectors during this first pass.
The CSS Modules hash normalization rule above is part of the normal first pass:
it turns a readable hashed class like `.MessageDate_container__HJE_V` into
`[class*="MessageDate_container__"]`. It must not invent a new semantic target
that was not present in the JSON.

After finishing the normal CSS, tell the user when the selector set looks
high-churn or suspicious. Explain that a follow-up semantic review may be more
stable, and offer a scoped text-whitelist approach like this. Do not apply this
template unless the user explicitly asks for a semantic refactor.

```css
<site-root> :where(
  p,
  span,
  div,
  mark,
  a,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  li,
  label,
  button,
  input,
  textarea,
  select,
  option,
  em,
  strong,
  b,
  i,
  small,
  time,
  cite,
  q,
  blockquote,
  figcaption,
  summary,
  dt,
  dd,
  th,
  td,
  caption,
  legend,
  [role="heading"],
  [role="button"],
  [role="menuitem"],
  [role="option"],
  [role="tab"]
):not(
  [class*="icon" i],
  [class*="symbol" i],
  [class*="glyph" i],
  [class*="material-icons" i],
  [class*="fa-"],
  [class~="fa"],
  [class*="bi-"],
  [role="img"],
  pre *,
  code,
  code *,
  kbd,
  samp
) {
  font-family: var(--fontara-font), var(--site-text-fallback) !important;
}
```

When the user approves this path, keep it scoped to a stable site root such as
`body#gsr`; never ship the template globally.
