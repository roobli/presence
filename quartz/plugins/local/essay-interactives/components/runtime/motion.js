/**
 * Motion helpers: springs, the rubber band, release projection, a pointer
 * velocity tracker and the shared animation-frame loop. Nothing here touches the
 * DOM when the file loads, so the unit tests can evaluate it in Node.
 */

var SPRING_SUBSTEP = 1 / 240
var LOOP_MAX_DT = 1 / 30

/* ---------- springs ---------- */

// Critically damped spring for a response time in seconds, at m = 1.
function uiSpring(response) {
  return { k: Math.pow((2 * Math.PI) / response, 2), zeta: 1, m: 1 }
}

/**
 * Advance state {x, v, target} by dt seconds with semi-implicit Euler, in equal
 * substeps of at most 1/240 s. When |x - target| < restDelta and |v| < restSpeed
 * (display units, default 0.5 px and 5 px/s) the state snaps to the target.
 * Returns true once the state is at rest.
 */
function stepSpring(state, params, dt, restDelta, restSpeed) {
  var m = params.m || 1
  var k = params.k
  var c = 2 * params.zeta * Math.sqrt(k * m)
  var delta = restDelta == null ? 0.5 : restDelta
  var speed = restSpeed == null ? 5 : restSpeed
  var n = Math.max(1, Math.ceil(dt / SPRING_SUBSTEP - 1e-9))
  var h = dt / n
  for (var i = 0; i < n; i++) {
    var a = (-k * (state.x - state.target) - c * state.v) / m
    state.v += a * h
    state.x += state.v * h
    if (Math.abs(state.x - state.target) < delta && Math.abs(state.v) < speed) {
      state.x = state.target
      state.v = 0
      return true
    }
  }
  return false
}

/**
 * createSpring({response = 0.35, dampingRatio = 1, value = 0, velocity = 0,
 *   restDelta = 0.5, restSpeed = 5, reducedMotion})
 * Mass 1, k = (2π/response)^2, c = 4π·dampingRatio/response. retarget(target)
 * keeps value and velocity, so motion continues from its presentation value;
 * under reduced motion it jumps to the target. set(value, velocity) jumps.
 * step(dt) returns true while the spring still moves.
 */
function createSpring(opts) {
  var o = opts || {}
  var response = o.response > 0 ? o.response : 0.35
  var params = {
    k: Math.pow((2 * Math.PI) / response, 2),
    zeta: o.dampingRatio == null ? 1 : o.dampingRatio,
    m: 1,
  }
  var restDelta = o.restDelta == null ? 0.5 : o.restDelta
  var restSpeed = o.restSpeed == null ? 5 : o.restSpeed
  var reduced =
    typeof o.reducedMotion === "function"
      ? o.reducedMotion
      : function () {
          return false
        }
  var start = o.value || 0
  var state = { x: start, v: o.velocity || 0, target: start }
  var resting = state.v === 0

  return {
    get value() {
      return state.x
    },
    get velocity() {
      return state.v
    },
    get target() {
      return state.target
    },
    get resting() {
      return resting
    },
    retarget: function (target) {
      state.target = target
      if (reduced()) {
        state.x = target
        state.v = 0
        resting = true
        return
      }
      resting = state.x === target && state.v === 0
    },
    set: function (value, velocity) {
      state.x = value
      state.v = velocity || 0
      state.target = value
      resting = state.v === 0
    },
    step: function (dt) {
      if (resting) return false
      resting = stepSpring(state, params, dt, restDelta, restSpeed)
      return !resting
    },
  }
}

/* ---------- rubber band and projection ---------- */

// Offset shown for x px of travel past a bound, over a dimension of d px.
function rubberBand(x, d, c) {
  var k = c == null ? 0.55 : c
  var ax = Math.abs(x)
  return (x < 0 ? -1 : 1) * ((ax * d * k) / (d + k * ax))
}

// The travel that rubberBand maps to p. |p| approaches d as travel grows.
function rubberBandInverse(p, d, c) {
  var k = c == null ? 0.55 : c
  var ap = Math.abs(p)
  var sign = p < 0 ? -1 : 1
  if (ap >= d) return sign * Infinity
  return sign * ((ap * d) / (k * (d - ap)))
}

// Where a release at v px/s comes to rest, in px, with decel per millisecond.
function project(v, decel) {
  var r = decel == null ? 0.998 : decel
  return (v * r) / (1 - r) / 1000
}

/* ---------- velocity ---------- */

/**
 * Pointer velocity in px/s: the least-squares slope of position over the
 * samples from the last 80 ms. velocity(now) is {x: 0, y: 0} with fewer than 3
 * samples in that window or when the newest sample is more than 50 ms older than
 * now (pass the release event's timeStamp). addEvent reads getCoalescedEvents,
 * so fast moves between frames still count.
 */
