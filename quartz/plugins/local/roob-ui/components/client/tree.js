// The file tree inside the panel: pinned ancestor crumbs, branch guides, the
// unfold cascade, titles for rows the panel cuts short, reveal and fold.

var FILE_TREE_KEY = "fileTree" // owned by Quartz's explorer; shared on purpose

// --- pinned ancestors ----------------------------------------------------
//
// The editor theme keeps the open file's folders in view by making their
// rows sticky, with one CSS rule per depth and a hand-written top offset on
// each. That cannot work here: Quartz clips `ul.tree-item-children` to
// collapse it, and an overflow-hidden ancestor is what sticky sticks to, so
// the rows would pin to a box that never scrolls.
//
// So the stack is drawn rather than positioned: a zero-height sticky strip at
// the top of the panel paints a copy of each ancestor row that has scrolled
// out from under it. Nothing in the tree moves, which is also why the guides
// underneath stay where they were measured, and the depth of the stack is
// read from the tree instead of enumerated depth by depth in CSS.
var CRUMB_ROW = 26
var crumbFrame = 0

function makeCrumbs() {
  var box = el("div", "tpl-tree-crumbs")
  box.setAttribute("aria-hidden", "true")
  return box
}

/** The open note's folders, outermost first, as their header rows. */
function crumbChain(explorer) {
  var active = activeTreeLink(explorer)
  if (!active || !active.closest) return []
  var folders = ancestorFolders(active.closest("li"))
  var out = []
  for (var i = folders.length - 1; i >= 0; i -= 1) {
    var container = folders[i].previousElementSibling
    if (container && container.classList.contains("folder-container")) out.push(container)
  }
  return out
}

function crumbLabel(container) {
  var title = container.querySelector(".folder-title")
  return title ? (title.textContent || "").trim() : ""
}

function drawCrumbs(explorer, body) {
  var box = body.querySelector(".tpl-tree-crumbs")
  if (!box) return
  var chain = crumbChain(explorer)
  var top = body.getBoundingClientRect().top

  // A crumb earns its place once its own row has gone under the stack above
  // it, and loses it again once the folder it stands for has scrolled by
  // entirely: past that point it would be naming a branch nowhere near what
  // is on screen. That is the same bound `position: sticky` would apply.
  // They are ordered, so what shows is always a leading run.
  var shown = 0
  while (shown < chain.length) {
    var line = top + shown * CRUMB_ROW
    var rect = chain[shown].getBoundingClientRect()
    if (rect.top >= line - 0.5) break
    var outer = chain[shown].nextElementSibling
    var bottom = outer ? outer.getBoundingClientRect().bottom : rect.bottom
    if (bottom <= line + CRUMB_ROW) break
    shown += 1
  }

  var signature = String(shown)
  for (var i = 0; i < shown; i += 1) signature += "\u0000" + crumbLabel(chain[i])
  if (box.dataset.signature === signature) return
  box.dataset.signature = signature

  box.textContent = ""
  box.classList.toggle("tpl-crumbs-on", shown > 0)
  for (var j = 0; j < shown; j += 1) {
    box.appendChild(makeCrumb(chain[j], j))
  }
  // Same rule as the tree rows: a tooltip only where the name was cut.
  var labels = box.querySelectorAll(".tpl-crumb-label")
  for (var k = 0; k < labels.length; k += 1) {
    var host = labels[k].parentElement
    if (labels[k].scrollWidth > labels[k].clientWidth + 1) host.title = host.dataset.full || ""
    else host.removeAttribute("title")
  }
}

function makeCrumb(container, depth) {
  var row = el("button", "tpl-tree-crumb")
  row.type = "button"
  // A crumb repeats a folder row that is still reachable in the tree, and
  // it is redrawn on scroll. It stays out of the tab order, as the strip is
  // out of the accessibility tree, so focus never sits on a node about to go.
  row.tabIndex = -1
  row.style.paddingLeft = 10 + depth * 18 + "px"
  var chevron = container.querySelector(".folder-icon")
  if (chevron) {
    var mark = el("span", "tpl-crumb-mark")
    mark.innerHTML = ICONS.folder
    row.appendChild(mark)
  }
  var label = crumbLabel(container)
  row.appendChild(el("span", "tpl-crumb-label", label))
  row.dataset.full = label
  // The click is taken on the document, which finds the folder row again by
  // its path: micromorph can hand a node built here to a server element on
  // the next page, and a listener on the node would go along with it.
  row.dataset.folderpath = container.dataset.folderpath || ""
  row.dataset.depth = String(depth)
  return row
}

