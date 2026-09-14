import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import { loadRegistry } from "../index.js"

const WIDGETS_DIR = new URL("../components/widgets/", import.meta.url)
const RUNTIME_DIR = new URL("../components/runtime/", import.meta.url)

function read(dir, name) {
  return readFileSync(new URL(name, dir), "utf8")
}

/* ---------- widget files load without a DOM ---------- */

test("every widget file evaluates in node:vm with a context of { WIDGETS: {} }", () => {
  const files = readdirSync(WIDGETS_DIR).filter((name) => name.endsWith(".js"))
  assert.ok(files.length > 0)
  const registered = new Set()
  for (const file of files) {
    const context = vm.createContext({ WIDGETS: {} })
    assert.doesNotThrow(
      () => vm.runInContext(read(WIDGETS_DIR, file), context, { filename: file }),
      `${file} must not touch the DOM at load`,
    )
    const names = Object.keys(context.WIDGETS)
    assert.ok(names.length > 0, `${file} registers no widget`)
    for (const name of names) {
      assert.equal(typeof context.WIDGETS[name], "function", `${file}: WIDGETS["${name}"]`)
      registered.add(name)
    }
  }
  for (const entry of loadRegistry(undefined, true).values()) {
    if (entry.status === "live")
      assert.ok(registered.has(entry.name), `no widget file registers ${entry.name}`)
  }
})

test("model functions declared in a widget file run in node:vm", () => {
  const motion = vm.runInNewContext(
    read(RUNTIME_DIR, "motion.js") + "\n;({ rubberBand, rubberBandInverse })",
    {},
  )
  const context = vm.createContext({ WIDGETS: {}, ...motion })
  vm.runInContext(read(WIDGETS_DIR, "_fixture.js"), context)
  const band = vm.runInContext("fixtureBand", context)
  const unband = vm.runInContext("fixtureUnband", context)
  const overshoot = vm.runInContext("fixtureOvershoot", context)
  assert.ok(Math.abs(band(335 + 120, 335) - (335 + 55.14)) <= 0.01)
  assert.ok(Math.abs(unband(band(-600, 335), 335) + 600) <= 1e-9)
  assert.ok(Math.abs(overshoot(0.5) - 0.163) <= 5e-4)
  assert.equal(overshoot(1), 0)
})

test("no string in a widget file contains an en or em dash", () => {
  for (const file of readdirSync(WIDGETS_DIR).filter((name) => name.endsWith(".js"))) {
    const text = read(WIDGETS_DIR, file)
    for (const match of text.matchAll(/"[^"\n]*"/g)) {
      assert.ok(!/[–—]/.test(match[0]), `${file}: ${match[0]}`)
    }
  }
})

/* ---------- keyboard slider and press, against a stand-in element ---------- */

function fakeElement() {
  const attrs = new Map()
  const listeners = new Map()
  const classes = new Set()
  return {
    disabled: false,
    setAttribute(key, value) {
      attrs.set(key, String(value))
    },
    getAttribute(key) {
      return attrs.has(key) ? attrs.get(key) : null
    },
    hasAttribute(key) {
      return attrs.has(key)
    },
    removeAttribute(key) {
      attrs.delete(key)
    },
    set tabIndex(value) {
      attrs.set("tabindex", String(value))
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || []
      const at = list.indexOf(fn)
      if (at >= 0) list.splice(at, 1)
    },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    fire(type, init = {}) {
      const event = {
        type,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true
        },
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...init,
      }
      for (const fn of [...(listeners.get(type) || [])]) fn(event)
      return event
    },
  }
}

function loadDrag() {
  const timers = []
  const context = vm.createContext({
    setTimeout: (fn, ms) => timers.push({ fn, ms }) && timers.length,
    clearTimeout: (id) => {
      if (id && timers[id - 1]) timers[id - 1].fn = null
    },
  })
  const api = vm.runInContext(
    read(RUNTIME_DIR, "drag.js") + "\n;({ createKeySlider, createPress })",
    context,
  )
  const flush = () => {
    const pending = timers.filter((t) => t.fn)
    for (const t of pending) {
      const fn = t.fn
      t.fn = null
      fn()
    }
    return pending.map((t) => t.ms)
  }
  return { ...api, flush }
}

