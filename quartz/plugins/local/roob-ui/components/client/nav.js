// -------------------------------------------------------------------------
// Sidebar navigation
//
// Modelled on the Cloudflare dashboard's nav rather than Quartz's: a search
// pill at the top, then flat 32px rows carrying a leading icon, a label and
// a right chevron; groups that expand under a vertical guide line; recents
// as two-line rows with the location underneath; and one scroll region for
// the lot. Quartz's default gives the outline and the tree a fixed slice of
// the viewport each and scrolls inside them, which stops working the moment
// the tree is deep. The palette stays the editor theme's.
// -------------------------------------------------------------------------
var NAV_SCROLL_KEY = "roob-nav-scroll"
var NAV_BODY_ID = "tpl-nav-body"

STRINGS.nav = {
  en: {
    toggle: "Open navigation",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    readerMode: "Reader mode",
    outline: "Outline",
    reveal: "Reveal the current note",
    fold: "Collapse all folders",
    help: "Keyboard shortcuts",
    search: "Search",
    searchPlaceholder: "Search for something...",
  },
  "zh-Hans": {
    toggle: "打开导航",
    darkMode: "暗色模式",
    lightMode: "亮色模式",
    readerMode: "阅读模式",
    outline: "目录",
    reveal: "定位当前笔记",
    fold: "折叠全部文件夹",
    help: "快捷键",
    search: "搜索",
    searchPlaceholder: "搜索",
  },
}

// Three rules stepping in, on the grid and stroke of the other foot actions.
ICONS.outline = SVG_OPEN + '<path d="M4 6.5h16M8 12h12M8 17.5h9"/></svg>'

/**
 * Quartz ships its own drawings for dark mode and reader mode: one a filled
 * sun on a 35 grid, the other a filled book on a 24 grid scaled unevenly and
 * nudged off centre. Beside two line icons they read as a different set and
 * sit at a different height. Redraw them on the shared grid, keeping the
 * class names, since Quartz's own CSS swaps day for night by those.
 */
function normaliseControlIcons(controls) {
  var swap = [
    [".dayIcon", "sun", t("nav", "darkMode")],
    [".nightIcon", "moon", t("nav", "lightMode")],
    [".readerIcon", "book", t("nav", "readerMode")],
  ]
  for (var i = 0; i < swap.length; i += 1) {
    var found = controls.querySelector(swap[i][0])
    if (!found) continue
    var holder = document.createElement("div")
    holder.innerHTML = ICONS[swap[i][1]]
    var next = holder.firstChild
    next.setAttribute("class", swap[i][0].slice(1))
    next.setAttribute("aria-label", swap[i][2])
    var label = document.createElementNS("http://www.w3.org/2000/svg", "title")
    label.textContent = swap[i][2]
    next.insertBefore(label, next.firstChild)
    found.parentNode.replaceChild(next, found)
  }
}

/**
 * Quartz renders its search and theme controls in the build locale, which is
 * English on every page, and the rail adopts both. Their words follow the
 * page here: the search row's label and name, the field's placeholder and
 * name, and the theme button's name, which says what a press does, the way
 * the icon showing inside it does. Runs on every navigation and theme change.
 */
function syncControlLabels() {
  var buttons = document.querySelectorAll(".search > .search-button")
  for (var i = 0; i < buttons.length; i += 1) {
    buttons[i].setAttribute("aria-label", t("nav", "search"))
    var label = buttons[i].querySelector("p")
    if (label) label.textContent = t("nav", "search")
  }
  var fields = document.querySelectorAll(".search .search-bar")
  for (var j = 0; j < fields.length; j += 1) {
    fields[j].setAttribute("placeholder", t("nav", "searchPlaceholder"))
    fields[j].setAttribute("aria-label", t("nav", "searchPlaceholder"))
  }
  var dark = document.documentElement.getAttribute("saved-theme") === "dark"
  var themes = document.querySelectorAll(".sidebar.left button.darkmode")
  for (var k = 0; k < themes.length; k += 1) {
    themes[k].setAttribute("aria-label", t("nav", dark ? "lightMode" : "darkMode"))
  }
}

document.addEventListener("themechange", syncControlLabels)

function restoreNavScroll(body) {
  try {
    var saved = sessionStorage.getItem(NAV_SCROLL_KEY)
    if (saved === null) return
    var top = parseInt(saved, 10)
    if (!isNaN(top) && Math.abs(body.scrollTop - top) > 1) body.scrollTop = top
  } catch (e) {
    /* private mode */
  }
}

/** Its click is handled on the document; see "sidebar controls". */
function makeFootAction(name, action, label) {
  var button = el("button", "tpl-foot-action")
  button.type = "button"
  button.title = label
  button.setAttribute("aria-label", label)
  button.setAttribute("data-tpl-action", action)
  button.appendChild(icon(name))
  return button
}

/** The rail offers the outline on an essay that has one. It asks the toc
 *  itself, which buildNav moves out of the document before the foot is made.
 *  Whether the dial already shows it beside the column is decided in CSS,
 *  off the data-tpl-outline attribute the layout keeps on <html>. */
