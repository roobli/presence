/* spring-zeta: a spring-mass-damper settle with damping ratio and stiffness sliders. */

WIDGETS["spring-zeta"] = function (root) {
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

  var surface = createSurface(canvas, 280, paint)

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
    surface.draw()
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
      // The first frame's timestamp can be earlier than the performance.now() baseline.
      var dt = Math.max(0, Math.min(0.032, (now - last) / 1000))
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
        surface.draw()
        return
      }
      if (tAccum > MAX_T) {
        playing = false
        surface.draw()
        return
      }
      surface.draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  function paint(ctx, cssW, cssH, pal) {
    var ink = pal.ink
    var muted = pal.muted
    var line = pal.line
    var accent = pal.accent

    ctx.fillStyle = pal.surface
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

    // left wall / anchor (no zigzag coil; the plot carries the story)
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
    ctx.font = "10px " + pal.fontUi
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
    ctx.font = "11px " + pal.fontUi
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
    if (!playing) surface.draw()
  })
  kSlider.addEventListener("input", function () {
    k = parseFloat(kSlider.value)
    kVal.textContent = String(Math.round(k))
    if (!playing) surface.draw()
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

  return {
    destroy: function () {
      stop()
      surface.destroy()
    },
  }
}
