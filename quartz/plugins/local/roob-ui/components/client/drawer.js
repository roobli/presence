// The navigation drawer on one column: a left sheet holding a search row,
// the file tree and a theme row (_drawer.scss). On desktop its wrapper is
// display: contents and the tree sits in the panel as before.
//
// It moves on a spring, follows a sideways drag 1:1 from wherever it was
// caught, and stretches on a rubber band past fully open. On release its
// position is projected from the release speed, and a quarter of the travel
// away from the end the drag started at is enough to change state. The menu
// button stays above it, so a second tap mid-flight turns it around from
// where it is on screen.

STRINGS.drawer = {
  en: {
    label: "Navigation",
    search: "Search",
    darkTheme: "Dark theme",
    lightTheme: "Light theme",
  },
  "zh-Hans": {
    label: "导航",
    search: "搜索",
    darkTheme: "深色主题",
    lightTheme: "浅色主题",
  },
}

var DRAWER_SLOP = 8
// The share of the width a release has to carry it from the end it started at.
var DRAWER_SWITCH = 0.25

var drawerOpen = false // where it is headed
var drawerShown = false // on screen, or on its way on or off
var drawerX = 0 // presentation value: 0 open, -drawerWidth closed
var drawerWidth = 0
var drawerSpring = null
var drawerDrag = null
var drawerFrame = 0
var drawerSuppressClick = false

function drawerEl() {
  return document.getElementById("tpl-drawer")
}

function drawerIsOpen() {
  return drawerOpen
}

/** Where a drawer let go at x, moving at vx px/s, comes to rest, for a drag
 *  that started at originX. A pull a quarter of the way toward the other end
 *  says which end is wanted; a midpoint would need more than half. */
function drawerRestingX(x, vx, width, originX) {
  var projected = x + project(vx)
  var fromOpen = originX > -width / 2
  var line = fromOpen ? -width * DRAWER_SWITCH : -width * (1 - DRAWER_SWITCH)
  return projected > line ? 0 : -width
}

/** The drawer's x for a drag that would put its edge at raw. */
function drawerDragX(raw, width) {
  return raw > 0 ? rubberBand(raw, width, 0.55) : Math.max(raw, -width)
}

function mountDrawer() {
  var sidebar = document.querySelector(".sidebar.left")
  if (!sidebar || sidebar.dataset.tplNav !== "ready") return
  var drawer = drawerEl()
  if (!drawer || !sidebar.contains(drawer)) {
    var body = sidebar.querySelector(".tpl-nav-body")
    if (!body) return
    var scrim = el("div", "tpl-drawer-scrim")
    scrim.id = "tpl-drawer-scrim"
    drawer = el("div", "tpl-drawer")
    drawer.id = "tpl-drawer"

    var head = el("div", "tpl-drawer-head")
    var search = el("button", "tpl-drawer-row tpl-drawer-search")
    search.type = "button"
    search.appendChild(icon("search"))
    search.appendChild(el("span", "tpl-drawer-label"))
    head.appendChild(search)

    var foot = el("div", "tpl-drawer-foot")
    var theme = el("button", "tpl-drawer-row tpl-drawer-theme")
    theme.type = "button"
    theme.appendChild(el("span", "tpl-nav-icon"))
    theme.appendChild(el("span", "tpl-drawer-label"))
    foot.appendChild(theme)

    sidebar.insertBefore(scrim, body)
    sidebar.insertBefore(drawer, body)
    drawer.appendChild(head)
    drawer.appendChild(body)
    drawer.appendChild(foot)
    // The sidebar is rebuilt on every page, and a new drawer starts closed.
    resetDrawer()
  }
  syncDrawerLabels()
  syncDrawerMode()
}

function syncDrawerLabels() {
  var drawer = drawerEl()
  if (!drawer) return
  var search = drawer.querySelector(".tpl-drawer-search .tpl-drawer-label")
  if (search) search.textContent = t("drawer", "search")
  var theme = drawer.querySelector(".tpl-drawer-theme")
  if (theme) {
    var dark = document.documentElement.getAttribute("saved-theme") === "dark"
    theme.querySelector(".tpl-nav-icon").innerHTML = ICONS[dark ? "sun" : "moon"]
    theme.querySelector(".tpl-drawer-label").textContent = t("drawer", dark ? "lightTheme" : "darkTheme")
  }
  if (drawer.hasAttribute("role")) drawer.setAttribute("aria-label", t("drawer", "label"))
}

