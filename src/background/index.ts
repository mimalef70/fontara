import { ExtensionRuntime } from "./extension"

void ExtensionRuntime.start().catch((error) => {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn("Failed to start FontAra runtime.", error)
  }
})
