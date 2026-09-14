/* conflict-map: Fig. 1 of the keyboard-shortcut-systems essay.
 * One physical K in five contexts. A row is a context the reader selects; the
 * K keycap beside it is the key they press, with a pointer, with Enter or Space
 * on the keycap, or with Cmd/Ctrl+K while focus is inside the stage. The
 * selected app takes the key. On the last row the figure lets the chord
 * through, and this page's own search opens.
 * Only constants, pure functions and the WIDGETS assignment run at load, so
 * node:vm can evaluate the file with { WIDGETS: {} }. */

var KCM_ROWS = ["word", "slack", "vscode", "cursor", "site"]
var KCM_REST_ROW = "slack"
var KCM_TAGS = {
  word: ["link"],
  slack: ["jump"],
  vscode: ["chord"],
  cursor: ["chord", "ai"],
  site: [],
}
// Chords exactly as the essay prints them, the same in both languages.
var KCM_CHORDS = {
  word: "Ctrl+K",
  slack: "Cmd/Ctrl+K",
  vscode: "Ctrl+K",
  cursor: "Cmd+K",
  site: "Cmd/Ctrl+K",
}
var KCM_KEY_SIZE = 44
var KCM_PRESSED = 0.94
var KCM_MODIFIER_KEYS = {
  Shift: true,
  Control: true,
  Alt: true,
  AltGraph: true,
  Meta: true,
  CapsLock: true,
  Fn: true,
  OS: true,
}

var KCM_STRINGS = {
  en: {
    group: "App",
    apps: {
      word: "Word-class apps",
      slack: "Slack",
      vscode: "VS Code",
      cursor: "Cursor",
      site: "This site",
    },
    aside: "not in the essay",
    meanings: {
      word: "insert hyperlink",
      slack: "Quick Switcher, an in-app Jump",
      vscode: "first half of a chord, as in Ctrl+K Ctrl+S",
      cursor: "often a chord leader for inline AI and terminal prompts",
      site: "opens this site's search",
    },
    tags: { link: "link", jump: "jump", chord: "chord leader", ai: "AI prompt" },
    note: "Picked nearly arbitrarily at a 2014 hack day because common chords were taken. Slack's reach carried K = in-app Jump to Linear's command menu, Notion and Lark search jumpers, and AI omniboxes.",
    idle: {
      word: "In Word-class apps, Ctrl+K long meant insert hyperlink.",
      slack: "Slack shipped Quick Switcher with Cmd/Ctrl+K, and K = in-app Jump spread from there.",
      vscode: "In VS Code, Ctrl+K starts a sequential chord such as Ctrl+K Ctrl+S.",
      cursor:
        "Cursor keeps Cmd+Shift+P for the palette. Its Cmd+K is deliberately not the palette key.",
      site: "This row is about this site, not the essay. Press K here and the chord reaches the page.",
    },
    waiting: "Waiting for the second key. The first half cannot also be a standalone command.",
    sent: "Sent to the page. This site's search opens.",
    noSearch: "This page has no search to open.",
    press: {
      word: "Word-class apps: Ctrl+K inserts a hyperlink.",
      slack: "Slack: Cmd/Ctrl+K opens Quick Switcher, an in-app Jump.",
      vscode: "VS Code: Ctrl+K waits for the second key.",
      cursor: "Cursor: Cmd+K is often a chord leader for inline AI and terminal prompts.",
      site: "Opening this site's search.",
    },
    keyLabel: {
      word: "Press K in Word-class apps",
      slack: "Press K in Slack",
      vscode: "Press K in VS Code",
      cursor: "Press K in Cursor",
      site: "Press K on this site",
    },
    hint: "Arrow keys pick an app. Cmd+K or Ctrl+K presses K. Esc gives the keys back.",
  },
  "zh-Hans": {
    group: "应用",
    apps: {
      word: "Word 等软件",
      slack: "Slack",
      vscode: "VS Code",
      cursor: "Cursor",
      site: "本站",
    },
    aside: "文中未提",
    meanings: {
      word: "插入超链接",
      slack: "Quick Switcher，应用内 Jump",
      vscode: "和弦前缀，如 Ctrl+K Ctrl+S",
      cursor: "Inline Edit 与终端 AI 提示的和弦领袖",
      site: "打开本站搜索",
    },
    tags: { link: "链接", jump: "跳转", chord: "和弦领袖", ai: "AI 入口" },
    note: "2014 年 hack day 上常用键被占光，几乎随意选了 K。Slack 用户面大，K = 应用内 Jump 被 Linear 的命令菜单、Notion / 飞书的搜索跳转和 AI 万能框抄走。",
    idle: {
      word: "Word 等软件里，Ctrl+K 长期是「插入超链接」。",
      slack: "Slack 正式做了 Quick Switcher 并保留 Cmd/Ctrl+K，K = 应用内 Jump 从这里传开。",
      vscode: "VS Code 里，Ctrl+K 开启顺序和弦，如 Ctrl+K Ctrl+S。",
      cursor: "Cursor 仍保留 Cmd+Shift+P 命令面板，Cmd+K 和面板键刻意分开。",
      site: "这一行说的是本站，不是文中内容。在这里按 K，按键会交给页面。",
    },
    waiting: "等第二键：第一半键不能再当独立命令。",
    sent: "已交给页面，本站搜索打开。",
    noSearch: "本页没有可打开的搜索。",
    press: {
      word: "Word 等软件：Ctrl+K 插入超链接。",
      slack: "Slack：Cmd/Ctrl+K 打开 Quick Switcher，应用内 Jump。",
      vscode: "VS Code：Ctrl+K 在等第二键。",
      cursor: "Cursor：Cmd+K 是 Inline Edit 与终端 AI 提示的和弦领袖。",
      site: "正在打开本站搜索。",
    },
    keyLabel: {
      word: "在 Word 等软件里按 K",
      slack: "在 Slack 里按 K",
      vscode: "在 VS Code 里按 K",
      cursor: "在 Cursor 里按 K",
      site: "在本站按 K",
    },
    hint: "方向键选应用，Cmd+K 或 Ctrl+K 按下 K，Esc 交还按键。",
  },
}

