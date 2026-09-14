import { readdirSync, readFileSync } from "fs"
import { FIXTURES, REGISTRY } from "../index.js"

/**
 * Client script for the essay figures, assembled at import time from plain
 * browser files into one IIFE:
 *   runtime/  core, locale, motion, drag, ruler and shell in that order, then
 *             any other shared helper; these share the outer scope
 *   widgets/  one file per widget, each in its own function scope, registering
 *             WIDGETS["NAME"] = function (fig) { ...; return { destroy: fn } }
 * Files starting with "_" are test fixtures and ship only when the build runs
 * with ESSAY_FIG_FIXTURES=1.
 */

const RUNTIME_DIR = new URL("./runtime/", import.meta.url)
const WIDGETS_DIR = new URL("./widgets/", import.meta.url)
const RUNTIME_ORDER = ["core.js", "locale.js", "motion.js", "drag.js", "ruler.js", "shell.js"]

function listScripts(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js") && (FIXTURES || !name.startsWith("_")))
    .sort()
}

function readScript(dir, name) {
  return readFileSync(new URL(name, dir), "utf8")
}

const runtimeFiles = [
  ...RUNTIME_ORDER,
  ...listScripts(RUNTIME_DIR).filter((name) => !RUNTIME_ORDER.includes(name)),
]

// Widgets still written as mount(root); the shell mounts them through its adapter.
const adapted = {}
for (const entry of REGISTRY.values()) {
  if (entry.status === "live" && entry.adapter === "root") adapted[entry.name] = true
}

// Runtime files share the outer scope. Each widget file gets its own function
// scope, so a helper declared in one widget cannot replace another's.
const script = [
  "(function () {",
  "var ADAPTED_WIDGETS = " + JSON.stringify(adapted) + ";",
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
