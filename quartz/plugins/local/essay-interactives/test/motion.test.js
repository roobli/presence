import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"

// motion.js is a plain browser script that shares scope with the other runtime
// files, so evaluate it in its own context and collect its functions.
const source = readFileSync(new URL("../components/runtime/motion.js", import.meta.url), "utf8")
const motion = vm.runInNewContext(
  source +
    "\n;({ rubberBand, rubberBandInverse, stepSpring, uiSpring, springParams, createSpring, springAt, springVelocityAt, project, createVelocityTracker })",
  {},
)

// Closed-form references written out independently of motion.js.
function reference(y0, v0, zeta, omega, t) {
  if (zeta === 1) {
    const e = Math.exp(-omega * t)
    return { y: e * (y0 + (v0 + omega * y0) * t), v: e * (v0 - omega * (v0 + omega * y0) * t) }
  }
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const a = zeta * omega
    const e = Math.exp(-a * t)
    const c = Math.cos(wd * t)
    const s = Math.sin(wd * t)
    return {
      y: e * (y0 * c + ((v0 + a * y0) / wd) * s),
      v: e * (v0 * c - ((omega * omega * y0 + a * v0) / wd) * s),
    }
  }
  const root = omega * Math.sqrt(zeta * zeta - 1)
  const r1 = -zeta * omega + root
  const r2 = -zeta * omega - root
  const c1 = (v0 - r2 * y0) / (r1 - r2)
  const c2 = y0 - c1
  return {
    y: c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t),
    v: r1 * c1 * Math.exp(r1 * t) + r2 * c2 * Math.exp(r2 * t),
  }
}

const K = 320
const OMEGA = Math.sqrt(K)
const ZETAS = [0.5, 1, 1.5]
const STARTS = [
  { y0: 55.14, v0: 0 },
  { y0: 0, v0: 800 },
]

/* ---------- rubber band ---------- */

test("rubberBand(0.5, 1) is 0.2157 and rubberBand(120, 335) is 55.14", () => {
  assert.ok(
    Math.abs(motion.rubberBand(0.5, 1) - 0.2157) <= 1e-4,
    `got ${motion.rubberBand(0.5, 1)}`,
  )
  const value = motion.rubberBand(120, 335)
  assert.ok(Math.abs(value - 55.14) <= 0.01, `got ${value}`)
  assert.equal(motion.rubberBand(-120, 335), -value)
  assert.equal(motion.rubberBand(0, 335), 0)
})

test("rubberBandInverse(rubberBand(u, d), d) round-trips within 1e-9", () => {
  let worst = 0
  for (const d of [1, 100, 335, 812]) {
    for (let u = -3000; u <= 3000; u += 7.5) {
      const back = motion.rubberBandInverse(motion.rubberBand(u, d), d)
      worst = Math.max(worst, Math.abs(back - u))
    }
    for (const u of [0.5, 1e-3, -0.25]) {
      worst = Math.max(worst, Math.abs(motion.rubberBandInverse(motion.rubberBand(u, d), d) - u))
    }
  }
  assert.ok(worst <= 1e-9, `worst round trip error ${worst}`)
})

/* ---------- springs ---------- */

test("springAt and springVelocityAt match the closed forms at zeta 0.5, 1 and 1.5", () => {
  for (const zeta of ZETAS) {
    for (const { y0, v0 } of STARTS) {
      for (const t of [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1]) {
        const ref = reference(y0, v0, zeta, OMEGA, t)
        assert.ok(
          Math.abs(motion.springAt(y0, v0, zeta, OMEGA, t) - ref.y) <= 1e-9,
          `y z=${zeta} t=${t}`,
        )
        assert.ok(
          Math.abs(motion.springVelocityAt(y0, v0, zeta, OMEGA, t) - ref.v) <= 1e-7,
          `v z=${zeta} t=${t}`,
        )
      }
    }
  }
})

function track(spring, frames, y0, v0, zeta) {
  let t = 0
  let worst = 0
  for (const dt of frames) {
    spring.step(dt)
    t += dt
    const ref = reference(y0, v0, zeta, OMEGA, t)
    worst = Math.max(worst, Math.abs(spring.value - ref.y))
  }
  return worst
}

