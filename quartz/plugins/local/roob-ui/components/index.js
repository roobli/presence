/**
 * RooB UI: the browser half of the typora-plugin-lite chrome.
 *
 * Typora runs four plugins that shape how these notes are read: quick open,
 * wider, fence-enhance's copy button, and sidenote. Three of them are pure
 * behaviour and have no CSS-only equivalent, so they are reproduced here
 * against the same numbers the plugins use. The styling lives in
 * quartz/styles/custom.scss; this file only supplies state and geometry.
 */

function roobUI() {
  // plugins/wider/src/layout.ts
  var DEFAULT_CONTENT_WIDTH = 860
  var WIDE_MIN_CONTENT_WIDTH = 1000
  var WIDE_MAX_CONTENT_WIDTH = 1180
  var WIDE_AVAILABLE_RATIO = 0.78
  var FULL_MAX_CONTENT_WIDTH = 1680
  var MIN_CONTENT_WIDTH = 560
  // plugins/sidenote/src/main.ts
  var SIDENOTE_RESERVE = 300

  var MODES = ["default", "wide", "full"]
  var MODE_LABELS = { default: "Default", wide: "Wide", full: "Full" }
  var STORAGE_KEY = "roob-editor-width"
  var MOBILE_MAX = 800

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  // packages/core/src/ui/editor-surface.ts
  function shellGutter(hostWidth) {
    var width = Math.max(0, hostWidth)
    if (width < 1024) return 16
    return clamp(Math.round(width * 0.04), 24, 72)
  }

  function canFitReserve(hostWidth, reserve, minimumProseWidth) {
    var width = Math.max(0, hostWidth)
    return width - shellGutter(width) * 2 >= Math.max(0, reserve) + Math.max(0, minimumProseWidth)
  }

  function calculateLayout(mode, hostWidth, requestedReserve) {
    var width = Math.max(0, hostWidth)
    var reserve = canFitReserve(width, requestedReserve, DEFAULT_CONTENT_WIDTH)
      ? requestedReserve
      : 0
    var gutter = shellGutter(width)
    var availableShell = Math.max(0, width - gutter * 2)
    var availableContent = Math.max(0, availableShell - reserve)
    var contentFloor = Math.min(MIN_CONTENT_WIDTH, availableContent)

    var desired = DEFAULT_CONTENT_WIDTH
    if (mode === "wide") {
      desired = clamp(
        Math.round(availableContent * WIDE_AVAILABLE_RATIO),
        WIDE_MIN_CONTENT_WIDTH,
        WIDE_MAX_CONTENT_WIDTH,
      )
    } else if (mode === "full") {
      desired = Math.min(FULL_MAX_CONTENT_WIDTH, Math.max(WIDE_MIN_CONTENT_WIDTH, availableContent))
    }

    var maxWidth = Math.max(
      contentFloor + reserve,
      Math.min(availableShell, desired + reserve),
    )
    return { gutter: gutter, maxWidth: maxWidth, reserve: reserve }
  }

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

  /** The width the centre column has to work with, sidebar excluded. */
  function measureHostWidth() {
    var body = document.getElementById("quartz-body")
    if (!body) return window.innerWidth
    var width = body.clientWidth || window.innerWidth
    if (window.innerWidth > MOBILE_MAX) {
      var sidebar = body.querySelector(".sidebar.left")
      if (sidebar) width -= sidebar.offsetWidth
    }
    // Taken mid-layout this can come back at or near zero, and a zero here
    // collapses the reading column to nothing and leaves it there until
    // something else forces a recalculation. Refuse the reading instead.
    if (width < MIN_CONTENT_WIDTH) return Math.min(window.innerWidth, MIN_CONTENT_WIDTH)
    return width
  }

  function hasSidenotes() {
    return document.querySelector("article .sidenote") !== null
  }

  function applyLayout() {
    var root = document.getElementById("quartz-root")
    if (!root) return
    var layout = calculateLayout(
      mode,
      measureHostWidth(),
      hasSidenotes() ? SIDENOTE_RESERVE : 0,
    )
    // The custom properties go on <html>: the outline dial is a child of
    // <body>, a sibling of #quartz-root, so anything set on the root element
    // of the page layout would never reach it.
    var docEl = document.documentElement
    docEl.style.setProperty("--tpl-shell-gutter", layout.gutter + "px")
    docEl.style.setProperty("--tpl-sidenote-reserve-active", layout.reserve + "px")
    root.setAttribute("data-tpl-wider-mode", mode)
    root.setAttribute("data-tpl-sidenotes", layout.reserve > 0 ? "margin" : "inline")
    // The outline lives beside the column, never over it. Rather than let it
    // paint over the article (its own backdrop is the canvas colour, so it cut
    // a pale strip through anything tinted: callouts, fences, tables), the
    // column gives up the room. As a dial that costs nothing on a wide screen,
    // since the editor widths cap below the limit anyway. Pinned it needs the
    // full panel width instead, so the column pays for that too and the panel
    // becomes a rail rather than a card floating over the text.
    var host = measureHostWidth()
    var wantsOutline = outlineItems.length > 0
    var dockRoom = host - OUTLINE_DOCK_GUTTER * 2
    var docked = wantsOutline && outlinePinned() && dockRoom >= OUTLINE_MIN_DOCK_COLUMN
    var dialRoom = host - OUTLINE_GUTTER * 2
    var roomForOutline = docked ? dockRoom : dialRoom
    var showOutline = wantsOutline && (docked || dialRoom >= OUTLINE_MIN_COLUMN)
    var maxWidth = showOutline ? Math.min(layout.maxWidth, roomForOutline) : layout.maxWidth
    docEl.style.setProperty("--tpl-max-width", maxWidth + "px")
    docEl.style.setProperty("--tpl-outline-dock-width", OUTLINE_DOCK_WIDTH + "px")
    docEl.setAttribute("data-tpl-outline", showOutline ? (docked ? "dock" : "on") : "off")
    var gutter = Math.max(0, Math.round((host - maxWidth) / 2))
    docEl.style.setProperty("--tpl-right-gutter", gutter + "px")
    // Guides are measured, not laid out, so a width change strands the last
    // drawing over the new geometry unless it is redrawn here.
    var treeEl = document.querySelector(".sidebar.left .explorer")
    if (treeEl) scheduleGuides(treeEl)
    syncWidthButton()
    syncOutlineDock()
  }

  var toastTimer = 0

  function showToast(text) {
    var toast = document.getElementById("tpl-width-toast")
    if (!toast) {
      toast = document.createElement("div")
      toast.id = "tpl-width-toast"
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
    applyLayout()
    showToast("Editor width: " + MODE_LABELS[mode])
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
    var keys = mac ? "\u2318\u2325[ / \u2318\u2325]" : "Ctrl+Alt+[ / Ctrl+Alt+]"
    button.title = "Editor width: " + MODE_LABELS[mode] + "  (" + keys + ")"
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

  // --- sidenotes (plugins/sidenote) ---------------------------------------
  // The vault stores them as a bare <span class="sidenote">. Number them and
  // give each one an in-text marker, the way the editor plugin does.
  function decorateSidenotes() {
    var notes = document.querySelectorAll("article .sidenote")
    for (var i = 0; i < notes.length; i += 1) {
      var note = notes[i]
      var index = String(i + 1)
      note.setAttribute("data-tpl-sn-index", index)
      var marker = note.previousElementSibling
      if (!marker || !marker.classList.contains("tpl-sn-num")) {
        marker = document.createElement("span")
        marker.className = "tpl-sn-num"
        if (note.parentNode) note.parentNode.insertBefore(marker, note)
      }
      marker.setAttribute("data-tpl-sn-index", index)
    }
  }

  // --- quick open (plugins/fuzzy-search) -----------------------------------
  function searchIsOpen() {
    var container = document.querySelector(".search-container")
    return container !== null && container.classList.contains("active")
  }

  function openSearch() {
    var button = document.querySelector(".search-button")
    if (button) button.click()
  }

  function isTypingTarget(target) {
    if (!target || !target.tagName) return false
    var tag = target.tagName.toLowerCase()
    return tag === "input" || tag === "textarea" || target.isContentEditable === true
  }

  document.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Escape") {
        var sheet = document.getElementById("tpl-shortcuts")
        if (sheet && !sheet.hidden) {
          event.preventDefault()
          setShortcuts(false)
        }
        return
      }
      var mod = event.metaKey || event.ctrlKey
      if (!mod) return

      // Mod+. and Mod+' open the palette, as in the editor.
      if (!event.altKey && (event.key === "." || event.key === "'")) {
        if (searchIsOpen() || isTypingTarget(event.target)) return
        event.preventDefault()
        openSearch()
        return
      }

      // Mod+Alt+[ / Mod+Alt+] step the editor width. The editor uses plain
      // Mod+[ and Mod+], which in a browser is Back and Forward, so this adds
      // Alt. Match the physical key: Option+[ on macOS types a curly quote.
      if (event.code === "BracketLeft" || event.code === "BracketRight") {
        if (!event.altKey) return
        if (searchIsOpen() || isTypingTarget(event.target)) return
        event.preventDefault()
        stepMode(event.code === "BracketRight" ? 1 : -1)
      }
    },
    true,
  )

  // --- copy button (plugins/fence-enhance) ---------------------------------
  // The syntax-highlighting plugin owns the copy itself and re-creates the
  // button on every render, so the confirmation state is delegated.
  document.addEventListener("click", function (event) {
    var target = event.target
    if (!target || !target.closest) return
    var button = target.closest("pre > .clipboard-button")
    if (!button) return
    button.classList.add("tpl-copied")
    window.setTimeout(function () {
      button.classList.remove("tpl-copied")
    }, 1500)
  })

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
  var SIDEBAR_WIDTH_KEY = "roob-sidebar-width"
  var SIDEBAR_COLLAPSED_KEY = "roob-sidebar-collapsed"
  var FILE_TREE_KEY = "fileTree" // owned by Quartz's explorer; shared on purpose
  var NAV_SCROLL_KEY = "roob-nav-scroll"
  var SIDEBAR_MIN = 220
  var SIDEBAR_MAX = 520
  var DEFAULT_SIDEBAR_WIDTH = 280
  var DRAG_THRESHOLD = 4

  var SVG_OPEN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'

  var ICONS = {
    home: SVG_OPEN + '<path d="M3 10.6 12 4l9 6.6V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    clock: SVG_OPEN + '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
    list: SVG_OPEN + '<path d="M4 6h10M4 12h16M4 18h13"/></svg>',
    folder:
      SVG_OPEN +
      '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
    chevron: SVG_OPEN + '<path d="m9 6 6 6-6 6"/></svg>',
    panel:
      SVG_OPEN +
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>',
    search: SVG_OPEN + '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.2-4.2"/></svg>',
    target:
      SVG_OPEN +
      '<circle cx="12" cy="12" r="5.2"/>' +
      '<path d="M12 3v3.3M12 17.7V21M3 12h3.3M17.7 12H21"/></svg>',
    fold: SVG_OPEN + '<path d="m6 13.6 6-6 6 6"/><path d="M5.2 18.4h13.6"/></svg>',
    help:
      SVG_OPEN +
      '<circle cx="12" cy="12" r="8.6"/>' +
      '<path d="M9.9 9.7a2.2 2.2 0 1 1 2.9 2.1c-.5.2-.8.7-.8 1.2v.5"/>' +
      '<path d="M12 16.8h.01"/></svg>',
    close: SVG_OPEN + '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/></svg>',
    sun:
      SVG_OPEN +
      '<circle cx="12" cy="12" r="4.1"/>' +
      '<path d="M12 2.6v2.3M12 19.1v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6' +
      'M2.6 12h2.3M19.1 12h2.3M4.4 19.6l1.6-1.6M18 6l1.6-1.6"/></svg>',
    moon: SVG_OPEN + '<path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a8.6 8.6 0 1 0 10.7 10.7z"/></svg>',
    book:
      SVG_OPEN +
      '<path d="M3.8 5.6A1.6 1.6 0 0 1 5.4 4H10a2.4 2.4 0 0 1 2 1.1A2.4 2.4 0 0 1 14 4h4.6' +
      'a1.6 1.6 0 0 1 1.6 1.6v11.8a1.6 1.6 0 0 1-1.6 1.6H14a2.4 2.4 0 0 0-2 1.1' +
      'a2.4 2.4 0 0 0-2-1.1H5.4a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M12 5.1v14.9"/></svg>',
  }

  /**
   * Quartz ships its own drawings for dark mode and reader mode: one a filled
   * sun on a 35 grid, the other a filled book on a 24 grid scaled unevenly and
   * nudged off centre. Beside two line icons they read as a different set and
   * sit at a different height. Redraw them on the shared grid, keeping the
   * class names, since Quartz's own CSS swaps day for night by those.
   */
  function normaliseControlIcons(controls) {
    var swap = [
      [".dayIcon", "sun", "暗色模式"],
      [".nightIcon", "moon", "亮色模式"],
      [".readerIcon", "book", "阅读模式"],
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

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key)
      if (!raw) return fallback
      var parsed = JSON.parse(raw)
      return parsed === null || parsed === undefined ? fallback : parsed
    } catch (e) {
      return fallback
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      /* private mode */
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  function icon(name, className) {
    var span = el("span", "tpl-nav-icon" + (className ? " " + className : ""))
    span.innerHTML = ICONS[name] || ""
    return span
  }

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

  function currentSlug() {
    var path = location.pathname
    try {
      path = decodeURIComponent(path)
    } catch (e) {
      /* keep the raw path */
    }
    return path.replace(/^\/+/, "").replace(/\/+$/, "") || "index"
  }

  function currentTitle() {
    var heading = document.querySelector(".page-header .article-title")
    var text = heading && heading.textContent ? heading.textContent.trim() : ""
    return text || document.title || currentSlug()
  }

  // --- file tree: reveal, collapse -----------------------------------------
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
      box.appendChild(makeCrumb(chain[j], j, body))
    }
    // Same rule as the tree rows: a tooltip only where the name was cut.
    var labels = box.querySelectorAll(".tpl-crumb-label")
    for (var k = 0; k < labels.length; k += 1) {
      var host = labels[k].parentElement
      if (labels[k].scrollWidth > labels[k].clientWidth + 1) host.title = host.dataset.full || ""
      else host.removeAttribute("title")
    }
  }

  function makeCrumb(container, depth, body) {
    var row = el("button", "tpl-tree-crumb")
    row.type = "button"
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
    // Going back to the row it stands for is the only thing it has to do.
    row.addEventListener("click", function () {
      var rect = container.getBoundingClientRect()
      var host = body.getBoundingClientRect()
      body.scrollTop += rect.top - host.top - depth * CRUMB_ROW - 4
    })
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

  // --- shortcuts sheet -----------------------------------------------------
  function modKey() {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "")
      ? "\u2318"
      : "Ctrl"
  }

  function shortcutRows() {
    var mod = modKey()
    var alt = mod === "\u2318" ? "\u2325" : "Alt"
    return [
      [[mod + " ."], "\u6253\u5f00\u641c\u7d22", "\u6807\u9898\u3001\u6b63\u6587\u3001\u6807\u7b7e\u4e00\u8d77\u641c\uff1b" + mod + " ' \u540c\u6548"],
      [[mod + " " + alt + " [", mod + " " + alt + " ]"], "\u6b63\u6587\u5bbd\u5ea6", "\u5728\u7a84\u3001\u4e2d\u3001\u5bbd\u3001\u6ee1\u5e45\u4e4b\u95f4\u9010\u7ea7\u5207\u6362"],
      [["Esc"], "\u5173\u95ed", "\u5173\u95ed\u641c\u7d22\u9762\u677f\u6216\u672c\u9875"],
    ]
  }

  function usageRows() {
    return [
      ["\u76ee\u5f55\u6811", "\u70b9\u76ee\u5f55\u540d\u8fdb\u5b83\u7684\u7d22\u5f15\u9875\uff0c\u70b9\u5de6\u4fa7\u7bad\u5934\u5c55\u5f00\u6216\u6298\u53e0\u3002\u5f53\u524d\u7b14\u8bb0\u7684\u4e0a\u7ea7\u76ee\u5f55\u4f1a\u5806\u5728\u9762\u677f\u9876\u90e8\uff0c\u70b9\u4e00\u4e0b\u56de\u5230\u5b83\u3002"],
      ["\u5e95\u90e8\u6309\u94ae", "\u5b9a\u4f4d\u5c55\u5f00\u5e76\u6eda\u5230\u5f53\u524d\u7b14\u8bb0\uff0c\u6298\u53e0\u6536\u8d77\u6240\u6709\u76ee\u5f55\u3002"],
      ["\u53f3\u4e0a\u89d2\u76ee\u5f55", "\u9f20\u6807\u79fb\u4e0a\u53bb\u5c55\u5f00\u5168\u6587\u5927\u7eb2\uff0c\u70b9\u56fe\u9489\u56fa\u5b9a\u6210\u53f3\u4fa7\u680f\uff0c\u56fa\u5b9a\u65f6\u6b63\u6587\u4f1a\u8ba9\u51fa\u4f4d\u7f6e\u800c\u4e0d\u662f\u88ab\u906e\u4f4f\u3002"],
      ["\u4fa7\u8fb9\u680f", "\u62d6\u53f3\u8fb9\u7f18\u8c03\u5bbd\uff0c\u53cc\u51fb\u590d\u4f4d\uff1b\u53f3\u4e0a\u89d2\u6700\u540e\u4e00\u4e2a\u56fe\u6807\u6536\u8d77\u6574\u4e2a\u9762\u677f\u3002"],
    ]
  }

  function buildShortcuts() {
    var sheet = el("div", "tpl-sheet")
    sheet.id = "tpl-shortcuts"
    sheet.hidden = true
    var card = el("div", "tpl-sheet-card")
    card.setAttribute("role", "dialog")
    card.setAttribute("aria-modal", "true")
    card.setAttribute("aria-label", "\u5feb\u6377\u952e\u4e0e\u7528\u6cd5")

    var head = el("div", "tpl-sheet-head")
    head.appendChild(el("h2", "tpl-sheet-title", "\u5feb\u6377\u952e\u4e0e\u7528\u6cd5"))
    var close = el("button", "tpl-sheet-close")
    close.type = "button"
    close.setAttribute("aria-label", "\u5173\u95ed")
    close.appendChild(icon("close"))
    close.addEventListener("click", function () {
      setShortcuts(false)
    })
    head.appendChild(close)
    card.appendChild(head)

    var keys = el("dl", "tpl-sheet-keys")
    var rows = shortcutRows()
    for (var i = 0; i < rows.length; i += 1) {
      var dt = el("dt", "")
      for (var k = 0; k < rows[i][0].length; k += 1) {
        if (k > 0) dt.appendChild(el("span", "tpl-sheet-or", "/"))
        dt.appendChild(el("kbd", "tpl-command-key", rows[i][0][k]))
      }
      keys.appendChild(dt)
      var dd = el("dd", "")
      dd.appendChild(el("span", "tpl-sheet-what", rows[i][1]))
      dd.appendChild(el("span", "tpl-sheet-how", rows[i][2]))
      keys.appendChild(dd)
    }
    card.appendChild(keys)

    var notes = el("dl", "tpl-sheet-notes")
    var use = usageRows()
    for (var u = 0; u < use.length; u += 1) {
      notes.appendChild(el("dt", "", use[u][0]))
      notes.appendChild(el("dd", "", use[u][1]))
    }
    card.appendChild(notes)

    sheet.appendChild(card)
    sheet.addEventListener("click", function (event) {
      if (event.target === sheet) setShortcuts(false)
    })
    document.body.appendChild(sheet)
    return sheet
  }

  function setShortcuts(open) {
    var sheet = document.getElementById("tpl-shortcuts") || buildShortcuts()
    sheet.hidden = !open
    if (open) {
      var close = sheet.querySelector(".tpl-sheet-close")
      if (close) close.focus()
    }
  }

  function toggleShortcuts() {
    var sheet = document.getElementById("tpl-shortcuts")
    setShortcuts(!sheet || sheet.hidden)
  }

  function makeFootAction(name, label, run) {
    var button = el("button", "tpl-foot-action")
    button.type = "button"
    button.title = label
    button.setAttribute("aria-label", label)
    button.appendChild(icon(name))
    button.addEventListener("click", run)
    return button
  }

  // --- tree guides ---------------------------------------------------------
  //
  // One stroke per group, all of them in a single overlay above the tree.
  // Drawing the line as box borders on each row is what produced the seams and
  // the stray verticals; a path can put the trunk, every arm and the closing
  // corner in one stroke, with the corner at whatever radius reads best. The
  // branch holding the open note is drawn again in the accent colour, so a
  // tree this size still answers "where am I" at a glance.
  var SVG_NS = "http://www.w3.org/2000/svg"
  var GUIDE_ARM = 9
  var GUIDE_RADIUS = 6
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
  function guideCorner(x, top, y, radius) {
    var r = Math.min(radius, Math.max(0, y - top))
    return (
      "M" + x + "," + top +
      "L" + x + "," + (y - r) +
      "Q" + x + "," + y + " " + (x + r) + "," + y +
      "L" + (x + GUIDE_ARM) + "," + y
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

  function guideArm(x, y) {
    return "M" + x + "," + y + "L" + (x + GUIDE_ARM) + "," + y
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
      var onPath = -1
      for (var i = 0; i < rows.length; i += 1) {
        var rr = rows[i].row.getBoundingClientRect()
        arms.push(Math.round(rr.top - host.top + rr.height / 2) + 0.5)
        if (active && rows[i].li.contains(active)) onPath = i
      }

      base += guideCorner(x, top, arms[arms.length - 1], GUIDE_RADIUS)
      for (var j = 0; j < arms.length - 1; j += 1) base += guideArm(x, arms[j])

      if (onPath !== -1) {
        var y = arms[onPath]
        lit +=
          onPath === arms.length - 1
            ? guideCorner(x, top, y, GUIDE_RADIUS)
            : "M" + x + "," + top + "L" + x + "," + y + guideArm(x, y)
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

  /** Deep rows truncate, so the full name has to live somewhere reachable. */
  /**
   * A name that fits is already on screen, and a tooltip repeating it is
   * noise: it covers the rows below, arrives late, and says nothing new. The
   * tooltip is only for a name the panel had to cut, so whether a row gets one
   * depends on the panel's current width and is re-decided when that changes.
   */
  function titleTreeRows(explorer) {
    var rows = explorer.querySelectorAll(".folder-title, a.nav-file-title")
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i]
      if (row.scrollWidth > row.clientWidth + 1) {
        var text = (row.textContent || "").trim()
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

  /** Re-apply the folder open/closed state the explorer persisted. */
  function restoreSavedOpenState(explorer) {
    var saved = readJson(FILE_TREE_KEY, [])
    if (!Array.isArray(saved)) return
    var byPath = {}
    for (var i = 0; i < saved.length; i += 1) {
      if (saved[i] && saved[i].path) byPath[saved[i].path] = saved[i].collapsed
    }
    var containers = explorer.querySelectorAll(".folder-container")
    for (var j = 0; j < containers.length; j += 1) {
      var container = containers[j]
      var outer = container.nextElementSibling
      if (!outer) continue
      var path = container.dataset.folderpath
      var collapsed = path in byPath ? byPath[path] : true
      outer.classList.toggle("open", !collapsed)
    }
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

  function shortcutHint() {
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "")
    return mac ? "⌘ ." : "Ctrl ."
  }

  // --- panel width ---------------------------------------------------------
  function storedSidebarWidth() {
    var width = readJson(SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH)
    if (typeof width !== "number" || width < SIDEBAR_MIN || width > SIDEBAR_MAX) {
      return DEFAULT_SIDEBAR_WIDTH
    }
    return width
  }

  function paintSidebarWidth(width) {
    document.documentElement.style.setProperty("--tpl-sidebar-width", width + "px")
  }

  function applySidebarWidth(width) {
    writeJson(SIDEBAR_WIDTH_KEY, width)
    paintSidebarWidth(width)
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
    paintSidebarWidth(collapsed ? 0 : storedSidebarWidth())
    applyLayout()
    syncCollapseButton()
  }

  function restoreSidebarPrefs() {
    var collapsed = sidebarCollapsed()
    document.documentElement.setAttribute("data-tpl-sidebar", collapsed ? "collapsed" : "open")
    paintSidebarWidth(collapsed ? 0 : storedSidebarWidth())
  }

  function syncCollapseButton() {
    var button = document.getElementById("tpl-sidebar-collapse")
    if (!button) return
    var collapsed = sidebarCollapsed()
    button.setAttribute("aria-pressed", collapsed ? "true" : "false")
    button.title = collapsed ? "展开侧栏" : "收起侧栏"
    button.setAttribute("aria-label", button.title)
  }

  /** Drag the panel edge; the reading column recomputes as it moves. */
  function makeResizeHandle() {
    var handle = el("div", "tpl-nav-resize")
    handle.setAttribute("role", "separator")
    handle.setAttribute("aria-label", "调整侧栏宽度")
    handle.title = "拖动调整宽度，双击复位"
    var armed = false
    var dragging = false
    var startX = 0

    var stop = function () {
      if (!armed) return
      armed = false
      dragging = false
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
      window.removeEventListener("blur", stop)
      document.documentElement.classList.remove("tpl-resizing")
    }

    function move(event) {
      // Pointer capture on the handle used to strand the drag whenever the
      // panel went away mid-gesture, and every later click then resized the
      // sidebar instead of opening what it hit. Watching the button state
      // means a drag that lost its pointerup ends itself on the next move.
      if (!(event.buttons & 1)) {
        stop()
        return
      }
      // The handle sits a few pixels from this panel's scrollbar, so a press
      // that lands on it by accident must not move anything. Only a pointer
      // that travels starts a resize; a click on the edge does nothing.
      if (!dragging) {
        if (Math.abs(event.clientX - startX) < DRAG_THRESHOLD) return
        dragging = true
        document.documentElement.classList.add("tpl-resizing")
      }
      applySidebarWidth(Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, event.clientX))))
      applyLayout()
    }

    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return
      armed = true
      dragging = false
      startX = event.clientX
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", stop)
      window.addEventListener("pointercancel", stop)
      window.addEventListener("blur", stop)
      event.preventDefault()
    })

    // A mis-drag is easy to make and hard to undo by hand, so give the edge
    // the usual way back to the default width.
    handle.addEventListener("dblclick", function () {
      applySidebarWidth(DEFAULT_SIDEBAR_WIDTH)
      applyLayout()
    })
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
    var toggle = el("button", "")
    toggle.id = "tpl-nav-toggle"
    toggle.type = "button"
    toggle.setAttribute("aria-label", "切换导航")
    toggle.innerHTML =
      SVG_OPEN + '<path d="M3 6h18M3 12h18M3 18h18"/></svg>'
    toggle.addEventListener("click", function () {
      var open = sidebar.classList.toggle("tpl-nav-open")
      toggle.setAttribute("aria-expanded", open ? "true" : "false")
      // The dropdown is short-lived, so it opens at the top rather than
      // wherever the panel was left scrolled on the last desktop visit.
      if (open && sidebar.__tplBody) sidebar.__tplBody.scrollTop = 0
    })
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
    collapseButton.addEventListener("click", function () {
      setSidebarCollapsed(!sidebarCollapsed())
    })
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
    var tocHost = el("div", "tpl-toc-source")
    if (toc) tocHost.appendChild(toc)

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
    footTools.appendChild(
      makeFootAction("target", "展开并滚动到当前笔记", function () {
        revealActive(explorer)
      }),
    )
    footTools.appendChild(
      makeFootAction("fold", "折叠所有目录", function () {
        collapseAll(explorer)
      }),
    )
    footTools.appendChild(
      makeFootAction("help", "快捷键与用法", function () {
        toggleShortcuts()
      }),
    )
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
    body.addEventListener("scroll", function () {
      try {
        sessionStorage.setItem(NAV_SCROLL_KEY, String(body.scrollTop))
      } catch (e) {
        /* private mode */
      }
    })

    sidebar.textContent = ""
    sidebar.appendChild(head)
    sidebar.appendChild(body)
    sidebar.appendChild(foot)
    sidebar.appendChild(tocHost)
    sidebar.appendChild(makeResizeHandle())
    sidebar.dataset.tplNav = "ready"
    sidebar.__tplBody = body
    mountReopenButton()
    syncCollapseButton()

    // The explorer rebuilds its tree asynchronously after every navigation,
    // so the row titles and the count have to be re-applied when it does.
    var list = explorer.querySelector(".explorer-ul")
    if (list && typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function () {
        titleTreeRows(explorer)
        restoreNavScroll(body)
        scheduleGuides(explorer)
        scheduleCrumbs(explorer, body)
      })
      observer.observe(list, { childList: true, subtree: true })
    }
    // Opening or closing a folder animates grid-template-rows for 300ms.
    // Capture, because the explorer's own toggle stops the click before it
    // bubbles this far: on the bubble phase neither of these ever ran.
    explorer.addEventListener(
      "click",
      function (event) {
        markUnfolding(event.target)
        followGuides(explorer, 420)
      },
      true,
    )
    explorer.addEventListener("transitionend", function (event) {
      if (event.propertyName === "grid-template-rows") scheduleGuides(explorer)
    })
    body.addEventListener("scroll", function () {
      scheduleGuides(explorer)
      scheduleCrumbs(explorer, body)
    })
    titleTreeRows(explorer)
    scheduleGuides(explorer)
    scheduleCrumbs(explorer, body)
  }

  function refreshNav() {
    var sidebar = document.querySelector(".sidebar.left")
    if (!sidebar) return
    if (sidebar.dataset.tplNav !== "ready") buildNav()
    sidebar = document.querySelector(".sidebar.left")
    if (!sidebar) return
    var explorer = sidebar.querySelector(".explorer")
    if (explorer) {
      titleTreeRows(explorer)
      scheduleGuides(explorer)
      if (sidebar.__tplBody) scheduleCrumbs(explorer, sidebar.__tplBody)
    }
  }


  var resizeTimer = 0
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(function () {
      applyLayout()
      var explorer = document.querySelector(".sidebar.left .explorer")
      if (explorer) {
        scheduleGuides(explorer)
        scheduleTitles(explorer)
      }
    }, 80)
  })

  function refresh() {
    restoreSidebarPrefs()
    decorateSidenotes()
    mountWidthButton()
    refreshNav()
    refreshOutline()
    applyLayout()
  }

  document.addEventListener("nav", refresh)
  refresh()
}

