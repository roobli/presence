/* prefix-tree: Fig. 2 of keyboard-shortcut-systems, in place of its third Mermaid
 * chart. The token (the one accent) marks the current node. No DOM at load. */

var PT_ROWS = ["cmds", "vscode", "emacs-cx", "emacs-mx", "tmux", "vim", "palette", "i3"]

// Row and DOM order. kids/parent link a first key and its children; mode: a vim
// mode chip; normal: Normal only. key: the physical chord [modifier, key] (pal:
// Ctrl or Cmd with Shift; char: Shift allowed). word: a dashed, unnamed chip.
var PT_CHIPS = {
  "cmds:cmd-s": { row: "cmds", text: "Cmd+S", key: ["meta", "s"] },
  "vscode:ctrl-k": { row: "vscode", text: "Ctrl+K", key: ["ctrl", "k"], kids: ["vscode:ctrl-s"] },
  "vscode:ctrl-s": { row: "vscode", text: "Ctrl+S", key: ["ctrl", "s"], parent: "vscode:ctrl-k" },
  "emacs:c-x": { row: "emacs-cx", text: "C-x", key: ["ctrl", "x"], kids: ["emacs:c-s"] },
  "emacs:c-s": { row: "emacs-cx", text: "C-s", key: ["ctrl", "s"], parent: "emacs:c-x" },
  "emacs:m-x": { row: "emacs-mx", text: "M-x", kids: ["emacs:name"] },
  "emacs:name": { row: "emacs-mx", word: "name", parent: "emacs:m-x" },
  "tmux:ctrl-b": { row: "tmux", text: "Ctrl-b", key: ["ctrl", "b"], kids: ["tmux:key", "tmux:literal"] },
  "tmux:key": { row: "tmux", word: "key", parent: "tmux:ctrl-b" },
  "tmux:literal": { row: "tmux", text: "Ctrl-b", key: ["ctrl", "b"], parent: "tmux:ctrl-b" },
  "vim:normal": { row: "vim", text: "Normal", mode: "normal" },
  "vim:insert": { row: "vim", text: "Insert", mode: "insert" },
  "vim:d": { row: "vim", text: "d", key: ["plain", "d"], kids: ["vim:dw"], normal: 1 },
  "vim:c": { row: "vim", text: "c", key: ["plain", "c"], kids: ["vim:c-dollar"], normal: 1 },
  "vim:dw": { row: "vim", text: "w", key: ["plain", "w"], parent: "vim:d" },
  "vim:c-dollar": { row: "vim", text: "$", key: ["char", "$"], parent: "vim:c" },
  "palette:open": { row: "palette", text: "Ctrl/Cmd+Shift+P", key: ["pal", "p"], kids: ["palette:name"] },
  "palette:name": { row: "palette", word: "name", parent: "palette:open" },
}

// Row and leaf labels both languages share.
var PT_SHARED = {
  vscode: "VS Code",
  "emacs-cx": "Emacs C-x / C-c / M-x",
  tmux: "tmux prefix",
  palette: "Command Palette / Cmd+K",
  "cmds:cmd-s": "Cmd+S",
  "vscode:ctrl-s": "Ctrl+K Ctrl+S",
  "emacs:c-s": "C-x C-s",
  "vim:dw": "dw",
  "vim:c-dollar": "c$",
}

