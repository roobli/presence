// The outline as a bottom sheet (_outline-sheet.scss). It opens from the
// header's outline button on one column, and from the rail's Outline action
// wherever the dial has no room beside the column (tpl:open-outline).
//
// Two detents, half and nine tenths of the window. The header row always
// drags it; the list drags it only downward from its top, and scrolls
// otherwise. A release settles at the detent nearest its projected height,
// or closes below a quarter, on the same spring as the drawer.

STRINGS.outlineSheet = {
  en: {
    label: "On this page",
    close: "Close",
  },
  "zh-Hans": {
    label: "本页目录",
    close: "关闭",
  },
}

var SHEET_LARGE = 0.9
var SHEET_MEDIUM = 0.5
var SHEET_CLOSE_BELOW = 0.25
var SHEET_SLOP = 6

var sheetEl = null
var sheetScrimEl = null
var sheetListEl = null
var sheetOpener = null
var sheetOpen = false // where it is headed
var sheetH = 0 // presentation value: visible height in px
var sheetViewport = 0
var sheetDetent = SHEET_MEDIUM
var sheetSpring = null
var sheetDrag = null
var sheetFrame = 0
var sheetSuppressClick = false

/** The height a sheet let go at h, growing at vh px/s, settles at. */
function sheetRestingHeight(h, vh, viewport) {
  var projected = h + project(vh)
  if (projected < SHEET_CLOSE_BELOW * viewport) return 0
  var large = SHEET_LARGE * viewport
  var medium = SHEET_MEDIUM * viewport
  return Math.abs(projected - large) < Math.abs(projected - medium) ? large : medium
}

/** The visible height for a drag that would make it raw px tall. */
function sheetDragHeight(raw, viewport) {
  var large = SHEET_LARGE * viewport
  if (raw > large) return large + rubberBand(raw - large, (1 - SHEET_LARGE) * viewport, 0.55)
  return Math.max(0, raw)
}

function outlineSheetIsOpen() {
  return sheetOpen
}

function sheetViewportHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight
}

function buildOutlineSheet() {
  if (sheetEl && sheetEl.isConnected && sheetScrimEl && sheetScrimEl.isConnected) return
  if (sheetEl) sheetEl.remove()
  if (sheetScrimEl) sheetScrimEl.remove()
  sheetScrimEl = el("div", "tpl-os-scrim")
  sheetScrimEl.id = "tpl-outline-scrim"
  sheetScrimEl.hidden = true

  sheetEl = el("section", "tpl-outline-sheet")
  sheetEl.id = "tpl-outline-sheet"
  sheetEl.setAttribute("role", "dialog")
  sheetEl.setAttribute("aria-modal", "true")
  sheetEl.hidden = true

  var head = el("div", "tpl-os-head")
  var grabber = el("span", "tpl-os-grabber")
  grabber.setAttribute("aria-hidden", "true")
  head.appendChild(grabber)
  head.appendChild(el("h2", "tpl-os-title"))
  var close = el("button", "tpl-os-close")
  close.type = "button"
  close.appendChild(icon("close"))
  head.appendChild(close)

  sheetListEl = el("div", "tpl-os-list")
  sheetEl.appendChild(head)
  sheetEl.appendChild(sheetListEl)
  document.body.appendChild(sheetScrimEl)
  document.body.appendChild(sheetEl)
}

function outlineSheetArticle() {
  return document.querySelector(".page > #quartz-body > .center > article")
}

/** The TOC's text where it has the heading, which leaves out anchor marks. */
function headingLabel(heading) {
  var link = null
  try {
    link = document.querySelector('.toc-content a[href="#' + CSS.escape(heading.id) + '"]')
  } catch (e) {
    link = null
  }
  return ((link ? link.textContent : heading.textContent) || "").trim()
}

function sheetRow(heading, className) {
  var row = el("a", className, headingLabel(heading))
  row.href = "#" + heading.id
  row.setAttribute("data-target", heading.id)
  return row
}

/** Every h2, with the h3s of the section being read beneath it. Returns the
 *  current section's row, or null when the page has no sections. */
