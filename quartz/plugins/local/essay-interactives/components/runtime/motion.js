/**
 * Motion helpers: springs, the rubber band, release projection, a pointer
 * velocity tracker and the shared animation-frame loop. Nothing here touches the
 * DOM when the file loads, so the unit tests can evaluate it in Node.
 */

var SPRING_SUBSTEP = 1 / 240
var SPRING_CRITICAL_EPS = 1e-6
var LOOP_MAX_DT = 1 / 30

/* ---------- springs ---------- */

// Transition matrix of y'' + 2ζω y' + ω² y = 0 over t, written into m:
// y(t) = m[0]·y0 + m[1]·v0 and v(t) = m[2]·y0 + m[3]·v0. Closed forms for
// ζ < 1, ζ = 1 (within 1e-6) and ζ > 1; no allocation.
function springMatrix(zeta, omega, t, m) {
  var z = zeta > 0 ? zeta : 0
  var e
  if (Math.abs(z - 1) <= SPRING_CRITICAL_EPS) {
    e = Math.exp(-omega * t)
    m[0] = e * (1 + omega * t)
    m[1] = e * t
    m[2] = -e * omega * omega * t
    m[3] = e * (1 - omega * t)
  } else if (z < 1) {
    var wd = omega * Math.sqrt(1 - z * z)
    var cs = Math.cos(wd * t)
    var sn = Math.sin(wd * t) / wd
    e = Math.exp(-z * omega * t)
    m[0] = e * (cs + z * omega * sn)
    m[1] = e * sn
    m[2] = -e * omega * omega * sn
    m[3] = e * (cs - z * omega * sn)
  } else {
    var s = omega * Math.sqrt(z * z - 1)
    var r1 = -z * omega + s
    var r2 = -z * omega - s
    var e1 = Math.exp(r1 * t)
    var e2 = Math.exp(r2 * t)
    var span = 2 * s
    m[0] = (r1 * e2 - r2 * e1) / span
    m[1] = (e1 - e2) / span
    m[2] = (omega * omega * (e2 - e1)) / span
    m[3] = (r1 * e1 - r2 * e2) / span
  }
  return m
}

var springScratch = typeof Float64Array === "function" ? new Float64Array(4) : [0, 0, 0, 0]

/**
 * springAt(y0, v0, zeta, omega, t): displacement from rest t seconds after
 * starting at y0 with velocity v0, for ω = sqrt(k/m). Pure; for recorded
 * episodes and tests. springVelocityAt takes the same arguments.
 */
function springAt(y0, v0, zeta, omega, t) {
  var m = springMatrix(zeta, omega, t, springScratch)
  return m[0] * y0 + m[1] * v0
}

function springVelocityAt(y0, v0, zeta, omega, t) {
  var m = springMatrix(zeta, omega, t, springScratch)
  return m[2] * y0 + m[3] * v0
}

/**
 * Spring parameters {k, zeta, m, exact} from {stiffness, mass = 1} or
 * {response = 0.35}, with dampingRatio (default 1). A response gives
 * k = m·(2π/response)², so the response keeps its meaning at any mass.
 */
function springParams(o) {
  var opts = o || {}
  var mass = opts.mass > 0 ? opts.mass : 1
  var k
  if (opts.stiffness > 0) {
    k = opts.stiffness
  } else {
    var response = opts.response > 0 ? opts.response : 0.35
    k = mass * Math.pow((2 * Math.PI) / response, 2)
  }
  return {
    k: k,
    zeta: opts.dampingRatio == null ? 1 : Math.max(0, opts.dampingRatio),
    m: mass,
    exact: opts.exact === true,
  }
}

// Critically damped spring for a response time in seconds, at m = 1. Set
// exact: true on the result to step it in closed form.
function uiSpring(response) {
  return springParams({ response: response, dampingRatio: 1 })
}

// One coordinate, results in springX and springV. Returns true at rest.
var springX = 0
var springV = 0

function advanceSpring(x, v, target, k, c, mass, n, h, matrix, delta, speed) {
  var y = x - target
  if (matrix) {
    var ny = matrix[0] * y + matrix[1] * v
    v = matrix[2] * y + matrix[3] * v
    y = ny
  } else {
    for (var i = 0; i < n; i++) {
      v += ((-k * y - c * v) / mass) * h
      y += v * h
      if (Math.abs(y) < delta && Math.abs(v) < speed) {
        y = 0
        v = 0
        break
      }
    }
  }
  if (Math.abs(y) < delta && Math.abs(v) < speed) {
    springX = target
    springV = 0
    return true
  }
  springX = target + y
  springV = v
  return false
}

