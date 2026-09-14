// -------------------------------------------------------------------------
// Page outline
//
// The outline used to be a section in the sidebar, which meant a note with
// a long one shoved everything below it down the moment the page loaded.
// It is a fixed dial in the top right instead: a few lines of the outline
// arranged on a shallow arc, the line you are reading crisp and level, its
// neighbours dimmer, blurrier and tilted off it. Pointing at it opens the
// whole outline, upright and opaque, inside the same gutter; only a pinned
// outline that the gutter cannot dock opens wider, over the article.
//
// It lives in the gutter right of the column. applyLayout (width.js) measures
// that gutter and sets html[data-tpl-outline]; the column never gives up
// width for it.
// -------------------------------------------------------------------------
STRINGS.outline = {
  en: {
    label: "On this page",
    title: "Outline",
    pin: "Pin outline",
    unpin: "Unpin outline",
  },
  "zh-Hans": {
    label: "本页目录",
    title: "目录",
    pin: "固定目录",
    unpin: "取消固定",
  },
}

var OUTLINE_ROW = 26 // px per line; layout stays fixed so the states can swap
var OUTLINE_ANCHOR = 3 // the current line rides the fourth row of the dial
var OUTLINE_PIN_KEY = "roob-outline-pinned"
// A little longer than the width transition in _outline.scss.
var OUTLINE_MORPH_MS = 320

var outlineEl = null
var outlineListEl = null
var outlineCountEl = null
var outlineItems = [] // { id: string, node: HTMLElement }
var outlineActive = -1
var outlineTicking = false
var outlineMorphTimer = 0

function outlineIsOpen() {
  return outlineEl !== null && outlineEl.getAttribute("data-state") === "open"
}

/**
 * Let the dial's next width change glide. Only a mode change and the dial
 * opening or closing ask for it; a gutter measured after a window resize
 * snaps, so nothing restarts a transition while the window is being sized.
 */
function morphOutlineWidth() {
  if (!outlineEl) return
  outlineEl.classList.add("tpl-outline-morph")
  window.clearTimeout(outlineMorphTimer)
  outlineMorphTimer = window.setTimeout(function () {
    if (outlineEl) outlineEl.classList.remove("tpl-outline-morph")
  }, OUTLINE_MORPH_MS)
}

function setOutlineState(open) {
  if (!outlineEl) return
  if (outlineIsOpen() === open) return
  morphOutlineWidth()
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
 * request for a rail, not a promise of one: in a gutter too narrow to carry
 * the rail it stays a dial, and hovering it still opens the full outline the
 * way it always did.
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
    pin.title = t("outline", pinned ? "unpin" : "pin")
    pin.setAttribute("aria-label", pin.title)
  }
  if (docked) setOutlineState(true)
  // Undocked it is a dial again, unless the pointer is still on it: opening
  // on hover is the dial's own behaviour and unpinning happens under one.
  else if (!outlineEl.matches(":hover")) setOutlineState(false)
}

/** The dial outlives SPA navigation, and the page's language can change. */
function syncOutlineLabels() {
  outlineEl.setAttribute("aria-label", t("outline", "label"))
  var title = outlineEl.querySelector(".tpl-outline-title")
  if (title) title.textContent = t("outline", "title")
}

function mountOutline() {
  if (document.getElementById("tpl-outline")) {
    outlineEl = document.getElementById("tpl-outline")
    outlineListEl = outlineEl.querySelector(".tpl-outline-list")
    outlineCountEl = outlineEl.querySelector(".tpl-outline-count")
    syncOutlineLabels()
    return
  }
  outlineEl = el("aside", "")
  outlineEl.id = "tpl-outline"
  outlineEl.setAttribute("data-state", "collapsed")
  outlineEl.hidden = true

  var head = el("div", "tpl-outline-head")
  head.appendChild(el("span", "tpl-outline-title"))
  outlineCountEl = el("span", "tpl-outline-count")
  head.appendChild(outlineCountEl)
  var pin = el("button", "tpl-outline-pin")
  pin.type = "button"
  pin.innerHTML =
    SVG_OPEN + '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>'
  pin.addEventListener("click", function (event) {
    event.stopPropagation()
    writeJson(OUTLINE_PIN_KEY, !outlinePinned())
    // Docking is decided by the gutter, so measure before the panel changes.
    applyLayout()
  })
  head.appendChild(pin)

  var body = el("div", "tpl-outline-body")
  outlineListEl = el("ol", "tpl-outline-list")
  body.appendChild(outlineListEl)

  outlineEl.appendChild(head)
  outlineEl.appendChild(body)
  syncOutlineLabels()

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
  // A note with no headings turns the dial off.
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