function pageHasOutline(toc) {
  return !!(
    toc &&
    toc.querySelector(".toc-content") &&
    document.body.getAttribute("data-kind") === "essay"
  )
}

function shortcutHint() {
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "")
  return mac ? "⌘ ." : "Ctrl ."
}

function buildNav() {
  var sidebar = document.querySelector(".sidebar.left")
  if (!sidebar || sidebar.dataset.tplNav === "ready") return
  var title = sidebar.querySelector(".page-title")
  var toolbar = sidebar.querySelector(".flex-component")
  var toc = sidebar.querySelector(".toc")
  var explorer = sidebar.querySelector(".explorer")
  var searchButton = sidebar.querySelector(".search-button")
  if (!toolbar || !explorer) return

  var head = el("div", "tpl-nav-head")
  var topRow = el("div", "tpl-nav-top")
  // Narrow screens fold the whole nav behind this; it is hidden on desktop.
  // Nothing built here carries a listener of its own: clicks, scrolls and
  // presses are taken on the document (see "sidebar controls" below).
  var toggle = el("button", "")
  toggle.id = "tpl-nav-toggle"
  toggle.type = "button"
  toggle.setAttribute("aria-label", t("nav", "toggle"))
  toggle.setAttribute("aria-expanded", "false")
  toggle.setAttribute("aria-controls", "tpl-drawer")
  toggle.innerHTML =
    SVG_OPEN + '<path d="M3 6h18M3 12h18M3 18h18"/></svg>'
  topRow.appendChild(toggle)
  if (title) topRow.appendChild(title)
  var controls = el("div", "tpl-nav-controls")
  var buttons = toolbar.querySelectorAll("button.darkmode, button.readermode, #tpl-width-button")
  for (var i = 0; i < buttons.length; i += 1) controls.appendChild(buttons[i])
  // Folding the panel away and bringing it back belong to the same control
  // in the same corner, not one at the top and another at the bottom.
  var collapseButton = el("button", "")
  collapseButton.id = "tpl-sidebar-collapse"
  collapseButton.type = "button"
  collapseButton.appendChild(icon("panel"))
  controls.appendChild(collapseButton)
  topRow.appendChild(controls)
  head.appendChild(topRow)

  normaliseControlIcons(controls)
  toolbar.remove()

  // The panel opens on the tree, the way the editor's does. The rows that
  // used to sit above it, home, recents, and a header naming the section the
  // whole panel already is, were three lines of chrome in front of the one
  // thing anyone opens this to reach.
  var body = el("div", "tpl-nav-body")
  body.appendChild(makeCrumbs())

  // Quartz's outline stays in the DOM out of sight: its own script binds to
  // it, and the dial in the top right is rebuilt from it on every page.
  // Quartz numbers each plugin's lists from zero, so this list carries the
  // Explorer's id, list-0, and its header points at a toc-N id that nothing
  // has. Out of view neither is needed: the dial and the sheet find the
  // list by class.
  var tocHost = el("div", "tpl-toc-source")
  if (toc) {
    var tocList = toc.querySelector(".toc-content")
    if (tocList) tocList.removeAttribute("id")
    var tocHeader = toc.querySelector(".toc-header")
    if (tocHeader) tocHeader.removeAttribute("aria-controls")
    tocHost.appendChild(toc)
  }

  var explorerToggle = explorer.querySelector(".explorer-toggle.desktop-explorer")
  if (explorerToggle) explorerToggle.remove()
  body.appendChild(explorer)

  // Search and the tree's own actions sit along the bottom, out of the way
  // of the tree and in reach of the thumb, the way the editor keeps its
  // status line. It reads as a row rather than a field: a box you cannot
  // type into only looks like an input by mistake.
  var foot = el("div", "tpl-nav-foot")
  var searchHost = searchButton ? searchButton.parentElement : null
  if (searchHost) {
    searchHost.classList.add("tpl-command-host")
    foot.appendChild(searchHost)
    searchButton.classList.add("tpl-nav-item")
    var glyph = searchButton.querySelector("svg")
    if (glyph) searchButton.replaceChild(icon("search"), glyph)
    if (!searchButton.querySelector("kbd")) {
      searchButton.appendChild(el("kbd", "tpl-command-key", shortcutHint()))
    }
  }
  var footTools = el("div", "tpl-nav-foot-tools")
  // The outline comes first: the tools sit against the right edge, so the
  // tree's own actions hold their place when it appears and goes.
  var outlineAction = makeFootAction("outline", "outline", t("nav", "outline"))
  outlineAction.hidden = !pageHasOutline(toc)
  footTools.appendChild(outlineAction)
  footTools.appendChild(makeFootAction("target", "reveal", t("nav", "reveal")))
  footTools.appendChild(makeFootAction("fold", "fold", t("nav", "fold")))
  footTools.appendChild(makeFootAction("help", "help", t("nav", "help")))
  foot.appendChild(footTools)

  // Quartz scrolls the tree to the open note on every navigation. With one
  // scroll region that would jump the whole nav past its own groups on each
  // page load, so its scroll restore is neutralised here and the nav keeps
  // its own position instead. The 定位 button does the reveal on ask.
  try {
    sessionStorage.setItem("explorerScrollTop", "0")
  } catch (e) {
    /* private mode */
  }

  body.id = NAV_BODY_ID
  sidebar.textContent = ""
  sidebar.appendChild(head)
  sidebar.appendChild(body)
  sidebar.appendChild(foot)
  sidebar.appendChild(tocHost)
  sidebar.appendChild(makeResizeHandle())
  sidebar.dataset.tplNav = "ready"
  sidebar.__tplBody = body
  syncResizeHandle(paintedSidebarWidth())
  mountReopenButton()
  syncCollapseButton()

  // The explorer rebuilds its tree asynchronously after every navigation,
  // so the row titles and the count have to be re-applied when it does.
  // One observer at a time: the previous page's list is gone or reused.
  if (treeObserver) treeObserver.disconnect()
  treeObserver = null
  var list = explorer.querySelector(".explorer-ul")
  if (list && typeof MutationObserver !== "undefined") {
    treeObserver = new MutationObserver(function () {
      titleTreeRows(explorer)
      restoreNavScroll(body)
      scheduleGuides(explorer)
      scheduleCrumbs(explorer, body)
    })
    treeObserver.observe(list, { childList: true, subtree: true })
  }
  titleTreeRows(explorer)
  scheduleGuides(explorer)
  scheduleCrumbs(explorer, body)
}

