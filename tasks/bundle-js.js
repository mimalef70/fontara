const fs = require("node:fs")
const path = require("node:path")
const esbuild = require("esbuild")

const { absolutePath, getDestDir } = require("./paths")
const { PLATFORM } = require("./platform")

const jsEntries = [
  {
    src: "src/background/index.ts",
    dest: "background/index.js"
  },
  {
    src: "src/inject/index.ts",
    dest: "inject/index.js"
  },
  {
    src: "src/ui/popup/index.tsx",
    dest: "ui/popup/index.js"
  },
  {
    src: "src/ui/options/index.tsx",
    dest: "ui/options/index.js"
  },
  {
    src: "src/ui/i18n/bootstrap.ts",
    dest: "ui/i18n/bootstrap.js"
  }
]

const textPlugin = {
  name: "fontara-text-loader",
  setup(build) {
    build.onResolve({ filter: /\?text$/ }, (args) => {
      const requestPath = args.path.replace(/\?text$/, "")
      const resolvedPath = path.isAbsolute(requestPath)
        ? requestPath
        : path.resolve(args.resolveDir, requestPath)

      return {
        path: resolvedPath,
        namespace: "fontara-text"
      }
    })

    build.onResolve({ filter: /\.css$/ }, (args) => {
      const resolvedPath = path.isAbsolute(args.path)
        ? args.path
        : path.resolve(args.resolveDir, args.path)

      return {
        path: resolvedPath,
        namespace: "fontara-text"
      }
    })

    build.onLoad({ filter: /.*/, namespace: "fontara-text" }, async (args) => {
      const text = await fs.promises.readFile(args.path, "utf8")
      return {
        contents: `export default ${JSON.stringify(text)};`,
        loader: "js"
      }
    })
  }
}

async function bundleJS({ platform, debug }) {
  const outDir = getDestDir({ platform, debug })

  await Promise.all(
    jsEntries.map((entry) =>
      esbuild.build({
        entryPoints: [absolutePath(entry.src)],
        outfile: path.join(outDir, entry.dest),
        bundle: true,
        format: "iife",
        target: platform === PLATFORM.FIREFOX_MV3 ? "firefox109" : "chrome106",
        platform: "browser",
        sourcemap: debug ? "inline" : false,
        minify: !debug,
        legalComments: "none",
        define: {
          "process.env.NODE_ENV": JSON.stringify("production"),
          __DEBUG__: JSON.stringify(debug),
          __PLATFORM__: JSON.stringify(platform),
          __CHROMIUM_MV3__: JSON.stringify(platform !== PLATFORM.FIREFOX_MV3),
          __FIREFOX_MV3__: JSON.stringify(platform === PLATFORM.FIREFOX_MV3)
        },
        loader: {
          ".png": "file",
          ".svg": "file",
          ".woff": "file",
          ".woff2": "file",
          ".ttf": "file",
          ".otf": "file"
        },
        plugins: [textPlugin]
      })
    )
  )
}

module.exports = bundleJS
