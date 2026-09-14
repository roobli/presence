/* curvature-comb: one corner drawn two ways and overlaid. The essay's
 * three-cubic continuous corner is solid; a circular arc is dashed and carries
 * comb teeth. Both comb envelopes share one scale, and a strip below plots
 * curvature for both. The reader drags the arc radius along the top edge; no
 * radius removes the step at the joins. Geometry lives in runtime/corner.js.
 * Only function declarations, constants and the WIDGETS assignment run when the
 * file loads, so node:vm can load it with { WIDGETS: {} }. */

var COMB_STRINGS = {
  en: {
    legendCont: "Continuous corner, from the essay's control-point table",
    legendArc: "Circular arc (G1)",
    legendTeeth: "comb teeth on the arc",
    knob: "Arc radius",
    touch: "apexes touch",
    same: "same tangent points",
    stripY: "curvature × r",
    stripX: "position along the corner",
    apex: "apex",
    readout:
      "Arc radius {rho} r · outlines differ by at most {gap} r · arc curvature jumps from 0 to {k}/r · continuous corner peaks at {peak}/r",
    valueText:
      "Arc radius {rho} r, outlines differ by at most {gap} r, arc curvature jumps from 0 to {k} over r",
    detent: ", {word}",
  },
  "zh-Hans": {
    legendCont: "连续转角（取自正文控制点表）",
    legendArc: "圆弧（G1）",
    legendTeeth: "圆弧上的曲率梳",
    knob: "圆弧半径",
    touch: "顶点重合",
    same: "切点相同",
    stripY: "曲率 × r",
    stripX: "沿转角的位置",
    apex: "顶点",
    readout:
      "圆弧半径 {rho} r · 两条轮廓最多相差 {gap} r · 圆弧曲率从 0 一步跳到 {k}/r · 连续转角峰值为 {peak}/r",
    valueText: "圆弧半径 {rho} r，两条轮廓最多相差 {gap} r，圆弧曲率从 0 跳到 {k}/r",
    detent: "，{word}",
  },
}

var COMB_MIN = 0.35
var COMB_MAX = 1.8
var COMB_KEY_STEP = 0.05
var COMB_SHIFT_STEP = 0.2
var COMB_DETENT = 0.03
var COMB_TOOTH = 0.1184 // tooth length in r_px per unit of curvature × r
var COMB_TOOTH_GAP = 6 // px of arc length between arc teeth
var COMB_ENV_GAP = 2 // px between envelope points
var COMB_GAP_STEP = 0.005 // r between samples for the outline gap
var COMB_GAP_MS = 100
var COMB_STRIP_SPAN = 1.5
var COMB_STRIP_MAX = 3
var COMB_SVG = "http://www.w3.org/2000/svg"

/* ---------- pure models (window.__essayInteractives.models) ---------- */

function combApexDistance() {
  var p = bezierPoint(CORNER_SEGS[1], 0.5, { x: 0, y: 0 })
  return Math.hypot(1 - p.x, p.y)
}

// The arc radius whose apex touches the table's apex.
function combRho0() {
  return combApexDistance() / (Math.SQRT2 - 1)
}

function combArcLength() {
  return cornerCubicLength(cornerPieces())
}

// Curvature × r on either side of the first internal join.
function combJoinKappa() {
  return [bezierCurvature(CORNER_SEGS[0], 1), bezierCurvature(CORNER_SEGS[1], 0)]
}

function combPeakKappa() {
  return bezierCurvature(CORNER_SEGS[1], 0.5)
}

function combArcCapacity() {
  return Math.ceil(arcPathLength(COMB_MIN) / COMB_GAP_STEP) + 2
}

function combHausdorff(rho) {
  var cont = resamplePieces(cornerPieces(), COMB_GAP_STEP)
  var xs = new Float64Array(combArcCapacity())
  var ys = new Float64Array(xs.length)
  var n = fillArcSamples(rho, COMB_GAP_STEP, xs, ys)
  return hausdorff(cont.x, cont.y, cont.n, xs, ys, n)
}

function combFill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (all, key) {
    return values[key]
  })
}

