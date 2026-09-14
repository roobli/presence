/**
 * Corner geometry for curvature-comb. Units of r with y down, in the frame of
 * the essay's control-point table: an upper right corner whose sharp tip is at
 * (1, 0), entered along the top edge y = 0 and left along the right edge x = 1.
 * The continuous path is the table's three cubics between two straights; the
 * arc path is a circular quarter of radius rho between the same straights.
 * Nothing here touches the DOM when the file loads, so node:vm can load it.
 */

// The essay's control-point table (lines 153 to 157), one corner at r = 1.
var CORNER_SEGS = [
  [
    [0.0, 0.0],
    [0.3, 0.0],
    [0.473, 0.0],
    [0.619, 0.039],
  ],
  [
    [0.619, 0.039],
    [0.804, 0.088],
    [0.912, 0.196],
    [0.961, 0.381],
  ],
  [
    [0.961, 0.381],
    [1.0, 0.527],
    [1.0, 0.7],
    [1.0, 1.0],
  ],
]

var CORNER_TABLE_STEPS = 1024

/**
 * mapCorner(x, y, ox, oy, rPx, out): screen position of a table-frame point,
 * drawn mirrored as a top-left corner whose tip sits at (ox, oy), so a growing
 * radius, a rightward drag and ArrowRight agree. Writes out.x and out.y.
 */
function mapCorner(x, y, ox, oy, rPx, out) {
  out.x = ox + (1 - x) * rPx
  out.y = oy + y * rPx
  return out
}

/* ---------- cubics ---------- */

function bezierPoint(seg, t, out) {
  var u = 1 - t
  var a = u * u * u
  var b = 3 * u * u * t
  var c = 3 * u * t * t
  var d = t * t * t
  out.x = a * seg[0][0] + b * seg[1][0] + c * seg[2][0] + d * seg[3][0]
  out.y = a * seg[0][1] + b * seg[1][1] + c * seg[2][1] + d * seg[3][1]
  return out
}

// First derivative into out.dx, out.dy and second into out.ddx, out.ddy.
function bezierDerivatives(seg, t, out) {
  var u = 1 - t
  var p0 = seg[0]
  var p1 = seg[1]
  var p2 = seg[2]
  var p3 = seg[3]
  out.dx = 3 * (u * u * (p1[0] - p0[0]) + 2 * u * t * (p2[0] - p1[0]) + t * t * (p3[0] - p2[0]))
  out.dy = 3 * (u * u * (p1[1] - p0[1]) + 2 * u * t * (p2[1] - p1[1]) + t * t * (p3[1] - p2[1]))
  out.ddx = 6 * (u * (p2[0] - 2 * p1[0] + p0[0]) + t * (p3[0] - 2 * p2[0] + p1[0]))
  out.ddy = 6 * (u * (p2[1] - 2 * p1[1] + p0[1]) + t * (p3[1] - 2 * p2[1] + p1[1]))
  return out
}

var cornerScratch = { x: 0, y: 0, dx: 0, dy: 0, ddx: 0, ddy: 0 }

// Signed curvature (x'y'' - y'x'') / (x'^2 + y'^2)^(3/2); positive where the
// path turns clockwise on screen, which is the corner's turn with y down.
function bezierCurvature(seg, t) {
  var d = bezierDerivatives(seg, t, cornerScratch)
  var speed2 = d.dx * d.dx + d.dy * d.dy
  return (d.dx * d.ddy - d.dy * d.ddx) / Math.pow(speed2, 1.5)
}

/* ---------- paths resampled by arc length ---------- */

/**
 * cornerPieces(): the continuous path as pieces, straight (-1, 0) to (0, 0),
 * the three cubics, straight (1, 1) to (1, 2). Each cubic carries a cumulative
 * chord-length table over CORNER_TABLE_STEPS equal steps in t, so a local arc
 * length maps back to t. Built once per figure.
 */