var PT_STRINGS = {
  en: {
    columns: { root: "Namespace root", waiting: "Waiting", command: "Command" },
    labels: {
      cmds: "Simultaneous chord",
      vim: "vim modes + operators",
      i3: "i3 $mod / modes",
      "emacs:name": "a command, by name",
      "tmux:key": "a command",
      "tmux:literal": "literal Ctrl-b",
      "palette:name": "a command, by name",
    },
    patterns: {
      vscode: "Sequential chord",
      "emacs-cx": "Sequential chord",
      "emacs-mx": "by name",
      tmux: "Prefix mode",
      vim: "Modal state",
      palette: "palette text box",
    },
    i3: "$mod + letter; binding modes swap temporary maps",
    chips: { name: "name", key: "key" },
    waiting: {
      "vscode:ctrl-k":
        "Ctrl+K waits for the second key. The first half cannot also be a standalone command.",
      "emacs:c-x": "C-x occupies binding space and waits for the second key.",
      "emacs:m-x": "M-x waits for a command name.",
      "tmux:ctrl-b": "Ctrl-b is the leader. The next key is the command.",
      "palette:open": "The palette text box waits for a name.",
    },
    operator: "{key} is an operator. It waits for a motion.",
    command: {
      "cmds:cmd-s": "Simultaneous chord: Cmd+S, with no stop in Waiting.",
      "vscode:ctrl-s": "Sequential chord complete: Ctrl+K Ctrl+S.",
      "emacs:c-s": "Sequential chord complete: C-x C-s.",
      "emacs:name": "M-x, then a name: a command invoked by name.",
      "tmux:key": "Prefix, then a command key.",
      "tmux:literal": "Double prefix: a literal Ctrl-b is sent.",
      "vim:dw": "dw: operator, then motion.",
      "vim:c-dollar": "c$: operator, then motion.",
      "palette:name": "Palette, then a name: you remember the name, not the location.",
    },
    fromRoot: " The next key starts from the root.",
    fromNormal: " The next key starts from Normal.",
    mode: {
      normal: "Normal: d and c start operator + motion.",
      insert: "Insert: this state lasts until you return to Normal.",
    },
    blocked: "{key} is an operator in Normal. You are in Insert, until you return to Normal.",
    order: "{child} follows {parent}. Press {parent} first.",
    cancel: "Cancelled. Back at the root.",
    cancelVim: "Cancelled. Back at Normal.",
    hint: "Keys go to this figure. Esc gives them back.",
  },
  "zh-Hans": {
    columns: { root: "命名空间根", waiting: "等待中", command: "命令" },
    labels: {
      cmds: "同时和弦",
      vim: "vim 模式 + operator",
      i3: "i3 $mod / mode",
      "emacs:name": "按名字调用的命令",
      "tmux:key": "命令",
      "tmux:literal": "字面 Ctrl-b",
      "palette:name": "按名字调用的命令",
    },
    patterns: {
      vscode: "顺序和弦",
      "emacs-cx": "顺序和弦",
      "emacs-mx": "按名字调用",
      tmux: "前缀模式",
      vim: "模态状态",
      palette: "命令面板输入框",
    },
    i3: "$mod + 字母；binding modes 临时换一张键表",
    chips: { name: "名字", key: "键" },
    waiting: {
      "vscode:ctrl-k": "Ctrl+K 在等第二键：第一半键不能再当独立命令。",
      "emacs:c-x": "C-x 占用绑定空间，等第二键。",
      "emacs:m-x": "M-x 在等命令名。",
      "tmux:ctrl-b": "Ctrl-b 是 leader，下一键才是命令。",
      "palette:open": "命令面板输入框在等名字。",
    },
    operator: "{key} 是 operator，在等 motion。",
    command: {
      "cmds:cmd-s": "同时和弦：Cmd+S，不经过「等待中」。",
      "vscode:ctrl-s": "顺序和弦完成：Ctrl+K Ctrl+S。",
      "emacs:c-s": "顺序和弦完成：C-x C-s。",
      "emacs:name": "M-x 再输入名字：用名字调用命令。",
      "tmux:key": "先 prefix，再按命令键。",
      "tmux:literal": "连按两次 prefix：送出字面 Ctrl-b。",
      "vim:dw": "dw：operator 再 motion。",
      "vim:c-dollar": "c$：operator 再 motion。",
      "palette:name": "面板再输入名字：记得名字，不记得位置。",
    },
    fromRoot: "下一键从根开始。",
    fromNormal: "下一键从 Normal 开始。",
    mode: { normal: "Normal：d、c 开始 operator + motion。", insert: "Insert：状态持续到回到 Normal。" },
    blocked: "{key} 是 Normal 下的 operator，现在处于 Insert，状态持续到回到 Normal。",
    order: "{child} 接在 {parent} 之后，请先按 {parent}。",
    cancel: "已取消，回到根。",
    cancelVim: "已取消，回到 Normal。",
    hint: "按键现在交给本图，按 Esc 交还。",
  },
}

