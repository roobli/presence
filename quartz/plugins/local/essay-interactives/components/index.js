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


  /* ---------- zeta-triptych ---------- */

  function simulateTrace(zeta, k, m, maxT, dt) {
    var x = 1
    var v = 0
    var target = 0
    var c = 2 * zeta * Math.sqrt(k * m)
    var pts = [{ t: 0, x: x }]
    var t = 0
    while (t < maxT) {
      var a = (-k * (x - target) - c * v) / m
      v += a * dt
      x += v * dt
      t += dt
      pts.push({ t: t, x: x })
      if (Math.abs(x - target) < 0.008 && Math.abs(v) < 0.008 && t > 0.2) {
        x = target
        v = 0
        pts.push({ t: t, x: x })
        break
      }
    }
    return pts
  }

  function mountZetaTriptych(root) {
    var m = 1
    var k = 320
    var MAX_T = 4
    var DT = 0.01
    var regimes = [
      { zeta: 0.5, label: "overshoot", dash: [], caption: "ζ=0.5 · overshoot" },
      { zeta: 1.0, label: "clean settle", dash: [7, 5], caption: "ζ=1.0 · clean settle" },
      { zeta: 1.5, label: "crawl", dash: [2, 3], caption: "ζ=1.5 · crawl" },
    ]
    var traces = regimes.map(function (r) {
      return simulateTrace(r.zeta, k, m, MAX_T, DT)
    })
    var revealT = MAX_T
    var raf = 0
    var playing = false
    var reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    var live = el("div", {
      class: "essay-interactive__live",
      role: "status",
      "aria-live": "polite",
    })
    var playBtn = el("button", {
      type: "button",
      class: "essay-interactive__btn",
      text: "Play once",
    })
    var canvas = el("canvas", {
      class: "essay-interactive__canvas",
      width: "640",
      height: "260",
      role: "img",
      "aria-label": "Three damping regimes after the same step: overshoot, clean settle, and crawl",
    })
    var caption = el("div", {
      class: "essay-interactive__footnote",
      text: "Solid · dashed · dotted — same step, m=1, k=320",
    })

    var controlsKids = []
    if (!reduceMotion) {
      controlsKids.push(
        el("div", { class: "essay-interactive__row essay-interactive__row--actions" }, [playBtn]),
      )
    } else {
      playBtn.disabled = true
      playBtn.setAttribute("aria-hidden", "true")
      playBtn.style.display = "none"
    }

    root.appendChild(
      el("div", { class: "essay-interactive__card" }, [
        el("div", {
          class: "essay-interactive__title",
          text: "ζ triptych · same step, three regimes",
        }),
        el("div", { class: "essay-interactive__controls" }, controlsKids),
        canvas,
        caption,
        live,
      ]),
    )

    function stop() {
      playing = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    function draw() {
      var ctx = canvas.getContext("2d")
      var dpr = window.devicePixelRatio || 1
      var cssW = canvas.clientWidth || 640
      var cssH = 260
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      var ink = cssVar("--ink-color", "#34312e")
      var muted = cssVar("--ink-muted-color", "#6f6b66")
      var surface = cssVar("--surface-color", "#f2f1ee")
      var line = cssVar("--line-color", "#ddd9d2")
      var accent = cssVar("--accent-color", "#a85d3b")
      var fontUi = cssVar("--font-ui", "sans-serif") || "sans-serif"

      ctx.fillStyle = surface
      ctx.fillRect(0, 0, cssW, cssH)

      var plotT = 28
      var plotB = cssH - 36
      var plotL = 40
      var plotR = cssW - 16

      ctx.strokeStyle = line
      ctx.lineWidth = 1
      ctx.strokeRect(plotL, plotT, plotR - plotL, plotB - plotT)

      ctx.fillStyle = muted
      ctx.font = "11px " + fontUi
      ctx.fillText("x(t)", plotL + 4, plotT + 14)
      ctx.fillText("0", plotL - 12, (plotT + plotB) / 2 + 3)

      function plotY(xv) {
        var mid = (plotT + plotB) / 2
        return mid - xv * ((plotB - plotT) * 0.38)
      }
      function plotX(tv) {
        return plotL + (tv / MAX_T) * (plotR - plotL)
      }

      // faint rest line
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.35
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(plotL, plotY(0))
      ctx.lineTo(plotR, plotY(0))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // three traces with distinct stroke styles (not color alone)
      var strokeStyles = [
        { color: ink, width: 1.7, dash: [] },
        { color: ink, width: 1.7, dash: [7, 5] },
        { color: muted, width: 1.7, dash: [2, 3] },
      ]
      for (var i = 0; i < traces.length; i++) {
        var pts = traces[i]
        var st = strokeStyles[i]
        ctx.strokeStyle = st.color
        ctx.lineWidth = st.width
        ctx.setLineDash(st.dash)
        ctx.beginPath()
        var started = false
        for (var j = 0; j < pts.length; j++) {
          if (pts[j].t > revealT) break
          var px = plotX(pts[j].t)
          var py = plotY(pts[j].x)
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else {
            ctx.lineTo(px, py)
          }
        }
        if (started) ctx.stroke()
        ctx.setLineDash([])
      }

      // captions under plot
      var caps = ["overshoot", "clean settle", "crawl"]
      var capXs = [plotL + (plotR - plotL) * 0.18, (plotL + plotR) / 2, plotL + (plotR - plotL) * 0.82]
      ctx.font = "11px " + fontUi
      ctx.fillStyle = muted
      for (var c = 0; c < caps.length; c++) {
        ctx.setLineDash(strokeStyles[c].dash)
        ctx.strokeStyle = strokeStyles[c].color
        ctx.lineWidth = 1.5
        var lx = capXs[c] - 28
        var ly = cssH - 14
        ctx.beginPath()
        ctx.moveTo(lx, ly - 4)
        ctx.lineTo(lx + 18, ly - 4)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillText(caps[c], lx + 22, ly)
      }
    }

    function startPlay() {
      if (reduceMotion) return
      stop()
      revealT = 0
      playing = true
      var start = performance.now()
      var durationMs = MAX_T * 1000 * 0.55
      function tick(now) {
        if (!playing) return
        var u = Math.min(1, (now - start) / durationMs)
        revealT = u * MAX_T
        draw()
        if (u < 1) {
          raf = requestAnimationFrame(tick)
        } else {
          playing = false
          revealT = MAX_T
          draw()
        }
      }
      raf = requestAnimationFrame(tick)
    }

    if (!reduceMotion) {
      playBtn.addEventListener("click", function () {
        startPlay()
      })
    }

    revealT = MAX_T
    draw()
    announce(
      live,
      "Three regimes after the same step: zeta 0.5 overshoot, zeta 1.0 clean settle, zeta 1.5 crawl",
    )
    window.addEventListener("resize", function () {
      draw()
    })
  }

  /* ---------- curvature-comb ---------- */

  function mountCurvatureComb(root) {
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

    function setMode(next) {
      mode = next
      toggleG1.classList.toggle("is-active", mode === "g1")
      toggleCont.classList.toggle("is-active", mode === "continuous")
      toggleG1.setAttribute("aria-pressed", mode === "g1" ? "true" : "false")
      toggleCont.setAttribute("aria-pressed", mode === "continuous" ? "true" : "false")
      draw()
      announce(
        live,
        mode === "g1"
          ? "G1 circular fillet: curvature jump"
          : "Continuous blend: curvature ramp",
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
            mt * mt * mt * p0[0] +
            3 * mt * mt * t * p1[0] +
            3 * mt * t * t * p2[0] +
            t * t * t * p3[0]
          var y =
            mt * mt * mt * p0[1] +
            3 * mt * mt * t * p1[1] +
            3 * mt * t * t * p2[1] +
            t * t * t * p3[1]
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

    function draw() {
      var ctx = canvas.getContext("2d")
      var dpr = window.devicePixelRatio || 1
      var cssW = canvas.clientWidth || 640
      var cssH = 300
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      var ink = cssVar("--ink-color", "#34312e")
      var muted = cssVar("--ink-muted-color", "#6f6b66")
      var surface = cssVar("--surface-color", "#f2f1ee")
      var canvasBg = cssVar("--canvas-color", "#faf9f6")
      var line = cssVar("--line-color", "#ddd9d2")
      var accent = cssVar("--accent-color", "#a85d3b")
      var fontUi = cssVar("--font-ui", "sans-serif") || "sans-serif"

      ctx.fillStyle = surface
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

      var kpts =
        mode === "g1" ? sampleCurvatureG1(r, 80) : sampleCurvatureG2(r, 80)
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
      ctx.fillText(
        mode === "g1" ? "G1 · circular fillet" : "Continuous · smooth blend",
        18,
        cssH - 16,
      )
      ctx.fillText(
        mode === "g1" ? "stepped comb" : "smooth envelope",
        plotL,
        cssH - 16,
      )
    }

    toggleG1.addEventListener("click", function () {
      setMode("g1")
    })
    toggleCont.addEventListener("click", function () {
      setMode("continuous")
    })
    combCheck.addEventListener("change", function () {
      showComb = combCheck.checked
      draw()
    })
    zebraCheck.addEventListener("change", function () {
      showZebra = zebraCheck.checked
      draw()
    })

    draw()
    announce(live, "G1 circular fillet: curvature jump")
    window.addEventListener("resize", function () {
      draw()
    })
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
      else if (kind === "zeta-triptych") mountZetaTriptych(node)
      else if (kind === "curvature-comb") mountCurvatureComb(node)
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