function cornerPieces() {
  var pieces = [{ line: true, ax: -1, ay: 0, bx: 0, by: 0, len: 1 }]
  var p = { x: 0, y: 0 }
  for (var i = 0; i < CORNER_SEGS.length; i++) {
    var seg = CORNER_SEGS[i]
    var table = new Float64Array(CORNER_TABLE_STEPS + 1)
    var px = seg[0][0]
    var py = seg[0][1]
    for (var j = 1; j <= CORNER_TABLE_STEPS; j++) {
      bezierPoint(seg, j / CORNER_TABLE_STEPS, p)
      table[j] = table[j - 1] + Math.hypot(p.x - px, p.y - py)
      px = p.x
      py = p.y
    }
    pieces.push({ line: false, seg: seg, table: table, len: table[CORNER_TABLE_STEPS] })
  }
  pieces.push({ line: true, ax: 1, ay: 1, bx: 1, by: 2, len: 1 })
  var start = 0
  for (var k = 0; k < pieces.length; k++) {
    pieces[k].start = start
    start += pieces[k].len
  }
  return pieces
}

function piecesLength(pieces) {
  var last = pieces[pieces.length - 1]
  return last.start + last.len
}

// Total arc length of the three cubics (the corner without its straights).
function cornerCubicLength(pieces) {
  var total = 0
  for (var i = 0; i < pieces.length; i++) if (!pieces[i].line) total += pieces[i].len
  return total
}

/**
 * piecePoint(piece, u, out): the point at local arc length u along a piece,
 * with out.x, out.y, the curvature out.k and the outward unit normal
 * (dy, -dx) / |d| in out.nx, out.ny ((0, -1) on the top edge, (1, 0) on the
 * right edge).
 */
function piecePoint(piece, u, out) {
  if (piece.line) {
    var f = piece.len > 0 ? Math.min(1, Math.max(0, u / piece.len)) : 0
    var ex = piece.bx - piece.ax
    var ey = piece.by - piece.ay
    var el = Math.hypot(ex, ey) || 1
    out.x = piece.ax + ex * f
    out.y = piece.ay + ey * f
    out.k = 0
    out.nx = ey / el
    out.ny = -ex / el
    return out
  }
  var table = piece.table
  var target = Math.min(piece.len, Math.max(0, u))
  var lo = 0
  var hi = CORNER_TABLE_STEPS
  while (hi - lo > 1) {
    var mid = (lo + hi) >> 1
    if (table[mid] < target) lo = mid
    else hi = mid
  }
  var span = table[hi] - table[lo]
  var t = (lo + (span > 0 ? (target - table[lo]) / span : 0)) / CORNER_TABLE_STEPS
  bezierPoint(piece.seg, t, out)
  var d = bezierDerivatives(piece.seg, t, cornerScratch)
  var speed = Math.hypot(d.dx, d.dy) || 1
  out.k = (d.dx * d.ddy - d.dy * d.ddx) / (speed * speed * speed)
  out.nx = d.dy / speed
  out.ny = -d.dx / speed
  return out
}

/**
 * resamplePieces(pieces, step): the path resampled every step of arc length,
 * plus its end. Returns {n, s, x, y, k, nx, ny} in typed arrays. Built once.
 */
function resamplePieces(pieces, step) {
  var total = piecesLength(pieces)
  var n = Math.floor(total / step + 1e-9) + 1
  if ((n - 1) * step < total - 1e-9) n += 1
  var out = {
    n: n,
    s: new Float64Array(n),
    x: new Float64Array(n),
    y: new Float64Array(n),
    k: new Float64Array(n),
    nx: new Float64Array(n),
    ny: new Float64Array(n),
  }
  var p = { x: 0, y: 0, k: 0, nx: 0, ny: 0 }
  var at = 0
  for (var i = 0; i < n; i++) {
    var s = Math.min(total, i * step)
    while (at < pieces.length - 1 && s > pieces[at].start + pieces[at].len) at += 1
    piecePoint(pieces[at], s - pieces[at].start, p)
    out.s[i] = s
    out.x[i] = p.x
    out.y[i] = p.y
    out.k[i] = p.k
    out.nx[i] = p.nx
    out.ny[i] = p.ny
  }
  return out
}

