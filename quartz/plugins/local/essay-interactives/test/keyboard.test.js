import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"

// Models of the keyboard-shortcut-systems figures, loaded from the widget files
// the way the browser bundle loads them, with no DOM.
const WIDGETS_DIR = new URL("../components/widgets/", import.meta.url)

function load(file, names) {
  const context = vm.createContext({ WIDGETS: {} })
  vm.runInContext(readFileSync(new URL(file, WIDGETS_DIR), "utf8"), context, { filename: file })
  return vm.runInContext(`({ ${names.join(", ")} })`, context)
}

// vm objects come from another realm, so compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value))

function keyEvent(key, mods = {}) {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods }
}

/* ---------- Fig. 1: conflict-map ---------- */

const kcm = load("conflict-map.js", [
  "KCM_ROWS",
  "KCM_TAGS",
  "KCM_CHORDS",
  "KCM_STRINGS",
  "kcmRest",
  "kcmStep",
  "kcmKeyAction",
  "kcmStatusText",
  "kcmSayText",
])

const LANGS = ["en", "zh-Hans"]

function pick(state) {
  return { row: state.row, phase: state.phase, hit: state.hit, status: state.status }
}

test("conflict-map: rests on Slack, idle, nothing hit", () => {
  assert.deepEqual(pick(kcm.kcmRest()), { row: "slack", phase: "idle", hit: "", status: "idle" })
  assert.deepEqual(plain(kcm.KCM_ROWS), ["word", "slack", "vscode", "cursor", "site"])
})

test("conflict-map: a press is taken by the selected app", () => {
  const { kcmRest, kcmStep } = kcm
  for (const row of ["word", "slack", "cursor"]) {
    const selected = kcmStep(kcmRest(), { type: "select", row })
    const pressed = kcmStep(selected, { type: "press" }, true)
    assert.deepEqual(pick(pressed), { row, phase: "idle", hit: row, status: "idle" })
    assert.equal(pressed.say, "press")
    assert.equal(pressed.search, false)
  }
})

test("conflict-map: VS Code waits for the second key until Escape, another key or blur", () => {
  const { kcmRest, kcmStep } = kcm
  const waiting = kcmStep(kcmStep(kcmRest(), { type: "select", row: "vscode" }), {
    type: "press",
  })
  assert.deepEqual(pick(waiting), {
    row: "vscode",
    phase: "waiting",
    hit: "vscode",
    status: "waiting",
  })
  const escaped = kcmStep(waiting, { type: "escape" })
  assert.deepEqual(pick(escaped), { row: "vscode", phase: "idle", hit: "vscode", status: "idle" })
  assert.equal(escaped.say, "idle")
  assert.equal(escaped.blur, false)
  const blurred = kcmStep(escaped, { type: "escape" })
  assert.equal(blurred.blur, true, "Escape while idle gives the keys back")
  assert.equal(kcmStep(waiting, { type: "key" }).phase, "idle")
  assert.equal(kcmStep(waiting, { type: "blur" }).phase, "idle")
  assert.equal(kcmStep(waiting, { type: "blur" }).row, "vscode", "blur keeps the row")
})

test("conflict-map: the last row hands the press to the page's search", () => {
  const { kcmRest, kcmStep } = kcm
  const site = kcmStep(kcmRest(), { type: "select", row: "site" })
  const sent = kcmStep(site, { type: "press" }, true)
  assert.equal(sent.status, "sent")
  assert.equal(sent.search, true)
  assert.equal(sent.hit, "")
  const none = kcmStep(site, { type: "press" }, false)
  assert.equal(none.status, "noSearch")
  assert.equal(none.search, false)
  assert.equal(none.say, "noSearch")
})

test("conflict-map: select and reset clear the press", () => {
  const { kcmRest, kcmStep } = kcm
  const hit = kcmStep(kcmRest(), { type: "press" }, true)
  assert.equal(hit.hit, "slack")
  assert.deepEqual(pick(kcmStep(hit, { type: "select", row: "word" })), {
    row: "word",
    phase: "idle",
    hit: "",
    status: "idle",
  })
  assert.deepEqual(pick(kcmStep(hit, { type: "reset" })), pick(kcmRest()))
})

