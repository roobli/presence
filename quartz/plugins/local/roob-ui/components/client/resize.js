// The panel's width and collapse: the stored width, the edge handle's drag
// and keyboard, and the button that brings a folded panel back.

STRINGS.resize = {
  en: {
    handle: "Resize sidebar",
    hint: "Drag to resize, double-click to reset",
    show: "Show sidebar",
    hide: "Hide sidebar",
  },
  "zh-Hans": {
    handle: "调整侧栏宽度",
    hint: "拖动调整宽度，双击复位",
    show: "展开侧栏",
    hide: "收起侧栏",
  },
}

// Keys and limits come from SIDEBAR_PREFS, which the <head> script that
// paints the stored width before first paint reads too.
var SIDEBAR_WIDTH_KEY = prefs.widthKey
var SIDEBAR_COLLAPSED_KEY = prefs.collapsedKey
var SIDEBAR_MIN = prefs.min
var SIDEBAR_MAX = prefs.max
var DEFAULT_SIDEBAR_WIDTH = prefs.defaultWidth
var SIDEBAR_COLUMN_RESERVE = prefs.columnReserve
// Past a limit the edge stays put and only its line gives, toward this many
// px at most. The release speed is read over this many ms of samples.
var RESIZE_BAND = 80
var RELEASE_WINDOW = 100
var KEY_WIDTHS = { ArrowLeft: 1, ArrowRight: 1, Home: 1, End: 1, Enter: 1 }

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

/** The column follows the width in CSS; the row titles are measured. */
function settleSidebarWidth() {
  applyLayout()
  var explorer = document.querySelector(".sidebar.left .explorer")
  if (explorer) scheduleTitles(explorer)
}

/** Paint and keep a width. */
function commitSidebarWidth(width) {
  writeJson(SIDEBAR_WIDTH_KEY, width)
  paintSidebarWidth(width)
  settleSidebarWidth()
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
  button.title = t("resize", collapsed ? "show" : "hide")
  button.setAttribute("aria-label", button.title)
}

// --- dragging the panel edge ---------------------------------------------
//
// Bound once on the document and matched by class when the press lands.
// micromorph pairs the rebuilt sidebar's children with the server's by
// position and reuses a node of the same tag, so listeners put on the
// handle itself moved onto the file tree after a navigation.
//
// The press takes the edge at once and it moves exactly as far as the
// pointer, from wherever the press caught it. Each frame writes the width
// once and nothing else: no layout reads, no storage. The width is kept on
// release. Past either limit the edge holds and its line stretches on a
// rubber band, then springs back from the speed it was let go at.
var drag = null
var dragFrame = 0
var lineSpring = null

function setLineOffset(handle, offset) {
  if (Math.abs(offset) < 0.01) handle.style.removeProperty("--tpl-resize-offset")
  else handle.style.setProperty("--tpl-resize-offset", offset.toFixed(2) + "px")
}

/** Flat [time, offset, ...] samples of the line, the last RELEASE_WINDOW ms. */
function sampleLine(state, time) {
  var samples = state.samples
  samples.push(time, state.offset)
  while (samples.length > 4 && time - samples[0] > RELEASE_WINDOW) samples.splice(0, 2)
}

/** The line's average speed over the samples in the window before now, px/s. */
function lineVelocity(samples, now) {
  for (var i = 0; i < samples.length - 2; i += 2) {
    if (now - samples[i] > RELEASE_WINDOW) continue
    var last = samples.length - 2
    var dt = samples[last] - samples[i]
    return dt > 0 ? ((samples[last + 1] - samples[i + 1]) / dt) * 1000 : 0
  }
  return 0
}

function paintDrag() {
  dragFrame = 0
  if (!drag) return
  if (drag.width !== drag.painted) {
    document.documentElement.style.setProperty("--tpl-sidebar-width", drag.width + "px")
    drag.painted = drag.width
  }
  setLineOffset(drag.handle, drag.offset)
}

function moveDrag(clientX, time) {
  var raw = drag.startWidth + drag.bias + (clientX - drag.startX)
  drag.width = clamp(raw, SIDEBAR_MIN, drag.max)
  var overshoot = raw - drag.width
  drag.offset = overshoot === 0 ? 0 : rubberBand(overshoot, RESIZE_BAND)
  sampleLine(drag, time)
}