// 1 s of frames at 60 Hz, and 1 s of uneven frames.
const EVEN = Array.from({ length: 60 }, () => 1 / 60)
const UNEVEN = []
for (let t = 0; t < 1;) {
  const dt = [1 / 60, 1 / 144, 1 / 30, 1 / 90][UNEVEN.length % 4]
  UNEVEN.push(dt)
  t += dt
}

test("exact mode steps the closed form over any frame pattern at zeta 0.5, 1 and 1.5", () => {
  for (const zeta of ZETAS) {
    for (const { y0, v0 } of STARTS) {
      for (const frames of [EVEN, UNEVEN]) {
        const spring = motion.createSpring({
          stiffness: K,
          dampingRatio: zeta,
          exact: true,
          value: y0,
          velocity: v0,
          restDelta: 0,
          restSpeed: 0,
        })
        spring.retarget(0)
        const worst = track(spring, frames, y0, v0, zeta)
        assert.ok(worst <= 1e-9, `zeta ${zeta} start ${y0}/${v0}: worst ${worst}`)
      }
    }
  }
})

test("response and stiffness forms agree: k = m (2π/response)^2", () => {
  const response = (2 * Math.PI) / OMEGA
  const a = motion.createSpring({ response, dampingRatio: 0.5, exact: true, value: 10 })
  const b = motion.createSpring({ stiffness: K, dampingRatio: 0.5, exact: true, value: 10 })
  a.retarget(0)
  b.retarget(0)
  for (let i = 0; i < 20; i++) {
    a.step(1 / 60)
    b.step(1 / 60)
    assert.ok(Math.abs(a.value - b.value) <= 1e-9)
  }
  const heavy = motion.springParams({ response: 0.35, mass: 2 })
  assert.ok(Math.abs(heavy.k - 2 * Math.pow((2 * Math.PI) / 0.35, 2)) < 1e-9)
  assert.equal(heavy.m, 2)
})

test("the default semi-implicit mode stays within ω·h of the closed form, h = 1/240 s", () => {
  const bound = OMEGA / 240
  for (const zeta of ZETAS) {
    for (const { y0, v0 } of STARTS) {
      const amplitude = Math.max(Math.abs(y0), Math.abs(v0) / OMEGA)
      for (const frames of [EVEN, UNEVEN]) {
        const spring = motion.createSpring({
          stiffness: K,
          dampingRatio: zeta,
          value: y0,
          velocity: v0,
          restDelta: 0,
          restSpeed: 0,
        })
        spring.retarget(0)
        const worst = track(spring, frames, y0, v0, zeta)
        assert.ok(worst > 1e-6, "the default mode is not the exact one")
        assert.ok(worst <= bound * amplitude, `zeta ${zeta}: ${worst} > ${bound * amplitude}`)
      }
    }
  }
})

test("both modes rest and snap at the per-spring restDelta and restSpeed", () => {
  for (const exact of [true, false]) {
    for (const zeta of ZETAS) {
      const spring = motion.createSpring({
        stiffness: K,
        dampingRatio: zeta,
        exact,
        value: 1,
        restDelta: 0.001,
        restSpeed: 0.01,
      })
      spring.retarget(0)
      let frames = 0
      let before = null
      while (spring.step(1 / 60)) {
        before = { x: spring.value, v: spring.velocity }
        frames++
        assert.ok(frames < 600, "never rested")
      }
      assert.equal(spring.value, 0)
      assert.equal(spring.velocity, 0)
      assert.ok(spring.resting)
      assert.ok(before && (Math.abs(before.x) >= 0.001 || Math.abs(before.v) >= 0.01))
    }
  }
})

test("retarget keeps value and velocity in both modes", () => {
  for (const exact of [true, false]) {
    const spring = motion.createSpring({ value: 0, exact })
    spring.retarget(100)
    for (let i = 0; i < 6; i++) spring.step(1 / 60)
    const value = spring.value
    const velocity = spring.velocity
    assert.ok(velocity > 0 && value > 0 && value < 100)
    spring.retarget(-50)
    assert.equal(spring.value, value)
    assert.equal(spring.velocity, velocity)
    let frames = 0
    while (spring.step(1 / 60)) frames++
    assert.equal(spring.value, -50)
    assert.ok(frames < 120)
  }
})

test("createSpring jumps to its target under reduced motion", () => {
  const spring = motion.createSpring({ value: 10, exact: true, reducedMotion: () => true })
  spring.retarget(80)
  assert.equal(spring.value, 80)
  assert.equal(spring.velocity, 0)
  assert.equal(spring.step(1 / 60), false)
})