/** A dialog on one column, a plain wrapper beside it. */
function syncDrawerMode() {
  var drawer = drawerEl()
  if (!drawer) return
  if (isNarrow()) {
    drawer.setAttribute("role", "dialog")
    drawer.setAttribute("aria-modal", "true")
    drawer.setAttribute("aria-label", t("drawer", "label"))
    return
  }
  drawer.removeAttribute("role")
  drawer.removeAttribute("aria-modal")
  drawer.removeAttribute("aria-label")
  if (drawerShown || drawerOpen) resetDrawer()
}

narrowQuery.addEventListener("change", syncDrawerMode)

function paintDrawer() {
  drawerFrame = 0
  var drawer = drawerEl()
  if (!drawer) return
  drawer.style.transform = "translate3d(" + drawerX.toFixed(2) + "px, 0, 0)"
  var scrim = document.getElementById("tpl-drawer-scrim")
  if (scrim && drawerWidth > 0) {
    scrim.style.opacity = String(clamp(1 + drawerX / drawerWidth, 0, 1))
  }
}

function setDrawerShown(shown) {
  drawerShown = shown
  var docEl = document.documentElement
  docEl.classList.toggle("tpl-drawer-shown", shown)
  docEl.classList.toggle("mobile-no-scroll", shown)
}

function setDrawerTarget(open) {
  drawerOpen = open
  var sidebar = document.querySelector(".sidebar.left")
  if (sidebar) sidebar.classList.toggle("tpl-nav-open", open)
  var toggle = document.getElementById("tpl-nav-toggle")
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false")
}

/** Retarget from the presentation value. A velocity restarts the spring from
 *  it (a release); without one a running spring keeps its own. */
function animateDrawer(target, velocity) {
  releaseDrawerDrag()
  if (!drawerSpring) drawerSpring = createSpring({ response: 0.35, dampingRatio: 1 })
  if (velocity !== undefined || !drawerSpring.running) drawerSpring.set(drawerX, velocity || 0)
  drawerSpring.retarget(target)
  if (prefersReducedMotion()) {
    drawerX = target
    paintDrawer()
  }
  drawerSpring.run(
    function (value) {
      drawerX = value
      paintDrawer()
    },
    function () {
      if (!drawerOpen && drawerX <= -drawerWidth + 0.5) setDrawerShown(false)
    },
  )
}

function firstDrawerRow(drawer) {
  var tree = drawer.querySelector(".explorer-content")
  var rows = tree ? focusableIn(tree) : []
  return rows[0] || focusableIn(drawer)[0] || null
}

function openDrawer() {
  var drawer = drawerEl()
  if (!drawer || !isNarrow()) return
  if (!drawerShown) {
    drawerWidth = drawer.offsetWidth
    drawerX = -drawerWidth
    setDrawerShown(true)
    paintDrawer()
  }
  setDrawerTarget(true)
  animateDrawer(0)
  var first = firstDrawerRow(drawer)
  if (first) first.focus({ preventScroll: true })
}

function closeDrawer(restoreFocus, velocity) {
  var drawer = drawerEl()
  if (!drawer || !drawerShown) {
    setDrawerTarget(false)
    return
  }
  var active = document.activeElement
  var hadFocus = drawer.contains(active) || !active || active === document.body
  setDrawerTarget(false)
  animateDrawer(-drawerWidth, velocity)
  var toggle = document.getElementById("tpl-nav-toggle")
  if (restoreFocus && hadFocus && toggle) toggle.focus({ preventScroll: true })
}

function resetDrawer() {
  if (drawerSpring) drawerSpring.stop()
  releaseDrawerDrag()
  if (drawerFrame) {
    window.cancelAnimationFrame(drawerFrame)
    drawerFrame = 0
  }
  setDrawerTarget(false)
  setDrawerShown(false)
  var drawer = drawerEl()
  if (drawer) drawer.style.removeProperty("transform")
  var scrim = document.getElementById("tpl-drawer-scrim")
  if (scrim) scrim.style.removeProperty("opacity")
}

document.addEventListener("prenav", resetDrawer)
document.addEventListener("themechange", syncDrawerLabels)

// --- drag ----------------------------------------------------------------------
// Bound once on the document, like the resize handle: micromorph reuses nodes.

function releaseDrawerDrag() {
  var d = drawerDrag
  if (!d) return
  drawerDrag = null
  document.documentElement.classList.remove("tpl-drawer-dragging")
  try {
    if (d.captured && d.drawer.hasPointerCapture(d.id)) d.drawer.releasePointerCapture(d.id)
  } catch (e) {
    /* the drawer is already gone */
  }
}

