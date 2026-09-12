/* zeta-triptych: the same step response at three damping ratios. */

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

WIDGETS["zeta-triptych"] = function (root) {
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
  var reduceMotion = prefersReducedMotion()

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

  var surface = createSurface(canvas, 260, paint)

  function stop() {
    playing = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function paint(ctx, cssW, cssH, pal) {
    var ink = pal.ink
    var muted = pal.muted
    var line = pal.line
    var accent = pal.accent
    var fontUi = pal.fontUi

    ctx.fillStyle = pal.surface
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
      surface.draw()
      if (u < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        playing = false
        revealT = MAX_T
        surface.draw()
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
  surface.draw()
  announce(
    live,
    "Three regimes after the same step: zeta 0.5 overshoot, zeta 1.0 clean settle, zeta 1.5 crawl",
  )

  return {
    destroy: function () {
      stop()
      surface.destroy()
    },
  }
}
