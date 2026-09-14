import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import vm from "vm"

const clientDir = new URL("./client/", import.meta.url)

// The modules share one scope in the browser; the same order here.
const MODULES = [
  "helpers.js",
  "locale.js",
  "motion.js",
  "mobile.js",
  "drawer.js",
  "outline-sheet.js",
  "progress.js",
]

function loadModules() {
  const noop = () => {}
  const query = { matches: false, addEventListener: noop, removeEventListener: noop }
  const context = vm.createContext({
    window: {
      matchMedia: () => query,
      addEventListener: noop,
      removeEventListener: noop,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: noop,
      setTimeout,
    },
    document: { addEventListener: noop, body: { lang: "en" } },
  })
  for (const name of MODULES) {
    vm.runInContext(fs.readFileSync(new URL(name, clientDir), "utf8"), context)
  }
  return context
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe("roob-ui drawer", () => {
  const m = loadModules()
  const width = 322

  test("a still release changes state past a quarter of the travel", () => {
    // Dragged from open: 100px of a 322px drawer closes it, 60px does not.
    assert.strictEqual(m.drawerRestingX(-100, 0, width, 0), -width)
    assert.strictEqual(m.drawerRestingX(-60, 0, width, 0), 0)
    // Dragged from closed: the same rule toward open.
    assert.strictEqual(m.drawerRestingX(-150, 0, width, -width), 0)
    assert.strictEqual(m.drawerRestingX(-280, 0, width, -width), -width)
  })

  test("release speed is projected before choosing", () => {
    assert.strictEqual(m.drawerRestingX(-30, -300, width, 0), -width)
    assert.strictEqual(m.drawerRestingX(-250, 600, width, 0), 0)
    assert.strictEqual(m.drawerRestingX(-300, 400, width, -width), 0)
  })

  test("drag tracks 1:1 inside the range and rubber-bands past open", () => {
    assert.strictEqual(m.drawerDragX(-100, width), -100)
    assert.strictEqual(m.drawerDragX(-500, width), -width)
    const over = m.drawerDragX(60, width)
    assert.ok(near(over, (60 * width * 0.55) / (width + 0.55 * 60)))
    assert.ok(over > 0 && over < 60)
  })
})

describe("roob-ui outline sheet", () => {
  const m = loadModules()
  const vh = 800

  test("settles at the detent nearest the projected height", () => {
    assert.strictEqual(m.sheetRestingHeight(700, 0, vh), 720)
    assert.strictEqual(m.sheetRestingHeight(500, 0, vh), 400)
    assert.strictEqual(m.sheetRestingHeight(250, 0, vh), 400)
    assert.strictEqual(m.sheetRestingHeight(400, 800, vh), 720)
  })

  test("closes when the projected height is under a quarter", () => {
    assert.strictEqual(m.sheetRestingHeight(190, 0, vh), 0)
    assert.strictEqual(m.sheetRestingHeight(400, -600, vh), 0)
  })

  test("drag rubber-bands above the large detent and never passes the top", () => {
    assert.strictEqual(m.sheetDragHeight(600, vh), 600)
    assert.strictEqual(m.sheetDragHeight(-20, vh), 0)
    const over = m.sheetDragHeight(760, vh)
    assert.ok(near(over, 720 + (40 * 80 * 0.55) / (80 + 0.55 * 40)))
    assert.ok(m.sheetDragHeight(1e6, vh) < vh)
  })
})

describe("roob-ui reading progress", () => {
  const m = loadModules()

  test("runs from the article's top at the header to its bottom at the window's", () => {
    assert.strictEqual(m.readingProgress(952, 48, 1000, 5000, 800), 0)
    assert.strictEqual(m.readingProgress(0, 48, 1000, 5000, 800), 0)
    assert.strictEqual(m.readingProgress(5200, 48, 1000, 5000, 800), 1)
    assert.ok(near(m.readingProgress(952 + 2124, 48, 1000, 5000, 800), 0.5))
    assert.strictEqual(m.readingProgress(2000, 48, 1000, 300, 800), 1)
  })

  test("segment fills weighted by their share add up to the progress", () => {
    const starts = [0, 0.1, 0.45, 0.8]
    for (const p of [0, 0.05, 0.3, 0.5, 0.79, 1]) {
      const fills = m.segmentFills(p, starts)
      let sum = 0
      for (let i = 0; i < starts.length; i += 1) {
        const end = i + 1 < starts.length ? starts[i + 1] : 1
        sum += fills[i] * (end - starts[i])
      }
      assert.ok(near(sum, p), `p=${p} summed to ${sum}`)
    }
    assert.deepStrictEqual([...m.segmentFills(0.45, starts)], [1, 1, 0, 0])
  })
})
