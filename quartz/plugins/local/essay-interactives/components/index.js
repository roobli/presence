/**
 * Client mounts for essay interactive placeholders produced by the transformer.
 * Placeholders: <div class="essay-interactive" data-interactive="…">
 */

function essayInteractives() {
  var MOUNTED = "data-essay-mounted"

  function el(tag, attrs, kids) {
    var node = document.createElement(tag)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k]
        else if (k === "html") node.innerHTML = attrs[k]
        else if (attrs[k] != null) node.setAttribute(k, attrs[k])
      })
    }
    ;(kids || []).forEach(function (c) {
      if (c) node.appendChild(c)
    })
    return node
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  function announce(live, text) {
    if (!live) return
    live.textContent = ""
    window.setTimeout(function () {
      live.textContent = text
    }, 20)
  }

  /* ---------- spring-zeta ---------- */

  function mountSpringZeta(root) {
    var zeta = 0.7
    var k = 320
    var m = 1
    var x = 1
    var v = 0
    var target = 0
    var raf = 0
    var playing = false
    var tAccum = 0
    var trail = []
    var MAX_T = 4

    var live = el("div", {
      class: "essay-interactive__live",
      role: "status",
      "aria-live": "polite",
    })
    var regime = el("span", { class: "essay-interactive__regime", text: "Underdamped" })
    var zetaVal = el("span", { class: "essay-interactive__value", text: "0.70" })
    var kVal = el("span", { class: "essay-interactive__value", text: "320" })

    var zetaSlider = el("input", {
      type: "range",
      min: "0.2",
      max: "1.8",
      step: "0.05",
      value: String(zeta),
      id: "essay-zeta-" + Math.random().toString(36).slice(2, 8),
      "aria-label": "Damping ratio zeta",
    })
    var kSlider = el("input", {
      type: "range",
      min: "80",
      max: "600",
      step: "10",
      value: String(k),
      "aria-label": "Spring stiffness k",
    })
    var playBtn = el("button", { type: "button", class: "essay-interactive__btn", text: "Play once" })
    var resetBtn = el("button", { type: "button", class: "essay-interactive__btn", text: "Reset" })

    var canvas = el("canvas", {
      class: "essay-interactive__canvas",
      width: "640",
      height: "280",
      role: "img",
      "aria-label": "Spring-mass settle and position versus time",
    })

    var controls = el("div", { class: "essay-interactive__controls" }, [
      el("div", { class: "essay-interactive__row" }, [
        el("label", { class: "essay-interactive__label", text: "Damping ratio ζ" }),
        zetaSlider,
        zetaVal,
        regime,
      ]),
      el("div", { class: "essay-interactive__row" }, [
        el("label", { class: "essay-interactive__label", text: "Stiffness k" }),
        kSlider,
        kVal,
      ]),
      el("div", { class: "essay-interactive__row essay-interactive__row--actions" }, [
        playBtn,
        resetBtn,
      ]),
    ])

    root.appendChild(
      el("div", { class: "essay-interactive__card" }, [
        el("div", { class: "essay-interactive__title", text: "Spring–mass–damper · ζ regimes" }),
        controls,
        canvas,
        live,
      ]),
    )

    function regimeLabel(z) {
      if (Math.abs(z - 1) < 0.025) return "Critical"
      return z < 1 ? "Underdamped" : "Overdamped"
    }

    function syncLabels() {
      zetaVal.textContent = zeta.toFixed(2)
      kVal.textContent = String(Math.round(k))
      var lab = regimeLabel(zeta)
      regime.textContent = lab
      announce(live, "Damping ratio " + zeta.toFixed(2) + ", " + lab)
    }

    function stop() {
      playing = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    function resetState(run) {
      stop()
      x = 1
      v = 0
      target = 0
      tAccum = 0
      trail = [{ t: 0, x: x }]
      draw()
      if (run) startPlay()
    }

    function startPlay() {
      stop()
      x = 1
      v = 0
      target = 0
      tAccum = 0
      trail = [{ t: 0, x: x }]
      playing = true
      var last = performance.now()
      function tick(now) {
        if (!playing) return
        var dt = Math.min(0.032, (now - last) / 1000)
        last = now
        var c = 2 * zeta * Math.sqrt(k * m)
        var steps = Math.max(1, Math.ceil(dt / 0.008))
        var h = dt / steps
        for (var i = 0; i < steps; i++) {
          var a = (-k * (x - target) - c * v) / m
          v += a * h
          x += v * h
          tAccum += h
          if (trail.length === 0 || tAccum - trail[trail.length - 1].t > 0.012) {
            trail.push({ t: tAccum, x: x })
          }
        }
        if (Math.abs(x - target) < 0.01 && Math.abs(v) < 0.01) {
          x = target
          v = 0
          playing = false
          trail.push({ t: tAccum, x: x })
          draw()
          return
        }
        if (tAccum > MAX_T) {
          playing = false
          draw()
          return
        }
        draw()
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    function draw() {
      var ctx = canvas.getContext("2d")
      var dpr = window.devicePixelRatio || 1
      var cssW = canvas.clientWidth || 640
      var cssH = 280
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      var ink = cssVar("--ink-color", "#34312e")
      var muted = cssVar("--ink-muted-color", "#6f6b66")
      var canvasBg = cssVar("--canvas-color", "#faf9f6")
      var surface = cssVar("--surface-color", "#f2f1ee")
      var line = cssVar("--line-color", "#ddd9d2")
      var accent = cssVar("--accent-color", "#a85d3b")

      ctx.fillStyle = surface
      ctx.fillRect(0, 0, cssW, cssH)

      var trackY = 48
      var trackL = 28
      var trackR = cssW - 28
      var trackMid = (trackL + trackR) / 2
      var amp = (trackR - trackL) * 0.36

      ctx.strokeStyle = line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(trackL, trackY)
      ctx.lineTo(trackR, trackY)
      ctx.stroke()

      // left wall / anchor (no zigzag coil — plot carries the story)
      var massX = trackMid + x * amp
      ctx.fillStyle = muted
      ctx.globalAlpha = 0.55
      ctx.fillRect(trackL - 2, trackY - 14, 3, 28)
      ctx.globalAlpha = 1

      // rest marker
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(trackMid, trackY - 14)
      ctx.lineTo(trackMid, trackY + 14)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = muted
      ctx.font = "10px " + (cssVar("--font-ui", "sans-serif") || "sans-serif")
      ctx.fillText("rest", trackMid + 4, trackY - 18)

      // rounded mass on the track
      ctx.fillStyle = ink
      ctx.beginPath()
      var mw = 22
      var mh = 22
      var mr = 11
      var mx = massX - mw / 2
      var my = trackY - mh / 2
      ctx.moveTo(mx + mr, my)
      ctx.arcTo(mx + mw, my, mx + mw, my + mh, mr)
      ctx.arcTo(mx + mw, my + mh, mx, my + mh, mr)
      ctx.arcTo(mx, my + mh, mx, my, mr)
      ctx.arcTo(mx, my, mx + mw, my, mr)
      ctx.closePath()
      ctx.fill()

      // plot area (primary visual)
      var plotT = 84
      var plotB = cssH - 18
      var plotL = 36
      var plotR = cssW - 16
      ctx.strokeStyle = line
      ctx.strokeRect(plotL, plotT, plotR - plotL, plotB - plotT)

      // grid + axis labels
      ctx.fillStyle = muted
      ctx.font = "11px " + (cssVar("--font-ui", "sans-serif") || "sans-serif")
      ctx.fillText("x(t)", plotL + 4, plotT + 14)
      ctx.fillText("0", plotL - 12, (plotT + plotB) / 2 + 3)

      function plotY(xv) {
        var mid = (plotT + plotB) / 2
        return mid - xv * ((plotB - plotT) * 0.38)
      }
      function plotX(tv) {
        return plotL + (tv / MAX_T) * (plotR - plotL)
      }

      // rest line
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.35
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(plotL, plotY(0))
      ctx.lineTo(plotR, plotY(0))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // faint ghosts at 0.5 / 1.0 / 1.5
      ;[0.5, 1.0, 1.5].forEach(function (gz) {
        var gx = 1
        var gv = 0
        var gc = 2 * gz * Math.sqrt(k * m)
        ctx.strokeStyle = muted
        ctx.globalAlpha = 0.22
        ctx.beginPath()
        ctx.moveTo(plotX(0), plotY(gx))
        for (var t = 0; t <= MAX_T; t += 0.02) {
          var a = (-k * (gx - 0) - gc * gv) / m
          gv += a * 0.02
          gx += gv * 0.02
          ctx.lineTo(plotX(t), plotY(gx))
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      if (trail.length > 1) {
        ctx.strokeStyle = ink
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(plotX(trail[0].t), plotY(trail[0].x))
        for (var j = 1; j < trail.length; j++) {
          ctx.lineTo(plotX(trail[j].t), plotY(trail[j].x))
        }
        ctx.stroke()
      }
    }

    zetaSlider.addEventListener("input", function () {
      zeta = parseFloat(zetaSlider.value)
      syncLabels()
      if (!playing) draw()
    })
    kSlider.addEventListener("input", function () {
      k = parseFloat(kSlider.value)
      kVal.textContent = String(Math.round(k))
      if (!playing) draw()
    })
    playBtn.addEventListener("click", function () {
      startPlay()
    })
    resetBtn.addEventListener("click", function () {
      resetState(false)
    })

    // first interaction on sliders can also start a settle once
    var startedOnce = false
    function maybeStart() {
      if (startedOnce) return
      startedOnce = true
      startPlay()
    }
    zetaSlider.addEventListener("change", maybeStart)
    kSlider.addEventListener("change", maybeStart)

    syncLabels()
    resetState(false)
    window.addEventListener("resize", function () {
      draw()
    })
  }

  /* ---------- squircle-compare ---------- */

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
    // corner: 0=TR, 1=BR, 2=BL, 3=TL — article table rotated CW around tip
    if (corner === 0) return [tipX - r + x * r, tipY + y * r]
    if (corner === 1) return [tipX - y * r, tipY - r + x * r]
    if (corner === 2) return [tipX + r - x * r, tipY - y * r]
    return [tipX + y * r, tipY + r - x * r]
  }

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

  function mountSquircle(root) {
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
  }

  /* ---------- mount / SPA ---------- */

  function mountAll() {
    var nodes = document.querySelectorAll(".essay-interactive[data-interactive]")
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      if (node.getAttribute(MOUNTED) === "1") continue
      var kind = node.getAttribute("data-interactive")
      node.setAttribute(MOUNTED, "1")
      if (kind === "spring-zeta") mountSpringZeta(node)
      else if (kind === "squircle-compare") mountSquircle(node)
    }
  }

  document.addEventListener("nav", mountAll)
  document.addEventListener("render", mountAll)
  mountAll()
}

const script = "(" + essayInteractives.toString() + ")()"

const EssayInteractives = () => {
  const Component = () => null
  Component.afterDOMLoaded = script
  return Component
}

export { EssayInteractives }
