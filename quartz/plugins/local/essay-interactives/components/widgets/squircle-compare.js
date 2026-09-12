/* squircle-compare: a G1 rounded square beside a continuous-corner square, with a curvature plot. */

function continuousPathFixed(cx, cy, half, r) {
  r = Math.min(r, half * 0.95)
  var tips = [
    [cx + half, cy - half], // TR
    [cx + half, cy + half], // BR
    [cx - half, cy + half], // BL
    [cx - half, cy - half], // TL
  ]
  var parts = []
  parts.push("M " + (cx - half + r) + " " + (cy - half))
  parts.push("L " + (cx + half - r) + " " + (cy - half))
  addSegs(parts, 0, tips[0], r)
  parts.push("L " + (cx + half) + " " + (cy + half - r))
  addSegs(parts, 1, tips[1], r)
  parts.push("L " + (cx - half + r) + " " + (cy + half))
  addSegs(parts, 2, tips[2], r)
  parts.push("L " + (cx - half) + " " + (cy - half + r))
  addSegs(parts, 3, tips[3], r)
  parts.push("Z")
  return parts.join(" ")
}

function addSegs(parts, corner, tip, r) {
  CORNER_SEGS.forEach(function (seg) {
    var p1 = mapCorner(seg[1], corner, tip[0], tip[1], r)
    var p2 = mapCorner(seg[2], corner, tip[0], tip[1], r)
    var p3 = mapCorner(seg[3], corner, tip[0], tip[1], r)
    parts.push("C " + p1[0] + " " + p1[1] + ", " + p2[0] + " " + p2[1] + ", " + p3[0] + " " + p3[1])
  })
}

function g1Path(cx, cy, half, r) {
  r = Math.min(r, half)
  // Classic rounded rect via arcs
  var x0 = cx - half
  var y0 = cy - half
  var x1 = cx + half
  var y1 = cy + half
  return [
    "M",
    x0 + r,
    y0,
    "L",
    x1 - r,
    y0,
    "A",
    r,
    r,
    0,
    0,
    1,
    x1,
    y0 + r,
    "L",
    x1,
    y1 - r,
    "A",
    r,
    r,
    0,
    0,
    1,
    x1 - r,
    y1,
    "L",
    x0 + r,
    y1,
    "A",
    r,
    r,
    0,
    0,
    1,
    x0,
    y1 - r,
    "L",
    x0,
    y0 + r,
    "A",
    r,
    r,
    0,
    0,
    1,
    x0 + r,
    y0,
    "Z",
  ].join(" ")
}