test("stepSpring over typed arrays matches scalar steps and rests only when all do", () => {
  for (const exact of [true, false]) {
    const params = motion.uiSpring(0.35)
    params.exact = exact
    const n = 64
    const x = new Float64Array(n)
    const v = new Float64Array(n)
    const target = new Float32Array(n)
    const scalars = []
    for (let i = 0; i < n; i++) {
      x[i] = i * 3 - 90
      v[i] = (i % 5) * 40
      target[i] = i % 3 ? 20 : -10
      scalars.push({ x: x[i], v: v[i], target: target[i] })
    }
    const state = { x, v, target }
    let rested = false
    for (let frame = 0; frame < 240 && !rested; frame++) {
      rested = motion.stepSpring(state, params, 1 / 60, 0.5, 5)
      let all = true
      for (let i = 0; i < n; i++) {
        if (!motion.stepSpring(scalars[i], params, 1 / 60, 0.5, 5)) all = false
        assert.equal(x[i], scalars[i].x, `x[${i}] frame ${frame}`)
        assert.equal(v[i], scalars[i].v, `v[${i}] frame ${frame}`)
      }
      assert.equal(rested, all)
    }
    assert.ok(rested, "the array came to rest")
    for (let i = 0; i < n; i++) assert.equal(x[i], target[i])

    const shared = { x: new Float64Array([5, -5]), v: new Float64Array(2), target: 0 }
    while (!motion.stepSpring(shared, params, 1 / 60)) {}
    assert.deepEqual([...shared.x], [0, 0])
  }
})

test("uiSpring is critically damped with k = (2π/response)^2", () => {
  const params = motion.uiSpring(0.35)
  assert.ok(Math.abs(params.k - Math.pow((2 * Math.PI) / 0.35, 2)) < 1e-9)
  assert.equal(params.zeta, 1)
  assert.equal(params.m, 1)
})

/* ---------- velocity ---------- */

// Flat until 1000 ms, then 500 px/s rightward and 250 px/s upward, sampled every
// 10 ms to 1100 ms. The flat samples from 900 to 990 ms lie outside a 100 ms
// window and inside a 150 ms one.
function kinked(tracker) {
  tracker.add(500, 0, 0)
  for (let t = 900; t < 1000; t += 10) tracker.add(t, 0, 0)
  for (let t = 1000; t <= 1100; t += 10) tracker.add(t, (t - 1000) * 0.5, -(t - 1000) * 0.25)
}

test("velocity is the least-squares slope of the samples from the last 100 ms", () => {
  const tracker = motion.createVelocityTracker()
  kinked(tracker)
  const out = { x: NaN, y: NaN }
  const v = tracker.velocity(1100, out)
  assert.equal(v, out)
  assert.ok(Math.abs(v.x - 500) < 1e-9, `x ${v.x}`)
  assert.ok(Math.abs(v.y + 250) < 1e-9, `y ${v.y}`)

  // A wider window takes in the flat part and reads slower.
  const wide = motion.createVelocityTracker({ windowMs: 150 })
  kinked(wide)
  assert.ok(wide.velocity(1100).x < 480)
})

test("velocity is 0 with fewer than 3 samples, a stale newest sample, or after reset", () => {
  const tracker = motion.createVelocityTracker()
  tracker.add(0, 0, 0)
  tracker.add(8, 10, 0)
  assert.equal(tracker.velocity(8).x, 0)
  tracker.add(16, 20, 0)
  assert.ok(tracker.velocity(16).x > 0)
  assert.ok(tracker.velocity(66).x > 0, "50 ms old is still fresh")
  assert.equal(tracker.velocity(67).x, 0)
  tracker.reset()
  assert.equal(tracker.velocity(16).x, 0)
})

test("a flick held at 8 px/s for 110 ms reads 8.000 px/s", () => {
  const tracker = motion.createVelocityTracker()
  for (let t = 0; t <= 110; t += 5) tracker.add(t, (8 * t) / 1000, 0)
  assert.ok(Math.abs(tracker.velocity(110).x - 8) < 1e-9)
})

test("project travels v * 0.998 / 0.002 / 1000 px", () => {
  assert.ok(Math.abs(motion.project(1000) - 499) < 1e-9)
  assert.ok(Math.abs(motion.project(-1000) + 499) < 1e-9)
})