test("conflict-map: key map consumes Cmd/Ctrl+K except on the last row, and nothing else", () => {
  const { kcmRest, kcmStep, kcmKeyAction } = kcm
  const rest = kcmRest()
  for (const mods of [{ ctrlKey: true }, { metaKey: true }]) {
    assert.deepEqual(plain(kcmKeyAction(rest, keyEvent("k", mods))), {
      type: "press",
      consume: true,
    })
  }
  const site = kcmStep(rest, { type: "select", row: "site" })
  assert.deepEqual(plain(kcmKeyAction(site, keyEvent("k", { metaKey: true }))), {
    type: "press",
    consume: false,
  })
  // Tag search, Alt chords and plain letters go to the page.
  assert.equal(kcmKeyAction(rest, keyEvent("K", { ctrlKey: true, shiftKey: true })), null)
  assert.equal(kcmKeyAction(rest, keyEvent("k", { ctrlKey: true, altKey: true })), null)
  assert.equal(kcmKeyAction(rest, keyEvent("k")), null)
  assert.equal(kcmKeyAction(rest, keyEvent(".", { metaKey: true })), null)
  assert.equal(kcmKeyAction(rest, keyEvent("[", { metaKey: true, altKey: true })), null)
})

test("conflict-map: arrows, Home and End select without wrapping", () => {
  const { kcmRest, kcmStep, kcmKeyAction } = kcm
  const rest = kcmRest()
  assert.deepEqual(plain(kcmKeyAction(rest, keyEvent("ArrowDown"))), {
    type: "select",
    row: "vscode",
    consume: true,
  })
  assert.deepEqual(plain(kcmKeyAction(rest, keyEvent("ArrowUp"))), {
    type: "select",
    row: "word",
    consume: true,
  })
  assert.equal(kcmKeyAction(rest, keyEvent("End")).row, "site")
  const top = kcmStep(rest, { type: "select", row: "word" })
  assert.deepEqual(plain(kcmKeyAction(top, keyEvent("ArrowUp"))), { type: "key", consume: true })
  assert.deepEqual(plain(kcmKeyAction(top, keyEvent("Home"))), { type: "key", consume: true })
  assert.equal(kcmKeyAction(rest, keyEvent("ArrowDown", { metaKey: true })), null)
})

test("conflict-map: while waiting, other keys end the chord but bare modifiers do not", () => {
  const { kcmRest, kcmStep, kcmKeyAction } = kcm
  const waiting = kcmStep(kcmStep(kcmRest(), { type: "select", row: "vscode" }), {
    type: "press",
  })
  assert.deepEqual(plain(kcmKeyAction(waiting, keyEvent("s"))), { type: "key", consume: false })
  assert.deepEqual(plain(kcmKeyAction(waiting, keyEvent("Escape"))), {
    type: "escape",
    consume: true,
  })
  for (const bare of ["Shift", "Control", "Alt", "Meta"]) {
    assert.equal(kcmKeyAction(waiting, keyEvent(bare)), null)
  }
  assert.deepEqual(plain(kcmKeyAction(kcmRest(), keyEvent("Escape"))), {
    type: "escape",
    consume: false,
  })
  assert.equal(kcmKeyAction(kcmRest(), keyEvent("s")), null)
})

test("conflict-map: tags, chords and the essay's hedges", () => {
  assert.deepEqual(plain(kcm.KCM_TAGS), {
    word: ["link"],
    slack: ["jump"],
    vscode: ["chord"],
    cursor: ["chord", "ai"],
    site: [],
  })
  assert.deepEqual(plain(kcm.KCM_CHORDS), {
    word: "Ctrl+K",
    slack: "Cmd/Ctrl+K",
    vscode: "Ctrl+K",
    cursor: "Cmd+K",
    site: "Cmd/Ctrl+K",
  })
  const en = kcm.KCM_STRINGS.en
  const zh = kcm.KCM_STRINGS["zh-Hans"]
  assert.deepEqual(plain(en.tags), {
    link: "link",
    jump: "jump",
    chord: "chord leader",
    ai: "AI prompt",
  })
  assert.deepEqual(plain(zh.tags), { link: "链接", jump: "跳转", chord: "和弦领袖", ai: "AI 入口" })
  assert.match(en.meanings.cursor, /often/)
  assert.match(en.waiting, /cannot also be a standalone command/)
  assert.match(zh.waiting, /第一半键不能再当独立命令/)
  assert.equal(zh.meanings.word, "插入超链接")
  assert.equal(en.meanings.word, "insert hyperlink")
})