WIDGETS["squircle-compare"] = function (root) {
  var mode = "g1" // g1 | continuous
  var r = 36
  var showKappa = true
  var morph = 0 // 0 = g1, 1 = continuous
  var morphRaf = 0
  var morphFrom = 0
  var morphTo = 0
  var morphStart = 0
  var MORPH_MS = 260

  var live = el("div", {
    class: "essay-interactive__live",
    role: "status",
    "aria-live": "polite",
  })
  var rVal = el("span", { class: "essay-interactive__value", text: "36" })
  var rSlider = el("input", {
    type: "range",
    min: "12",
    max: "64",
    step: "1",
    value: String(r),
    "aria-label": "Corner radius",
  })
  var toggleG1 = el("button", {
    type: "button",
    class: "essay-interactive__btn is-active",
    text: "G1 circular",
    "aria-pressed": "true",
  })
  var toggleCont = el("button", {
    type: "button",
    class: "essay-interactive__btn",
    text: "Continuous",
    "aria-pressed": "false",
  })
  var kappaCheck = el("input", {
    type: "checkbox",
    checked: "checked",
    id: "essay-kappa-" + Math.random().toString(36).slice(2, 8),
    "aria-label": "Show curvature plot",
  })
  kappaCheck.checked = true

  var svgNS = "http://www.w3.org/2000/svg"
  var svg = document.createElementNS(svgNS, "svg")
  svg.setAttribute("class", "essay-interactive__svg essay-interactive__svg--stage")
  svg.setAttribute("viewBox", "0 0 640 200")
  svg.setAttribute("role", "img")
  svg.setAttribute("aria-label", "G1 versus continuous corner comparison")

  var pathG1 = document.createElementNS(svgNS, "path")
  var pathCont = document.createElementNS(svgNS, "path")
  pathG1.setAttribute("class", "essay-interactive__shape essay-interactive__shape--g1")
  pathCont.setAttribute("class", "essay-interactive__shape essay-interactive__shape--cont")
  svg.appendChild(pathG1)
  svg.appendChild(pathCont)

  var kappaSvg = document.createElementNS(svgNS, "svg")
  kappaSvg.setAttribute("class", "essay-interactive__kappa")
  kappaSvg.setAttribute("viewBox", "0 0 640 100")
  kappaSvg.setAttribute("aria-hidden", "true")

  var kappaLabel = el("label", {
    class: "essay-interactive__check",
    for: kappaCheck.id,
  })
  kappaLabel.appendChild(kappaCheck)
  kappaLabel.appendChild(document.createTextNode("Show curvature κ(s)"))

  root.appendChild(
    el("div", { class: "essay-interactive__card" }, [
      el("div", { class: "essay-interactive__title", text: "Corner continuity · G1 vs continuous" }),
      el("div", { class: "essay-interactive__controls" }, [
        el("div", { class: "essay-interactive__row essay-interactive__row--actions" }, [
          toggleG1,
          toggleCont,
        ]),
        el("div", { class: "essay-interactive__row" }, [
          el("label", { class: "essay-interactive__label", text: "Radius r" }),
          rSlider,
          rVal,
        ]),
        el("div", { class: "essay-interactive__row essay-interactive__row--check" }, [kappaLabel]),
      ]),
      svg,
      kappaSvg,
      live,
    ]),
  )

  function setMode(next) {
    mode = next
    toggleG1.classList.toggle("is-active", mode === "g1")
    toggleCont.classList.toggle("is-active", mode === "continuous")
    toggleG1.setAttribute("aria-pressed", mode === "g1" ? "true" : "false")
    toggleCont.setAttribute("aria-pressed", mode === "continuous" ? "true" : "false")
    morphFrom = morph
    morphTo = mode === "continuous" ? 1 : 0
    morphStart = performance.now()
    if (morphRaf) cancelAnimationFrame(morphRaf)
    function step(now) {
      var u = Math.min(1, (now - morphStart) / MORPH_MS)
      // smoothstep
      var e = u * u * (3 - 2 * u)
      morph = morphFrom + (morphTo - morphFrom) * e
      paint()
      if (u < 1) morphRaf = requestAnimationFrame(step)
      else morphRaf = 0
    }
    morphRaf = requestAnimationFrame(step)
    announce(live, mode === "g1" ? "G1 circular corners" : "Continuous G2-ish corners")
  }

  function paint() {
    var half = 48
    var y = 82
    var leftCx = 170
    var rightCx = 470
    // Cap corner radius to diagram scale so shapes stay diagram-sized.
    var rr = Math.min(r, half * 0.9)
    pathG1.setAttribute("d", g1Path(leftCx, y, half, rr))
    pathCont.setAttribute("d", continuousPathFixed(rightCx, y, half, rr))
    pathG1.setAttribute("opacity", String(0.35 + (1 - morph) * 0.65))
    pathCont.setAttribute("opacity", String(0.35 + morph * 0.65))

    // labels
    var old = svg.querySelectorAll("text.essay-interactive__caption")
    old.forEach(function (n) {
      n.remove()
    })
    ;[
      [leftCx, 168, "G1 · circular"],
      [rightCx, 168, "Continuous"],
    ].forEach(function (row) {
      var t = document.createElementNS(svgNS, "text")
      t.setAttribute("class", "essay-interactive__caption")
      t.setAttribute("x", String(row[0]))
      t.setAttribute("y", String(row[1]))
      t.setAttribute("text-anchor", "middle")
      t.textContent = row[2]
      svg.appendChild(t)
    })

    // kappa plot (compact ~100px viewBox)
    while (kappaSvg.firstChild) kappaSvg.removeChild(kappaSvg.firstChild)
    kappaSvg.style.display = showKappa ? "" : "none"
    if (!showKappa) return

    var frame = document.createElementNS(svgNS, "rect")
    frame.setAttribute("x", "40")
    frame.setAttribute("y", "10")
    frame.setAttribute("width", "560")
    frame.setAttribute("height", "72")
    frame.setAttribute("class", "essay-interactive__kappa-frame")
    kappaSvg.appendChild(frame)

    var g1pts = sampleCurvatureG1(r, 80)
    var g2pts = sampleCurvatureG2(r, 80)
    var kMax = 0
    g1pts.concat(g2pts).forEach(function (p) {
      if (p.k > kMax) kMax = p.k
    })
    kMax = Math.max(kMax, 1e-6)

    function poly(pts, cls, alpha) {
      var d = pts
        .map(function (p, i) {
          var x = 40 + p.s * 560
          var y = 82 - (p.k / kMax) * 62
          return (i === 0 ? "M" : "L") + x + " " + y
        })
        .join(" ")
      var path = document.createElementNS(svgNS, "path")
      path.setAttribute("d", d)
      path.setAttribute("class", cls)
      path.setAttribute("opacity", String(alpha))
      path.setAttribute("fill", "none")
      kappaSvg.appendChild(path)
    }
    poly(g1pts, "essay-interactive__kappa-g1", 0.35 + (1 - morph) * 0.65)
    poly(g2pts, "essay-interactive__kappa-g2", 0.35 + morph * 0.65)

    var label = document.createElementNS(svgNS, "text")
    label.setAttribute("x", "44")
    label.setAttribute("y", "24")
    label.setAttribute("class", "essay-interactive__caption")
    label.textContent = "κ(s) along one corner"
    kappaSvg.appendChild(label)
  }

  toggleG1.addEventListener("click", function () {
    setMode("g1")
  })
  toggleCont.addEventListener("click", function () {
    setMode("continuous")
  })
  rSlider.addEventListener("input", function () {
    r = parseFloat(rSlider.value)
    rVal.textContent = String(Math.round(r))
    paint()
  })
  kappaCheck.addEventListener("change", function () {
    showKappa = kappaCheck.checked
    paint()
  })

  paint()
  announce(live, "G1 circular corners")

  return {
    destroy: function () {
      if (morphRaf) cancelAnimationFrame(morphRaf)
      morphRaf = 0
    },
  }
}
