import { readdirSync, readFileSync } from "fs"

/**
 * Client script for the essay interactives, assembled at import time from
 * plain browser files:
 *   runtime/  shared helpers, the WIDGETS registry and mountAll (core.js first)
 *   widgets/  one file per widget; NAME.js registers WIDGETS["NAME"]
 * The transformer derives its marker names from the same widgets/ listing.
 */

const RUNTIME_DIR = new URL("./runtime/", import.meta.url)
const WIDGETS_DIR = new URL("./widgets/", import.meta.url)

function listScripts(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .sort()
}

function readScript(dir, name) {
  return readFileSync(new URL(name, dir), "utf8")
}

const runtimeFiles = ["core.js", ...listScripts(RUNTIME_DIR).filter((name) => name !== "core.js")]

// Runtime files share the outer scope. Each widget file gets its own function
// scope, so a helper declared in one widget cannot replace another's.
const script = [
  "(function () {",
  ...runtimeFiles.map((name) => readScript(RUNTIME_DIR, name)),
  ...listScripts(WIDGETS_DIR).map(
    (name) => ";(function () {\n" + readScript(WIDGETS_DIR, name) + "\n})()",
  ),
  ";boot()",
  "})()",
].join("\n")

const EssayInteractives = () => {
  const Component = () => null
  Component.afterDOMLoaded = script
  return Component
}

export { EssayInteractives }
