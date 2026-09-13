// The keyboard: quick open, the width steps, Escape for whatever is
// innermost, and the shortcuts sheet.

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
    var sheet = document.getElementById("tpl-shortcuts")
    var sheetOpen = sheet !== null && !sheet.hidden
    if (event.key === "Escape") {
      // Innermost first: a drag in progress, then the sheet, then the
      // narrow-screen nav. Search closes itself.
      if (drag) {
        event.preventDefault()
        endDrag(false)
      } else if (sheetOpen) {
        event.preventDefault()
        setShortcuts(false)
      } else if (!searchIsOpen() && closeNav()) {
        event.preventDefault()
      }
      return
    }
    if (event.key === "Tab" && sheetOpen) {
      trapFocus(sheet, event)
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
    ? "\u2318"
    : "Ctrl"
}

function shortcutRows() {
  var mod = modKey()
  var alt = mod === "\u2318" ? "\u2325" : "Alt"
  return [
    [[mod + " ."], "\u6253\u5f00\u641c\u7d22", "\u6807\u9898\u3001\u6b63\u6587\u3001\u6807\u7b7e\u4e00\u8d77\u641c\uff1b" + mod + " ' \u540c\u6548"],
    [[mod + " " + alt + " [", mod + " " + alt + " ]"], "\u6b63\u6587\u5bbd\u5ea6", "\u5728\u9ed8\u8ba4\u3001\u52a0\u5bbd\u3001\u6ee1\u5e45\u4e09\u6863\u4e4b\u95f4\u5faa\u73af\u5207\u6362"],
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

var sheetReturnFocus = null

function setShortcuts(open) {
  var sheet = document.getElementById("tpl-shortcuts") || buildShortcuts()
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
 *  the sheet's own controls instead of walking out behind the backdrop. */
function trapFocus(container, event) {
  var items = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (items.length === 0) return
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
