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