/* ---------- model (pure; window.__essayInteractives.models["conflict-map"]) ---------- */

// row: the selected context. phase: idle, or waiting after Ctrl+K in VS Code.
// hit: the row whose meaning a press lit, or "". status: "idle" (the row's own
// line), "waiting", "sent" or "noSearch". The rest are effects of the step
// that produced the state: say (what to announce), search (open the page's
// search) and blur (give the keys back).
function kcmRest() {
  return {
    row: KCM_REST_ROW,
    phase: "idle",
    hit: "",
    status: "idle",
    say: "",
    search: false,
    blur: false,
  }
}

// SELECT, PRESS, ESCAPE, KEY, BLUR and RESET. hasSearch says whether the page
// has a search to hand the last row's press to.
function kcmStep(state, action, hasSearch) {
  var next = {
    row: state.row,
    phase: state.phase,
    hit: state.hit,
    status: state.status,
    say: "",
    search: false,
    blur: false,
  }
  var type = action.type
  if (type === "reset") return kcmRest()
  if (type === "select") {
    next.row = action.row
    next.phase = "idle"
    next.hit = ""
    next.status = "idle"
  } else if (type === "press") {
    if (state.row === "site") {
      next.phase = "idle"
      next.status = hasSearch ? "sent" : "noSearch"
      next.say = hasSearch ? "press" : "noSearch"
      next.search = !!hasSearch
    } else if (state.row === "vscode") {
      next.phase = "waiting"
      next.hit = "vscode"
      next.status = "waiting"
      next.say = "press"
    } else {
      next.hit = state.row
      next.say = "press"
    }
  } else if (type === "escape") {
    if (state.phase === "waiting") {
      next.phase = "idle"
      next.status = "idle"
      next.say = "idle"
    } else {
      next.blur = true
    }
  } else if ((type === "key" || type === "blur") && state.phase === "waiting") {
    next.phase = "idle"
    next.status = "idle"
  }
  return next
}

// What a keydown inside the stage means, or null when the figure ignores it.
// consume says whether the figure keeps the key from the page.
function kcmKeyAction(state, e) {
  var key = e.key
  if (key === "Escape") return { type: "escape", consume: state.phase === "waiting" }
  if ((key === "k" || key === "K") && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    // The last row lets the chord through to the page.
    return { type: "press", consume: state.row !== "site" }
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    var at = KCM_ROWS.indexOf(state.row)
    var to = -2
    if (key === "ArrowUp") to = at - 1
    else if (key === "ArrowDown") to = at + 1
    else if (key === "Home") to = 0
    else if (key === "End") to = KCM_ROWS.length - 1
    if (to !== -2) {
      // No wrapping: past either end the key only ends a waiting chord.
      if (to >= 0 && to < KCM_ROWS.length && to !== at) {
        return { type: "select", row: KCM_ROWS[to], consume: true }
      }
      return { type: "key", consume: true }
    }
  }
  if (KCM_MODIFIER_KEYS[key] || state.phase !== "waiting") return null
  return { type: "key", consume: false }
}