/**
 * Dev-only cache buster.
 *
 * The dev server sends index.css with no Cache-Control and no ETag, so Chrome
 * reuses it on heuristic freshness, and Quartz marks the link data-persist so
 * the SPA router never replaces it either. A stylesheet edit then shows up
 * only after a manual hard reload, which makes every visual change look like
 * it did not take. Localhost gets a stamped href; nothing else is touched.
 */
function roobDevCacheBust() {
  var host = location.hostname
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") return
  var stamp = String(Date.now())
  var apply = function () {
    var links = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]')
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href")
      if (!href || href.indexOf("tplcb=") !== -1) continue
      links[i].setAttribute("href", href + (href.indexOf("?") === -1 ? "?" : "&") + "tplcb=" + stamp)
    }
  }
  apply()
  document.addEventListener("DOMContentLoaded", apply)
}

const script = "(" + roobUI.toString() + ")()"
const beforeScript = "(" + roobDevCacheBust.toString() + ")()"

const css = `
#tpl-width-button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-inline, 3px);
  background: transparent;
  color: var(--ink-muted-color, currentColor);
  cursor: pointer;
}
#tpl-width-button:hover {
  background: var(--item-hover-bg-color, rgba(128, 128, 128, 0.1));
  color: var(--accent-color, currentColor);
}
#tpl-width-button[data-mode="wide"],
#tpl-width-button[data-mode="full"] {
  color: var(--accent-color, currentColor);
}
#tpl-width-button[data-mode="full"] svg {
  transform: scaleX(1.18);
}

#tpl-width-toast {
  position: fixed;
  left: 50%;
  bottom: 2.5rem;
  transform: translate(-50%, 6px);
  z-index: 99999;
  padding: 6px 14px;
  border: 1px solid var(--line-color, rgba(128, 128, 128, 0.25));
  border-radius: var(--radius-block, 6px);
  background: var(--surface-subtle-color, #fff);
  color: var(--ink-color, #333);
  font-family: var(--font-ui, inherit);
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 8px 20px var(--overlay-shadow-color, rgba(0, 0, 0, 0.12));
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease-out, transform 140ms ease-out;
}
#tpl-width-toast.tpl-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
@media (prefers-reduced-motion: reduce) {
  #tpl-width-toast {
    transition: none;
  }
}
`

const RoobUI = () => {
  const Component = () => null
  Component.beforeDOMLoaded = beforeScript
  Component.afterDOMLoaded = script
  Component.css = css
  return Component
}

export { RoobUI }