function key(el, name, init = {}) {
  const down = el.fire("keydown", { key: name, ...init })
  el.fire("keyup", { key: name, ...init })
  return down
}

test("keySlider: PageUp and PageDown walk the marks, then the bounds", () => {
  const { createKeySlider } = loadDrag()
  const el = fakeElement()
  const slider = createKeySlider(el, {
    min: -100,
    max: 100,
    step: 1,
    value: 0,
    marks: [50, -50, 0],
  })
  const seen = []
  for (const name of ["PageUp", "PageUp", "PageDown", "PageDown", "PageDown", "PageDown"]) {
    key(el, name)
    seen.push(slider.get())
  }
  assert.deepEqual(seen, [50, 100, 50, 0, -50, -100])
  assert.equal(el.getAttribute("role"), "slider")
  assert.equal(el.getAttribute("aria-valuemin"), "-100")
  assert.equal(el.getAttribute("aria-valuemax"), "100")
  assert.equal(el.getAttribute("aria-valuenow"), "-100")

  const bare = fakeElement()
  const plain = createKeySlider(bare, { min: 0, max: 8, step: 1, value: 3 })
  key(bare, "PageUp")
  assert.equal(plain.get(), 8)
  key(bare, "PageDown")
  assert.equal(plain.get(), 0)
})

test("keySlider: step, a caller-defined shiftStep, Home and End, caller-built valuetext", () => {
  const { createKeySlider } = loadDrag()
  const el = fakeElement()
  const slider = createKeySlider(el, {
    min: 0,
    max: 2,
    step: 0.025,
    shiftStep: 0.1,
    value: 1,
    valueText: (v) => `ζ ${v.toFixed(3)}`,
  })
  key(el, "ArrowRight", { shiftKey: true })
  assert.equal(slider.get(), 1.1)
  key(el, "ArrowLeft")
  assert.equal(slider.get(), 1.075)
  key(el, "ArrowUp")
  assert.equal(slider.get(), 1.1)
  assert.equal(el.getAttribute("aria-valuetext"), "ζ 1.100")
  key(el, "End")
  assert.equal(slider.get(), 2)
  key(el, "Home")
  assert.equal(slider.get(), 0)
  const ctrl = el.fire("keydown", { key: "ArrowRight", ctrlKey: true })
  assert.equal(ctrl.defaultPrevented, false)
  assert.equal(slider.get(), 0)
})

test("keySlider: announces after 400 ms of quiet or at keyup after a jump, never on mount", () => {
  const { createKeySlider, flush } = loadDrag()
  const el = fakeElement()
  const said = []
  const inputs = []
  const changes = []
  createKeySlider(el, {
    min: 0,
    max: 10,
    step: 1,
    value: 5,
    valueText: (v) => `${v} units`,
    announce: (text) => said.push(text),
    onInput: (v) => inputs.push(v),
    onChange: (v) => changes.push(v),
  })
  assert.deepEqual(flush(), [])
  assert.deepEqual(said, [])
  key(el, "ArrowRight")
  key(el, "ArrowRight")
  assert.deepEqual(inputs, [6, 7])
  assert.deepEqual(said, [])
  assert.deepEqual(flush(), [400])
  assert.deepEqual(said, ["7 units"])
  assert.deepEqual(changes, [7])
  key(el, "Home")
  assert.deepEqual(said, ["7 units", "0 units"])
  key(el, "Home")
  assert.deepEqual(said, ["7 units", "0 units"], "no change, no announcement")
})

