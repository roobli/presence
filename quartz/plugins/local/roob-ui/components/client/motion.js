// Motion for the chrome: a spring, the rubber band and release projection.
// Same math as essay-interactives runtime/motion.js, so a sheet in the chrome
// and a figure in an essay settle alike. Nothing here touches the DOM until a
// spring is run, so the tests can evaluate this file on its own.

var SPRING_SUBSTEP = 1 / 240
var SPRING_MAX_DT = 1 / 30

var reducedMotionQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null

function prefersReducedMotion() {
  return reducedMotionQuery !== null && reducedMotionQuery.matches
}

/**
 * createSpring({response = 0.35, dampingRatio = 1, value = 0, velocity = 0,
 *   restDelta = 0.5, restSpeed = 5})
 *
 * Mass 1, k = (2π/response)^2, c = 4π·dampingRatio/response, stepped with
 * semi-implicit Euler at 1/240 s. It rests, and snaps to the target, once
 * |value - target| < restDelta and |velocity| < restSpeed (display units).
 *
 * retarget(target) keeps value and velocity, so a spring caught mid-flight
 * carries on from where it is on screen; under reduced motion it jumps.
 * set(value, velocity) jumps. step(dt) advances and returns true while the
 * spring still moves. run(onFrame, onRest) drives it on animation frames:
 * onFrame(value) every frame, onRest() once when it settles. stop() halts it.
 */
function createSpring(opts) {
  var o = opts || {}
  var response = o.response > 0 ? o.response : 0.35
  var dampingRatio = o.dampingRatio == null ? 1 : o.dampingRatio
  var k = Math.pow((2 * Math.PI) / response, 2)
  var c = (4 * Math.PI * dampingRatio) / response
  var restDelta = o.restDelta == null ? 0.5 : o.restDelta
  var restSpeed = o.restSpeed == null ? 5 : o.restSpeed
  var x = o.value || 0
  var v = o.velocity || 0
  var target = x
  var frame = 0
  var last = 0
  var onFrame = null
  var onRest = null

  function step(dt) {
    var n = Math.max(1, Math.ceil(dt / SPRING_SUBSTEP - 1e-9))
    var h = dt / n
    for (var i = 0; i < n; i += 1) {
      v += (-k * (x - target) - c * v) * h
      x += v * h
    }
    if (Math.abs(x - target) < restDelta && Math.abs(v) < restSpeed) {
      x = target
      v = 0
      return false
    }
    return true
  }

  function tick(now) {
    frame = 0
    var dt = last ? (now - last) / 1000 : 1 / 60
    last = now
    var moving = step(Math.min(SPRING_MAX_DT, Math.max(0, dt)))
    if (onFrame) onFrame(x)
    if (moving) {
      frame = window.requestAnimationFrame(tick)
      return
    }
    last = 0
    var done = onRest
    onFrame = null
    onRest = null
    if (done) done()
  }

  return {
    get value() {
      return x
    },
    get velocity() {
      return v
    },
    get target() {
      return target
    },
    get running() {
      return frame !== 0
    },
    retarget: function (next) {
      target = next
      if (prefersReducedMotion()) {
        x = next
        v = 0
      }
    },
    set: function (value, velocity) {
      x = value
      v = velocity || 0
      target = value
    },
    step: step,
    run: function (frameFn, restFn) {
      onFrame = frameFn || null
      onRest = restFn || null
      if (!frame) {
        last = 0
        frame = window.requestAnimationFrame(tick)
      }
    },
    stop: function () {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      last = 0
      onFrame = null
      onRest = null
    },
  }
}

/** Where x px of travel past a limit shows, over a dimension of d px. */
function rubberBand(x, d, c) {
  var k = c == null ? 0.55 : c
  return (x * d * k) / (d + k * Math.abs(x))
}

/** The travel that rubberBand maps to p; it grows without bound as |p| nears d. */
function rubberBandInverse(p, d, c) {
  var k = c == null ? 0.55 : c
  var ap = Math.min(Math.abs(p), d * 0.999)
  return ((p < 0 ? -1 : 1) * (ap * d)) / (k * (d - ap))
}

/** How far a release at v px/s would coast, in px, at decel per millisecond. */
function project(v, decel) {
  var r = decel == null ? 0.998 : decel
  return (v * r) / (1 - r) / 1000
}
