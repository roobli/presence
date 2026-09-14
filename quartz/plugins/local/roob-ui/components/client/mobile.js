// The narrow-screen header: one 48px row of menu, wordmark, outline and
// search (_mobile-header.scss). The tree lives in the drawer (drawer.js), the
// outline in the sheet (outline-sheet.js). Above 800px none of it shows.

STRINGS.mobile = {
  en: {
    outline: "Outline",
    search: "Search",
    closeSearch: "Close search",
  },
  "zh-Hans": {
    outline: "目录",
    search: "搜索",
    closeSearch: "关闭搜索",
  },
}

// The same breakpoint as $mobile in the stylesheet.
var narrowQuery = window.matchMedia("(max-width: 800px)")

function isNarrow() {
  return narrowQuery.matches
}

ICONS.menuClose = SVG_OPEN + '<path d="m6 6 12 12M18 6 6 18"/></svg>'

/** Release speed over the last 100ms of samples, in px/s. The sample taken
 *  at release counts, so a pause before letting go slows it down. */
function trackVelocity() {
  var samples = []
  return {
    add: function (time, value) {
      samples.push(time, value)
      while (samples.length > 4 && time - samples[0] > 100) samples.splice(0, 2)
    },
    velocity: function () {
      var last = samples.length - 2
      if (last < 2) return 0
      var dt = samples[last] - samples[0]
      return dt > 0 ? ((samples[last + 1] - samples[1]) / dt) * 1000 : 0
    },
  }
}

/** A focusable that can take focus right now: visible and in the tab order. */
function focusableIn(container) {
  var nodes = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  var out = []
  for (var i = 0; i < nodes.length; i += 1) {
    var node = nodes[i]
    if (node.getAttribute("tabindex") === "-1") continue
    if (node.getClientRects().length === 0) continue
    out.push(node)
  }
  return out
}

function headerButton(id, iconName, label) {
  var button = el("button", "tpl-bar-button")
  button.id = id
  button.type = "button"
  button.appendChild(icon(iconName))
  button.setAttribute("aria-label", label)
  return button
}

/** Outline and search join the wordmark row. The row is rebuilt with the
 *  sidebar on every navigation, so this runs on every refresh. */
function mountHeader() {
  var sidebar = document.querySelector(".sidebar.left")
  if (!sidebar || sidebar.dataset.tplNav !== "ready") return
  var top = sidebar.querySelector(".tpl-nav-top")
  if (!top) return

  var toggle = document.getElementById("tpl-nav-toggle")
  if (toggle && !toggle.querySelector(".tpl-toggle-close")) {
    var holder = document.createElement("span")
    holder.innerHTML = ICONS.menuClose
    holder.firstChild.setAttribute("class", "tpl-toggle-close")
    toggle.appendChild(holder.firstChild)
  }

  var actions = top.querySelector(".tpl-bar-actions")
  if (!actions) {
    actions = el("div", "tpl-bar-actions")
    actions.appendChild(headerButton("tpl-outline-button", "outline", t("mobile", "outline")))
    actions.appendChild(headerButton("tpl-search-button", "search", t("mobile", "search")))
    var controls = top.querySelector(".tpl-nav-controls")
    top.insertBefore(actions, controls)
  }
  var outline = document.getElementById("tpl-outline-button")
  if (outline) {
    outline.hidden = !(
      document.body.getAttribute("data-kind") === "essay" && sidebar.querySelector(".toc-content")
    )
  }
}

// --- search ------------------------------------------------------------------
// Quartz's search has no close control of its own; on one column it is a full
// screen sheet and needs one. Its script closes on a click that lands on the
// container itself, so the button asks for that.
var searchOpener = null

function mountSearchClose() {
  var spaces = document.querySelectorAll(".search > .search-container > .search-space")
  for (var i = 0; i < spaces.length; i += 1) {
    var close = spaces[i].querySelector(".tpl-search-close")
    if (!close) {
      close = el("button", "tpl-search-close")
      close.type = "button"
      close.appendChild(icon("close"))
      spaces[i].appendChild(close)
    }
    close.setAttribute("aria-label", t("mobile", "closeSearch"))
  }
}

function closeSearch() {
  var container = document.querySelector(".search > .search-container.active")
  if (!container) return
  container.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
}

function openSearchFrom(opener) {
  searchOpener = opener || null
  openSearch()
}

/** Quartz hands focus back to its own button, which is hidden here. */
function returnSearchFocus() {
  window.setTimeout(function () {
    var back = searchOpener
    if (searchIsOpen() || !back) return
    searchOpener = null
    var active = document.activeElement
    var lost = !active || active === document.body || active.getClientRects().length === 0
    if (lost && back.isConnected) back.focus()
  }, 0)
}

document.addEventListener("click", function (event) {
  var target = event.target
  if (!target || !target.closest) return
  if (target.closest(".tpl-search-close")) {
    closeSearch()
    returnSearchFocus()
    return
  }
  var button = target.closest("#tpl-search-button, #tpl-outline-button")
  if (!button) return
  if (button.id === "tpl-search-button") openSearchFrom(button)
  else openOutlineSheet(button)
})

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && searchOpener) returnSearchFocus()
})

// --- the nav toggle ------------------------------------------------------------
// nav.js owns the toggle's click and calls these; the drawer does the work.

function setNavOpen(sidebar, open) {
  if (open) openDrawer()
  else closeDrawer(true)
}

/** Close the drawer; true when there was one to close. */
function closeNav() {
  if (!drawerIsOpen()) return false
  closeDrawer(true)
  return true
}

function refreshMobile() {
  mountHeader()
  mountDrawer()
  mountSearchClose()
}