function createVelocityTracker() {
  var CAP = 64
  var WINDOW_MS = 80
  var STALE_MS = 50
  var ts = new Float64Array(CAP)
  var xs = new Float64Array(CAP)
  var ys = new Float64Array(CAP)
  var head = 0
  var count = 0

  function add(t, x, y) {
    ts[head] = t
    xs[head] = x
    ys[head] = y
    head = (head + 1) % CAP
    if (count < CAP) count += 1
  }

  function addEvent(e) {
    var list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null
    if (list && list.length) {
      for (var i = 0; i < list.length; i++) add(list[i].timeStamp, list[i].clientX, list[i].clientY)
    } else {
      add(e.timeStamp, e.clientX, e.clientY)
    }
  }

  function velocity(now) {
    var out = { x: 0, y: 0 }
    if (count < 3) return out
    var newest = (head - 1 + CAP) % CAP
    var at = now == null ? ts[newest] : now
    if (at - ts[newest] > STALE_MS) return out
    var from = at - WINDOW_MS
    var n = 0
    var st = 0
    var sx = 0
    var sy = 0
    var i
    var j
    for (i = 0; i < count; i++) {
      j = (newest - i + CAP) % CAP
      if (ts[j] < from) break
      n += 1
      st += ts[j]
      sx += xs[j]
      sy += ys[j]
    }
    if (n < 3) return out
    var mt = st / n
    var mx = sx / n
    var my = sy / n
    var stt = 0
    var stx = 0
    var sty = 0
    for (i = 0; i < n; i++) {
      j = (newest - i + CAP) % CAP
      var dt = ts[j] - mt
      stt += dt * dt
      stx += dt * (xs[j] - mx)
      sty += dt * (ys[j] - my)
    }
    if (stt > 0) {
      out.x = (stx / stt) * 1000
      out.y = (sty / stt) * 1000
    }
    return out
  }

  return {
    add: add,
    addEvent: addEvent,
    velocity: velocity,
    reset: function () {
      head = 0
      count = 0
    },
  }
}

/* ---------- animation loop ---------- */

var loopState = null

function loopScheduler() {
  if (!loopState) {
    loopState = { list: [], frame: 0, last: -1, interval: 1 / 60, inFrame: false }
    document.addEventListener("visibilitychange", function () {
      syncLoops()
    })
  }
  return loopState
}

// Request frames only while some loop runs, is on screen, and the tab is visible.
function syncLoops() {
  var s = loopState
  var active = 0
  if (!document.hidden) {
    for (var i = 0; i < s.list.length; i++) if (s.list[i].active()) active += 1
  }
  var ns = window.__essayInteractives || (window.__essayInteractives = {})
  ns.activeLoops = active
  if (s.inFrame) return
  if (active && !s.frame) {
    s.last = -1
    s.frame = requestAnimationFrame(runLoops)
  } else if (!active && s.frame) {
    cancelAnimationFrame(s.frame)
    s.frame = 0
  }
}

function runLoops(now) {
  var s = loopState
  s.frame = 0
  // A loop that starts or resumes from idle gets one frame interval, not the
  // time it spent stopped.
  var dt = s.last < 0 ? s.interval : (now - s.last) / 1000
  if (s.last >= 0 && dt > 0 && dt < 0.1) s.interval = dt
  s.last = now
  if (!(dt > 0)) dt = 0
  else if (dt > LOOP_MAX_DT) dt = LOOP_MAX_DT

  s.inFrame = true
  var list = s.list
  var count = list.length
  for (var i = 0; i < count; i++) {
    var loop = list[i]
    if (loop.active() && loop.step(dt) === false) loop.stop()
  }
  var kept = 0
  for (i = 0; i < list.length; i++) if (list[i].running()) list[kept++] = list[i]
  list.length = kept
  s.inFrame = false

  syncLoops()
  if (s.frame) s.last = now
}

/**
 * createLoop(step) calls step(dt) once per animation frame while started, with
 * dt clamped to [0, 1/30] s, and stops when step returns false. pause(true)
 * holds it without stopping (the shell pauses loops of off-screen figures).
 */
function createLoop(step) {
  var s = loopScheduler()
  var isRunning = false
  var paused = false
  var loop = {
    step: step,
    active: function () {
      return isRunning && !paused
    },
    running: function () {
      return isRunning
    },
    start: function () {
      if (isRunning) return
      isRunning = true
      if (s.list.indexOf(loop) < 0) s.list.push(loop)
      syncLoops()
    },
    stop: function () {
      if (!isRunning) return
      isRunning = false
      if (!s.inFrame) {
        var at = s.list.indexOf(loop)
        if (at >= 0) s.list.splice(at, 1)
      }
      syncLoops()
    },
    pause: function (flag) {
      if (paused === !!flag) return
      paused = !!flag
      syncLoops()
    },
  }
  return loop
}