function endDrag(keep, event) {
  if (!drag) return
  var ended = drag
  drag = null
  if (dragFrame) {
    window.cancelAnimationFrame(dragFrame)
    dragFrame = 0
  }
  document.documentElement.classList.remove("tpl-resizing")
  try {
    if (ended.handle.hasPointerCapture(ended.pointerId)) {
      ended.handle.releasePointerCapture(ended.pointerId)
    }
  } catch (e) {
    /* the handle is already gone */
  }
  if (!keep) {
    // Escape: straight back to where the press found it.
    setLineOffset(ended.handle, 0)
    paintSidebarWidth(ended.startWidth)
    return
  }
  var now = event ? event.timeStamp : performance.now()
  var width = Math.round(ended.width)
  paintSidebarWidth(width)
  if (width !== Math.round(ended.startWidth)) {
    writeJson(SIDEBAR_WIDTH_KEY, width)
    settleSidebarWidth()
  }
  springLineBack(ended.handle, ended.offset, lineVelocity(ended.samples, now))
}

function springLineBack(handle, offset, velocity) {
  if (offset === 0) {
    setLineOffset(handle, 0)
    return
  }
  if (!lineSpring) lineSpring = createSpring({ response: 0.35, dampingRatio: 1 })
  lineSpring.stop()
  lineSpring.set(offset, velocity)
  lineSpring.retarget(0)
  // The line has to stay lit on its way back, pointer over it or not.
  handle.classList.add("tpl-resize-settling")
  lineSpring.run(
    function (value) {
      setLineOffset(handle, value)
    },
    function () {
      handle.classList.remove("tpl-resize-settling")
    },
  )
}

function stopLineSpring() {
  if (!lineSpring || !lineSpring.running) return 0
  var value = lineSpring.value
  lineSpring.stop()
  var settling = document.querySelector(".tpl-resize-settling")
  if (settling) settling.classList.remove("tpl-resize-settling")
  return value
}

document.addEventListener("pointerdown", function (event) {
  if (event.button !== 0 || !event.isPrimary) return
  var target = event.target
  var handle = target && target.closest ? target.closest(".tpl-nav-resize") : null
  if (!handle) return
  endDrag(false)
  // Caught on its way back, the line holds where it is and the pointer takes
  // it from there: the travel it stands for is folded into the grab.
  var caught = stopLineSpring()
  var width = paintedSidebarWidth()
  drag = {
    handle: handle,
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: width,
    bias: caught ? rubberBandInverse(caught, RESIZE_BAND) : 0,
    // Read once here; the window does not change size under a drag.
    max: sidebarMax(),
    width: width,
    painted: width,
    offset: 0,
    samples: [],
  }
  moveDrag(event.clientX, event.timeStamp)
  try {
    handle.setPointerCapture(event.pointerId)
  } catch (e) {
    /* without capture the document still sees every move */
  }
  document.documentElement.classList.add("tpl-resizing")
  setLineOffset(handle, drag.offset)
  // No text selection, and no focus ring from a mouse press.
  event.preventDefault()
})

document.addEventListener("pointermove", function (event) {
  if (!drag || event.pointerId !== drag.pointerId) return
  // A release the page never heard about still ends the drag, and keeps
  // the width that was on screen when the button came up.
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    endDrag(true, event)
    return
  }
  moveDrag(event.clientX, event.timeStamp)
  if (!dragFrame) dragFrame = window.requestAnimationFrame(paintDrag)
})

document.addEventListener("pointerup", function (event) {
  if (!drag || event.pointerId !== drag.pointerId) return
  moveDrag(event.clientX, event.timeStamp)
  endDrag(true, event)
})

// Capture lost for any reason, a system cancel included, ends the drag the
// way a release does: what is on screen is kept.
document.addEventListener("lostpointercapture", function (event) {
  if (drag && event.pointerId === drag.pointerId) endDrag(true, event)
})

document.addEventListener("prenav", function () {
  endDrag(false)
  stopLineSpring()
})

// The keyboard way to do the same: arrows nudge the edge, Shift takes
// bigger steps, Home and End go to the limits, Enter restores the default.
// Each press paints; the width is kept when the key comes up.
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
  paintSidebarWidth(fitSidebarWidth(width))
})

document.addEventListener("keyup", function (event) {
  var handle = event.target
  if (!handle || !handle.classList || !handle.classList.contains("tpl-nav-resize")) return
  if (!KEY_WIDTHS[event.key]) return
  var width = Math.round(paintedSidebarWidth())
  if (width === storedSidebarWidth()) return
  writeJson(SIDEBAR_WIDTH_KEY, width)
  settleSidebarWidth()
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
  handle.setAttribute("aria-label", t("resize", "handle"))
  handle.tabIndex = 0
  handle.title = t("resize", "hint")
  return handle
}

function mountReopenButton() {
  var button = document.getElementById("tpl-sidebar-reopen")
  if (!button) {
    button = el("button", "")
    button.id = "tpl-sidebar-reopen"
    button.type = "button"
    button.appendChild(icon("panel"))
    button.addEventListener("click", function () {
      setSidebarCollapsed(false)
    })
    document.body.appendChild(button)
  }
  // The page's language can change under a button that outlives the page.
  button.title = t("resize", "show")
  button.setAttribute("aria-label", button.title)
}