var treeObserver = null

// --- sidebar controls ----------------------------------------------------
//
// Everything buildNav makes is handled here, on the document, for the same
// reason as the resize handle: after a navigation micromorph hands the old
// nodes to other server elements, and a node's listeners go with it. The
// reveal button, for one, came back as the theme toggle and kept revealing.
document.addEventListener("click", function (event) {
  var target = event.target
  if (!target || !target.closest) return
  var control = target.closest(
    "#tpl-nav-toggle, #tpl-sidebar-collapse, .tpl-foot-action[data-tpl-action]",
  )
  if (!control) return
  if (control.id === "tpl-nav-toggle") {
    var sidebar = control.closest(".sidebar.left")
    setNavOpen(sidebar, !(sidebar && sidebar.classList.contains("tpl-nav-open")))
    return
  }
  if (control.id === "tpl-sidebar-collapse") {
    setSidebarCollapsed(!sidebarCollapsed())
    // The panel, and this button with it, is display: none now. Focus moves to
    // the button that brings it back, which sits in the same corner.
    var reopen = sidebarCollapsed() && document.getElementById("tpl-sidebar-reopen")
    if (reopen) reopen.focus({ preventScroll: true })
    return
  }
  var action = control.getAttribute("data-tpl-action")
  if (action === "help") {
    toggleShortcuts()
    return
  }
  // The outline sheet listens for this. The opener goes with it so focus can
  // return there when the sheet closes.
  if (action === "outline") {
    document.dispatchEvent(new CustomEvent("tpl:open-outline", { detail: { opener: control } }))
    return
  }
  var explorer = document.querySelector(".sidebar.left .explorer")
  if (!explorer) return
  if (action === "reveal") revealActive(explorer)
  else if (action === "fold") collapseAll(explorer)
})

// Scroll does not bubble, so the panel's scroller is caught on the way down.
document.addEventListener(
  "scroll",
  function (event) {
    var body = event.target
    if (!body || !body.classList || !body.classList.contains("tpl-nav-body")) return
    rememberNavScroll(body.scrollTop)
    var explorer = body.querySelector(".explorer")
    if (!explorer) return
    scheduleGuides(explorer)
    scheduleCrumbs(explorer, body)
  },
  { capture: true, passive: true },
)

// The position is written at most five times a second, and once more before
// the page changes, so the next page's tree restores the latest one. The
// value is read at scroll time: a detached panel reports a scrollTop of 0.
var navScrollTop = null
var navScrollTimer = 0

function saveNavScroll() {
  window.clearTimeout(navScrollTimer)
  navScrollTimer = 0
  if (navScrollTop === null) return
  try {
    sessionStorage.setItem(NAV_SCROLL_KEY, String(navScrollTop))
  } catch (e) {
    /* private mode */
  }
  navScrollTop = null
}

function rememberNavScroll(top) {
  navScrollTop = top
  if (!navScrollTimer) navScrollTimer = window.setTimeout(saveNavScroll, 200)
}

document.addEventListener("prenav", saveNavScroll)
window.addEventListener("pagehide", saveNavScroll)

function refreshNav() {
  var sidebar = document.querySelector(".sidebar.left")
  if (!sidebar) return
  if (sidebar.dataset.tplNav !== "ready") buildNav()
  syncControlLabels()
  sidebar = document.querySelector(".sidebar.left")
  if (!sidebar) return
  var explorer = sidebar.querySelector(".explorer")
  if (explorer) {
    titleTreeRows(explorer)
    scheduleGuides(explorer)
    if (sidebar.__tplBody) scheduleCrumbs(explorer, sidebar.__tplBody)
  }
}
