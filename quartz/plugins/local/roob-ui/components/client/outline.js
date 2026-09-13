// -------------------------------------------------------------------------
// Page outline
//
// The outline used to be a section in the sidebar, which meant a note with
// a long one shoved everything below it down the moment the page loaded.
// It is a fixed dial in the top right instead: a few lines of the outline
// arranged on a shallow arc, the line you are reading crisp and level, its
// neighbours dimmer, blurrier and tilted off it. Pointing at it opens the
// whole outline, upright and opaque, over the article if it has to be.
// -------------------------------------------------------------------------
var OUTLINE_ROW = 26 // px per line; layout stays fixed so the states can swap
// What the dial needs on each side of the column, and the narrowest measure
// worth keeping once it has taken it.
var OUTLINE_GUTTER = 200
var OUTLINE_MIN_COLUMN = 900
// Pinned, the panel itself has to fit in that gutter, so the column pays the
// panel's width plus the room it needs on either side of it. The floor is
// lower than the dial's: asking for the rail is asking to spend the width.
var OUTLINE_DOCK_WIDTH = 288
var OUTLINE_DOCK_GUTTER = 330
var OUTLINE_MIN_DOCK_COLUMN = 640
var OUTLINE_ANCHOR = 3 // the current line rides the fourth row of the dial
var OUTLINE_PIN_KEY = "roob-outline-pinned"

var outlineEl = null
var outlineListEl = null
var outlineCountEl = null
var outlineItems = [] // { id: string, node: HTMLElement }
var outlineActive = -1
var outlineTicking = false

function outlineIsOpen() {
  return outlineEl !== null && outlineEl.getAttribute("data-state") === "open"
}

function setOutlineState(open) {
  if (!outlineEl) return
  if (outlineIsOpen() === open) return
  outlineEl.setAttribute("data-state", open ? "open" : "collapsed")
  var body = outlineEl.querySelector(".tpl-outline-body")
  if (!body) return
  if (open) {
    // Both states place the active line at the same point, so solving for
    // the scroll offset that matches the dial's transform keeps it still.
    body.scrollTop = Math.max(0, (outlineActive - OUTLINE_ANCHOR) * OUTLINE_ROW)
  } else {
    body.scrollTop = 0
  }
}

function outlinePinned() {
  return readJson(OUTLINE_PIN_KEY, false) === true
}

/**
 * Reconcile the panel with the room the layout just gave it. Pinning is a
 * request for a rail, not a promise of one: on a window too narrow to carry
 * both the rail and a readable column it stays a dial, and hovering it still
 * opens the full outline the way it always did.
 */
function syncOutlineDock() {
  if (!outlineEl) return
  var pinned = outlinePinned()
  var docked = document.documentElement.getAttribute("data-tpl-outline") === "dock"
  outlineEl.classList.toggle("tpl-outline-pinned", pinned)
  outlineEl.classList.toggle("tpl-outline-docked", docked)
  var pin = outlineEl.querySelector(".tpl-outline-pin")
  if (pin) {
    pin.setAttribute("aria-pressed", pinned ? "true" : "false")
    pin.title = pinned ? "取消固定" : "固定在右侧"
    pin.setAttribute("aria-label", pin.title)
  }
  if (docked) setOutlineState(true)
  // Undocked it is a dial again, unless the pointer is still on it: opening
  // on hover is the dial's own behaviour and unpinning happens under one.
  else if (!outlineEl.matches(":hover")) setOutlineState(false)
}