function kcmStatusText(state, s) {
  return state.status === "idle" ? s.idle[state.row] : s[state.status]
}

function kcmSayText(state, s) {
  if (state.say === "press") return s.press[state.row]
  if (state.say === "idle") return s.idle[state.row]
  if (state.say === "noSearch") return s.noSearch
  return ""
}

function kcmEl(tag, cls, text) {
  var node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

/* ---------- widget ---------- */

WIDGETS["conflict-map"] = function (fig) {
  var s = fig.strings(KCM_STRINGS)
  var root = fig.root
  var stage = fig.stage
  var state = kcmRest()
  var alive = true
  var measured = false
  var held = false
  var centers = new Float64Array(KCM_ROWS.length)

  var wrap = kcmEl("div", "kcm")
  var grid = kcmEl("div", "kcm__grid")
  grid.setAttribute("role", "radiogroup")
  grid.setAttribute("aria-label", s.group)
  var rows = []
  var firstSlot = null

  KCM_ROWS.forEach(function (id) {
    var row = kcmEl("div", "kcm__row")
    row.setAttribute("data-row", id)
    row.setAttribute("role", "radio")
    var who = kcmEl("div", "kcm__who")
    who.appendChild(kcmEl("span", "kcm__app", s.apps[id]))
    who.appendChild(kcmEl("kbd", "kcm__chord", KCM_CHORDS[id]))
    if (id === "site") who.appendChild(kcmEl("span", "kcm__aside", s.aside))
    var slot = kcmEl("span", "kcm__slot")
    slot.setAttribute("aria-hidden", "true")
    if (!firstSlot) firstSlot = slot
    var what = kcmEl("div", "kcm__what")
    what.appendChild(kcmEl("span", "kcm__meaning", s.meanings[id]))
    var tags = kcmEl("span", "kcm__tags")
    KCM_TAGS[id].forEach(function (tag) {
      var pill = kcmEl("span", "kcm__tag", s.tags[tag])
      pill.setAttribute("data-tag", tag)
      tags.appendChild(pill)
    })
    what.appendChild(tags)
    row.appendChild(who)
    row.appendChild(slot)
    row.appendChild(what)
    if (id === "slack") row.appendChild(kcmEl("p", "kcm__note", s.note))
    grid.appendChild(row)
    rows.push(row)
    // Mouse and pen select on press; touch selects on a tap, so a scroll that
    // starts on a row never changes it.
    fig.press(row, function () {
      commit(kcmStep(state, { type: "select", row: id }))
    })
  })

  var status = kcmEl("p", "kcm__status")
  status.setAttribute("aria-hidden", "true")
  var hint = kcmEl("p", "kcm__hint", s.hint)
  hint.setAttribute("aria-hidden", "true")
  var key = kcmEl("button", "kcm__key")
  key.type = "button"
  key.appendChild(kcmEl("span", "kcm__glyph", "K"))
  // Tab reaches the checked row first, then the keycap.
  wrap.appendChild(hint)
  wrap.appendChild(grid)
  wrap.appendChild(status)
  wrap.appendChild(key)
  fig.box.appendChild(wrap)

  /* ---------- keycap motion ---------- */

  var y = fig.spring({ response: 0.35, dampingRatio: 1, restDelta: 0.5, restSpeed: 5 })
  var scale = fig.spring({
    response: 0.3,
    dampingRatio: 1,
    value: 1,
    restDelta: 0.001,
    restSpeed: 0.01,
  })

  function rowTop(id) {
    return centers[KCM_ROWS.indexOf(id)] - KCM_KEY_SIZE / 2
  }

  function paint() {
    var at = y.value
    key.style.transform = "translate3d(0," + at + "px,0) scale(" + scale.value + ")"
    root.setAttribute("data-key-y", at.toFixed(1))
  }

  var loop = fig.loop(function (dt) {
    var moving = y.step(dt)
    if (scale.step(dt)) moving = true
    paint()
    return moving
  })

  // Frames run only while a spring has somewhere to go; under reduced motion
  // retarget has already jumped, so the settled keycap is painted now.
  function run() {
    if (y.resting && scale.resting) {
      loop.stop()
      paint()
    } else {
      loop.start()
    }
  }

  // Row centers relative to the figure body, read on resize, size change and
  // font load, never per frame. The keycap is placed without animation when a
  // measure moves its target.
  function measure() {
    if (!alive) return
    var base = wrap.getBoundingClientRect()
    if (!(base.width > 0)) return
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect()
      centers[i] = r.top - base.top + r.height / 2
    }
    var slot = firstSlot.getBoundingClientRect()
    key.style.left = (slot.left - base.left + (slot.width - KCM_KEY_SIZE) / 2).toFixed(2) + "px"
    var top = rowTop(state.row)
    if (!measured || Math.abs(y.target - top) > 0.01) {
      measured = true
      y.set(top)
      run()
    }
  }

  /* ---------- state ---------- */

  function hasSearch() {
    return !!document.querySelector(".search-button")
  }

  function openSearch() {
    var button = document.querySelector(".search-button")
    if (button) button.click()
  }

  function commit(next) {
    var moved = next.row !== state.row
    state = next
    for (var i = 0; i < rows.length; i++) {
      var id = KCM_ROWS[i]
      rows[i].setAttribute("aria-checked", id === state.row ? "true" : "false")
      rows[i].tabIndex = id === state.row ? 0 : -1
      rows[i].classList.toggle("is-hit", id === state.hit)
    }
    key.setAttribute("aria-label", s.keyLabel[state.row])
    key.classList.toggle("is-waiting", state.phase === "waiting")
    root.setAttribute("data-row", state.row)
    root.setAttribute("data-phase", state.phase)
    root.setAttribute("data-hit", state.hit)
    status.textContent = kcmStatusText(state, s)
    if (moved && measured) {
      y.retarget(rowTop(state.row))
      run()
    }
    if (state.say) fig.announce(kcmSayText(state, s))
  }

  /* ---------- input ---------- */

  // The keycap answers on press for every pointer type; the press itself runs
  // on the native click, so a scroll that starts on the keycap cancels it.
  fig.listen(key, "pointerdown", function (e) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return
    held = true
    key.classList.add("is-held")
    if (!fig.reducedMotion()) {
      scale.retarget(KCM_PRESSED)
      run()
    }
  })

  function release() {
    if (!held) return
    held = false
    key.classList.remove("is-held")
    scale.retarget(1)
    run()
  }

  fig.listen(window, "pointerup", release, true)
  fig.listen(window, "pointercancel", release, true)
  fig.listen(key, "lostpointercapture", release)

  fig.listen(key, "click", function () {
    var next = kcmStep(state, { type: "press" }, hasSearch())
    commit(next)
    if (next.search) openSearch()
  })

  fig.keyScope(function (e) {
    var action = kcmKeyAction(state, e)
    if (!action) return false
    var onRow = e.target && e.target.getAttribute && e.target.getAttribute("role") === "radio"
    // On the last row the chord bubbles on to the page's search listener; the
    // status says so before it opens.
    var next = kcmStep(state, action, hasSearch())
    commit(next)
    if (action.type === "select" && onRow) rows[KCM_ROWS.indexOf(state.row)].focus()
    if (next.blur && document.activeElement && stage.contains(document.activeElement)) {
      document.activeElement.blur()
    }
    return action.consume
  })

  fig.listen(stage, "focusout", function (e) {
    if (e.relatedTarget && stage.contains(e.relatedTarget)) return
    if (state.phase === "waiting") commit(kcmStep(state, { type: "blur" }))
  })

  fig.onReset(function () {
    commit(kcmStep(state, { type: "reset" }))
  })

  fig.onReducedMotionChange(function () {
    if (!fig.reducedMotion()) return
    y.set(y.target)
    scale.set(1)
    run()
  })

  var observer = new ResizeObserver(measure)
  observer.observe(grid)
  fig.onSizeChange(measure)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure)

  fig.model({
    rest: kcmRest,
    step: kcmStep,
    keyAction: kcmKeyAction,
  })

  commit(state)
  measure()

  return {
    destroy: function () {
      alive = false
      observer.disconnect()
    },
  }
}
