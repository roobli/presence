// Editor width (plugins/wider): the three modes, the column geometry they
// give, and the toolbar button and toast that step through them.

// plugins/wider/src/layout.ts
var DEFAULT_CONTENT_WIDTH = 860
var WIDE_MIN_CONTENT_WIDTH = 1000
var WIDE_MAX_CONTENT_WIDTH = 1180
var WIDE_AVAILABLE_RATIO = 0.78
var FULL_MAX_CONTENT_WIDTH = 1680
var MIN_CONTENT_WIDTH = 560
// plugins/sidenote/src/main.ts
var SIDENOTE_RESERVE = 300

var MODES = ["default", "wide", "full"]
var MODE_LABELS = { default: "Default", wide: "Wide", full: "Full" }
var STORAGE_KEY = "roob-editor-width"
var MOBILE_MAX = 800

// packages/core/src/ui/editor-surface.ts
function shellGutter(hostWidth) {
  var width = Math.max(0, hostWidth)
  if (width < 1024) return 16
  return clamp(Math.round(width * 0.04), 24, 72)
}

function canFitReserve(hostWidth, reserve, minimumProseWidth) {
  var width = Math.max(0, hostWidth)
  return width - shellGutter(width) * 2 >= Math.max(0, reserve) + Math.max(0, minimumProseWidth)
}

function calculateLayout(mode, hostWidth, requestedReserve) {
  var width = Math.max(0, hostWidth)
  var reserve = canFitReserve(width, requestedReserve, DEFAULT_CONTENT_WIDTH)
    ? requestedReserve
    : 0
  var gutter = shellGutter(width)
  var availableShell = Math.max(0, width - gutter * 2)
  var availableContent = Math.max(0, availableShell - reserve)
  var contentFloor = Math.min(MIN_CONTENT_WIDTH, availableContent)

  var desired = DEFAULT_CONTENT_WIDTH
  if (mode === "wide") {
    desired = clamp(
      Math.round(availableContent * WIDE_AVAILABLE_RATIO),
      WIDE_MIN_CONTENT_WIDTH,
      WIDE_MAX_CONTENT_WIDTH,
    )
  } else if (mode === "full") {
    desired = Math.min(FULL_MAX_CONTENT_WIDTH, Math.max(WIDE_MIN_CONTENT_WIDTH, availableContent))
  }

  var maxWidth = Math.max(
    contentFloor + reserve,
    Math.min(availableShell, desired + reserve),
  )
  return { gutter: gutter, maxWidth: maxWidth, reserve: reserve }
}

function readMode() {
  try {
    var stored = localStorage.getItem(STORAGE_KEY)
    if (MODES.indexOf(stored) !== -1) return stored
  } catch (e) {
    /* private mode */
  }
  return "default"
}

function writeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (e) {
    /* private mode */
  }
}

var mode = readMode()

/** The width the centre column has to work with, sidebar excluded. */
function measureHostWidth() {
  var body = document.getElementById("quartz-body")
  if (!body) return window.innerWidth
  var width = body.clientWidth || window.innerWidth
  if (window.innerWidth > MOBILE_MAX) {
    var sidebar = body.querySelector(".sidebar.left")
    if (sidebar) width -= sidebar.offsetWidth
  }
  // Taken mid-layout this can come back at or near zero, and a zero here
  // collapses the reading column to nothing and leaves it there until
  // something else forces a recalculation. Refuse the reading instead.
  if (width < MIN_CONTENT_WIDTH) return Math.min(window.innerWidth, MIN_CONTENT_WIDTH)
  return width
}

function hasSidenotes() {
  return document.querySelector("article .sidenote") !== null
}