function mountOutline() {
  if (document.getElementById("tpl-outline")) {
    outlineEl = document.getElementById("tpl-outline")
    outlineListEl = outlineEl.querySelector(".tpl-outline-list")
    outlineCountEl = outlineEl.querySelector(".tpl-outline-count")
    return
  }
  outlineEl = el("aside", "")
  outlineEl.id = "tpl-outline"
  outlineEl.setAttribute("data-state", "collapsed")
  outlineEl.setAttribute("aria-label", "本页目录")
  outlineEl.hidden = true

  var head = el("div", "tpl-outline-head")
  head.appendChild(el("span", "tpl-outline-title", "目录"))
  outlineCountEl = el("span", "tpl-outline-count")
  head.appendChild(outlineCountEl)
  var pin = el("button", "tpl-outline-pin")
  pin.type = "button"
  pin.title = "固定目录"
  pin.setAttribute("aria-label", "固定目录")
  pin.innerHTML =
    SVG_OPEN + '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>'
  pin.addEventListener("click", function (event) {
    event.stopPropagation()
    writeJson(OUTLINE_PIN_KEY, !outlinePinned())
    // The column has to give up the width before the panel can take it.
    applyLayout()
  })
  head.appendChild(pin)

  var body = el("div", "tpl-outline-body")
  outlineListEl = el("ol", "tpl-outline-list")
  body.appendChild(outlineListEl)

  outlineEl.appendChild(head)
  outlineEl.appendChild(body)

  outlineEl.addEventListener("pointerenter", function () {
    setOutlineState(true)
  })
  outlineEl.addEventListener("pointerleave", function () {
    if (!outlineEl.classList.contains("tpl-outline-docked")) setOutlineState(false)
  })
  outlineEl.addEventListener("focusin", function () {
    setOutlineState(true)
  })
  outlineEl.addEventListener("focusout", function () {
    if (outlineEl.classList.contains("tpl-outline-docked")) return
    window.setTimeout(function () {
      if (outlineEl && !outlineEl.contains(document.activeElement)) setOutlineState(false)
    }, 0)
  })
  document.body.appendChild(outlineEl)
  syncOutlineDock()
}

/** Rebuild the dial from whatever outline Quartz rendered for this page. */
function refreshOutline() {
  mountOutline()
  if (!outlineEl || !outlineListEl) return
  var links = document.querySelectorAll(".toc-content li:not(.overflow-end) > a")
  outlineListEl.textContent = ""
  outlineItems = []
  outlineActive = -1

  for (var i = 0; i < links.length; i += 1) {
    var link = links[i]
    var id = (link.getAttribute("href") || "").replace(/^#/, "")
    if (!id) continue
    var row = link.parentElement
    var depth = 0
    if (row && row.className) {
      var found = /depth-(\d)/.exec(row.className)
      if (found) depth = parseInt(found[1], 10)
    }
    var item = el("li", "tpl-outline-item")
    item.dataset.depth = String(Math.min(depth, 3))
    var anchor = el("a", "tpl-outline-link", (link.textContent || "").trim())
    anchor.href = "#" + id
    anchor.title = (link.textContent || "").trim()
    item.appendChild(anchor)
    outlineListEl.appendChild(item)
    outlineItems.push({ id: id, node: item })
  }

  var count = outlineItems.length
  outlineEl.hidden = count === 0
  // A note with no headings should not cost the column any width.
  applyLayout()
  if (outlineCountEl) outlineCountEl.textContent = count ? String(count) : ""
  if (count === 0) return
  updateOutlineActive()
}

/** The line being read is the last heading to have crossed the reading line. */
function updateOutlineActive() {
  if (!outlineEl || outlineItems.length === 0) return
  var threshold = window.innerHeight * 0.28
  var next = 0
  for (var i = 0; i < outlineItems.length; i += 1) {
    var heading = document.getElementById(outlineItems[i].id)
    if (!heading) continue
    if (heading.getBoundingClientRect().top - threshold <= 1) next = i
    else break
  }
  setOutlineActive(next)
}

function setOutlineActive(index) {
  if (index === outlineActive) return
  outlineActive = index
  outlineEl.style.setProperty("--tpl-outline-active", String(index))
  for (var i = 0; i < outlineItems.length; i += 1) {
    var rel = i - index
    if (rel < -4) rel = -4
    if (rel > 4) rel = 4
    outlineItems[i].node.dataset.rel = String(rel)
  }
  if (outlineIsOpen()) {
    var body = outlineEl.querySelector(".tpl-outline-body")
    if (body) {
      var wanted = (index - OUTLINE_ANCHOR) * OUTLINE_ROW
      var max = body.scrollHeight - body.clientHeight
      body.scrollTop = Math.min(Math.max(0, wanted), Math.max(0, max))
    }
  }
}

function onOutlineScroll() {
  if (outlineTicking) return
  outlineTicking = true
  window.requestAnimationFrame(function () {
    outlineTicking = false
    updateOutlineActive()
  })
}

window.addEventListener("scroll", onOutlineScroll, { passive: true })
window.addEventListener("resize", onOutlineScroll)
