# FontAra Firefox Source Package

This source package is provided for Mozilla Add-ons reviewers. It contains the
source files and build tooling needed to recreate the Firefox MV3 add-on package.

## Build Environment

- Operating system: macOS, Linux, or Windows with a POSIX-like shell.
- Node.js: `24.x` (`package.json` requires `>=24 <25`).
- pnpm: `11.5.0` (`packageManager` is `pnpm@11.5.0`).

## Install Required Tools

Install Node.js 24 from https://nodejs.org/ or with a version manager such as
`nvm`, `fnm`, or `volta`.

Enable the package manager version declared by the project:

```sh
corepack enable
corepack prepare pnpm@11.5.0 --activate
```

Confirm the versions:

```sh
node --version
pnpm --version
```

## Build Steps

From the root of this source package:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build:firefox
```

The generated Firefox add-on files will be written to:

```text
build/firefox-mv3-prod/
```

The generated uploadable Firefox add-on package will be written to:

```text
build/firefox-mv3-prod.zip
```

## One-Command Build Script

The package includes this build script in `package.json`:

```sh
pnpm build:firefox
```

It executes:

```sh
node tasks/cli.js build --release --firefox-mv3
```

That script bundles HTML, JavaScript, CSS, manifest patches, locales, and assets
from the source files in this package and then creates the Firefox zip package.

## Source Package Contents

The source package includes:

- `src/` extension source files.
- `assets/` extension icons, bundled fonts, logos, and CSS assets.
- `tasks/` build scripts.
- `tests/` unit tests.
- `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- TypeScript, Tailwind, PostCSS, Biome, and component configuration files.
- `README.md` and this reviewer source README.

The source package intentionally excludes generated output and unrelated files:

- `node_modules/`
- `build/`, `dist/`, and `out/`
- `.git/`
- generated reports such as `repomix-output.xml`
- the website documentation folder `docs/`, which is not used to build the add-on

No remote code is loaded by the extension at runtime. Bundled fonts and assets
are included in the add-on package.