/**
 * arcPathPoint(rho, s, out): the arc path at arc length s from (-1, 0): straight
 * to (1 - rho, 0), a clockwise quarter circle about (1 - rho, rho) to (1, rho),
 * then straight to (1, 2). Same fields as piecePoint. Analytic, no tables.
 */
function arcPathPoint(rho, s, out) {
  var entry = 2 - rho
  var quarter = (Math.PI * rho) / 2
  if (s <= entry) {
    out.x = -1 + Math.max(0, s)
    out.y = 0
    out.k = 0
    out.nx = 0
    out.ny = -1
  } else if (s < entry + quarter) {
    var phi = (s - entry) / rho
    var sn = Math.sin(phi)
    var cs = Math.cos(phi)
    out.x = 1 - rho + rho * sn
    out.y = rho - rho * cs
    out.k = 1 / rho
    out.nx = sn
    out.ny = -cs
  } else {
    out.x = 1
    out.y = rho + Math.min(entry, s - entry - quarter)
    out.k = 0
    out.nx = 1
    out.ny = 0
  }
  return out
}

function arcPathLength(rho) {
  return 2 * (2 - rho) + (Math.PI * rho) / 2
}

/**
 * fillArcSamples(rho, step, xs, ys): the arc path every step of arc length plus
 * its end, written into preallocated arrays. Returns the sample count.
 */
var arcScratch = { x: 0, y: 0, k: 0, nx: 0, ny: 0 }

function fillArcSamples(rho, step, xs, ys) {
  var total = arcPathLength(rho)
  var n = 0
  for (var s = 0; s < total - 1e-9 && n < xs.length - 1; s += step) {
    arcPathPoint(rho, s, arcScratch)
    xs[n] = arcScratch.x
    ys[n] = arcScratch.y
    n += 1
  }
  arcPathPoint(rho, total, arcScratch)
  xs[n] = arcScratch.x
  ys[n] = arcScratch.y
  return n + 1
}

/* ---------- distance between outlines ---------- */

// Distance from (px, py) to the polyline (xs, ys) of n points: the nearest
// vertex, then the two segments that meet there. No allocation.
function polylineDistance(px, py, xs, ys, n) {
  var best = Infinity
  var at = 0
  for (var i = 0; i < n; i++) {
    var dx = xs[i] - px
    var dy = ys[i] - py
    var d2 = dx * dx + dy * dy
    if (d2 < best) {
      best = d2
      at = i
    }
  }
  for (var j = Math.max(0, at - 1); j < Math.min(n - 1, at + 1); j++) {
    var ax = xs[j]
    var ay = ys[j]
    var ex = xs[j + 1] - ax
    var ey = ys[j + 1] - ay
    var len2 = ex * ex + ey * ey
    if (!(len2 > 0)) continue
    var f = ((px - ax) * ex + (py - ay) * ey) / len2
    if (f <= 0 || f >= 1) continue
    var qx = ax + f * ex - px
    var qy = ay + f * ey - py
    var q2 = qx * qx + qy * qy
    if (q2 < best) best = q2
  }
  return Math.sqrt(best)
}

/**
 * hausdorff(ax, ay, na, bx, by, nb): the two-way Hausdorff distance between two
 * sampled outlines, the largest distance from a point on either one to the
 * other. O(na * nb), no allocation.
 */
function hausdorff(ax, ay, na, bx, by, nb) {
  var worst = 0
  var i
  var d
  for (i = 0; i < na; i++) {
    d = polylineDistance(ax[i], ay[i], bx, by, nb)
    if (d > worst) worst = d
  }
  for (i = 0; i < nb; i++) {
    d = polylineDistance(bx[i], by[i], ax, ay, na)
    if (d > worst) worst = d
  }
  return worst
}