function combNode(ns, tag, cls, parent) {
  var node = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  if (cls) node.setAttribute("class", cls)
  if (parent) parent.appendChild(node)
  return node
}

function combRound(v) {
  return Math.round(v * 10) / 10
}

/* ---------- widget ---------- */

WIDGETS["curvature-comb"] = function (fig) {
  var s = fig.strings(COMB_STRINGS)
  var rho0 = combRho0()
  var pieces = cornerPieces()
  var half = cornerCubicLength(pieces) / 2
  var apexAt = pieces[1].start + half
  var peak = combPeakKappa()
  var cont = resamplePieces(pieces, COMB_GAP_STEP)
  var arcX = new Float64Array(combArcCapacity())
  var arcY = new Float64Array(arcX.length)
  var pt = { x: 0, y: 0, k: 0, nx: 0, ny: 0 }

  var rho = rho0
  var gap = 0
  var gapAt = -Infinity
  var phase = ""
  var rhoText = ""
  var size = 0
  var r = 0
  var ox = 0
  var knobX = 0
  var grab = 0
  var pressRho = rho0
  var settleTo = null
  var stripW = 0
  var stripH = 0
  var shown = { rho: "", gap: "", k: "" }

  var root = combNode(null, "div", "curvature-comb", fig.box)
  var corner = combNode(null, "div", "curvature-comb__corner", root)
  var side = combNode(null, "div", "curvature-comb__side", root)
  var stripWrap = combNode(null, "div", "curvature-comb__strip-wrap", side)

  var cornerSvg = fig.svg({ parent: corner, onSize: layout })
  cornerSvg.el.setAttribute(
    "class",
    cornerSvg.el.getAttribute("class") + " curvature-comb__corner-svg",
  )
  var plate = combNode(COMB_SVG, "path", "curvature-comb__plate", cornerSvg.el)
  var arc = combNode(COMB_SVG, "path", "curvature-comb__arc", cornerSvg.el)
  var teeth = combNode(COMB_SVG, "path", "curvature-comb__teeth", cornerSvg.el)
  var arcEnv = combNode(COMB_SVG, "path", "curvature-comb__arc-env", cornerSvg.el)
  var contPath = combNode(COMB_SVG, "path", "curvature-comb__cont", cornerSvg.el)
  var contEnv = combNode(COMB_SVG, "path", "curvature-comb__cont-env", cornerSvg.el)
  var joinTop = combNode(COMB_SVG, "line", "curvature-comb__join", cornerSvg.el)
  var joinSide = combNode(COMB_SVG, "line", "curvature-comb__join", cornerSvg.el)

  var knob = combNode(null, "div", "curvature-comb__knob", corner)
  combNode(null, "span", "curvature-comb__knob-dot", knob)

  var strip = fig.svg({ parent: stripWrap, onSize: drawStrip })
  strip.el.setAttribute("class", strip.el.getAttribute("class") + " curvature-comb__strip")
  var axis = combNode(COMB_SVG, "g", "curvature-comb__strip-axis", strip.el)
  var baseLine = combNode(COMB_SVG, "line", "curvature-comb__strip-base", axis)
  var gridLine = combNode(COMB_SVG, "line", "curvature-comb__strip-grid", axis)
  var apexTick = combNode(COMB_SVG, "line", "curvature-comb__strip-base", axis)
  var yTicks = [0, 1, 2, 3].map(function (v) {
    var t = combNode(COMB_SVG, "text", "curvature-comb__strip-tick", axis)
    t.textContent = String(v)
    return t
  })
  var yTitle = combNode(COMB_SVG, "text", "curvature-comb__strip-title", axis)
  var xTitle = combNode(COMB_SVG, "text", "curvature-comb__strip-title", axis)
  var apexLabel = combNode(COMB_SVG, "text", "curvature-comb__strip-title", axis)
  yTitle.textContent = s.stripY
  xTitle.textContent = s.stripX
  xTitle.setAttribute("text-anchor", "end")
  apexLabel.textContent = s.apex
  apexLabel.setAttribute("text-anchor", "middle")
  var stripCont = combNode(COMB_SVG, "path", "curvature-comb__strip-cont", strip.el)
  var stripArc = combNode(COMB_SVG, "path", "curvature-comb__strip-arc", strip.el)
  var peakLabel = combNode(COMB_SVG, "text", "curvature-comb__peak", strip.el)
  peakLabel.textContent = peak.toFixed(2)

  var legend = combNode(null, "ul", "curvature-comb__legend", side)
  ;[
    ["cont", s.legendCont],
    ["arc", s.legendArc],
    ["teeth", s.legendTeeth],
  ].forEach(function (item) {
    var li = combNode(null, "li", null, legend)
    var sw = combNode(COMB_SVG, "svg", "curvature-comb__swatch", li)
    sw.setAttribute("width", "18")
    sw.setAttribute("height", "12")
    sw.setAttribute("aria-hidden", "true")
    var mark = combNode(COMB_SVG, "path", "curvature-comb__swatch-" + item[0], sw)
    mark.setAttribute("d", item[0] === "teeth" ? "M3 11V3M9 11V2M15 11V4" : "M1 6H17")
    li.appendChild(document.createTextNode(item[1]))
  })

  // Readout in the rail: words in the interface face, values in mono spans.
  var readout = combNode(null, "output", "curvature-comb__readout", fig.rail)
  var spans = {}
  s.readout.split(/(\{\w+\})/).forEach(function (part) {
    var m = /^\{(\w+)\}$/.exec(part)
    if (m) spans[m[1]] = combNode(null, "span", "curvature-comb__v", readout)
    else if (part) readout.appendChild(document.createTextNode(part))
  })
  spans.peak.textContent = peak.toFixed(2)

  var spring = fig.spring({ response: 0.3, dampingRatio: 1, exact: true })

  function setPhase(next) {
    if (next === phase) return
    phase = next
    root.setAttribute("data-phase", next)
  }

  function valueText(v) {
    var text = combFill(s.valueText, {
      rho: v.toFixed(2),
      gap: (v === rho ? gap : combHausdorffInto(v)).toFixed(2),
      k: (1 / v).toFixed(2),
    })
    if (Math.abs(v - rho0) < 1e-9) text += combFill(s.detent, { word: s.touch })
    else if (Math.abs(v - 1) < 1e-9) text += combFill(s.detent, { word: s.same })
    return text
  }

  function combHausdorffInto(v) {
    var n = fillArcSamples(v, COMB_GAP_STEP, arcX, arcY)
    return hausdorff(cont.x, cont.y, cont.n, arcX, arcY, n)
  }

  function measureGap(force) {
    var now = performance.now()
    if (!force && now - gapAt < COMB_GAP_MS) return
    gapAt = now
    gap = combHausdorffInto(rho)
  }

  function sx(x) {
    return ox + (1 - x) * r
  }

  function sy(y) {
    return ox + y * r
  }

  // Static parts: plate, continuous outline and its envelope.
  function drawCorner() {
    var segs = CORNER_SEGS
    var d =
      "M" +
      combRound(sx(-1)) +
      " " +
      combRound(sy(0)) +
      "L" +
      combRound(sx(0)) +
      " " +
      combRound(sy(0))
    for (var i = 0; i < segs.length; i++) {
      d += "C"
      for (var j = 1; j < 4; j++) {
        d += (j > 1 ? " " : "") + combRound(sx(segs[i][j][0])) + " " + combRound(sy(segs[i][j][1]))
      }
    }
    d += "L" + combRound(sx(1)) + " " + combRound(sy(2))
    contPath.setAttribute("d", d)
    plate.setAttribute("d", d + "L" + combRound(sx(-1)) + " " + combRound(sy(2)) + "Z")

    var env = ""
    for (var p = 1; p <= 3; p++) {
      var piece = pieces[p]
      var n = Math.max(2, Math.ceil((piece.len * r) / COMB_ENV_GAP))
      if (n % 2) n += 1
      for (var q = 0; q <= n; q++) {
        piecePoint(piece, (piece.len * q) / n, pt)
        var len = COMB_TOOTH * pt.k * r
        env +=
          (env ? "L" : "M") +
          combRound(sx(pt.x) - pt.nx * len) +
          " " +
          combRound(sy(pt.y) + pt.ny * len)
      }
    }
    contEnv.setAttribute("d", env)
  }

  // Everything that follows the radius: arc, teeth, arc envelope, joins.
  function drawArc() {
    var arcPx = (Math.PI * rho * r) / 2
    var len = (COMB_TOOTH * r) / rho
    var cx = sx(1 - rho)
    var cy = sy(rho)
    arc.setAttribute(
      "d",
      "M" +
        combRound(sx(-1)) +
        " " +
        combRound(sy(0)) +
        "L" +
        combRound(cx) +
        " " +
        combRound(sy(0)) +
        "A" +
        combRound(rho * r) +
        " " +
        combRound(rho * r) +
        " 0 0 0 " +
        combRound(sx(1)) +
        " " +
        combRound(cy) +
        "L" +
        combRound(sx(1)) +
        " " +
        combRound(sy(2)),
    )
    var n = Math.max(1, Math.round(arcPx / COMB_TOOTH_GAP))
    var d = ""
    var i
    var phi
    for (i = 0; i <= n; i++) {
      phi = ((Math.PI / 2) * i) / n
      var bx = cx - rho * r * Math.sin(phi)
      var by = cy - rho * r * Math.cos(phi)
      d +=
        "M" +
        combRound(bx) +
        " " +
        combRound(by) +
        "L" +
        combRound(bx - len * Math.sin(phi)) +
        " " +
        combRound(by - len * Math.cos(phi))
    }
    teeth.setAttribute("d", d)
    var m = Math.max(1, Math.round(arcPx / COMB_ENV_GAP))
    var e = "M" + combRound(cx) + " " + combRound(sy(0))
    for (i = 0; i <= m; i++) {
      phi = ((Math.PI / 2) * i) / m
      e +=
        "L" +
        combRound(cx - (rho * r + len) * Math.sin(phi)) +
        " " +
        combRound(cy - (rho * r + len) * Math.cos(phi))
    }
    arcEnv.setAttribute("d", e + "L" + combRound(sx(1)) + " " + combRound(cy))
    setLine(joinTop, cx, sy(0) - 6, cx, sy(0) + 6)
    setLine(joinSide, sx(1) - 6, cy, sx(1) + 6, cy)
    drawStripArc()
  }

  function setLine(node, x1, y1, x2, y2) {
    node.setAttribute("x1", combRound(x1))
    node.setAttribute("y1", combRound(y1))
    node.setAttribute("x2", combRound(x2))
    node.setAttribute("y2", combRound(y2))
  }

  /* ---------- strip ---------- */

  var left = 22
  var top = 20

  function stx(v) {
    return left + ((v + COMB_STRIP_SPAN) / (2 * COMB_STRIP_SPAN)) * (stripW - 6 - left)
  }

  function sty(k) {
    return stripH - 18 - (k / COMB_STRIP_MAX) * (stripH - 18 - top)
  }

  function drawStrip() {
    stripW = strip.width()
    stripH = strip.height()
    if (!(stripW > 0 && stripH > 0)) return
    var bottom = sty(0)
    setLine(baseLine, left, bottom, stripW - 6, bottom)
    setLine(gridLine, left, sty(1), stripW - 6, sty(1))
    setLine(apexTick, stx(0), bottom, stx(0), bottom + 4)
    for (var i = 0; i < yTicks.length; i++) {
      yTicks[i].setAttribute("x", String(left - 6))
      yTicks[i].setAttribute("y", String(combRound(sty(i) + 4)))
    }
    yTitle.setAttribute("x", String(left))
    yTitle.setAttribute("y", "13")
    xTitle.setAttribute("x", String(stripW - 6))
    xTitle.setAttribute("y", "13")
    apexLabel.setAttribute("x", String(combRound(stx(0))))
    apexLabel.setAttribute("y", String(combRound(stripH - 4)))
    peakLabel.setAttribute("x", String(combRound(stx(0))))
    peakLabel.setAttribute("y", String(combRound(sty(peak) - 6)))

    var d =
      "M" +
      combRound(stx(-COMB_STRIP_SPAN)) +
      " " +
      combRound(bottom) +
      "L" +
      combRound(stx(-half)) +
      " " +
      combRound(bottom)
    var pxPerR = (stripW - 6 - left) / (2 * COMB_STRIP_SPAN)
    for (var p = 1; p <= 3; p++) {
      var piece = pieces[p]
      var n = Math.max(2, Math.ceil((piece.len * pxPerR) / COMB_ENV_GAP))
      if (n % 2) n += 1
      for (var q = 0; q <= n; q++) {
        var u = (piece.len * q) / n
        piecePoint(piece, u, pt)
        d += "L" + combRound(stx(piece.start + u - apexAt)) + " " + combRound(sty(pt.k))
      }
    }
    stripCont.setAttribute("d", d + "L" + combRound(stx(COMB_STRIP_SPAN)) + " " + combRound(bottom))
    drawStripArc()
  }

  function drawStripArc() {
    if (!(stripW > 0)) return
    var a = (Math.PI * rho) / 4
    var y0 = combRound(sty(0))
    var y1 = combRound(sty(1 / rho))
    var xa = combRound(stx(-a))
    var xb = combRound(stx(a))
    stripArc.setAttribute(
      "d",
      "M" +
        combRound(stx(-COMB_STRIP_SPAN)) +
        " " +
        y0 +
        "L" +
        xa +
        " " +
        y0 +
        "L" +
        xa +
        " " +
        y1 +
        "L" +
        xb +
        " " +
        y1 +
        "L" +
        xb +
        " " +
        y0 +
        "L" +
        combRound(stx(COMB_STRIP_SPAN)) +
        " " +
        y0,
    )
  }

  /* ---------- state ---------- */

  function showValue(key, text) {
    if (shown[key] === text) return
    shown[key] = text
    spans[key].textContent = text
  }

  function renderReadout() {
    showValue("rho", rho.toFixed(2))
    showValue("gap", gap.toFixed(2))
    showValue("k", (1 / rho).toFixed(2))
    var text = rho.toFixed(3)
    if (text !== rhoText) {
      rhoText = text
      root.setAttribute("data-rho", text)
    }
  }

  function setRho(v) {
    rho = Math.min(COMB_MAX, Math.max(COMB_MIN, v))
    drawArc()
  }

  function placeKnob() {
    knob.style.transform = "translate3d(" + combRound(knobX) + "px," + combRound(ox) + "px,0)"
  }

  function band(raw) {
    var lo = ox + COMB_MIN * r
    var hi = ox + COMB_MAX * r
    if (raw < lo) return lo - fig.rubberBand(lo - raw, hi - lo)
    if (raw > hi) return hi + fig.rubberBand(raw - hi, hi - lo)
    return raw
  }

  function unband(shownX) {
    var lo = ox + COMB_MIN * r
    var hi = ox + COMB_MAX * r
    if (shownX < lo) return lo - fig.rubberBandInverse(lo - shownX, hi - lo)
    if (shownX > hi) return hi + fig.rubberBandInverse(shownX - hi, hi - lo)
    return shownX
  }

  // A jump with no animation: keys, Reset, reduced motion.
  function jumpTo(v) {
    loop.stop()
    settleTo = null
    setRho(v)
    knobX = ox + rho * r
    spring.set(knobX)
    measureGap(true)
    renderReadout()
    placeKnob()
    setPhase("rest")
  }

  function finish() {
    loop.stop()
    if (settleTo != null) rho = settleTo
    knobX = ox + rho * r
    spring.set(knobX)
    setRho(rho)
    measureGap(true)
    renderReadout()
    placeKnob()
    setPhase("rest")
    keys.reset(rho)
    if (settleTo != null && Math.abs(rho - pressRho) > 1e-9) fig.announce(valueText(rho))
    settleTo = null
  }

  function release() {
    var lo = ox + COMB_MIN * r
    var hi = ox + COMB_MAX * r
    settleTo = null
    if (Math.abs(rho - rho0) <= COMB_DETENT) settleTo = rho0
    else if (Math.abs(rho - 1) <= COMB_DETENT) settleTo = 1
    var target = settleTo != null ? ox + settleTo * r : Math.min(hi, Math.max(lo, knobX))
    spring.set(knobX, 0)
    spring.retarget(target)
    if (spring.resting || Math.abs(target - knobX) < 0.5) {
      knobX = target
      finish()
      return
    }
    setPhase("settling")
    loop.start()
  }

  var loop = fig.loop(function (dt) {
    var moving = spring.step(dt)
    knobX = spring.value
    setRho((knobX - ox) / r)
    measureGap(false)
    renderReadout()
    placeKnob()
    if (!moving) {
      finish()
      return false
    }
    return true
  })

  fig.drag(
    knob,
    {
      onStart: function () {
        loop.stop()
        settleTo = null
        spring.set(knobX)
        grab = unband(knobX)
        pressRho = rho
        knob.focus({ preventScroll: true })
        setPhase("held")
      },
      onMove: function (point, delta) {
        knobX = band(grab + delta.x)
        setRho((knobX - ox) / r)
        measureGap(false)
        renderReadout()
        placeKnob()
      },
      onEnd: release,
      onCancel: release,
    },
    { touchAction: "none" },
  )

  var keys = fig.keySlider(knob, {
    min: COMB_MIN,
    max: COMB_MAX,
    step: COMB_KEY_STEP,
    shiftStep: COMB_SHIFT_STEP,
    marks: [COMB_MIN, rho0, 1, COMB_MAX],
    value: rho0,
    label: s.knob,
    valueText: valueText,
    onInput: jumpTo,
  })

  // Arrows go to the next multiple of 0.05 (Shift: 0.2 further), which the
  // shared keySlider's min-anchored rounding cannot express; Home, End, PageUp
  // and PageDown stay with keySlider, whose keyup still commits and announces.
  fig.listen(
    corner,
    "keydown",
    function (e) {
      if (e.target !== knob || e.altKey || e.ctrlKey || e.metaKey) return
      var dir =
        e.key === "ArrowRight" || e.key === "ArrowUp"
          ? 1
          : e.key === "ArrowLeft" || e.key === "ArrowDown"
            ? -1
            : 0
      if (!dir) return
      e.preventDefault()
      e.stopPropagation()
      var from = rho + dir * (e.shiftKey ? COMB_SHIFT_STEP - COMB_KEY_STEP : 0)
      var units = from / COMB_KEY_STEP
      var next =
        (dir > 0 ? Math.floor(units + 1e-6) + 1 : Math.ceil(units - 1e-6) - 1) * COMB_KEY_STEP
      next = Math.min(COMB_MAX, Math.max(COMB_MIN, parseFloat(next.toFixed(10))))
      keys.set(next)
      jumpTo(next)
    },
    true,
  )

  function layout() {
    var w = cornerSvg.width()
    if (!(w > 0)) return
    size = w
    r = (size - 16) / 2.35
    ox = 8 + 0.35 * r
    knobX = ox + rho * r
    if (phase === "settling") {
      loop.stop()
      finish()
    }
    spring.set(knobX)
    drawCorner()
    drawArc()
    placeKnob()
  }

  // Narrow figures move the legend into the rail, above the readout.
  function placeLegend(sizeClass) {
    root.setAttribute("data-size", sizeClass)
    if (sizeClass === "narrow") {
      if (legend.parentNode !== fig.rail) fig.rail.insertBefore(legend, readout)
    } else if (legend.parentNode !== side) {
      side.appendChild(legend)
    }
  }

  var sizeClass = fig.size()
  fig.onSizeChange(function (next) {
    if (next === sizeClass) return
    sizeClass = next
    placeLegend(next)
  })

  fig.onReducedMotionChange(function () {
    if (phase === "settling" && fig.reducedMotion()) finish()
  })

  fig.model({
    arcLength: combArcLength,
    joinKappa: combJoinKappa,
    peakKappa: combPeakKappa,
    apexDistance: combApexDistance,
    rho0: rho0,
    hausdorff: combHausdorff,
  })

  fig.onReset(function () {
    jumpTo(rho0)
    keys.reset(rho0)
  })

  placeLegend(sizeClass)
  layout()
  drawStrip()
  measureGap(true)
  renderReadout()
  setPhase("rest")
  keys.reset(rho)

  return {
    destroy: function () {
      loop.stop()
    },
  }
}