/* ---------- model (pure; also registered through fig.model) ---------- */

function ptFirsts() {
  return Object.keys(PT_CHIPS).filter(function (id) {
    return !PT_CHIPS[id].parent && !PT_CHIPS[id].mode
  })
}

// node: root, waiting or command; key: the walk's first key; reached: the last
// leaf; readout: [kind, id, parent]; effects: announce, timer, blur.
function ptRest() {
  return {
    row: "vscode",
    node: "waiting",
    key: "vscode:ctrl-k",
    mode: "normal",
    reached: "",
    readout: ["waiting", "vscode:ctrl-k"],
    announce: false,
    timer: "cancel",
    blur: false,
  }
}

function ptEnabled(state, id) {
  var chip = PT_CHIPS[id]
  if (!chip || chip.mode) return !!chip
  if (!chip.parent) return !(chip.normal && state.mode === "insert")
  return state.node === "waiting" && state.key === chip.parent
}

function ptKeyMatches(spec, e) {
  if (!spec || e.altKey) return false
  var key = e.key || ""
  var mod = spec[0]
  if (mod === "plain") return key === spec[1] && !e.ctrlKey && !e.metaKey && !e.shiftKey
  if (mod === "char") return key === spec[1] && !e.ctrlKey && !e.metaKey
  if (key.toLowerCase() !== spec[1]) return false
  if (mod === "ctrl") return e.ctrlKey && !e.metaKey && !e.shiftKey
  if (mod === "meta") return e.metaKey && !e.ctrlKey && !e.shiftKey
  return (e.ctrlKey || e.metaKey) && e.shiftKey
}

// A child of the waiting key, then any first key, else "" (the page's key).
function ptResolveKey(state, e) {
  var kids = state.node === "waiting" && state.key ? PT_CHIPS[state.key].kids : []
  var list = kids.concat(ptFirsts())
  for (var i = 0; i < list.length; i++) if (ptKeyMatches(PT_CHIPS[list[i]].key, e)) return list[i]
  return ""
}

// press, escape, timer, reset. A disabled chip only explains itself.
function ptStep(state, action) {
  if (action.type === "reset") return ptRest()
  var next = {}
  for (var k in state) next[k] = state[k]
  next.announce = next.blur = false
  next.timer = "keep"
  var id = action.chip
  var chip = PT_CHIPS[id]
  if (action.type === "timer") {
    if (state.node === "command") {
      next.node = "root"
      next.key = ""
    }
  } else if (action.type === "escape") {
    next.blur = state.node !== "waiting"
    if (!next.blur) {
      next.node = "root"
      next.key = ""
      next.readout = ["cancel", state.row]
      next.announce = true
      next.timer = "cancel"
    }
  } else if (chip && !ptEnabled(state, id)) {
    next.readout = chip.parent ? ["order", id, chip.parent] : ["blocked", id]
  } else if (chip) {
    next.announce = true
    next.timer = chip.mode || chip.kids ? "cancel" : "start"
    next.row = chip.row
    next.mode = chip.mode || state.mode
    // A mode change ends any walk; a child or Cmd+S goes straight to a command.
    next.node = chip.mode ? "root" : chip.kids ? "waiting" : "command"
    next.key = chip.mode ? "" : chip.kids ? id : chip.parent || ""
    next.reached = chip.mode ? state.reached : chip.kids ? "" : id
    next.readout = chip.mode ? ["mode", chip.mode] : [next.node, id]
  }
  return next
}

// The waiting key, the reached leaf, or the row's root (vim: the mode chip).
function ptTokenNode(state) {
  if (state.node === "waiting") return state.key
  if (state.node === "command") return state.reached
  return state.row === "vim" ? "vim:" + state.mode : "dot:" + state.row
}