function applyLayout() {
  var root = document.getElementById("quartz-root")
  if (!root) return
  var layout = calculateLayout(
    mode,
    measureHostWidth(),
    hasSidenotes() ? SIDENOTE_RESERVE : 0,
  )
  // The custom properties go on <html>: the outline dial is a child of
  // <body>, a sibling of #quartz-root, so anything set on the root element
  // of the page layout would never reach it.
  var docEl = document.documentElement
  // On one column the sidebar is a sticky bar over the article, and anchor
  // jumps need its real height to land below it (_mobile-header.scss).
  if (window.innerWidth <= MOBILE_MAX) {
    var bar = document.querySelector(".page > #quartz-body > .sidebar.left")
    if (bar && bar.offsetHeight > 0) {
      docEl.style.setProperty("--tpl-mobile-header", bar.offsetHeight + "px")
    }
  }
  docEl.style.setProperty("--tpl-shell-gutter", layout.gutter + "px")
  docEl.style.setProperty("--tpl-sidenote-reserve-active", layout.reserve + "px")
  root.setAttribute("data-tpl-wider-mode", mode)
  root.setAttribute("data-tpl-sidenotes", layout.reserve > 0 ? "margin" : "inline")
  // The outline lives beside the column, never over it. Rather than let it
  // paint over the article (its own backdrop is the canvas colour, so it cut
  // a pale strip through anything tinted: callouts, fences, tables), the
  // column gives up the room. As a dial that costs nothing on a wide screen,
  // since the editor widths cap below the limit anyway. Pinned it needs the
  // full panel width instead, so the column pays for that too and the panel
  // becomes a rail rather than a card floating over the text.
  var host = measureHostWidth()
  var wantsOutline = outlineItems.length > 0
  var dockRoom = host - OUTLINE_DOCK_GUTTER * 2
  var docked = wantsOutline && outlinePinned() && dockRoom >= OUTLINE_MIN_DOCK_COLUMN
  var dialRoom = host - OUTLINE_GUTTER * 2
  var roomForOutline = docked ? dockRoom : dialRoom
  var showOutline = wantsOutline && (docked || dialRoom >= OUTLINE_MIN_COLUMN)
  var maxWidth = showOutline ? Math.min(layout.maxWidth, roomForOutline) : layout.maxWidth
  docEl.style.setProperty("--tpl-max-width", maxWidth + "px")
  docEl.style.setProperty("--tpl-outline-dock-width", OUTLINE_DOCK_WIDTH + "px")
  docEl.setAttribute("data-tpl-outline", showOutline ? (docked ? "dock" : "on") : "off")
  var gutter = Math.max(0, Math.round((host - maxWidth) / 2))
  docEl.style.setProperty("--tpl-right-gutter", gutter + "px")
  // Guides are measured, not laid out, so a width change strands the last
  // drawing over the new geometry unless it is redrawn here.
  var treeEl = document.querySelector(".sidebar.left .explorer")
  if (treeEl) scheduleGuides(treeEl)
  syncWidthButton()
  syncOutlineDock()
}

var toastTimer = 0

function showToast(text) {
  var toast = document.getElementById("tpl-width-toast")
  if (!toast) {
    toast = document.createElement("div")
    toast.id = "tpl-width-toast"
    document.body.appendChild(toast)
  }
  toast.textContent = text
  toast.classList.add("tpl-visible")
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(function () {
    toast.classList.remove("tpl-visible")
  }, 1400)
}

function stepMode(delta) {
  var index = MODES.indexOf(mode)
  mode = MODES[(index + delta + MODES.length) % MODES.length]
  writeMode(mode)
  applyLayout()
  showToast("Editor width: " + MODE_LABELS[mode])
}

// --- toolbar button ------------------------------------------------------
// Same 24 grid, same 1.7 stroke, same round joins as the rest of the row.
var WIDTH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m7 8-4 4 4 4M17 8l4 4-4 4M12 4.5v15"/></svg>'

function syncWidthButton() {
  var button = document.getElementById("tpl-width-button")
  if (!button) return
  button.setAttribute("data-mode", mode)
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "")
  var keys = mac ? "\u2318\u2325[ / \u2318\u2325]" : "Ctrl+Alt+[ / Ctrl+Alt+]"
  button.title = "Editor width: " + MODE_LABELS[mode] + "  (" + keys + ")"
  button.setAttribute("aria-label", button.title)
}

function mountWidthButton() {
  if (document.getElementById("tpl-width-button")) return
  var toolbar = document.querySelector(".sidebar.left .flex-component")
  if (!toolbar) return
  var button = document.createElement("button")
  button.id = "tpl-width-button"
  button.type = "button"
  button.innerHTML = WIDTH_ICON
  button.addEventListener("click", function () {
    stepMode(1)
  })
  toolbar.appendChild(button)
  syncWidthButton()
}
