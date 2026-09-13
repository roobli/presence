// The panel's width and collapse: the stored width, the edge handle's drag
// and keyboard, and the button that brings a folded panel back.

// Keys and limits come from SIDEBAR_PREFS, which the <head> script that
// paints the stored width before first paint reads too.
var SIDEBAR_WIDTH_KEY = prefs.widthKey
var SIDEBAR_COLLAPSED_KEY = prefs.collapsedKey
var SIDEBAR_MIN = prefs.min
var SIDEBAR_MAX = prefs.max
var DEFAULT_SIDEBAR_WIDTH = prefs.defaultWidth
var SIDEBAR_COLUMN_RESERVE = prefs.columnReserve
var DRAG_THRESHOLD = 4

// --- panel width ---------------------------------------------------------
/** The widest the panel may be in this window: never past SIDEBAR_MAX, and
 *  never so wide that the column is left less than SIDEBAR_COLUMN_RESERVE. */
function sidebarMax() {
  return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, window.innerWidth - SIDEBAR_COLUMN_RESERVE))
}

function fitSidebarWidth(width) {
  return Math.round(clamp(width, SIDEBAR_MIN, sidebarMax()))
}

function storedSidebarWidth() {
  var width = readJson(SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH)
  if (typeof width !== "number" || width < SIDEBAR_MIN || width > SIDEBAR_MAX) {
    return DEFAULT_SIDEBAR_WIDTH
  }
  return width
}

/** The width on screen, which during a drag is not the stored one. */
function paintedSidebarWidth() {
  var painted = parseFloat(document.documentElement.style.getPropertyValue("--tpl-sidebar-width"))
  return painted > 0 ? painted : fitSidebarWidth(storedSidebarWidth())
}

function paintSidebarWidth(width) {
  document.documentElement.style.setProperty("--tpl-sidebar-width", width + "px")
  if (width > 0) syncResizeHandle(width)
}

function syncResizeHandle(width) {
  var handle = document.querySelector(".sidebar.left .tpl-nav-resize")
  if (!handle) return
  handle.setAttribute("aria-valuemin", String(SIDEBAR_MIN))
  handle.setAttribute("aria-valuemax", String(sidebarMax()))
  handle.setAttribute("aria-valuenow", String(Math.round(width)))
}

/** Paint and keep a width, and let the column and the row titles follow. */
function commitSidebarWidth(width) {
  writeJson(SIDEBAR_WIDTH_KEY, width)
  paintSidebarWidth(width)
  applyLayout()
  var explorer = document.querySelector(".sidebar.left .explorer")
  if (explorer) scheduleTitles(explorer)
}

function sidebarCollapsed() {
  return readJson(SIDEBAR_COLLAPSED_KEY, false) === true
}

function setSidebarCollapsed(collapsed) {
  writeJson(SIDEBAR_COLLAPSED_KEY, collapsed)
  document.documentElement.setAttribute("data-tpl-sidebar", collapsed ? "collapsed" : "open")
  // The width lives in an inline custom property, which outranks anything
  // the stylesheet says. Collapsing has to zero it here or the grid keeps a
  // column the width of a panel that is no longer on screen.
  paintSidebarWidth(collapsed ? 0 : fitSidebarWidth(storedSidebarWidth()))
  applyLayout()
  syncCollapseButton()
}

/** Same result as roobSidebarPrepaint, which already ran in <head>. */
function restoreSidebarPrefs() {
  var collapsed = sidebarCollapsed()
  document.documentElement.setAttribute("data-tpl-sidebar", collapsed ? "collapsed" : "open")
  paintSidebarWidth(collapsed ? 0 : fitSidebarWidth(storedSidebarWidth()))
}

function syncCollapseButton() {
  var button = document.getElementById("tpl-sidebar-collapse")
  if (!button) return
  var collapsed = sidebarCollapsed()
  button.setAttribute("aria-pressed", collapsed ? "true" : "false")
  button.title = collapsed ? "展开侧栏" : "收起侧栏"
  button.setAttribute("aria-label", button.title)
}

// --- dragging the panel edge ---------------------------------------------
//
// Bound once on the document and matched by class when the press lands.
// micromorph pairs the rebuilt sidebar's children with the server's by
// position and reuses a node of the same tag, so listeners put on the
// handle itself moved onto the file tree after a navigation: a press that
// travelled in the tree resized the panel, and a double-click reset it.
//
// The edge moves exactly as far as the pointer, from wherever the press
// caught it. Capture keeps the drag when the pointer leaves the strip, the
// writes wait for the next frame, and the width is only kept on release.
var drag = null
var dragFrame = 0