// "root:ROW>FIRST" and "FIRST>CHILD".
function ptEdges() {
  var out = []
  ptFirsts().forEach(function (id) {
    out.push("root:" + PT_CHIPS[id].row + ">" + id)
    ;(PT_CHIPS[id].kids || []).forEach(function (kid) {
      out.push(id + ">" + kid)
    })
  })
  return out
}

function ptLitEdges(state) {
  var id = state.node === "waiting" ? state.key : state.node === "command" ? state.reached : ""
  var chip = PT_CHIPS[id]
  if (!chip) return []
  var first = chip.parent || id
  var out = ["root:" + chip.row + ">" + first]
  if (chip.parent) out.push(first + ">" + id)
  return out
}

function ptChipText(id, s) {
  var chip = PT_CHIPS[id]
  return chip.word ? s.chips[chip.word] : chip.text
}

function ptReadoutText(readout, s) {
  var kind = readout[0]
  var id = readout[1]
  if (kind === "mode") return s.mode[id]
  if (kind === "cancel") return id === "vim" ? s.cancelVim : s.cancel
  var text = ptChipText(id, s)
  if (kind === "waiting") return (s.waiting[id] || s.operator).replace("{key}", text)
  if (kind === "command") return s.command[id] + (PT_CHIPS[id].row === "vim" ? s.fromNormal : s.fromRoot)
  if (kind === "blocked") return s.blocked.replace("{key}", text)
  return s.order.replace("{child}", text).replace(/\{parent\}/g, ptChipText(readout[2], s))
}

// Crisp 1px strokes sit on half pixels.
function ptHalf(v) {
  return Math.round(v) + 0.5
}

// Right of box a to left of box b, with an elbow at x when not level.
function ptEdgePath(a, b, elbow) {
  var y1 = ptHalf(a.y + a.h / 2)
  var y2 = ptHalf(b.y + b.h / 2)
  var turn = Math.abs(y1 - y2) < 1 ? "" : ptHalf(elbow) + "V" + y2 + "H"
  return "M" + Math.round(a.x + a.w) + " " + y1 + "H" + turn + Math.round(b.x)
}

// Token rect [x, y, w, h, rx]: a chip grown 3px a side, or a 20px ring on a dot.
function ptTokenBox(id, b, out) {
  var dot = id.indexOf("dot:") === 0
  out[2] = dot ? 20 : b.w + 6
  out[3] = dot ? 20 : b.h + 6
  out[0] = b.x + (b.w - out[2]) / 2
  out[1] = b.y + (b.h - out[3]) / 2
  out[4] = dot ? 10 : 8
  return out
}

function ptEl(tag, cls, text, parent) {
  var node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return parent ? parent.appendChild(node) : node
}

function ptSvg(tag, cls, parent) {
  var node = document.createElementNS("http://www.w3.org/2000/svg", tag)
  node.setAttribute("class", cls)
  return parent.appendChild(node)
}

/* ---------- widget ---------- */

