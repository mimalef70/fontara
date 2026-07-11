# FontARA Third-Party Notices

FontARA itself is licensed under the MIT License in `LICENSE`. This file records
the principal third-party software and font assets distributed in release
artifacts. Package versions are locked by `pnpm-lock.yaml`.

## Bundled font software

The font files under `assets/fonts` are redistributed under the SIL Open Font
License 1.1 (OFL-1.1). Copyright, version, source, and SHA-256 information for
every exact binary is recorded in `assets/fonts/provenance.json` and is checked
during every production build.

Upstream projects include Arad, Estedad, Mikhak, Vazirmatn, Samim, Shabnam,
Sahel, Parastoo, Gandom, Tanha, and Nahid. Behdad, Nika, GanjNamehSans, and
Shahab retain their embedded Persian Font Store / Saleh Souzanchi copyright and
Reserved Font Name notices. FontARA does not modify or rename those binaries.

Some upstream font projects incorporate glyphs originating from DejaVu
(public-domain changes and the Bitstream Vera terms), Roboto, Open Sans, or Noto
(Apache-2.0), and Lora (OFL-1.1). Their copyright statements remain embedded in
the font binaries. Source and license details are available through the
upstream URLs in the provenance manifest.

The previously bundled `AzarMehr[wght].woff2` is intentionally not distributed
in FontARA 5.1.0 because that exact binary declares “All rights reserved” and no
redistribution grant for it was available during the release audit.

OFL-1.1 permits unmodified font software to be bundled and redistributed with
software provided the copyright and license notices are included. The full
license is included in `FONT_LICENSES/OFL-1.1.txt` and is also available at
<https://openfontlicense.org/open-font-license-official-text/>.

## Runtime software

The following principal packages and their transitive runtime dependencies are
bundled into the extension JavaScript:

- React and React DOM 19.2.6 — MIT
- Radix UI primitives — MIT
- Fontkit 2.0.4 and its runtime dependencies (`base64-js`, `brotli`, `clone`,
  `dfa`, `pako`, `restructure`, `tiny-inflate`, `unicode-properties`, and
  `unicode-trie`) — MIT
- Floating UI — MIT
- `cmdk`, `vaul`, `react-window`, `tailwind-merge`, `clsx`, and
  `tailwindcss-animate` — MIT
- `class-variance-authority` and `@swc/helpers` — Apache-2.0
- Lucide — ISC
- `tslib` — 0BSD

The authoritative copyright and license text for each package is contained in
its package distribution and source repository. Fontkit source:
<https://github.com/foliojs/fontkit>.

## Google Fonts catalog

`assets/data/google-fonts.json` contains public catalog metadata generated from
the Google Fonts Developer API. It contains family metadata only, not font
binaries. Actual Google Font files are requested from Google only after the user
enables Google Fonts and selects a family.

## Website assets

The legacy documentation website includes third-party front-end assets whose
license headers are preserved in their source files, including Bootstrap,
jQuery, Font Awesome, and Ionicons. These website assets are not loaded by the
extension runtime.