function scheduleCrumbs(explorer, body) {
  if (crumbFrame) return
  crumbFrame = window.setTimeout(function () {
    crumbFrame = 0
    try {
      drawCrumbs(explorer, body)
    } catch (err) {
      console.error("[roob] crumbs failed:", err)
    }
  }, 0)
}

// Going back to the row a crumb stands for is the only thing it has to do.
document.addEventListener("click", function (event) {
  var target = event.target
  var crumb = target && target.closest ? target.closest(".tpl-tree-crumb") : null
  var body = crumb ? crumb.closest(".tpl-nav-body") : null
  if (!body) return
  var containers = body.querySelectorAll(".folder-container")
  for (var i = 0; i < containers.length; i += 1) {
    if (containers[i].dataset.folderpath !== crumb.dataset.folderpath) continue
    var rect = containers[i].getBoundingClientRect()
    var host = body.getBoundingClientRect()
    var depth = parseInt(crumb.dataset.depth, 10) || 0
    body.scrollTop += rect.top - host.top - depth * CRUMB_ROW - 4
    return
  }
})

// --- tree guides ---------------------------------------------------------
//
// One stroke per group, all of them in a single overlay above the tree.
// Drawing the line as box borders on each row is what produced the seams and
// the stray verticals; a path can put the trunk, every arm and the closing
// corner in one stroke, with the corner at whatever radius reads best. The
// branch holding the open note is drawn again in the accent colour, so a
// tree this size still answers "where am I" at a glance.
var SVG_NS = "http://www.w3.org/2000/svg"
// An arm runs from the trunk into the row's own padding and stops short of its
// mark, so on the open note it leads straight into the accent bar. The corner
// radius is the Typora tree's.
var GUIDE_ARM_INTO_ROW = 5
var GUIDE_RADIUS = 7
// Fallback only. The trunk belongs under the chevron of the folder that owns
// the group, which is where the eye expects the branch to leave the parent;
// that is measured off the chevron itself, and this is what to use when a
// group has no folder row above it.
var GUIDE_TRUNK_INSET = 14
var guideFrame = 0

function activeTreeLink(explorer) {
  return (
    explorer.querySelector("a.nav-file-title.active") ||
    explorer.querySelector("a.nav-file-title.is-active")
  )
}

/** True when any folder above this group is closed, however far up. */
function hiddenByCollapse(node, root) {
  var walker = node
  while (walker && walker !== root) {
    if (
      walker.classList &&
      walker.classList.contains("folder-outer") &&
      !walker.classList.contains("open")
    ) {
      return true
    }
    walker = walker.parentElement
  }
  return false
}

function guideOverlay(content) {
  var svg = content.querySelector("svg.tpl-tree-guides")
  if (svg) return svg
  svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("class", "tpl-tree-guides")
  svg.setAttribute("aria-hidden", "true")
  svg.appendChild(document.createElementNS(SVG_NS, "path"))
  var lit = document.createElementNS(SVG_NS, "path")
  lit.setAttribute("class", "tpl-guide-lit")
  svg.appendChild(lit)
  content.insertBefore(svg, content.firstChild)
  return svg
}

/** Trunk down to a row, turned into its arm with a real radius. */
function guideCorner(x, top, y, end, radius) {
  var r = Math.min(radius, Math.max(0, y - top))
  return (
    "M" + x + "," + top +
    "L" + x + "," + (y - r) +
    "Q" + x + "," + y + " " + (x + r) + "," + y +
    "L" + end + "," + y
  )
}

/** The chevron of the folder this group hangs off, if it has one. */
function folderChevron(ul) {
  var outer = ul.parentElement ? ul.parentElement.closest(".folder-outer") : null
  if (!outer) return null
  var container = outer.previousElementSibling
  if (!container || !container.classList.contains("folder-container")) return null
  return container.querySelector(".folder-icon")
}

function guideArm(x, y, end) {
  return "M" + x + "," + y + "L" + end + "," + y
}