function fillOutlineSheet() {
  sheetListEl.textContent = ""
  var article = outlineSheetArticle()
  if (!article) return null
  var heads = article.querySelectorAll("h2[id], h3[id]")
  var sections = []
  for (var i = 0; i < heads.length; i += 1) {
    if (heads[i].tagName === "H2") sections.push({ node: heads[i], subs: [] })
    else if (sections.length) sections[sections.length - 1].subs.push(heads[i])
  }
  if (!sections.length) return null

  var threshold = window.innerHeight * 0.28
  var current = 0
  for (var s = 0; s < sections.length; s += 1) {
    if (sections[s].node.getBoundingClientRect().top - threshold <= 1) current = s
    else break
  }

  var list = el("ol", "tpl-os-sections")
  var currentRow = null
  for (var j = 0; j < sections.length; j += 1) {
    var item = el("li", "tpl-os-section")
    var row = sheetRow(sections[j].node, "tpl-os-row")
    item.appendChild(row)
    if (j === current) {
      row.classList.add("tpl-os-current")
      row.setAttribute("aria-current", "location")
      currentRow = row
      if (sections[j].subs.length) {
        var subs = el("ol", "tpl-os-subs")
        for (var k = 0; k < sections[j].subs.length; k += 1) {
          var subItem = el("li", "")
          subItem.appendChild(sheetRow(sections[j].subs[k], "tpl-os-row tpl-os-sub"))
          subs.appendChild(subItem)
        }
        item.appendChild(subs)
      }
    }
    list.appendChild(item)
  }
  sheetListEl.appendChild(list)
  return currentRow
}

function paintOutlineSheet() {
  sheetFrame = 0
  if (!sheetEl) return
  sheetEl.style.transform = "translate3d(0, " + (sheetViewport - sheetH).toFixed(2) + "px, 0)"
  if (sheetScrimEl && sheetViewport > 0) {
    sheetScrimEl.style.opacity = String(clamp(sheetH / (SHEET_MEDIUM * sheetViewport), 0, 1))
  }
}

function sizeOutlineSheet() {
  sheetViewport = sheetViewportHeight()
  sheetEl.style.height = sheetViewport + "px"
  placeOutlineSheet()
}

/** Beside a column the sheet sits under the note column. Its left edge and
 *  width go to the stylesheet, which centres a sheet of at most 420px on them
 *  and ignores them on one column. Runs on open, on resize, and from
 *  applyLayout, which also covers a text width change while the sheet is up. */
function placeOutlineSheet() {
  if (!sheetEl || sheetEl.hidden) return
  var center = document.querySelector(".page > #quartz-body > .center")
  if (!center) return
  var rect = center.getBoundingClientRect()
  sheetEl.style.setProperty("--tpl-os-column-left", rect.left.toFixed(2) + "px")
  sheetEl.style.setProperty("--tpl-os-column-width", rect.width.toFixed(2) + "px")
}

/** Rows below the bottom of the screen at this detent can still scroll up. */
function setSheetDetent(fraction) {
  sheetDetent = fraction
  sheetListEl.style.setProperty(
    "--tpl-os-hidden",
    Math.round((1 - fraction) * sheetViewport) + "px",
  )
}

/** At the top of the list a downward swipe belongs to the sheet, so touch
 *  only scrolls it the other way; iOS ignores pan-down and keeps pan-y. */
function syncSheetTouchAction() {
  if (!sheetListEl) return
  sheetListEl.style.touchAction = sheetListEl.scrollTop <= 0 ? "pan-down" : "pan-y"
}

function animateOutlineSheet(target, velocity) {
  releaseSheetDrag()
  if (!sheetSpring) sheetSpring = createSpring({ response: 0.35, dampingRatio: 1 })
  if (velocity !== undefined || !sheetSpring.running) sheetSpring.set(sheetH, velocity || 0)
  sheetSpring.retarget(target)
  if (prefersReducedMotion()) {
    sheetH = target
    paintOutlineSheet()
  }
  sheetSpring.run(
    function (value) {
      sheetH = value
      paintOutlineSheet()
    },
    function () {
      if (!sheetOpen && sheetH <= 0.5) hideOutlineSheet()
    },
  )
}

