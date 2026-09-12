/**
 * Corner geometry shared by squircle-compare and curvature-comb.
 */

// Three-segment cubic Bézier for one continuous corner at r=1 (article table).
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

function mapCorner(pt, corner, tipX, tipY, r) {
  var x = pt[0]
  var y = pt[1]
  // corner: 0=TR, 1=BR, 2=BL, 3=TL; the article table rotated CW around the tip
  if (corner === 0) return [tipX - r + x * r, tipY + y * r]
  if (corner === 1) return [tipX - y * r, tipY - r + x * r]
  if (corner === 2) return [tipX + r - x * r, tipY - y * r]
  return [tipX + y * r, tipY + r - x * r]
}

function sampleCurvatureG1(r, n) {
  // Normalized arc-length-ish parameter 0..1 across one corner: flat, jump to 1/r, flat
  var pts = []
  for (var i = 0; i <= n; i++) {
    var s = i / n
    var kappa = 0
    if (s > 0.15 && s < 0.85) kappa = 1 / Math.max(r, 0.001)
    pts.push({ s: s, k: kappa })
  }
  // sharpen the jump edges
  return pts
}

function sampleCurvatureG2(r, n) {
  var pts = []
  for (var i = 0; i <= n; i++) {
    var s = i / n
    // smooth raised-cosine ramp peaking mid-corner
    var w = Math.sin(Math.PI * s)
    var kappa = (w * w * 1.15) / Math.max(r, 0.001)
    pts.push({ s: s, k: kappa })
  }
  return pts
}