function drawTreeGuides(explorer) {
  if (!explorer) return
  var content = explorer.querySelector(".explorer-content")
  if (!content) return
  var svg = guideOverlay(content)

  var host = content.getBoundingClientRect()
  var active = activeTreeLink(explorer)
  var base = ""
  var lit = ""
  var lists = content.querySelectorAll("ul.tree-item-children")

  for (var g = 0; g < lists.length; g += 1) {
    var ul = lists[g]
    // A closed folder keeps its box: the collapse is grid-template-rows to
    // 0fr plus clipping, so everything inside keeps its intrinsic size and
    // still measures. Checking only the immediate parent misses a group
    // whose own folder is open but whose grandparent is shut, which is what
    // left arms floating under the tree. Walk the whole chain.
    if (hiddenByCollapse(ul, content)) continue
    if (ul.getBoundingClientRect().height < 4) continue

    var rows = []
    for (var c = 0; c < ul.children.length; c += 1) {
      var row = ul.children[c].firstElementChild
      if (row) rows.push({ li: ul.children[c], row: row })
    }
    if (!rows.length) continue

    var ulRect = ul.getBoundingClientRect()
    var x = Math.round(ulRect.left - host.left + GUIDE_TRUNK_INSET) + 0.5
    var chevron = folderChevron(ul)
    if (chevron) {
      var cr = chevron.getBoundingClientRect()
      x = Math.round(cr.left - host.left + cr.width / 2) + 0.5
    }
    var top = Math.round(ulRect.top - host.top) + 0.5
    var arms = []
    var ends = []
    var onPath = -1
    for (var i = 0; i < rows.length; i += 1) {
      var rr = rows[i].row.getBoundingClientRect()
      arms.push(Math.round(rr.top - host.top + rr.height / 2) + 0.5)
      ends.push(Math.round(rr.left - host.left) + GUIDE_ARM_INTO_ROW)
      if (active && rows[i].li.contains(active)) onPath = i
    }

    var last = arms.length - 1
    base += guideCorner(x, top, arms[last], ends[last], GUIDE_RADIUS)
    for (var j = 0; j < last; j += 1) base += guideArm(x, arms[j], ends[j])

    if (onPath !== -1) {
      var y = arms[onPath]
      lit +=
        onPath === last
          ? guideCorner(x, top, y, ends[onPath], GUIDE_RADIUS)
          : "M" + x + "," + top + "L" + x + "," + y + guideArm(x, y, ends[onPath])
    }
  }

  svg.children[0].setAttribute("d", base)
  svg.children[1].setAttribute("d", lit)
}

// requestAnimationFrame never fires while the tab is hidden, which would
// strand the pending flag and kill every later redraw. A timeout always
// runs, and measuring after layout is all this needs.
function scheduleGuides(explorer) {
  if (guideFrame) return
  guideFrame = window.setTimeout(function () {
    guideFrame = 0
    drawTreeGuides(explorer)
  }, 0)
}

/** Folders open over 300ms, so the guides ride the animation rather than
 *  snapping to the end of it. Measuring ~270 rows costs about a millisecond. */
function followGuides(explorer, ms) {
  var started = Date.now()
  var step = function () {
    drawTreeGuides(explorer)
    if (Date.now() - started < ms) window.setTimeout(step, 16)
  }
  window.setTimeout(step, 0)
}

/**
 * Let the rows of a folder the reader just opened cascade in. The class is
 * put on for one animation and taken off again, so the tree does not replay
 * it on every navigation, on a filter, or on the state restored at load.
 */
function markUnfolding(target) {
  if (!target || !target.closest) return
  var container = target.closest(".folder-container")
  if (!container) return
  var outer = container.nextElementSibling
  if (!outer || !outer.classList.contains("folder-outer")) return
  // Quartz flips the class after this handler runs, so ask on the next tick.
  window.setTimeout(function () {
    if (!outer.classList.contains("open")) return
    outer.classList.add("tpl-unfold")
    window.setTimeout(function () {
      outer.classList.remove("tpl-unfold")
    }, 720)
  }, 0)
}

// A note's row is labelled with its title cut at the dash (the explorer's
// mapFn in quartz.ts), so the whole title goes in the row's tooltip. Titles
// come from the content index, which Quartz fetches once per load as
// fetchData; the explorer builds its tree from the same response.
var fullTitles = null // slug -> frontmatter title
var fullTitlesRequested = false

function requestFullTitles() {
  if (fullTitlesRequested || typeof fetchData === "undefined") return
  fullTitlesRequested = true
  Promise.resolve(fetchData)
    .then(function (data) {
      var entries = (data && data.content) || data || {}
      var titles = {}
      for (var slug in entries) {
        var entry = entries[slug]
        if (entry && typeof entry.title === "string") titles[slug] = entry.title
      }
      fullTitles = titles
      var explorer = document.querySelector(".sidebar.left .explorer")
      if (explorer) titleTreeRows(explorer)
    })
    .catch(function (err) {
      console.error("[roob] content index failed:", err)
    })
}