function hideOutlineSheet() {
  if (sheetEl) sheetEl.hidden = true
  if (sheetScrimEl) sheetScrimEl.hidden = true
}

function openOutlineSheet(opener) {
  if (sheetOpen) return
  buildOutlineSheet()
  var current = fillOutlineSheet()
  if (!current) return
  sheetOpener = opener || document.activeElement
  sheetEl.setAttribute("aria-label", t("outlineSheet", "label"))
  sheetEl.querySelector(".tpl-os-title").textContent = t("outlineSheet", "label")
  sheetEl.querySelector(".tpl-os-close").setAttribute("aria-label", t("outlineSheet", "close"))

  var shown = !sheetEl.hidden
  sheetEl.hidden = false
  sheetScrimEl.hidden = false
  sizeOutlineSheet()
  if (!shown) {
    sheetH = 0
    paintOutlineSheet()
  }
  sheetOpen = true
  document.documentElement.classList.add("tpl-outline-sheet-open")
  setSheetDetent(SHEET_MEDIUM)
  sheetListEl.scrollTop = Math.max(0, current.offsetTop - sheetListEl.offsetTop - 44)
  syncSheetTouchAction()
  animateOutlineSheet(SHEET_MEDIUM * sheetViewport)
  current.focus({ preventScroll: true })
}

/** Close the sheet; true when there was one to close. */
function closeOutlineSheet(focusBack, velocity) {
  if (!sheetOpen) return false
  sheetOpen = false
  document.documentElement.classList.remove("tpl-outline-sheet-open")
  animateOutlineSheet(0, velocity)
  var back = sheetOpener
  sheetOpener = null
  if (focusBack !== false && back && back.isConnected && back.getClientRects().length) {
    back.focus({ preventScroll: true })
  }
  return true
}

function resetOutlineSheet() {
  if (sheetSpring) sheetSpring.stop()
  releaseSheetDrag()
  sheetOpen = false
  sheetOpener = null
  sheetH = 0
  document.documentElement.classList.remove("tpl-outline-sheet-open")
  hideOutlineSheet()
}

function goToHeading(id) {
  var heading = document.getElementById(id)
  closeOutlineSheet(false)
  if (!heading) return
  heading.scrollIntoView({
    behavior: prefersReducedMotion() ? "instant" : "smooth",
    block: "start",
  })
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
  heading.focus({ preventScroll: true })
  try {
    history.replaceState(history.state, "", "#" + id)
  } catch (e) {
    /* the address stays as it was */
  }
}

document.addEventListener("tpl:open-outline", function (event) {
  openOutlineSheet(event.detail && event.detail.opener)
})

document.addEventListener("prenav", resetOutlineSheet)

window.addEventListener("resize", function () {
  if (!sheetEl || sheetEl.hidden || sheetDrag) return
  sizeOutlineSheet()
  setSheetDetent(sheetDetent)
  var target = sheetOpen ? sheetDetent * sheetViewport : 0
  if (sheetSpring && sheetSpring.running) {
    sheetSpring.retarget(target)
    return
  }
  sheetH = target
  paintOutlineSheet()
})

document.addEventListener(
  "scroll",
  function (event) {
    if (event.target === sheetListEl) syncSheetTouchAction()
  },
  { capture: true, passive: true },
)

// --- drag ----------------------------------------------------------------------

function releaseSheetDrag() {
  var d = sheetDrag
  if (!d) return
  sheetDrag = null
  document.documentElement.classList.remove("tpl-sheet-dragging")
  try {
    if (d.captured && sheetEl.hasPointerCapture(d.id)) sheetEl.releasePointerCapture(d.id)
  } catch (e) {
    /* the sheet is already gone */
  }
}

function captureSheetDrag(d) {
  try {
    sheetEl.setPointerCapture(d.id)
  } catch (e) {
    /* the document still sees the moves */
  }
  d.captured = true
  document.documentElement.classList.add("tpl-sheet-dragging")
}