function allStrings(value, out = []) {
  if (typeof value === "string") out.push(value)
  else if (value && typeof value === "object") for (const v of Object.values(value)) allStrings(v, out)
  return out
}

test("conflict-map: every row has its strings in both languages; the only numeral is 2014", () => {
  for (const lang of LANGS) {
    const s = kcm.KCM_STRINGS[lang]
    for (const row of kcm.KCM_ROWS) {
      for (const table of ["apps", "meanings", "idle", "press", "keyLabel"]) {
        assert.ok(s[table][row], `${lang} ${table}.${row}`)
      }
      const state = { row, phase: "idle", hit: "", status: "idle", say: "press" }
      assert.equal(kcm.kcmStatusText(state, s), s.idle[row])
      assert.equal(kcm.kcmSayText(state, s), s.press[row])
    }
    for (const text of allStrings(s)) {
      assert.ok(!/[–—]/.test(text), `${lang}: ${text}`)
      for (const number of text.match(/[0-9]+/g) || []) assert.equal(number, "2014", text)
    }
  }
})

/* ---------- Fig. 2: prefix-tree ---------- */

const pt = load("prefix-tree.js", [
  "PT_ROWS",
  "PT_CHIPS",
  "PT_SHARED",
  "PT_STRINGS",
  "ptRest",
  "ptStep",
  "ptEnabled",
  "ptResolveKey",
  "ptTokenNode",
  "ptEdges",
  "ptLitEdges",
  "ptReadoutText",
])

const EN = pt.PT_STRINGS.en
const ZH = pt.PT_STRINGS["zh-Hans"]

function press(state, ...chips) {
  return chips.reduce((s, chip) => pt.ptStep(s, { type: "press", chip }), state)
}

function where(state) {
  return {
    row: state.row,
    node: state.node,
    key: state.key,
    mode: state.mode,
    reached: state.reached,
    token: pt.ptTokenNode(state),
  }
}

const say = (state, s = EN) => pt.ptReadoutText(state.readout, s)

test("prefix-tree: rests on VS Code Ctrl+K, waiting for the second key, in Normal", () => {
  const rest = pt.ptRest()
  assert.deepEqual(where(rest), {
    row: "vscode",
    node: "waiting",
    key: "vscode:ctrl-k",
    mode: "normal",
    reached: "",
    token: "vscode:ctrl-k",
  })
  assert.match(say(rest), /cannot also be a standalone command/)
  assert.match(say(rest, ZH), /第一半键不能再当独立命令/)
  assert.equal(rest.announce, false, "nothing is announced on mount")
  assert.ok(pt.ptEnabled(rest, "vscode:ctrl-s"))
  assert.ok(!pt.ptEnabled(rest, "emacs:c-s"))
})

test("prefix-tree: a sequential chord waits, completes, then returns to the row root", () => {
  const waiting = press(pt.ptRest(), "emacs:c-x")
  assert.deepEqual(where(waiting), {
    row: "emacs-cx",
    node: "waiting",
    key: "emacs:c-x",
    mode: "normal",
    reached: "",
    token: "emacs:c-x",
  })
  assert.equal(waiting.timer, "cancel")
  const done = press(waiting, "emacs:c-s")
  assert.equal(done.node, "command")
  assert.equal(done.reached, "emacs:c-s")
  assert.equal(done.timer, "start")
  assert.equal(say(done), "Sequential chord complete: C-x C-s. The next key starts from the root.")
  assert.deepEqual(plain(pt.ptLitEdges(done)), ["root:emacs-cx>emacs:c-x", "emacs:c-x>emacs:c-s"])
  const back = pt.ptStep(done, { type: "timer" })
  assert.deepEqual(where(back), {
    row: "emacs-cx",
    node: "root",
    key: "",
    mode: "normal",
    reached: "emacs:c-s",
    token: "dot:emacs-cx",
  })
  assert.equal(back.announce, false, "the automatic return is not announced")
  assert.equal(say(back), say(done), "the command text already says where the next key starts")
})