function paintDrag() {
  dragFrame = 0
  if (!drag) return
  paintSidebarWidth(drag.width)
  applyLayout()
}

function endDrag(keep) {
  if (!drag) return
  var ended = drag
  drag = null
  if (dragFrame) {
    window.cancelAnimationFrame(dragFrame)
    dragFrame = 0
  }
  document.documentElement.classList.remove("tpl-resizing")
  if (ended.moved) {
    if (keep) {
      commitSidebarWidth(ended.width)
    } else {
      paintSidebarWidth(ended.startWidth)
      applyLayout()
    }
  }
  try {
    if (ended.handle.hasPointerCapture(ended.pointerId)) {
      ended.handle.releasePointerCapture(ended.pointerId)
    }
  } catch (e) {
    /* the handle is already gone */
  }
}

document.addEventListener("pointerdown", function (event) {
  if (event.button !== 0 || !event.isPrimary) return
  var target = event.target
  var handle = target && target.closest ? target.closest(".tpl-nav-resize") : null
  if (!handle) return
  endDrag(false)
  var width = paintedSidebarWidth()
  drag = {
    handle: handle,
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: width,
    width: width,
    moved: false,
  }
  try {
    handle.setPointerCapture(event.pointerId)
  } catch (e) {
    /* without capture the document still sees every move */
  }
  // No text selection, and no focus ring from a mouse press.
  event.preventDefault()
})

document.addEventListener("pointermove", function (event) {
  if (!drag || event.pointerId !== drag.pointerId) return
  // A release the page never heard about still ends the drag, and keeps
  // the width that was on screen when the button came up.
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    endDrag(true)
    return
  }
  var dx = event.clientX - drag.startX
  // The strip sits beside the panel's scrollbar, so a press that lands on
  // it by accident must not move anything. Only travel starts a resize.
  if (!drag.moved) {
    if (Math.abs(dx) < DRAG_THRESHOLD) return
    drag.moved = true
    document.documentElement.classList.add("tpl-resizing")
  }
  drag.width = fitSidebarWidth(drag.startWidth + dx)
  if (!dragFrame) dragFrame = window.requestAnimationFrame(paintDrag)
})

document.addEventListener("pointerup", function (event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(true)
})

// Cancelled by the system, or the handle left the page mid-drag: the edge
// goes back to where the press found it and nothing is kept.
document.addEventListener("pointercancel", function (event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(false)
})

document.addEventListener("lostpointercapture", function (event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(false)
})

// The keyboard way to do the same: arrows nudge the edge, Shift takes
// bigger steps, Home and End go to the limits, Enter restores the default.
document.addEventListener("keydown", function (event) {
  var handle = event.target
  if (!handle || !handle.classList || !handle.classList.contains("tpl-nav-resize")) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  var width = paintedSidebarWidth()
  var step = event.shiftKey ? 50 : 10
  if (event.key === "ArrowLeft") width -= step
  else if (event.key === "ArrowRight") width += step
  else if (event.key === "Home") width = SIDEBAR_MIN
  else if (event.key === "End") width = sidebarMax()
  else if (event.key === "Enter") width = DEFAULT_SIDEBAR_WIDTH
  else return
  event.preventDefault()
  commitSidebarWidth(fitSidebarWidth(width))
})

// A mis-drag is easy to make and hard to undo by hand, so give the edge
// the usual way back to the default width.
document.addEventListener("dblclick", function (event) {
  var target = event.target
  if (!target || !target.closest || !target.closest(".tpl-nav-resize")) return
  commitSidebarWidth(fitSidebarWidth(DEFAULT_SIDEBAR_WIDTH))
})

function makeResizeHandle() {
  var handle = el("div", "tpl-nav-resize")
  handle.setAttribute("role", "separator")
  handle.setAttribute("aria-orientation", "vertical")
  handle.setAttribute("aria-label", "调整侧栏宽度")
  handle.tabIndex = 0
  handle.title = "拖动调整宽度，双击复位"
  return handle
}

function mountReopenButton() {
  if (document.getElementById("tpl-sidebar-reopen")) return
  var button = el("button", "")
  button.id = "tpl-sidebar-reopen"
  button.type = "button"
  button.title = "展开侧栏"
  button.setAttribute("aria-label", "展开侧栏")
  button.appendChild(icon("panel"))
  button.addEventListener("click", function () {
    setSidebarCollapsed(false)
  })
  document.body.appendChild(button)
}
