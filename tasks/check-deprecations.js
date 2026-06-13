#!/usr/bin/env node

const path = require("node:path")
const ts = require("typescript")

function formatDiagnostic(fileName, diagnostic, languageService) {
  const program = languageService.getProgram()
  const sourceFile = program?.getSourceFile(fileName)
  const position =
    sourceFile && typeof diagnostic.start === "number"
      ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
      : null
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  const relativePath = path.relative(process.cwd(), fileName)

  if (!position) return `${relativePath}:1:1 TS${diagnostic.code} ${message}`

  return `${relativePath}:${position.line + 1}:${position.character + 1} TS${
    diagnostic.code
  } ${message}`
}

function createLanguageService(parsedConfig) {
  const fileVersions = new Map(
    parsedConfig.fileNames.map((fileName) => [fileName, "0"])
  )
  const host = {
    directoryExists: ts.sys.directoryExists,
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => parsedConfig.options,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getDirectories: ts.sys.getDirectories,
    getScriptFileNames: () => parsedConfig.fileNames,
    getScriptSnapshot(fileName) {
      if (!ts.sys.fileExists(fileName)) return undefined

      return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) ?? "")
    },
    getScriptVersion: (fileName) => fileVersions.get(fileName) ?? "0",
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    realpath: ts.sys.realpath
  }

  return ts.createLanguageService(host, ts.createDocumentRegistry())
}

function isDeprecationDiagnostic(diagnostic) {
  if (diagnostic.code === 6385 || diagnostic.code === 6387) return true

  return /deprecated/i.test(
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  )
}

function main() {
  const configPath = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    "tsconfig.json"
  )
  if (!configPath) {
    throw new Error("Could not find tsconfig.json.")
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")
    )
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  )
  const languageService = createLanguageService(parsedConfig)
  const deprecations = []

  for (const fileName of parsedConfig.fileNames) {
    for (const diagnostic of languageService.getSuggestionDiagnostics(
      fileName
    )) {
      if (isDeprecationDiagnostic(diagnostic)) {
        deprecations.push(
          formatDiagnostic(fileName, diagnostic, languageService)
        )
      }
    }
  }

  if (deprecations.length === 0) {
    console.log("No deprecated TypeScript API usage found.")
    return
  }

  console.error(
    `Found ${deprecations.length} deprecated TypeScript API usage${
      deprecations.length === 1 ? "" : "s"
    }:\n`
  )
  console.error(deprecations.join("\n"))
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