/** The slug a file row links to, the way the content index keys it. */
function rowSlug(link) {
  var href = link.getAttribute("href") || ""
  var base = (document.body && document.body.dataset.basepath) || ""
  if (base && href.indexOf(base + "/") === 0) href = href.slice(base.length)
  return href.replace(/[?#].*$/, "").replace(/^\/+/, "")
}

/** The row's name in a box of its own. A row is a flex line of mark and name,
 *  and a flex container never draws an ellipsis for its own text, so a long
 *  name was cut mid-letter. The explorer sets each name as the row's text. */
function treeRowLabel(row) {
  var only = row.childNodes.length === 1 ? row.firstChild : null
  if (only && only.nodeType === 1 && only.classList.contains("tpl-tree-label")) return only
  var label = el("span", "tpl-tree-label", row.textContent || "")
  row.textContent = ""
  row.appendChild(label)
  return label
}

/**
 * A note's row always carries its full title. Any other name that fits is
 * already on screen, and a tooltip repeating it is noise: it covers the rows
 * below, arrives late, and says nothing new. Those rows get one only when the
 * panel had to cut the name, so it depends on the panel's current width and
 * is re-decided when that changes. Every row's name goes in its label first.
 */
function titleTreeRows(explorer) {
  requestFullTitles()
  var rows = explorer.querySelectorAll(".folder-title, a.nav-file-title")
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i]
    var label = treeRowLabel(row)
    var full =
      fullTitles && row.classList.contains("nav-file-title") ? fullTitles[rowSlug(row)] : null
    var text = typeof full === "string" ? full : ""
    if (!text && label.scrollWidth > label.clientWidth + 1) text = (label.textContent || "").trim()
    if (text) {
      if (row.title !== text) row.title = text
    } else if (row.title) {
      row.removeAttribute("title")
    }
  }
}

var titleTimer = 0

function scheduleTitles(explorer) {
  if (titleTimer) window.clearTimeout(titleTimer)
  titleTimer = window.setTimeout(function () {
    titleTimer = 0
    titleTreeRows(explorer)
  }, 120)
}

// --- file tree: reveal, collapse -----------------------------------------
function ancestorFolders(node) {
  var out = []
  var current = node
  while (current) {
    var outer = current.parentElement ? current.parentElement.closest(".folder-outer") : null
    if (!outer) break
    out.push(outer)
    current = outer.parentElement
  }
  return out
}

function persistOpenState(explorer) {
  var containers = explorer.querySelectorAll(".folder-container")
  var state = []
  for (var i = 0; i < containers.length; i += 1) {
    var container = containers[i]
    var outer = container.nextElementSibling
    if (!container.dataset.folderpath || !outer) continue
    state.push({
      path: container.dataset.folderpath,
      collapsed: !outer.classList.contains("open"),
    })
  }
  writeJson(FILE_TREE_KEY, state)
}

function revealActive(explorer) {
  var active =
    explorer.querySelector("a.nav-file-title.active") ||
    explorer.querySelector("a.nav-file-title.is-active")
  if (!active) return
  var folders = ancestorFolders(active.closest("li"))
  for (var i = 0; i < folders.length; i += 1) folders[i].classList.add("open")
  persistOpenState(explorer)
  active.scrollIntoView({ block: "center" })
}

function collapseAll(explorer) {
  var outers = explorer.querySelectorAll(".folder-outer")
  for (var i = 0; i < outers.length; i += 1) outers[i].classList.remove("open")
  persistOpenState(explorer)
}

// Opening or closing a folder animates grid-template-rows for 300ms.
// Capture, because the explorer's own toggle stops the click before it
// bubbles this far: on the bubble phase neither of these ever ran.
document.addEventListener(
  "click",
  function (event) {
    var target = event.target
    var explorer = target && target.closest ? target.closest(".sidebar.left .explorer") : null
    if (!explorer) return
    markUnfolding(target)
    followGuides(explorer, 420)
  },
  true,
)

document.addEventListener("transitionend", function (event) {
  if (event.propertyName !== "grid-template-rows") return
  var target = event.target
  var explorer = target && target.closest ? target.closest(".sidebar.left .explorer") : null
  if (explorer) scheduleGuides(explorer)
})
