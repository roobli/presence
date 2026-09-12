/* curvature-comb: zebra stripes and a curvature comb on one plate corner, G1 against continuous. */

WIDGETS["curvature-comb"] = function (root) {
  var mode = "g1" // g1 | continuous
  var showComb = true
  var showZebra = true

  var live = el("div", {
    class: "essay-interactive__live",
    role: "status",
    "aria-live": "polite",
  })
  var toggleG1 = el("button", {
    type: "button",
    class: "essay-interactive__btn is-active",
    text: "G1",
    "aria-pressed": "true",
  })
  var toggleCont = el("button", {
    type: "button",
    class: "essay-interactive__btn",
    text: "Continuous",
    "aria-pressed": "false",
  })
  var combCheck = el("input", {
    type: "checkbox",
    id: "essay-comb-" + Math.random().toString(36).slice(2, 8),
    "aria-label": "Show curvature comb",
  })
  combCheck.checked = true
  var zebraCheck = el("input", {
    type: "checkbox",
    id: "essay-zebra-" + Math.random().toString(36).slice(2, 8),
    "aria-label": "Show zebra stripes",
  })
  zebraCheck.checked = true

  var combLabel = el("label", { class: "essay-interactive__check", for: combCheck.id })
  combLabel.appendChild(combCheck)
  combLabel.appendChild(document.createTextNode("Show comb"))
  var zebraLabel = el("label", { class: "essay-interactive__check", for: zebraCheck.id })
  zebraLabel.appendChild(zebraCheck)
  zebraLabel.appendChild(document.createTextNode("Show zebra"))

  var canvas = el("canvas", {
    class: "essay-interactive__canvas",
    width: "640",
    height: "300",
    role: "img",
    "aria-label": "Corner schematic with zebra stripes and curvature comb",
  })
  var footnote = el("div", {
    class: "essay-interactive__footnote",
    text: "curvature jump vs ramp",
  })

  root.appendChild(
    el("div", { class: "essay-interactive__card" }, [
      el("div", {
        class: "essay-interactive__title",
        text: "Curvature comb · G1 jump vs continuous ramp",
      }),
      el("div", { class: "essay-interactive__controls" }, [
        el("div", { class: "essay-interactive__row essay-interactive__row--actions" }, [
          toggleG1,
          toggleCont,
        ]),
        el("div", { class: "essay-interactive__row essay-interactive__row--check" }, [
          combLabel,
          zebraLabel,
        ]),
      ]),
      canvas,
      footnote,
      live,
    ]),
  )

  var surface = createSurface(canvas, 300, paint)

  function setMode(next) {
    mode = next
    toggleG1.classList.toggle("is-active", mode === "g1")
    toggleCont.classList.toggle("is-active", mode === "continuous")
    toggleG1.setAttribute("aria-pressed", mode === "g1" ? "true" : "false")
    toggleCont.setAttribute("aria-pressed", mode === "continuous" ? "true" : "false")
    surface.draw()
    announce(
      live,
      mode === "g1" ? "G1 circular fillet: curvature jump" : "Continuous blend: curvature ramp",
    )
  }

  // Sample points along a plate-corner silhouette (top edge → corner → right edge)
  function sampleG1Corner(cx, cy, r, n) {
    var pts = []
    var i
    // approach along top edge
    for (i = 0; i <= 12; i++) {
      var u = i / 12
      pts.push({ x: cx - r - (1 - u) * 70, y: cy - r, s: u * 0.15, kappa: 0 })
    }
    // circular arc 90°
    for (i = 0; i <= n; i++) {
      var t = i / n
      var ang = -Math.PI / 2 + t * (Math.PI / 2)
      pts.push({
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r,
        s: 0.15 + t * 0.7,
        kappa: 1 / r,
      })
    }
    // exit down right edge
    for (i = 1; i <= 12; i++) {
      var v = i / 12
      pts.push({ x: cx + r, y: cy + r + v * 70, s: 0.85 + v * 0.15, kappa: 0 })
    }
    return pts
  }

  function sampleContinuousCorner(cx, cy, r, n) {
    // Match G1: arc center (cx,cy) ⇒ sharp tip at (cx+r, cy-r)
    var tipX = cx + r
    var tipY = cy - r
    var pts = []
    var i
    for (i = 0; i <= 10; i++) {
      var u = i / 10
      pts.push({ x: tipX - r - (1 - u) * 70, y: tipY, s: u * 0.12, kappa: 0 })
    }
    // sample three cubic segments
    var segs = CORNER_SEGS
    var total = segs.length * (n + 1)
    var idx = 0
    for (var s = 0; s < segs.length; s++) {
      var seg = segs[s]
      for (i = 0; i <= n; i++) {
        if (s > 0 && i === 0) continue
        var t = i / n
        var mt = 1 - t
        var p0 = mapCorner(seg[0], 0, tipX, tipY, r)
        var p1 = mapCorner(seg[1], 0, tipX, tipY, r)
        var p2 = mapCorner(seg[2], 0, tipX, tipY, r)
        var p3 = mapCorner(seg[3], 0, tipX, tipY, r)
        var x =
          mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0]
        var y =
          mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
        // raised-cosine-ish kappa along blend
        var sNorm = (s + t) / segs.length
        var w = Math.sin(Math.PI * sNorm)
        var kappa = (w * w * 1.15) / Math.max(r, 0.001)
        pts.push({ x: x, y: y, s: 0.12 + sNorm * 0.76, kappa: kappa })
        idx++
      }
    }
    var last = pts[pts.length - 1]
    for (i = 1; i <= 10; i++) {
      var v = i / 10
      pts.push({ x: last.x, y: last.y + v * 70, s: 0.88 + v * 0.12, kappa: 0 })
    }
    return pts
  }

  function offsetNormal(pts, i, dist) {
    var i0 = Math.max(0, i - 1)
    var i1 = Math.min(pts.length - 1, i + 1)
    var dx = pts[i1].x - pts[i0].x
    var dy = pts[i1].y - pts[i0].y
    var len = Math.sqrt(dx * dx + dy * dy) || 1
    // outward normal (rotate tangent left for our TR-ish path going right then down → inward is down-right; use + for "outside" of plate)
    var nx = -dy / len
    var ny = dx / len
    // Prefer normals pointing toward upper-right exterior for a bottom-left plate
    if (nx + ny < 0) {
      nx = -nx
      ny = -ny
    }
    return { x: pts[i].x + nx * dist, y: pts[i].y + ny * dist, nx: nx, ny: ny }
  }

  function paint(ctx, cssW, cssH, pal) {
    var ink = pal.ink
    var muted = pal.muted
    var canvasBg = pal.canvas
    var line = pal.line
    var accent = pal.accent
    var fontUi = pal.fontUi

    ctx.fillStyle = pal.surface
    ctx.fillRect(0, 0, cssW, cssH)

    // Layout: left schematic, right comb plot
    var leftCx = cssW * 0.32
    var leftCy = cssH * 0.42
    var r = Math.min(54, cssW * 0.09)

    var pts =
      mode === "g1"
        ? sampleG1Corner(leftCx, leftCy, r, 36)
        : sampleContinuousCorner(leftCx, leftCy, r, 14)

    // Fill plate body (below/left of silhouette)
    ctx.beginPath()
    ctx.moveTo(leftCx - r - 70, cssH - 24)
    ctx.lineTo(leftCx - r - 70, leftCy - r)
    for (var i = 0; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.lineTo(leftCx + r + 8, cssH - 24)
    ctx.closePath()
    ctx.fillStyle = canvasBg
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Redraw silhouette stroke cleanly
    ctx.beginPath()
    for (i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y)
      else ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.8
    ctx.stroke()

    // Zebra stripes: reflection-line proxies across the corner band
    if (showZebra) {
      var bandStart = Math.floor(pts.length * 0.12)
      var bandEnd = Math.floor(pts.length * 0.88)
      var stripeCount = 9
      for (var s = 0; s < stripeCount; s++) {
        var t0 = bandStart + ((bandEnd - bandStart) * s) / (stripeCount - 1)
        var ti = Math.round(t0)
        ti = Math.max(1, Math.min(pts.length - 2, ti))
        var outer = offsetNormal(pts, ti, 28)
        var inner = offsetNormal(pts, ti, -10)
        ctx.beginPath()
        if (mode === "g1") {
          // broken / kinked zebra: two segments with a visible break at the join feel
          var mid = offsetNormal(pts, ti, 8)
          // Introduce a small lateral kink for G1 discontinuity cue
          var kink = 4 * (s % 2 === 0 ? 1 : -1)
          ctx.moveTo(outer.x, outer.y)
          ctx.lineTo(mid.x + kink, mid.y + kink * 0.3)
          ctx.moveTo(mid.x + kink, mid.y + kink * 0.3)
          ctx.lineTo(inner.x, inner.y)
          ctx.strokeStyle = accent
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 1.2
          ctx.stroke()
          ctx.globalAlpha = 1
        } else {
          ctx.moveTo(outer.x, outer.y)
          ctx.lineTo(inner.x, inner.y)
          ctx.strokeStyle = accent
          ctx.globalAlpha = 0.5
          ctx.lineWidth = 1.2
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
    }

    // Curvature comb teeth along the corner
    if (showComb) {
      var cStart = Math.floor(pts.length * 0.1)
      var cEnd = Math.floor(pts.length * 0.9)
      var teeth = 22
      var kMax = 0
      for (i = 0; i < pts.length; i++) {
        if (pts[i].kappa > kMax) kMax = pts[i].kappa
      }
      kMax = Math.max(kMax, 1e-6)
      for (var t = 0; t <= teeth; t++) {
        var ci = Math.round(cStart + ((cEnd - cStart) * t) / teeth)
        ci = Math.max(0, Math.min(pts.length - 1, ci))
        var mag = (pts[ci].kappa / kMax) * 36
        if (mode === "g1") {
          // stepped / sawtooth envelope: flat zero then hard plateau
          var sParam = (ci - cStart) / Math.max(1, cEnd - cStart)
          if (sParam < 0.12 || sParam > 0.88) mag = 0
          else mag = 36
        }
        var tip = offsetNormal(pts, ci, 6 + mag)
        ctx.beginPath()
        ctx.moveTo(pts[ci].x, pts[ci].y)
        ctx.lineTo(tip.x, tip.y)
        ctx.strokeStyle = ink
        ctx.globalAlpha = 0.7
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      // envelope polyline
      ctx.beginPath()
      var envStarted = false
      for (t = 0; t <= teeth; t++) {
        ci = Math.round(cStart + ((cEnd - cStart) * t) / teeth)
        ci = Math.max(0, Math.min(pts.length - 1, ci))
        mag = (pts[ci].kappa / kMax) * 36
        if (mode === "g1") {
          sParam = (ci - cStart) / Math.max(1, cEnd - cStart)
          if (sParam < 0.12 || sParam > 0.88) mag = 0
          else mag = 36
        }
        tip = offsetNormal(pts, ci, 6 + mag)
        if (!envStarted) {
          ctx.moveTo(tip.x, tip.y)
          envStarted = true
        } else ctx.lineTo(tip.x, tip.y)
      }
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.4
      ctx.globalAlpha = 0.85
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Right-side kappa strip chart
    var plotL = cssW * 0.62
    var plotR = cssW - 18
    var plotT = 36
    var plotB = cssH - 48
    ctx.strokeStyle = line
    ctx.lineWidth = 1
    ctx.fillStyle = canvasBg
    ctx.fillRect(plotL, plotT, plotR - plotL, plotB - plotT)
    ctx.strokeRect(plotL, plotT, plotR - plotL, plotB - plotT)
    ctx.fillStyle = muted
    ctx.font = "11px " + fontUi
    ctx.fillText("κ(s)", plotL + 6, plotT + 14)

    var kpts = mode === "g1" ? sampleCurvatureG1(r, 80) : sampleCurvatureG2(r, 80)
    var km = 0
    for (i = 0; i < kpts.length; i++) if (kpts[i].k > km) km = kpts[i].k
    km = Math.max(km, 1e-6)
    ctx.beginPath()
    for (i = 0; i < kpts.length; i++) {
      var px = plotL + kpts[i].s * (plotR - plotL)
      var py = plotB - (kpts[i].k / km) * (plotB - plotT - 16)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = mode === "g1" ? accent : ink
    ctx.lineWidth = 1.6
    if (mode === "g1") ctx.setLineDash([])
    ctx.stroke()

    // Mode caption
    ctx.fillStyle = muted
    ctx.font = "12px " + fontUi
    ctx.fillText(mode === "g1" ? "G1 · circular fillet" : "Continuous · smooth blend", 18, cssH - 16)
    ctx.fillText(mode === "g1" ? "stepped comb" : "smooth envelope", plotL, cssH - 16)
  }

  toggleG1.addEventListener("click", function () {
    setMode("g1")
  })
  toggleCont.addEventListener("click", function () {
    setMode("continuous")
  })
  combCheck.addEventListener("change", function () {
    showComb = combCheck.checked
    surface.draw()
  })
  zebraCheck.addEventListener("change", function () {
    showZebra = zebraCheck.checked
    surface.draw()
  })

  surface.draw()
  announce(live, "G1 circular fillet: curvature jump")

  return {
    destroy: function () {
      surface.destroy()
    },
  }
}