test("prefix-tree: Cmd+S never stops in Waiting", () => {
  const done = press(pt.ptRest(), "cmds:cmd-s")
  assert.deepEqual(where(done), {
    row: "cmds",
    node: "command",
    key: "",
    mode: "normal",
    reached: "cmds:cmd-s",
    token: "cmds:cmd-s",
  })
  assert.deepEqual(plain(pt.ptLitEdges(done)), ["root:cmds>cmds:cmd-s"])
  assert.equal(pt.ptTokenNode(pt.ptStep(done, { type: "timer" })), "dot:cmds")
  assert.match(say(done, ZH), /不经过「等待中」/)
})

test("prefix-tree: vim starts from Normal and returns there", () => {
  const dw = press(pt.ptRest(), "vim:d", "vim:dw")
  assert.equal(dw.reached, "vim:dw")
  assert.equal(say(dw), "dw: operator, then motion. The next key starts from Normal.")
  assert.equal(pt.ptTokenNode(pt.ptStep(dw, { type: "timer" })), "vim:normal")
  const c = press(pt.ptRest(), "vim:c")
  assert.equal(say(c), "c is an operator. It waits for a motion.")
  assert.equal(say(c, ZH), "c 是 operator，在等 motion。")
  assert.equal(press(c, "vim:c-dollar").reached, "vim:c-dollar")
})

test("prefix-tree: Insert disables the operators until Normal returns", () => {
  const insert = press(pt.ptRest(), "vim:insert")
  assert.deepEqual(where(insert), {
    row: "vim",
    node: "root",
    key: "",
    mode: "insert",
    reached: "",
    token: "vim:insert",
  })
  assert.ok(!pt.ptEnabled(insert, "vim:d") && !pt.ptEnabled(insert, "vim:c"))
  const blocked = press(insert, "vim:d")
  assert.equal(blocked.node, "root")
  assert.equal(blocked.announce, false)
  assert.equal(blocked.timer, "keep", "a disabled chip leaves a pending return alone")
  assert.match(say(blocked), /until you return to Normal/)
  assert.match(say(blocked, ZH), /持续到回到 Normal/)
  const normal = press(insert, "vim:normal", "vim:d")
  assert.equal(normal.node, "waiting")
  assert.equal(normal.key, "vim:d")
})

test("prefix-tree: a mode change or Escape ends a walk; Escape at a root gives the keys back", () => {
  const modeEnds = press(pt.ptRest(), "tmux:ctrl-b", "vim:insert")
  assert.deepEqual([modeEnds.node, modeEnds.key, modeEnds.row], ["root", "", "vim"])
  const cancelled = pt.ptStep(press(pt.ptRest(), "emacs:c-x"), { type: "escape" })
  assert.deepEqual([cancelled.node, cancelled.key, cancelled.blur], ["root", "", false])
  assert.equal(say(cancelled), "Cancelled. Back at the root.")
  assert.equal(pt.ptTokenNode(cancelled), "dot:emacs-cx")
  const vim = pt.ptStep(press(pt.ptRest(), "vim:d"), { type: "escape" })
  assert.equal(say(vim, ZH), "已取消，回到 Normal。")
  assert.equal(pt.ptStep(cancelled, { type: "escape" }).blur, true)
})

test("prefix-tree: a child pressed out of order names its parent", () => {
  const rest = pt.ptRest()
  const stray = press(rest, "emacs:c-s")
  assert.deepEqual(where(stray), where(rest))
  assert.equal(say(stray), "C-s follows C-x. Press C-x first.")
  assert.equal(say(press(rest, "tmux:key"), ZH), "键 接在 Ctrl-b 之后，请先按 Ctrl-b。")
})

