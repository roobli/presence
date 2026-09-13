import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"

// motion.js is a plain browser script that shares scope with the other runtime
// files, so evaluate it in its own context and collect its functions.
const source = readFileSync(new URL("../components/runtime/motion.js", import.meta.url), "utf8")
const motion = vm.runInNewContext(
  source +
    "\n;({ rubberBand, rubberBandInverse, stepSpring, uiSpring, createSpring, project, createVelocityTracker })",
  {},
)

test("rubberBand(120, 335) is 55.14", () => {
  const value = motion.rubberBand(120, 335)
  assert.ok(Math.abs(value - 55.14) <= 0.01, `got ${value}`)
  assert.equal(motion.rubberBand(-120, 335), -value)
})

test("rubberBandInverse undoes rubberBand", () => {
  for (const d of [100, 335, 812]) {
    for (let u = -3000; u <= 3000; u += 7.5) {
      const back = motion.rubberBandInverse(motion.rubberBand(u, d), d)
      assert.ok(Math.abs(back - u) <= 1e-6 * Math.max(1, Math.abs(u)), `u=${u} d=${d} got ${back}`)
    }
  }
})

function restTime(frame) {
  const state = { x: 55.14, v: 0, target: 0 }
  const params = { k: 320, zeta: 0.825, m: 1 }
  let t = 0
  while (t < 2) {
    t += frame
    if (motion.stepSpring(state, params, frame, 0.5, 5)) return { t, state }
  }
  return { t: Infinity, state }
}

test("k = 320, zeta = 0.825 released from 55.14 px rests at 0.300 s", () => {
  for (const frame of [1 / 240, 1 / 120, 1 / 60]) {
    const { t, state } = restTime(frame)
    assert.ok(Math.abs(t - 0.3) <= 0.02, `frame ${frame}: rested at ${t}`)
    assert.equal(state.x, 0)
    assert.equal(state.v, 0)
  }
})

test("uiSpring is critically damped with k = (2π/response)^2", () => {
  const params = motion.uiSpring(0.35)
  assert.ok(Math.abs(params.k - Math.pow((2 * Math.PI) / 0.35, 2)) < 1e-9)
  assert.equal(params.zeta, 1)
  assert.equal(params.m, 1)
})

test("createSpring retarget keeps value and velocity", () => {
  const spring = motion.createSpring({ value: 0 })
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
})

test("createSpring jumps to its target under reduced motion", () => {
  const spring = motion.createSpring({ value: 10, reducedMotion: () => true })
  spring.retarget(80)
  assert.equal(spring.value, 80)
  assert.equal(spring.velocity, 0)
  assert.equal(spring.step(1 / 60), false)
})

test("velocity is the least-squares slope of the last 80 ms", () => {
  const tracker = motion.createVelocityTracker()
  // 4 px and -2 px every 8 ms, with old samples that must fall out of the window.
  tracker.add(0, 900, 900)
  tracker.add(500, 900, 900)
  for (let i = 0; i <= 10; i++) tracker.add(1000 + i * 8, i * 4, -i * 2)
  const v = tracker.velocity(1080)
  assert.ok(Math.abs(v.x - 500) < 1e-6, `x ${v.x}`)
  assert.ok(Math.abs(v.y + 250) < 1e-6, `y ${v.y}`)
})

test("velocity is 0 with fewer than 3 samples or a stale newest sample", () => {
  const tracker = motion.createVelocityTracker()
  tracker.add(0, 0, 0)
  tracker.add(8, 10, 0)
  assert.equal(tracker.velocity(8).x, 0)
  tracker.add(16, 20, 0)
  assert.ok(tracker.velocity(16).x > 0)
  assert.equal(tracker.velocity(16 + 51).x, 0)
  tracker.reset()
  assert.equal(tracker.velocity(16).x, 0)
})

test("project travels v * 0.998 / 0.002 / 1000 px", () => {
  assert.ok(Math.abs(motion.project(1000) - 499) < 1e-9)
  assert.ok(Math.abs(motion.project(-1000) + 499) < 1e-9)
})
