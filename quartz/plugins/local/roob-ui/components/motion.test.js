import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import vm from "vm"

const source = fs.readFileSync(new URL("./client/motion.js", import.meta.url), "utf8")

function loadMotion({ reduced = false } = {}) {
  const frames = new Map()
  let nextId = 1
  const context = vm.createContext({
    window: {
      matchMedia: () => ({ matches: reduced }),
      requestAnimationFrame(fn) {
        frames.set(nextId, fn)
        return nextId++
      },
      cancelAnimationFrame(id) {
        frames.delete(id)
      },
    },
  })
  vm.runInContext(source, context)
  // Runs pending frames at a steady rate; returns how many ran.
  context.flushFrames = (fps = 60, limit = 600) => {
    let now = 1000
    let ran = 0
    while (frames.size > 0 && ran < limit) {
      const [id, fn] = frames.entries().next().value
      frames.delete(id)
      now += 1000 / fps
      fn(now)
      ran += 1
    }
    return ran
  }
  return context
}

describe("roob-ui motion", () => {
  test("rubberBand follows x*d*c/(d + c*|x|) and never reaches d", () => {
    const m = loadMotion()
    assert.ok(Math.abs(m.rubberBand(100, 80) - (100 * 80 * 0.55) / (80 + 55)) < 1e-9)
    assert.strictEqual(m.rubberBand(-100, 80), -m.rubberBand(100, 80))
    assert.strictEqual(m.rubberBand(0, 80), 0)
    const far = m.rubberBand(1e9, 80)
    assert.ok(far < 80 && far > 79.9)
    for (const x of [-300, -12, 5, 40, 250]) {
      assert.ok(Math.abs(m.rubberBandInverse(m.rubberBand(x, 80), 80) - x) < 1e-6)
    }
  })

  test("project coasts about half a second of travel", () => {
    const m = loadMotion()
    assert.ok(Math.abs(m.project(1000) - 499) < 1e-9)
    assert.ok(Math.abs(m.project(-500, 0.99) + (500 * 0.99) / 0.01 / 1000) < 1e-9)
  })

  test("a critically damped spring settles without overshoot inside 600ms", () => {
    const m = loadMotion()
    const spring = m.createSpring({ value: 80 })
    spring.retarget(0)
    let t = 0
    let min = Infinity
    while (spring.step(1 / 60)) {
      t += 1 / 60
      min = Math.min(min, spring.value)
      assert.ok(t < 0.6, "still moving after 600ms")
    }
    assert.ok(min > -0.5, "overshot the target")
    assert.strictEqual(spring.value, 0)
    assert.strictEqual(spring.velocity, 0)
  })

  test("retarget keeps the presentation value and velocity", () => {
    const m = loadMotion()
    const spring = m.createSpring({ value: 0 })
    spring.retarget(100)
    spring.step(0.1)
    const value = spring.value
    const velocity = spring.velocity
    assert.ok(value > 0 && velocity > 0)
    spring.retarget(0)
    assert.strictEqual(spring.value, value)
    assert.strictEqual(spring.velocity, velocity)
  })

  test("a release velocity carries into the spring", () => {
    const m = loadMotion()
    const still = m.createSpring({ value: 40 })
    const flung = m.createSpring({ value: 40, velocity: -600 })
    still.retarget(0)
    flung.retarget(0)
    still.step(1 / 60)
    flung.step(1 / 60)
    assert.ok(flung.value < still.value)
  })

  test("run drives frames to rest and reports each value", () => {
    const m = loadMotion()
    const spring = m.createSpring({ value: 60 })
    const seen = []
    let rested = 0
    spring.retarget(0)
    spring.run(
      (value) => seen.push(value),
      () => (rested += 1),
    )
    assert.strictEqual(spring.running, true)
    const ran = m.flushFrames()
    assert.strictEqual(rested, 1)
    assert.strictEqual(spring.running, false)
    assert.strictEqual(seen.length, ran)
    assert.strictEqual(seen[seen.length - 1], 0)
    assert.ok(ran <= 36, `took ${ran} frames`)
  })

  test("reduced motion settles on the next frame", () => {
    const m = loadMotion({ reduced: true })
    const spring = m.createSpring({ value: 60, velocity: 300 })
    const seen = []
    spring.retarget(0)
    assert.strictEqual(spring.value, 0)
    spring.run((value) => seen.push(value))
    assert.strictEqual(m.flushFrames(), 1)
    assert.deepStrictEqual(seen, [0])
  })
})
