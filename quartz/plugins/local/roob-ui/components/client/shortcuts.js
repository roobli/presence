// The keyboard: quick open, the width steps, Escape for whatever is
// innermost, Tab kept inside whichever dialog is open, and the shortcuts sheet.

STRINGS.shortcuts = {
  en: {
    title: "Keyboard shortcuts and tips",
    close: "Close",
    searchWhat: "Open search",
    searchHow: "Titles, text and tags together; {mod} ' does the same",
    widthWhat: "Text width",
    widthHow: "Cycles through default, wide and full",
    escWhat: "Close",
    escHow: "Closes search or this sheet",
    treeWhat: "File tree",
    treeHow:
      "Click a folder's name to open its index page, and the arrow beside it to expand or collapse it. The folders above the current note stack at the top of the panel; click one to go back to it.",
    footWhat: "Bottom buttons",
    footHow:
      "Reveal opens the folders above the current note and scrolls to it, and Collapse closes every folder. Outline opens the outline when there is no room for it beside the text.",
    dialWhat: "Outline, top right",
    dialHow:
      "Point at it to open the whole outline. Pin it to keep it as a column on the right; where the window is wide enough it stands beside the text instead of over it.",
    panelWhat: "Sidebar",
    panelHow:
      "Drag its right edge to resize it, and double-click the edge to reset it. The last icon at the top right hides the whole panel.",
  },
  "zh-Hans": {
    title: "快捷键与用法",
    close: "关闭",
    searchWhat: "打开搜索",
    searchHow: "标题、正文、标签一起搜；{mod} ' 同效",
    widthWhat: "正文宽度",
    widthHow: "在默认、加宽、满幅三档之间循环切换",
    escWhat: "关闭",
    escHow: "关闭搜索面板或本页",
    treeWhat: "文件树",
    treeHow: "点文件夹名进它的索引页，点左侧箭头展开或折叠。当前笔记的上级文件夹会堆在面板顶部，点一下回到它。",
    footWhat: "底部按钮",
    footHow: "定位按钮展开当前笔记的上级文件夹并滚动到它，折叠按钮收起全部文件夹；正文旁放不下目录时，目录按钮打开它。",
    dialWhat: "右上角目录",
    dialHow: "鼠标移上去展开完整目录。点图钉固定成右侧栏，窗口够宽时它停在正文旁边，不遮住正文。",
    panelWhat: "侧边栏",
    panelHow: "拖右边缘调宽，双击复位；右上角最后一个图标收起整个面板。",
  },
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

/** The dialog that owns the keyboard right now, innermost first. */
function openDialog() {
  var sheet = document.getElementById("tpl-shortcuts")
  if (sheet !== null && !sheet.hidden) return sheet
  if (searchIsOpen()) return null
  if (outlineSheetIsOpen()) return sheetEl
  if (drawerIsOpen()) return drawerEl()
  return null
}

document.addEventListener(
  "keydown",
  function (event) {
    var sheet = document.getElementById("tpl-shortcuts")
    var sheetOpen = sheet !== null && !sheet.hidden
    if (event.key === "Escape") {
      // Innermost first: a panel drag, the shortcuts sheet, then search,
      // which closes itself, the outline sheet and the drawer.
      if (drag) {
        event.preventDefault()
        endDrag(false)
      } else if (sheetOpen) {
        event.preventDefault()
        setShortcuts(false)
      } else if (searchIsOpen()) {
        return
      } else if (closeOutlineSheet(true) || closeNav()) {
        event.preventDefault()
      }
      return
    }
    if (event.key === "Tab") {
      var dialog = openDialog()
      if (dialog) trapFocus(dialog, event)
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

// --- shortcuts sheet -----------------------------------------------------
function modKey() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "")
    ? "⌘"
    : "Ctrl"
}

function shortcutRows() {
  var mod = modKey()
  var alt = mod === "⌘" ? "⌥" : "Alt"
  return [
    [[mod + " ."], t("shortcuts", "searchWhat"), t("shortcuts", "searchHow", { mod: mod })],
    [
      [mod + " " + alt + " [", mod + " " + alt + " ]"],
      t("shortcuts", "widthWhat"),
      t("shortcuts", "widthHow"),
    ],
    [["Esc"], t("shortcuts", "escWhat"), t("shortcuts", "escHow")],
  ]
}

function usageRows() {
  return [
    [t("shortcuts", "treeWhat"), t("shortcuts", "treeHow")],
    [t("shortcuts", "footWhat"), t("shortcuts", "footHow")],
    [t("shortcuts", "dialWhat"), t("shortcuts", "dialHow")],
    [t("shortcuts", "panelWhat"), t("shortcuts", "panelHow")],
  ]
}

function buildShortcuts() {
  var sheet = el("div", "tpl-sheet")
  sheet.id = "tpl-shortcuts"
  sheet.hidden = true
  sheet.dataset.locale = pageLocale()
  var card = el("div", "tpl-sheet-card")
  card.setAttribute("role", "dialog")
  card.setAttribute("aria-modal", "true")
  card.setAttribute("aria-label", t("shortcuts", "title"))

  var head = el("div", "tpl-sheet-head")
  head.appendChild(el("h2", "tpl-sheet-title", t("shortcuts", "title")))
  var close = el("button", "tpl-sheet-close")
  close.type = "button"
  close.setAttribute("aria-label", t("shortcuts", "close"))
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

var sheetReturnFocus = null

function setShortcuts(open) {
  var sheet = document.getElementById("tpl-shortcuts")
  // A sheet built on a page in the other language is rebuilt before it opens.
  if (sheet && open && sheet.hidden && sheet.dataset.locale !== pageLocale()) {
    sheet.remove()
    sheet = null
  }
  if (!sheet) sheet = buildShortcuts()
  var wasOpen = !sheet.hidden
  sheet.hidden = !open
  if (open) {
    // Whatever opened the sheet gets focus back when it closes.
    if (!wasOpen) sheetReturnFocus = document.activeElement
    var close = sheet.querySelector(".tpl-sheet-close")
    if (close) close.focus()
  } else if (wasOpen) {
    var back = sheetReturnFocus
    sheetReturnFocus = null
    if (back && back.isConnected && typeof back.focus === "function") back.focus()
  }
}

function toggleShortcuts() {
  var sheet = document.getElementById("tpl-shortcuts")
  setShortcuts(!sheet || sheet.hidden)
}

/** aria-modal says the page behind is out of reach, so Tab cycles through
 *  the dialog's own controls instead of walking out behind it. */
function trapFocus(container, event) {
  var items = focusableIn(container)
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  var first = items[0]
  var last = items[items.length - 1]
  var active = document.activeElement
  if (!container.contains(active)) {
    event.preventDefault()
    first.focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