function endSheetDrag(event) {
  var d = sheetDrag
  if (!d) return
  if (!d.captured) {
    releaseSheetDrag()
    if (d.caught) animateOutlineSheet(sheetOpen ? sheetDetent * sheetViewport : 0, 0)
    return
  }
  if (event.type === "pointerup") {
    sheetH = sheetDragHeight(d.originH - (event.clientY - d.startY), sheetViewport)
    d.tracker.add(event.timeStamp, sheetH)
  }
  if (sheetFrame) {
    window.cancelAnimationFrame(sheetFrame)
    sheetFrame = 0
  }
  paintOutlineSheet()
  var moved = Math.abs(sheetH - d.originH) > 1
  releaseSheetDrag()
  if (moved) {
    sheetSuppressClick = true
    window.setTimeout(function () {
      sheetSuppressClick = false
    }, 0)
  }
  var velocity = d.tracker.velocity()
  var rest = sheetRestingHeight(sheetH, velocity, sheetViewport)
  if (rest === 0) {
    closeOutlineSheet(true, velocity)
    return
  }
  setSheetDetent(rest / sheetViewport)
  animateOutlineSheet(rest, velocity)
}

document.addEventListener("pointerdown", function (event) {
  if (!sheetEl || sheetEl.hidden || !sheetOpen || !event.isPrimary) return
  if (event.pointerType === "mouse" && event.button !== 0) return
  var target = event.target
  if (!target || !target.closest || !sheetEl.contains(target)) return
  var onHead = !!target.closest(".tpl-os-head")
  if (onHead && target.closest("button")) return
  var caught = !!(sheetSpring && sheetSpring.running)
  if (caught) {
    sheetH = sheetSpring.value
    sheetSpring.stop()
    paintOutlineSheet()
  }
  sheetDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originH: sheetH,
    captured: false,
    caught: caught,
    tracker: trackVelocity(),
  }
  sheetDrag.tracker.add(event.timeStamp, sheetH)
  // The header row is only ever a handle, so it takes the press at once.
  if (onHead) {
    captureSheetDrag(sheetDrag)
    event.preventDefault()
  }
})

document.addEventListener("pointermove", function (event) {
  var d = sheetDrag
  if (!d || event.pointerId !== d.id) return
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    endSheetDrag(event)
    return
  }
  var dx = event.clientX - d.startX
  var dy = event.clientY - d.startY
  if (!d.captured) {
    if (Math.sqrt(dx * dx + dy * dy) < SHEET_SLOP) return
    if (dy > 0 && dy > Math.abs(dx) && sheetListEl.scrollTop <= 0) {
      captureSheetDrag(d)
    } else {
      endSheetDrag(event)
      return
    }
  }
  sheetH = sheetDragHeight(d.originH - dy, sheetViewport)
  d.tracker.add(event.timeStamp, sheetH)
  if (!sheetFrame) sheetFrame = window.requestAnimationFrame(paintOutlineSheet)
})

document.addEventListener("pointerup", function (event) {
  if (sheetDrag && event.pointerId === sheetDrag.id) endSheetDrag(event)
})

document.addEventListener("pointercancel", function (event) {
  if (sheetDrag && event.pointerId === sheetDrag.id) endSheetDrag(event)
})

// Only the sheet's own capture counts: a touch on a row starts out captured
// by that row, and taking the capture fires this at the row.
document.addEventListener("lostpointercapture", function (event) {
  var d = sheetDrag
  if (d && d.captured && event.pointerId === d.id && event.target === sheetEl) endSheetDrag(event)
})

window.addEventListener(
  "click",
  function (event) {
    if (!sheetSuppressClick) return
    sheetSuppressClick = false
    var target = event.target
    if (!target || !target.closest || !target.closest("#tpl-outline-sheet")) return
    event.preventDefault()
    event.stopPropagation()
  },
  true,
)

document.addEventListener("click", function (event) {
  var target = event.target
  if (!target || !target.closest) return
  if (target.closest("#tpl-outline-scrim, #tpl-outline-sheet .tpl-os-close")) {
    closeOutlineSheet(true)
    return
  }
  var row = target.closest("#tpl-outline-sheet .tpl-os-row")
  if (!row || !sheetOpen) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  goToHeading(row.getAttribute("data-target"))
})
