// Text width (plugins/wider): three modes on html[data-tpl-width], the right
// gutter the outline dial is sized from, and the toolbar button and toast
// that step through the modes. The column itself is CSS (_shell.scss).

STRINGS.width = {
  en: {
    label: "Text width: {mode}",
    default: "Default",
    wide: "Wide",
    full: "Full",
  },
  "zh-Hans": {
    label: "正文宽度：{mode}",
    default: "默认",
    wide: "加宽",
    full: "满幅",
  },
}

var MODES = ["default", "wide", "full"]
var STORAGE_KEY = prefs.modeKey
var MOBILE_MAX = 800
// The dial needs this much room right of the column, enough for entries of
// about 25 characters; below it the Outline button in the sidebar foot opens
// the outline instead. Pinned, the panel needs this much before it docks as a
// rail.
var OUTLINE_MIN_GUTTER = 240
var OUTLINE_DOCK_GUTTER = 304

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

// Earlier builds wrote the column's cap and gutter inline on <html>, where
// they outrank the stylesheet. Nothing writes them now.
document.documentElement.style.removeProperty("--tpl-max-width")
document.documentElement.style.removeProperty("--tpl-shell-gutter")

/**
 * Measure the room right of the column once and let the outline take it.
 * Runs on load, on a debounced resize, on a mode change and on pinning; never
 * during a drag, where the right edge does not move anyway. It never narrows
 * the column.
 */
function applyLayout() {
  var docEl = document.documentElement
  docEl.setAttribute("data-tpl-width", mode)
  var narrow = window.innerWidth <= MOBILE_MAX
  // On one column the sidebar is a sticky bar over the article, and anchor
  // jumps need its real height to land below it (_mobile-header.scss).
  if (narrow) {
    var bar = document.querySelector(".page > #quartz-body > .sidebar.left")
    if (bar && bar.offsetHeight > 0) {
      docEl.style.setProperty("--tpl-mobile-header", bar.offsetHeight + "px")
    }
  }
  var center = document.querySelector(".page > #quartz-body > .center")
  var gutter = center ? Math.max(0, docEl.clientWidth - center.getBoundingClientRect().right) : 0
  docEl.style.setProperty("--tpl-right-gutter", Math.round(gutter * 100) / 100 + "px")
  var state = "off"
  if (!narrow && outlineItems.length > 0) {
    if (outlinePinned() && gutter >= OUTLINE_DOCK_GUTTER) state = "dock"
    else if (gutter >= OUTLINE_MIN_GUTTER) state = "on"
  }
  docEl.setAttribute("data-tpl-outline", state)
  // Guides are measured, not laid out, so a width change strands the last
  // drawing over the new geometry unless it is redrawn here.
  var treeEl = document.querySelector(".sidebar.left .explorer")
  if (treeEl) scheduleGuides(treeEl)
  syncWidthButton()
  syncOutlineDock()
  // The column may have moved under an open outline sheet.
  placeOutlineSheet()
}

var toastTimer = 0

function showToast(text) {
  var toast = document.getElementById("tpl-width-toast")
  if (!toast) {
    toast = document.createElement("div")
    toast.id = "tpl-width-toast"
    // A polite live region, so the new width is read out as well as shown.
    toast.setAttribute("role", "status")
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
  // The dial glides to its new width on a mode change, and only then.
  morphOutlineWidth()
  applyLayout()
  showToast(t("width", "label", { mode: t("width", mode) }))
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
  var keys = mac ? "⌘⌥[ / ⌘⌥]" : "Ctrl+Alt+[ / Ctrl+Alt+]"
  button.title = t("width", "label", { mode: t("width", mode) }) + " (" + keys + ")"
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