WIDGETS["prefix-tree"] = function (fig) {
  var s = fig.strings(PT_STRINGS)
  var root = fig.root
  var idBase = (root.id || "fig-" + fig.n) + "-pt-"
  var state = ptRest()
  var alive = true
  var measured = false
  var placed = false
  var timer = 0
  var chips = {}
  var leaves = {}
  var boxes = {}
  var dots = {}
  var rowChips = {}
  var modes = null
  var press = {}
  var id

  PT_ROWS.forEach(function (row) {
    rowChips[row] = []
  })
  for (id in PT_CHIPS) rowChips[PT_CHIPS[id].row].push(id)

  var wrap = ptEl("div", "pt")
  ptEl("p", "pt__hint", s.hint, wrap).setAttribute("aria-hidden", "true")
  var head = ptEl("div", "pt__head", null, wrap)
  var cols = ["label", "root", "waiting", "command"].map(function (name) {
    return ptEl("span", "pt__col pt__col--" + name, s.columns[name], head)
  })
  var body = ptEl("div", "pt__body", null, wrap)
  var overlay = ptSvg("svg", "pt__overlay", body)
  overlay.setAttribute("aria-hidden", "true")
  var spine = ptSvg("line", "pt__spine", overlay)
  var edgeGroup = ptSvg("g", "pt__edges", overlay)
  var token = ptSvg("rect", "pt__token", overlay)
  var edges = ptEdges().map(function (edge) {
    var cut = edge.indexOf(">")
    return { id: edge, from: edge.slice(0, cut), to: edge.slice(cut + 1), el: ptSvg("path", "pt__edge", edgeGroup) }
  })

  function addChip(chipId, parent) {
    var c = PT_CHIPS[chipId]
    var kind = c.mode ? " pt__chip--mode" : c.word ? " pt__chip--unnamed" : ""
    var node = (chips[chipId] = ptEl("button", "pt__chip" + kind, null, parent))
    node.type = "button"
    node.setAttribute("data-chip", chipId)
    if (!c.mode) node.setAttribute("data-kind", c.parent ? "child" : "first")
    if (c.parent) node.setAttribute("data-parent", c.parent)
    // The palette chord may wrap before +Shift, never inside a half.
    ;(c.text || ptChipText(chipId, s)).split(/(?=\+Shift)/).forEach(function (part) {
      ptEl("span", "", part, node)
    })
  }

  PT_ROWS.forEach(function (rowId) {
    var row = ptEl("div", "pt__row", null, body)
    row.setAttribute("data-row", rowId)
    row.setAttribute("role", "group")
    var label = ptEl("div", "pt__label" + (rowId.indexOf("emacs") ? "" : " pt__label--group"), null, row)
    var name = ptEl("span", "pt__system", s.labels[rowId] || PT_SHARED[rowId] || "", label)
    var pattern = ptEl("span", "pt__pattern", s.patterns[rowId] || "", label)
    name.id = idBase + rowId
    pattern.id = name.id + "-pattern"
    // The second Emacs row continues the group the first one names.
    row.setAttribute("aria-labelledby", (rowId === "emacs-mx" ? idBase + "emacs-cx" : name.id) + " " + pattern.id)
    var cell = ptEl("div", "pt__root", null, row)
    if (rowId === "vim") modes = ptEl("div", "pt__modes", null, cell)
    else (dots[rowId] = ptEl("span", "pt__dot", null, cell)).setAttribute("aria-hidden", "true")
    if (rowId === "i3") return ptEl("div", "pt__note", s.i3, row)
    var waiting = ptEl("div", "pt__waiting", null, row)
    var command = ptEl("div", "pt__command", null, row)
    rowChips[rowId].forEach(function (chipId) {
      var c = PT_CHIPS[chipId]
      if (c.mode || c.kids) return addChip(chipId, c.mode ? modes : waiting)
      var leaf = (leaves[chipId] = ptEl("div", "pt__leaf", null, command))
      addChip(chipId, leaf)
      ptEl("span", "pt__leaf-label", s.labels[chipId] || PT_SHARED[chipId], leaf)
    })
  })

  var readout = ptEl("p", "pt__readout", null, wrap)
  readout.setAttribute("aria-hidden", "true")
  fig.box.appendChild(wrap)

  /* ---------- token ---------- */

  var springs = ["x", "y", "width", "height"].map(function (name) {
    var spring = fig.spring({ response: 0.35, dampingRatio: 1, restDelta: 0.5, restSpeed: 5 })
    spring.attr = token[name].baseVal
    return spring
  })
  var goal = [0, 0, 0, 0, 8]

  function paint() {
    for (var i = 0; i < 4; i++) springs[i].attr.value = Math.max(i < 2 ? -1e4 : 0, springs[i].value)
  }

  var loop = fig.loop(function (dt) {
    var moving = false
    for (var i = 0; i < 4; i++) if (springs[i].step(dt)) moving = true
    paint()
    return moving
  })

  function run() {
    for (var i = 0; i < 4; i++) if (!springs[i].resting) return loop.start()
    loop.stop()
    paint()
  }

  // Retarget from the presentation value, or jump when a measure moved the target.
  function aim(animate) {
    var node = ptTokenNode(state)
    if (!boxes[node]) return
    ptTokenBox(node, boxes[node], goal)
    token.setAttribute("rx", String(goal[4]))
    var jump = !placed
    for (var i = 0; i < 4; i++) {
      if (animate) springs[i].retarget(goal[i])
      else if (Math.abs(springs[i].target - goal[i]) > 0.01) jump = true
    }
    if (!animate && jump) for (i = 0; i < 4; i++) springs[i].set(goal[i])
    placed = true
    run()
  }

  // Boxes relative to the body, on resize, size change and font load only.
  function measure() {
    var frame = body.getBoundingClientRect()
    if (!alive || !(frame.width > 0)) return
    function rel(key, el) {
      var r = el.getBoundingClientRect()
      var b = boxes[key] || (boxes[key] = {})
      b.x = r.left - frame.left
      b.y = r.top - frame.top
      b.w = r.width
      b.h = r.height
      return b
    }
    for (var key in chips) rel(key, chips[key])
    for (key in dots) rel("dot:" + key, dots[key])
    rel("root:vim", modes)
    var c = cols.map(function (el) {
      return el.getBoundingClientRect()
    })
    var elbows = [(c[1].right + c[2].left) / 2 - frame.left, (c[2].right + c[3].left) / 2 - frame.left]
    var size = [frame.width, frame.height].map(function (v) {
      return Math.round(v * 100) / 100
    })
    overlay.setAttribute("viewBox", "0 0 " + size.join(" "))
    overlay.setAttribute("width", size[0])
    overlay.setAttribute("height", size[1])
    var top = boxes["dot:cmds"]
    var end = boxes["dot:i3"]
    spine.setAttribute("x1", ptHalf(top.x + top.w / 2))
    spine.setAttribute("x2", ptHalf(top.x + top.w / 2))
    spine.setAttribute("y2", Math.round(end.y + end.h / 2))
    edges.forEach(function (edge) {
      var from = boxes[edge.from] || boxes["dot:" + edge.from.slice(5)]
      edge.el.setAttribute("d", ptEdgePath(from, boxes[edge.to], elbows[edge.from.indexOf("root:") ? 1 : 0]))
    })
    measured = true
    aim(false)
  }

  /* ---------- state ---------- */

  function render() {
    ;["row", "node", "key", "mode", "reached"].forEach(function (name) {
      root.setAttribute("data-" + name, state[name])
    })
    for (var chipId in chips) {
      var node = chips[chipId]
      var mode = PT_CHIPS[chipId].mode
      var on = ptEnabled(state, chipId)
      if (mode) node.setAttribute("aria-pressed", String(mode === state.mode))
      else if (on) node.removeAttribute("aria-disabled")
      else node.setAttribute("aria-disabled", "true")
      node.tabIndex = on ? 0 : -1
    }
    for (chipId in leaves) leaves[chipId].classList.toggle("is-reached", chipId === state.reached)
    var lit = ptLitEdges(state)
    edges.forEach(function (edge) {
      var isLit = lit.indexOf(edge.id) >= 0
      edge.el.classList.toggle("is-lit", isLit)
      // Lit edges draw last, over unlit edges that share a segment.
      if (isLit) edgeGroup.appendChild(edge.el)
    })
    readout.textContent = ptReadoutText(state.readout, s)
    if (measured) aim(true)
  }

  function commit(next) {
    if (next.timer !== "keep") clearTimeout(timer)
    if (next.timer === "start") {
      timer = setTimeout(function () {
        if (alive) commit(ptStep(state, { type: "timer" }))
      }, 400)
    }
    state = next
    render()
    if (next.announce) fig.announce(ptReadoutText(next.readout, s))
  }

  function activate(chipId, byKeyboard) {
    var next = ptStep(state, { type: "press", chip: chipId })
    commit(next)
    // From the keyboard, a first key hands focus to its first child.
    var kids = PT_CHIPS[chipId].kids
    if (byKeyboard && kids && next.key === chipId) chips[kids[0]].focus()
  }

  /* ---------- input ---------- */

  // fig.press rules, delegated from the body, except that a press on an
  // aria-disabled chip still reaches the model so the readout can explain it.
  function chipOf(target) {
    var node = target && target.closest ? target.closest(".pt__chip") : null
    return node && body.contains(node) ? node : null
  }

  function unpress() {
    if (press.el) press.el.classList.remove("is-pressed")
    press = {}
  }

  function strayed(e) {
    return Math.pow(e.clientX - press.x, 2) + Math.pow(e.clientY - press.y, 2) > 64
  }

  fig.listen(body, "pointerdown", function (e) {
    var node = chipOf(e.target)
    var touch = e.pointerType === "touch"
    if (!node || !e.isPrimary || (!touch && e.button !== 0)) return
    unpress()
    press = { el: node, id: e.pointerId, touch: touch, x: e.clientX, y: e.clientY, t: e.timeStamp }
    if (node.getAttribute("aria-disabled") !== "true") node.classList.add("is-pressed")
    if (!touch) activate(node.getAttribute("data-chip"), false)
  })

  fig.listen(body, "pointermove", function (e) {
    if (press.touch && e.pointerId === press.id && strayed(e)) unpress()
  })

  function release(e) {
    if (e.pointerId !== press.id) return
    var tap = e.type === "pointerup" && press.touch && !strayed(e) && e.timeStamp - press.t <= 500
    var chipId = press.el.getAttribute("data-chip")
    unpress()
    if (tap) activate(chipId, false)
  }

  fig.listen(window, "pointerup", release, true)
  fig.listen(window, "pointercancel", release, true)

  fig.listen(body, "click", function (e) {
    var node = e.detail === 0 && chipOf(e.target)
    if (node) activate(node.getAttribute("data-chip"), true)
  })

  function firstEnabled(list, from, step) {
    for (var i = from; list && i >= 0 && i < list.length; i += step) {
      if (ptEnabled(state, list[i])) return list[i]
    }
    return ""
  }

  // Up/Down: next row's first enabled chip. Left/Right: along the row. Home/End.
  function moveFocus(key, target) {
    var node = chipOf(target)
    var rowId = node ? PT_CHIPS[node.getAttribute("data-chip")].row : state.row
    var list = rowChips[rowId]
    var step = /Right|Down|End/.test(key) ? 1 : -1
    var dest = /Home|End/.test(key)
      ? firstEnabled(rowChips[step > 0 ? "palette" : "cmds"], 0, 1)
      : /Up|Down/.test(key)
        ? firstEnabled(rowChips[PT_ROWS[PT_ROWS.indexOf(rowId) + step]], 0, 1)
        : firstEnabled(list, (node ? list.indexOf(node.getAttribute("data-chip")) : -1) + step, step)
    if (dest) chips[dest].focus()
  }

  fig.keyScope(function (e) {
    if (e.key === "Escape") {
      var next = ptStep(state, { type: "escape" })
      if (!next.blur) commit(next)
      else if (fig.stage.contains(document.activeElement)) document.activeElement.blur()
      return !next.blur
    }
    if (/^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      moveFocus(e.key, e.target)
      return true
    }
    var chipId = ptResolveKey(state, e)
    if (chipId) activate(chipId, false)
    return !!chipId
  })

  fig.onReset(function () {
    commit(ptStep(state, { type: "reset" }))
  })

  fig.onReducedMotionChange(function () {
    if (!fig.reducedMotion()) return
    for (var i = 0; i < 4; i++) springs[i].set(springs[i].target)
    run()
  })

  var observer = new ResizeObserver(measure)
  observer.observe(body)
  fig.onSizeChange(measure)
  if (document.fonts) document.fonts.ready.then(measure)

  fig.model({ rest: ptRest, step: ptStep, resolveKey: ptResolveKey, enabled: ptEnabled, tokenNode: ptTokenNode })

  render()
  measure()

  return {
    destroy: function () {
      alive = false
      clearTimeout(timer)
      observer.disconnect()
    },
  }
}