test("prefix-tree: physical chords resolve children first, and pass everything else through", () => {
  const rest = pt.ptRest()
  const ctrl = (key) => keyEvent(key, { ctrlKey: true })
  assert.equal(pt.ptResolveKey(rest, ctrl("s")), "vscode:ctrl-s")
  assert.equal(pt.ptResolveKey(rest, ctrl("b")), "tmux:ctrl-b")
  const prefix = press(rest, "tmux:ctrl-b")
  assert.equal(pt.ptResolveKey(prefix, ctrl("b")), "tmux:literal")
  assert.match(say(press(prefix, "tmux:literal")), /literal Ctrl-b/)
  assert.equal(pt.ptResolveKey(prefix, ctrl("s")), "", "Ctrl+S only follows a waiting prefix")
  assert.equal(pt.ptResolveKey(rest, ctrl("x")), "emacs:c-x")
  assert.equal(pt.ptResolveKey(rest, keyEvent("s", { metaKey: true })), "cmds:cmd-s")
  for (const mods of [{ ctrlKey: true }, { metaKey: true }]) {
    assert.equal(pt.ptResolveKey(rest, keyEvent("P", { ...mods, shiftKey: true })), "palette:open")
  }
  assert.equal(pt.ptResolveKey(rest, keyEvent("d")), "vim:d")
  assert.equal(pt.ptResolveKey(press(rest, "vim:c"), keyEvent("$", { shiftKey: true })), "vim:c-dollar")
  // Site search, tag search, roob-ui's Mod shortcuts and Alt chords reach the page.
  for (const event of [
    keyEvent("k", { metaKey: true }),
    keyEvent("K", { ctrlKey: true, shiftKey: true }),
    keyEvent(".", { metaKey: true }),
    keyEvent("[", { metaKey: true, altKey: true }),
    keyEvent("x", { ctrlKey: true, altKey: true }),
    keyEvent("w"),
    keyEvent("D", { shiftKey: true }),
  ]) {
    assert.equal(pt.ptResolveKey(rest, event), "", JSON.stringify(event))
  }
})

test("prefix-tree: reset restores the resting state from anywhere", () => {
  const moved = press(pt.ptRest(), "vim:insert", "palette:open")
  assert.deepEqual(where(pt.ptStep(moved, { type: "reset" })), where(pt.ptRest()))
})

test("prefix-tree: every edge joins a root to a first key or a first key to its child", () => {
  const edges = plain(pt.ptEdges())
  // Eight first keys hang off their row roots, and eight children off first keys.
  assert.equal(edges.length, 16)
  assert.ok(edges.includes("root:cmds>cmds:cmd-s"))
  assert.ok(edges.includes("root:vim>vim:c"))
  assert.ok(edges.includes("tmux:ctrl-b>tmux:literal"))
  assert.equal(new Set(edges).size, edges.length)
})

test("prefix-tree: every readout exists in both languages, with no numerals or dashes", () => {
  const chips = Object.keys(pt.PT_CHIPS)
  const texts = [...allStrings(pt.PT_SHARED), ...chips.map((id) => pt.PT_CHIPS[id].text || "")]
  for (const s of [EN, ZH]) {
    for (const id of chips) {
      const chip = pt.PT_CHIPS[id]
      const kind = chip.mode ? "mode" : chip.kids ? "waiting" : "command"
      const text = pt.ptReadoutText([kind, chip.mode || id], s)
      assert.ok(text && !text.includes("undefined") && !text.includes("{"), `${id}: ${text}`)
      if (chip.parent) texts.push(pt.ptReadoutText(["order", id, chip.parent], s))
      texts.push(text)
    }
    texts.push(...allStrings(s), pt.ptReadoutText(["blocked", "vim:d"], s))
  }
  for (const text of texts) {
    assert.ok(!/[–—]/.test(text), text)
    // The product name i3 is the only digit the figure prints.
    assert.ok(!/[0-9]/.test(text.replace(/\bi3\b/g, "")), text)
  }
})

test("keyboard figures: widget files stay within 25 KB", () => {
  for (const file of ["conflict-map.js", "prefix-tree.js"]) {
    const bytes = readFileSync(new URL(file, WIDGETS_DIR)).length
    assert.ok(bytes <= 25000, `${file} is ${bytes} bytes`)
  }
})
