import { readFileSync } from "fs"

/**
 * RooB UI: the browser half of the typora-plugin-lite chrome.
 *
 * Typora runs four plugins that shape how these notes are read: quick open,
 * wider, fence-enhance's copy button, and sidenote. Three of them are pure
 * behaviour and have no CSS-only equivalent, so they are reproduced here
 * against the same numbers the plugins use. The styling lives in
 * quartz/styles/custom.scss; the scripts only supply state and geometry.
 *
 * The scripts are plain browser files in client/, assembled at import time:
 *   prescript.js    the <head> script: dev cache buster, and the panel width,
 *                   text width and tree state before first paint
 *   CLIENT_MODULES  everything else, concatenated into one function scope
 */

const CLIENT_DIR = new URL("./client/", import.meta.url)

function readClient(name) {
  return readFileSync(new URL(name, CLIENT_DIR), "utf8")
}

// Function declarations hoist across the shared scope, but var initializers
// and listener registrations run in this order. locale.js has to come before
// any module that adds a STRINGS table. Listeners for one event fire in the
// order they were added, and this keeps the order of the single file it was
// split from: article's document click before nav's, outline's window resize
// before boot's. boot.js runs the first refresh, so it stays last.
const CLIENT_MODULES = [
  "helpers.js",
  "locale.js",
  "motion.js",
  "width.js",
  "article.js",
  "shortcuts.js",
  "tree.js",
  "resize.js",
  "outline.js",
  "mobile.js",
  "drawer.js",
  "outline-sheet.js",
  "progress.js",
  "nav.js",
  "boot.js",
]

// Both scripts are assembled from source text, so they take these as an
// argument instead of closing over them.
const SIDEBAR_PREFS = {
  widthKey: "roob-sidebar-width",
  collapsedKey: "roob-sidebar-collapsed",
  min: 220,
  max: 520,
  defaultWidth: 280,
  // The panel never takes the window below this much room for the column.
  columnReserve: 480,
  // Text width mode, a plain string: default, wide or full (width.js).
  modeKey: "roob-editor-width",
}

const prefsArg = JSON.stringify(SIDEBAR_PREFS)
const clientSource = CLIENT_MODULES.map((name) => readClient(name)).join("\n")
const script = "(function roobUI(prefs) {\n" + clientSource + "\n})(" + prefsArg + ")"
const beforeScript =
  "(function roobPrescript(prefs) {\n" + readClient("prescript.js") + "\n})(" + prefsArg + ")"

const css = `
#tpl-width-button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-inline, 3px);
  background: transparent;
  color: var(--ink-muted-color, currentColor);
  cursor: pointer;
}
#tpl-width-button:hover {
  background: var(--item-hover-bg-color, rgba(128, 128, 128, 0.1));
  color: var(--accent-color, currentColor);
}
#tpl-width-button[data-mode="wide"],
#tpl-width-button[data-mode="full"] {
  color: var(--accent-color, currentColor);
}
#tpl-width-button[data-mode="full"] svg {
  transform: scaleX(1.18);
}

#tpl-width-toast {
  position: fixed;
  /* Centred on the track the text column sits in, not on the window, which
     the sidebar shares on desktop. */
  left: calc(var(--tpl-sidebar-width, 0px) + (100% - var(--tpl-sidebar-width, 0px)) / 2);
  bottom: 2.5rem;
  transform: translate(-50%, 6px);
  z-index: 99999;
  padding: 6px 14px;
  border: 1px solid var(--line-color, rgba(128, 128, 128, 0.25));
  border-radius: var(--radius-block, 6px);
  background: var(--surface-subtle-color, #fff);
  color: var(--ink-color, #333);
  font-family: var(--font-ui, inherit);
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 8px 20px var(--overlay-shadow-color, rgba(0, 0, 0, 0.12));
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease-out, transform 140ms ease-out;
}
#tpl-width-toast.tpl-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
@media (prefers-reduced-motion: reduce) {
  #tpl-width-toast {
    transition: none;
  }
}
@media (max-width: 800px) {
  #tpl-width-toast {
    left: 50%;
  }
}
`

const RoobUI = () => {
  const Component = () => null
  Component.beforeDOMLoaded = beforeScript
  Component.afterDOMLoaded = script
  Component.css = css
  return Component
}

export { RoobUI }
