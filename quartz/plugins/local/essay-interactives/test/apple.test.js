import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"

// Model checks for the apple-design-physics figures. The runtime files and the
// widget files are plain browser scripts, so each test evaluates them in one
// node:vm context: motion.js and corner.js first, then the widget's
// declarations (a widget file runs nothing but its WIDGETS assignment at load).

const RUNTIME_DIR = new URL("../components/runtime/", import.meta.url)
const WIDGETS_DIR = new URL("../components/widgets/", import.meta.url)

function read(dir, name) {
  return readFileSync(new URL(name, dir), "utf8")
}

function load(widget) {
  const context = vm.createContext({ WIDGETS: {} })
  vm.runInContext(read(RUNTIME_DIR, "motion.js"), context, { filename: "motion.js" })
  vm.runInContext(read(RUNTIME_DIR, "corner.js"), context, { filename: "corner.js" })
  if (widget) vm.runInContext(read(WIDGETS_DIR, widget), context, { filename: widget })
  return (source) => vm.runInContext(source, context)
}

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} is not within ${tolerance} of ${expected}`,
  )
}

/* ---------- corner.js ---------- */

test("corner: the table's arc length, join and peak curvature, apex and rho0", () => {
  const run = load()
  near(run("cornerCubicLength(cornerPieces())"), 1.7544, 5e-4, "cubic arc length")
  const lengths = run("cornerPieces().map((p) => p.len)")
  near(lengths[1], 0.6219, 5e-4, "segment 1")
  near(lengths[2], 0.5107, 5e-4, "segment 2")
  near(lengths[3], 0.6219, 5e-4, "segment 3")
  near(run("bezierCurvature(CORNER_SEGS[0], 0)"), 0, 1e-12, "curvature at the entry")
  near(run("bezierCurvature(CORNER_SEGS[2], 1)"), 0, 1e-12, "curvature at the exit")
  near(run("bezierCurvature(CORNER_SEGS[0], 1)"), 1.303, 2e-3, "join, segment 1 side")
  near(run("bezierCurvature(CORNER_SEGS[1], 0)"), 1.397, 2e-3, "join, segment 2 side")
  near(run("bezierCurvature(CORNER_SEGS[1], 0.5)"), 2.533, 2e-3, "peak on the bisector")
  const apex = run(
    "(() => { const p = bezierPoint(CORNER_SEGS[1], 0.5, {}); return Math.hypot(1 - p.x, p.y) })()",
  )
  near(apex, 0.2249, 3e-4, "apex distance from the tip")
  near(apex / (Math.SQRT2 - 1), 0.5429, 3e-4, "rho0")
})

test("corner: two-way Hausdorff distance between the table corner and the arc", () => {
  const run = load()
  const distance = (rho) =>
    run(`(() => {
      const cont = resamplePieces(cornerPieces(), 0.005)
      const xs = new Float64Array(1000), ys = new Float64Array(1000)
      const n = fillArcSamples(${rho}, 0.005, xs, ys)
      return hausdorff(cont.x, cont.y, cont.n, xs, ys, n)
    })()`)
  const rho0 = 0.22486 / (Math.SQRT2 - 1)
  near(distance(0.35), 0.0799, 1e-3, "rho 0.35")
  near(distance(rho0), 0.0155, 5e-4, "rho0")
  near(distance(1), 0.1894, 1e-3, "rho 1.00")
  near(distance(1.8), 0.5207, 2e-3, "rho 1.80")
})

test("corner: resampling spaces points by arc length with unit outward normals", () => {
  const run = load()
  const samples = run("resamplePieces(cornerPieces(), 0.002)")
  near(samples.s[samples.n - 1], 3.7544, 5e-4, "total length with both straights")
  for (let i = 1; i < samples.n - 1; i++) {
    const chord = Math.hypot(samples.x[i] - samples.x[i - 1], samples.y[i] - samples.y[i - 1])
    near(chord, 0.002, 1e-5, `spacing at sample ${i}`)
    near(Math.hypot(samples.nx[i], samples.ny[i]), 1, 1e-9, `normal length at sample ${i}`)
  }
  assert.deepEqual([samples.nx[10], samples.ny[10]], [0, -1], "top edge normal points up")
  near(samples.nx[samples.n - 10], 1, 1e-12, "right edge normal points right")
  const arc = run("(() => { const o = {}; arcPathPoint(0.5, 1.5 + Math.PI / 8, o); return o })()")
  near(arc.k, 2, 1e-12, "arc curvature is 1/rho")
  near(Math.hypot(arc.x - 0.5, arc.y - 0.5), 0.5, 1e-12, "arc point sits on its circle")
  near(arc.nx, (arc.x - 0.5) / 0.5, 1e-12, "arc normal points away from the centre")
})

test("corner: one CORNER_SEGS declaration and no schematic curvature samplers", () => {
  const files = [
    ...readdirSync(RUNTIME_DIR).map((name) => read(RUNTIME_DIR, name)),
    ...readdirSync(WIDGETS_DIR).map((name) => read(WIDGETS_DIR, name)),
  ].join("\n")
  assert.equal(files.match(/CORNER_SEGS\s*=/g)?.length, 1)
  assert.doesNotMatch(files, /sampleCurvatureG1|sampleCurvatureG2/)
  assert.ok(!readdirSync(WIDGETS_DIR).includes("squircle-compare.js"))
})

/* ---------- curvature-comb ---------- */

test("curvature-comb: model exports match the replayed table geometry", () => {
  const run = load("curvature-comb.js")
  near(run("combArcLength()"), 1.7544, 5e-4, "arcLength")
  const joins = run("combJoinKappa()")
  near(joins[0], 1.303, 2e-3, "joinKappa[0]")
  near(joins[1], 1.397, 2e-3, "joinKappa[1]")
  near(run("combPeakKappa()"), 2.533, 2e-3, "peakKappa")
  near(run("combApexDistance()"), 0.2249, 3e-4, "apexDistance")
  const rho0 = run("combRho0()")
  near(rho0, 0.5429, 3e-4, "rho0")
  near(run(`combHausdorff(${rho0})`), 0.0155, 5e-4, "hausdorff(rho0)")
  near(run("combHausdorff(1)"), 0.1894, 1e-3, "hausdorff(1)")
  near(run("combHausdorff(0.35)"), 0.0799, 1e-3, "hausdorff(0.35)")
  near(run("combHausdorff(1.8)"), 0.5207, 2e-3, "hausdorff(1.8)")
  // Tooth lengths on one scale: 0.1184 r_px per unit of curvature × r.
  near(0.1184 * run("combPeakKappa()"), 0.3, 1e-3, "continuous peak tooth")
  near(0.1184 / rho0, 0.218, 1e-3, "arc tooth at rho0")
  near(0.1184 / 0.35, 0.338, 1e-3, "arc tooth at 0.35")
})

/* ---------- zeta-triptych ---------- */

test("zeta-triptych: closed-form overshoot, settle time and extra time", () => {
  const run = load("zeta-triptych.js")
  near(run("zetaOvershoot(0.825)"), 0.0102, 1e-4, "overshoot(0.825)")
  near(run("zetaOvershoot(0.5)"), 0.163, 1e-4, "overshoot(0.5)")
  near(run("zetaOvershoot(0.3)"), 0.3723, 1e-4, "overshoot(0.3)")
  near(run("zetaOvershoot(0.7)"), 0.046, 1e-4, "overshoot(0.7)")
  near(run("zetaOvershoot(0.9)"), 0.0015, 1e-4, "overshoot(0.9)")
  assert.equal(run("zetaOvershoot(1)"), 0)
  assert.equal(run("zetaOvershoot(1.5)"), 0)
  near(run("zetaSettle(1)"), 0.3711, 5e-4, "settle(1)")
  assert.ok(Number.isNaN(run("zetaSettle(0.9)")), "no settle time is computed below ζ = 1")
  near(run("zetaExtra(1.25)"), 0.474, 2e-3, "extra(1.25)")
  near(run("zetaExtra(1.5)"), 0.878, 2e-3, "extra(1.5)")
  near(run("zetaExtra(2)"), 1.631, 3e-3, "extra(2)")
  let previous = -Infinity
  for (let i = 0; i <= 40; i++) {
    const z = 1 + i * 0.025
    const extra = run(`zetaExtra(${z})`)
    assert.ok(extra > previous, `extra rises at ζ ${z.toFixed(3)}`)
    previous = extra
  }
})

test("zeta-triptych: positions of the reference responses", () => {
  const run = load("zeta-triptych.js")
  near(run("zetaX(0.5, 0.2)"), -0.1628, 5e-4, "x(0.5, 0.2)")
  near(run("zetaX(1, 0.2)"), 0.1279, 5e-4, "x(1, 0.2)")
  near(run("zetaX(1.5, 0.2)"), 0.2985, 5e-4, "x(1.5, 0.2)")
  near(run("zetaX(2, 1.2)"), 0.0034, 1e-4, "x(2, 1.2) fits the 1.2 s axis")
  const trough = run(
    "(() => { let low = Infinity; for (let t = 0; t <= 1.2; t += 0.0005) low = Math.min(low, zetaX(0.3, t)); return low })()",
  )
  near(trough, -0.3723, 5e-4, "lowest point at ζ 0.3")
})

test("zeta-triptych: readout and value text at the acceptance settings", () => {
  const run = load("zeta-triptych.js")
  const say = (z, spoken) => run(`zetaSay(ZETA_STRINGS.en, ${z}, ${spoken})`)
  assert.equal(say(1, false), "ζ 1.00 · no overshoot · the fastest settle that never overshoots")
  assert.equal(say(2, false), "ζ 2.00 · no overshoot · settles 163% later than ζ = 1")
  assert.equal(say(0.3, false), "ζ 0.30 · overshoot 37.2% · oscillates")
  assert.match(say(0.825, false), /overshoot 1\.0%/)
  assert.match(say(1.5, false), /settles 88% later/)
  assert.equal(say(1.5, true), "ζ 1.50, no overshoot, settles 88 percent later than ζ 1")
  assert.equal(say(1, true), "ζ 1.00, no overshoot, the fastest settle that never overshoots")
})

/* ---------- spring-throw ---------- */

test("spring-throw: the recorded episode matches the replayed numbers", () => {
  const run = load("spring-throw.js")
  const at = (t) => run(`throwSample(${t})`)
  near(at(0.5358).spring, 0.2417, 1e-3, "spring peak")
  const gap = at(0.5471)
  near(gap.spring - gap.tween, 0.1913, 1e-3, "largest gap")
  near(at(0.515).spring, 0.2204, 1e-3, "spring at 0.515 s")
  near(at(0.515).tween, 0.0729, 1e-3, "tween at 0.515 s")
  near(at(0.59).spring, 0.181, 1e-3, "spring at the catch")
  near(at(0.59).tween, 0.0218, 1e-3, "tween at the catch")
  near(at(0.49).spring, 0.1, 1e-9, "spring at the release")
  near(at(0.49).tween, 0.1, 1e-9, "tween at the release")
  near(at(0.35).finger, -0.9, 1e-9, "finger at 0.35 s")
  near(at(0.38).finger, -0.78, 1e-9, "finger at 0.38 s")
  for (const t of [0.05, 0.52, 0.8, 1.2]) {
    assert.ok(Number.isNaN(at(t).finger), `the finger is lifted at ${t} s`)
  }
  const scan = run(`(() => {
    let previous = Infinity, rising = 0, over = 0, below = 0, peak = -Infinity, peakT = 0
    for (let ms = 490; ms <= 1600; ms++) {
      const s = throwSample(ms / 1000)
      if (s.tween > previous + 1e-12) rising++
      if (s.tween > 0.1 + 1e-12) over++
      if (ms >= 780 && s.spring < 0) below++
      if (s.spring > peak) { peak = s.spring; peakT = ms / 1000 }
      previous = s.tween
    }
    return { rising, over, below, peakT }
  })()`)
  assert.equal(scan.rising, 0, "the tween never rises after the release")
  assert.equal(scan.over, 0, "the tween never exceeds 0.10 H")
  assert.equal(scan.below, 0, "the spring never crosses home after 0.78 s")
  near(scan.peakT, 0.5358, 1.5e-3, "the peak comes 46 ms after letting go")
  assert.ok(Math.abs(at(0.59).spring - at(0.59 - 1 / 60).spring) <= 0.03, "no jump at the catch")
})

test("spring-throw: release speed, keyboard throw, rest times and edge resistance", () => {
  const run = load("spring-throw.js")
  const speed = run(`(() => {
    const tracker = createVelocityTracker({})
    for (let i = 0; i <= 6; i++) {
      const t = 0.49 - (6 - i) / 60
      tracker.add(t * 1000, throwFinger(t), 0)
    }
    return tracker.velocity(490).x
  })()`)
  near(speed, 8, 1e-6, "100 ms least-squares slope of the 60 Hz flick")
  const omega = Math.sqrt(320)
  near(run("springAt(0, 8, 1, THROW_OMEGA, 1 / THROW_OMEGA)"), 8 / (Math.E * omega), 1e-12, "peak")
  near(8 / (Math.E * omega), 0.1645, 1e-4, "the keyboard throw peaks at 0.1645 H")
  near(1000 / omega, 55.9, 0.05, "56 ms after the key")
  const rest = (y0, v0, h) =>
    run(`(() => {
      let continuous = 0
      for (let t = 0; t < 2; t += 1e-4) {
        const y = springAt(${y0}, ${v0}, 1, THROW_OMEGA, t)
        const v = springVelocityAt(${y0}, ${v0}, 1, THROW_OMEGA, t)
        if (!(Math.abs(y) * ${h} < 0.5 && Math.abs(v) * ${h} < 5)) continuous = t
      }
      const state = { x: ${y0}, v: ${v0}, target: 0 }
      let stepped = 0
      while (stepped < 2) {
        stepped += 1 / 60
        if (stepSpring(state, THROW_SPRING, 1 / 60, 0.5 / ${h}, 5 / ${h})) break
      }
      return { continuous, stepped }
    })()`)
  for (const [h, expected] of [
    [143.5, 0.408],
    [350, 0.467],
  ]) {
    const r = rest(0, 8, h)
    near(r.continuous, expected, 0.003, `the keyboard throw rests at H ${h}`)
    assert.ok(r.stepped >= r.continuous && r.stepped <= r.continuous + 1 / 60 + 1e-4, `H ${h}`)
  }
  const caught = run("springAt(0.1, 8, 1, THROW_OMEGA, 0.1)")
  for (const [h, expected] of [
    [143.5, 1.137],
    [350, 1.195],
  ]) {
    near(0.78 + rest(caught, 0, h).continuous, expected, 0.003, `recorded rest at H ${h}`)
  }
  near(run("throwResist(1.5)"), 1.2157, 1e-4, "1.5 H of travel shows 1.2157 H")
  near(run("throwResist(1.2)"), 1.0991, 1e-4, "1.2 H of travel shows 1.0991 H")
  near(run("throwResist(-1.5)"), -1.2157, 1e-4, "the left end resists the same way")
  assert.equal(run("throwResist(0.7)"), 0.7)
  for (const u of [-3, -1.4, -0.2, 0.9, 1.01, 2.5]) {
    near(run(`throwUnresist(throwResist(${u}))`), u, 1e-9, `round trip at ${u}`)
  }
  near(run("throwTween(0.1, 0.025)"), 0.0729, 1e-4, "tween 25 ms after the release")
  assert.equal(run("throwTween(0.4, 0.25)"), 0)
})

/* ---------- Escape during a drag, on a stand-in figure ---------- */

// Enough DOM for a widget to mount: nodes keep attributes, children, inline
// style and text, and nothing is laid out.
function fakeNode(tag) {
  const attrs = new Map()
  return {
    tag,
    style: {},
    textContent: "",
    parentNode: null,
    children: [],
    classList: { add() {}, remove() {}, contains: () => false },
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
    appendChild(child) {
      return this.insertBefore(child, null)
    },
    insertBefore(child, ref) {
      const from = child.parentNode
      if (from) from.children.splice(from.children.indexOf(child), 1)
      const at = ref ? this.children.indexOf(ref) : -1
      this.children.splice(at < 0 ? this.children.length : at, 0, child)
      child.parentNode = this
      return child
    },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  }
}

function findNode(node, cls) {
  if ((node.getAttribute("class") || "").split(" ").includes(cls)) return node
  for (const child of node.children) {
    const hit = findNode(child, cls)
    if (hit) return hit
  }
  return null
}

// Mounts a widget on a stand-in fig whose surfaces are `width` px wide. The
// handlers the widget gives fig.drag are kept so a test can call them the way
// createDrag does, and the widget's loop runs only inside frames().
function mountWidget(file, width) {
  const context = vm.createContext({
    WIDGETS: {},
    performance,
    setTimeout: () => 0,
    clearTimeout: () => {},
    document: {
      createElement: (tag) => fakeNode(tag),
      createElementNS: (ns, tag) => fakeNode(tag),
      createTextNode: (text) => Object.assign(fakeNode("#text"), { textContent: text }),
    },
  })
  for (const name of ["motion.js", "corner.js", "drag.js", file]) {
    const dir = name === file ? WIDGETS_DIR : RUNTIME_DIR
    vm.runInContext(read(dir, name), context, { filename: name })
  }
  const run = (source) => vm.runInContext(source, context)
  const runtime = run("({ createSpring, createKeySlider, rubberBand, rubberBandInverse })")
  const announced = []
  const drags = []
  const loop = { step: null, running: false }
  const box = fakeNode("div")
  const rail = fakeNode("div")
  const fig = {
    box,
    rail,
    strings: (table) => table.en,
    size: () => "wide",
    width: () => width,
    svg: ({ parent }) => {
      const el = parent.appendChild(fakeNode("svg"))
      el.setAttribute("class", "essay-fig__svg")
      return { el, width: () => width, height: () => width / 2 }
    },
    button: () => ({ el: rail.appendChild(fakeNode("button")) }),
    press: () => ({}),
    listen: () => {},
    announce: (text) => announced.push(text),
    spring: (o) => runtime.createSpring({ ...o, reducedMotion: () => false }),
    loop: (step) => {
      loop.step = step
      return {
        start: () => (loop.running = true),
        stop: () => (loop.running = false),
        running: () => loop.running,
      }
    },
    drag: (el, handlers) => drags.push(handlers),
    keySlider: (el, o) => runtime.createKeySlider(el, { announce: fig.announce, ...o }),
    rubberBand: runtime.rubberBand,
    rubberBandInverse: runtime.rubberBandInverse,
    reducedMotion: () => false,
    onReducedMotionChange: () => {},
    onSizeChange: () => {},
    onReset: () => {},
    model: () => {},
  }
  context.WIDGETS[file.replace(/\.js$/, "")](fig)
  assert.equal(drags.length, 1)
  return {
    run,
    announced,
    root: box.children[0],
    drag: drags[0],
    // At most n frames of 1/60 s, stopping when the loop does.
    frames(n = 600) {
      for (let i = 0; i < n && loop.running; i++) {
        if (loop.step(1 / 60) === false) loop.running = false
      }
    },
  }
}

const at = (x) => ({ x, y: 0 })

test("zeta-triptych: Escape settles back to the press value; release and pointercancel commit", () => {
  const w = mountWidget("zeta-triptych.js", 600)
  const knob = findNode(w.root, "zeta-triptych__knob")
  const zeta = () => w.root.getAttribute("data-zeta")
  const phase = () => w.root.getAttribute("data-phase")
  const knobX = () => Number(/translate3d\(([-\d.]+)px/.exec(knob.style.transform)[1]) + 22
  const x1 = knobX()
  near(x1, 22 + (0.7 / 1.7) * 556, 0.1, "ζ 1 on a 600 px strip")

  w.drag.onStart(at(x1))
  w.drag.onMove(at(x1 - 60), at(-60))
  assert.notEqual(zeta(), "1.000")
  w.drag.onCancel(at(x1 - 60), { key: "Escape" })
  assert.equal(phase(), "settling", "the knob springs back from where it was")
  w.frames()
  assert.equal(zeta(), "1.000")
  assert.equal(phase(), "rest")
  near(knobX(), x1, 0.1, "the knob is back on ζ 1")
  assert.equal(knob.getAttribute("aria-valuenow"), "1")
  assert.deepEqual(w.announced, [], "a cancelled drag announces nothing")

  // A press away from the knob brings the knob to the pointer; Escape undoes that too.
  w.drag.onStart(at(x1 + 150))
  assert.notEqual(zeta(), "1.000")
  w.drag.onMove(at(x1 + 170), at(20))
  w.drag.onCancel(at(x1 + 170), { key: "Escape" })
  w.frames()
  assert.equal(zeta(), "1.000")
  assert.deepEqual(w.announced, [])

  // pointerup and pointercancel both end in onEnd, which keeps the dragged value.
  w.drag.onStart(at(x1))
  w.drag.onMove(at(x1 - 60), at(-60))
  const dragged = zeta()
  w.drag.onEnd(at(x1 - 60), at(0), { type: "pointercancel" })
  w.frames()
  assert.equal(zeta(), dragged)
  assert.equal(Number(knob.getAttribute("aria-valuenow")).toFixed(3), dragged)
  assert.equal(w.announced.length, 1)

  // Caught during a detent settle, Escape returns to the value the settle was heading for.
  const from = knobX()
  w.drag.onStart(at(from))
  w.drag.onMove(at(x1 - 3), at(x1 - 3 - from))
  w.drag.onEnd(at(x1 - 3), at(0), { type: "pointerup" })
  assert.equal(phase(), "settling")
  w.frames(3)
  const caught = knobX()
  w.drag.onStart(at(caught))
  w.drag.onMove(at(caught - 80), at(-80))
  w.drag.onCancel(at(caught - 80), { key: "Escape" })
  w.frames()
  assert.equal(zeta(), "1.000")
  near(knobX(), x1, 0.1, "the knob is on ζ 1")
  assert.equal(w.announced.length, 2, "only the two releases announce")
})

test("curvature-comb: Escape settles back to the press radius; release and pointercancel commit", () => {
  const w = mountWidget("curvature-comb.js", 600)
  const knob = findNode(w.root, "curvature-comb__knob")
  const rho = () => w.root.getAttribute("data-rho")
  const phase = () => w.root.getAttribute("data-phase")
  const knobX = () => Number(/translate3d\(([-\d.]+)px/.exec(knob.style.transform)[1])
  const rho0 = w.run("combRho0()")
  const r = (600 - 16) / 2.35
  const x0 = knobX()
  assert.equal(rho(), rho0.toFixed(3))

  w.drag.onStart(at(0))
  w.drag.onMove(at(60), at(60))
  assert.equal(rho(), (rho0 + 60 / r).toFixed(3))
  w.drag.onCancel(at(60), { key: "Escape" })
  assert.equal(phase(), "settling", "the knob springs back from where it was")
  w.frames()
  assert.equal(rho(), rho0.toFixed(3))
  assert.equal(phase(), "rest")
  near(knobX(), x0, 0.1, "the knob is back on rho0")
  assert.equal(knob.getAttribute("aria-valuenow"), String(rho0))
  assert.deepEqual(w.announced, [], "a cancelled drag announces nothing")

  // pointerup and pointercancel both end in onEnd, which keeps the dragged radius.
  w.drag.onStart(at(0))
  w.drag.onMove(at(60), at(60))
  const dragged = rho()
  w.drag.onEnd(at(60), at(0), { type: "pointercancel" })
  w.frames()
  assert.equal(rho(), dragged)
  assert.equal(Number(knob.getAttribute("aria-valuenow")).toFixed(3), dragged)

  // Caught during a detent settle, Escape returns to the detent the settle was heading for.
  const now = Number(knob.getAttribute("aria-valuenow"))
  w.drag.onStart(at(0))
  w.drag.onMove(at(1), at((0.99 - now) * r))
  w.drag.onEnd(at(1), at(0), { type: "pointerup" })
  assert.equal(phase(), "settling")
  w.frames(3)
  w.drag.onStart(at(0))
  w.drag.onMove(at(1), at(-100))
  w.drag.onCancel(at(1), { key: "Escape" })
  w.frames()
  assert.equal(rho(), "1.000")
  near(knobX(), x0 + (1 - rho0) * r, 0.1, "the knob is on the 1.00 detent")
})