function endDrawerDrag(event) {
  var d = drawerDrag
  if (!d) return
  if (!d.captured) {
    releaseDrawerDrag()
    // Caught mid-flight and let go without a drag: carry on where it was going.
    if (d.caught) animateDrawer(drawerOpen ? 0 : -drawerWidth, 0)
    return
  }
  if (event.type === "pointerup") {
    drawerX = drawerDragX(d.originX + event.clientX - d.startX, drawerWidth)
    d.tracker.add(event.timeStamp, drawerX)
  }
  if (drawerFrame) {
    window.cancelAnimationFrame(drawerFrame)
    drawerFrame = 0
  }
  paintDrawer()
  releaseDrawerDrag()
  // The press ended on the drawer, not on whatever row it started over.
  drawerSuppressClick = true
  window.setTimeout(function () {
    drawerSuppressClick = false
  }, 0)
  var velocity = d.tracker.velocity()
  if (drawerRestingX(drawerX, velocity, drawerWidth, d.originX) === 0) {
    setDrawerTarget(true)
    animateDrawer(0, velocity)
  } else {
    closeDrawer(true, velocity)
  }
}

document.addEventListener("pointerdown", function (event) {
  if (!drawerShown || !event.isPrimary) return
  if (event.pointerType === "mouse" && event.button !== 0) return
  var target = event.target
  var drawer = target && target.closest ? target.closest("#tpl-drawer") : null
  if (!drawer) return
  // A drawer in flight stops under the finger.
  var caught = !!(drawerSpring && drawerSpring.running)
  if (caught) {
    drawerX = drawerSpring.value
    drawerSpring.stop()
    paintDrawer()
  }
  drawerDrag = {
    id: event.pointerId,
    drawer: drawer,
    startX: event.clientX,
    startY: event.clientY,
    originX: drawerX,
    captured: false,
    caught: caught,
    tracker: trackVelocity(),
  }
})

document.addEventListener("pointermove", function (event) {
  var d = drawerDrag
  if (!d || event.pointerId !== d.id) return
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    endDrawerDrag(event)
    return
  }
  var dx = event.clientX - d.startX
  var dy = event.clientY - d.startY
  if (!d.captured) {
    if (Math.sqrt(dx * dx + dy * dy) < DRAWER_SLOP) return
    if (Math.abs(dx) <= Math.abs(dy)) {
      // Vertical: the tree scrolls, and the drawer stays out of it.
      endDrawerDrag(event)
      return
    }
    try {
      d.drawer.setPointerCapture(d.id)
    } catch (e) {
      /* the document still sees the moves */
    }
    d.captured = true
    document.documentElement.classList.add("tpl-drawer-dragging")
  }
  drawerX = drawerDragX(d.originX + dx, drawerWidth)
  d.tracker.add(event.timeStamp, drawerX)
  if (!drawerFrame) drawerFrame = window.requestAnimationFrame(paintDrawer)
})

document.addEventListener("pointerup", function (event) {
  if (drawerDrag && event.pointerId === drawerDrag.id) endDrawerDrag(event)
})

document.addEventListener("pointercancel", function (event) {
  if (drawerDrag && event.pointerId === drawerDrag.id) endDrawerDrag(event)
})

document.addEventListener("lostpointercapture", function (event) {
  if (drawerDrag && drawerDrag.captured && event.pointerId === drawerDrag.id) endDrawerDrag(event)
})

// A link dragged with the mouse would start a native drag and cancel ours.
document.addEventListener("dragstart", function (event) {
  var target = event.target
  if (drawerDrag && target && target.closest && target.closest("#tpl-drawer")) event.preventDefault()
})

window.addEventListener(
  "click",
  function (event) {
    if (!drawerSuppressClick) return
    drawerSuppressClick = false
    var target = event.target
    if (!target || !target.closest || !target.closest("#tpl-drawer")) return
    event.preventDefault()
    event.stopPropagation()
  },
  true,
)

document.addEventListener("click", function (event) {
  var target = event.target
  if (!target || !target.closest) return
  if (target.closest("#tpl-drawer-scrim")) {
    closeDrawer(true)
    return
  }
  if (!target.closest("#tpl-drawer") || !drawerShown) return
  if (target.closest(".tpl-drawer-search")) {
    closeDrawer(false)
    openSearchFrom(document.getElementById("tpl-search-button"))
    return
  }
  if (target.closest(".tpl-drawer-theme")) {
    var themeButton = document.querySelector(".sidebar.left button.darkmode")
    if (themeButton) themeButton.click()
    return
  }
  // A row that goes somewhere takes the drawer away with it.
  if (target.closest("a[href]")) closeDrawer(false)
})
