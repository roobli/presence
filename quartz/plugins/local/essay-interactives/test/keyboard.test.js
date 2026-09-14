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