/**
 * stepSpring(state, params, dt, restDelta = 0.5, restSpeed = 5)
 * Advances state {x, v, target} by dt seconds. x and v are numbers or typed
 * arrays of one length; target is a number or an array of that length.
 * params is {k, zeta, m} (uiSpring or springParams). params.exact steps the ODE
 * in closed form over dt with the target held; otherwise semi-implicit Euler in
 * equal substeps of at most 1/240 s. A coordinate within restDelta of its
 * target and slower than restSpeed (display units) snaps to it. Returns true
 * once every coordinate is at rest. Nothing is allocated per call.
 */
function stepSpring(state, params, dt, restDelta, restSpeed) {
  var delta = restDelta == null ? 0.5 : restDelta
  var speed = restSpeed == null ? 5 : restSpeed
  var step = dt > 0 ? dt : 0
  var k = params.k
  var mass = params.m > 0 ? params.m : 1
  var zeta = params.zeta == null ? 1 : params.zeta
  var c = 2 * zeta * Math.sqrt(k * mass)
  var matrix = params.exact ? springMatrix(zeta, Math.sqrt(k / mass), step, springScratch) : null
  var n = matrix ? 1 : Math.max(1, Math.ceil(step / SPRING_SUBSTEP - 1e-9))
  var h = step / n
  var xs = state.x
  if (typeof xs === "number") {
    var rest = advanceSpring(xs, state.v, state.target, k, c, mass, n, h, matrix, delta, speed)
    state.x = springX
    state.v = springV
    return rest
  }
  var vs = state.v
  var targets = state.target
  var shared = typeof targets === "number"
  var all = true
  for (var i = 0; i < xs.length; i++) {
    var target = shared ? targets : targets[i]
    if (xs[i] === target && vs[i] === 0) continue
    if (!advanceSpring(xs[i], vs[i], target, k, c, mass, n, h, matrix, delta, speed)) all = false
    xs[i] = springX
    vs[i] = springV
  }
  return all
}

/**
 * createSpring({stiffness, mass = 1} | {response = 0.35}, dampingRatio = 1,
 *   exact = false, value = 0, velocity = 0, restDelta = 0.5, restSpeed = 5,
 *   reducedMotion})
 * The default mode is semi-implicit Euler at substeps of 1/240 s; exact: true
 * advances the ODE in closed form over each frame. retarget(target) keeps value
 * and velocity, so motion continues from its presentation value; under reduced
 * motion it jumps to the target. set(value, velocity) jumps. step(dt) returns
 * true while the spring still moves.
 */
function createSpring(opts) {
  var o = opts || {}
  var params = springParams(o)
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
    params: params,
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

// Offset shown for u px of travel past a bound, over a dimension of d px.
// Implementation only; figures never print it.
function rubberBand(u, d, c) {
  var k = c == null ? 0.55 : c
  var au = Math.abs(u)
  return (u < 0 ? -1 : 1) * ((au * d * k) / (d + k * au))
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
 * createVelocityTracker({windowMs = 100, staleMs = 50})
 * Pointer velocity in px/s: the least-squares slope of position over the
 * samples from the last windowMs. velocity(now, out) is {x: 0, y: 0} with fewer
 * than 3 samples in that window or when the newest sample is more than staleMs
 * older than now (pass the release event's timeStamp). addEvent reads
 * getCoalescedEvents, so fast moves between frames still count. Pass out to
 * reuse an object instead of allocating one.
 */
function createVelocityTracker(opts) {
  var o = opts || {}
  var CAP = 64
  var windowMs = o.windowMs > 0 ? o.windowMs : 100
  var staleMs = o.staleMs > 0 ? o.staleMs : 50
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

  function velocity(now, into) {
    var out = into || { x: 0, y: 0 }
    out.x = 0
    out.y = 0
    if (count < 3) return out
    var newest = (head - 1 + CAP) % CAP
    var at = now == null ? ts[newest] : now
    if (at - ts[newest] > staleMs) return out
    var from = at - windowMs
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
 * createLoop(step, onRun) calls step(dt) once per animation frame while
 * started, with dt clamped to [0, 1/30] s, and stops when step returns false.
 * pause(true) holds it without stopping (the shell pauses loops of off-screen
 * figures). onRun(running) runs when the loop starts and when it stops.
 */
function createLoop(step, onRun) {
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
      if (onRun) onRun(true)
      syncLoops()
    },
    stop: function () {
      if (!isRunning) return
      isRunning = false
      if (!s.inFrame) {
        var at = s.list.indexOf(loop)
        if (at >= 0) s.list.splice(at, 1)
      }
      if (onRun) onRun(false)
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