test("keySlider: extraKeys tell Enter, Shift+Enter, Space and Escape apart", () => {
  const { createKeySlider } = loadDrag()
  const el = fakeElement()
  const calls = []
  createKeySlider(el, {
    value: 0,
    extraKeys: {
      Enter: (e, v) => calls.push(["Enter", v]),
      "Shift+Enter": () => calls.push(["Shift+Enter"]),
      Space: () => calls.push(["Space"]),
      Escape: () => calls.push(["Escape"]),
      $: () => calls.push(["$"]),
      k: () => false,
    },
  })
  assert.equal(el.fire("keydown", { key: "Enter" }).defaultPrevented, true)
  el.fire("keydown", { key: "Enter", shiftKey: true })
  el.fire("keydown", { key: " " })
  el.fire("keydown", { key: " ", shiftKey: true })
  el.fire("keydown", { key: "Escape" })
  el.fire("keydown", { key: "$", shiftKey: true })
  assert.equal(el.fire("keydown", { key: "k" }).defaultPrevented, false)
  assert.equal(el.fire("keydown", { key: "Enter", metaKey: true }).defaultPrevented, false)
  assert.deepEqual(calls, [["Enter", 0], ["Shift+Enter"], ["Space"], ["Escape"], ["$"]])
})

test("keySlider: setDisabled ignores keys and leaves the tab order", () => {
  const { createKeySlider } = loadDrag()
  const el = fakeElement()
  const slider = createKeySlider(el, { min: 0, max: 10, step: 1, value: 5 })
  assert.equal(el.getAttribute("tabindex"), "0")
  slider.setDisabled(true)
  assert.equal(el.getAttribute("aria-disabled"), "true")
  assert.equal(el.getAttribute("tabindex"), "-1")
  assert.equal(key(el, "ArrowRight").defaultPrevented, false)
  assert.equal(slider.get(), 5)
  slider.setDisabled(false)
  assert.equal(el.getAttribute("aria-disabled"), null)
  assert.equal(el.getAttribute("tabindex"), "0")
  key(el, "ArrowRight")
  assert.equal(slider.get(), 6)
})

test("press: exactly one activation per gesture for mouse, touch and keyboard", () => {
  const { createPress } = loadDrag()
  const el = fakeElement()
  let count = 0
  createPress(el, () => count++)
  const pointer = (type, init) =>
    el.fire(type, {
      isPrimary: true,
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
      timeStamp: 1000,
      ...init,
    })

  pointer("pointerdown", { pointerType: "mouse" })
  assert.equal(count, 1, "mouse acts on press")
  pointer("pointerup", { pointerType: "mouse" })
  el.fire("click", { detail: 1 })
  assert.equal(count, 1, "the click after a press does not act again")

  el.fire("click", { detail: 0 })
  assert.equal(count, 2, "a keyboard click acts")

  pointer("pointerdown", { pointerType: "pen" })
  assert.equal(count, 3, "pen acts on press")

  pointer("pointerdown", { pointerType: "touch", pointerId: 2 })
  assert.equal(count, 3, "touch waits for release")
  assert.ok(el.classList.contains("is-pressed"))
  pointer("pointerup", {
    pointerType: "touch",
    pointerId: 2,
    clientX: 105,
    clientY: 104,
    timeStamp: 1300,
  })
  assert.equal(count, 4, "a tap within 8px and 500 ms acts")
  assert.ok(!el.classList.contains("is-pressed"))
  el.fire("click", { detail: 1 })
  assert.equal(count, 4)

  pointer("pointerdown", { pointerType: "touch", pointerId: 3 })
  pointer("pointermove", { pointerType: "touch", pointerId: 3, clientY: 110 })
  assert.ok(!el.classList.contains("is-pressed"), "travel clears the press")
  pointer("pointerup", { pointerType: "touch", pointerId: 3, clientY: 110 })
  assert.equal(count, 4)

  pointer("pointerdown", { pointerType: "touch", pointerId: 4 })
  pointer("pointerup", { pointerType: "touch", pointerId: 4, timeStamp: 1600 })
  assert.equal(count, 4, "a long hold does not act")

  pointer("pointerdown", { pointerType: "touch", pointerId: 5 })
  pointer("pointercancel", { pointerType: "touch", pointerId: 5 })
  assert.ok(!el.classList.contains("is-pressed"))
  pointer("pointerup", { pointerType: "touch", pointerId: 5 })
  assert.equal(count, 4, "pointercancel clears")

  el.disabled = true
  pointer("pointerdown", { pointerType: "mouse" })
  el.fire("click", { detail: 0 })
  assert.equal(count, 4, "disabled ignores everything")
})
