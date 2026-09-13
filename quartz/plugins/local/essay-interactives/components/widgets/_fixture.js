/* _fixture: test widgets for the instrument shell, built only with
 * ESSAY_FIG_FIXTURES=1.
 * "fixture" is a group stage: a handle on a track follows the pointer 1:1,
 * stretches past either end, and a spring brings it back on release. Its
 * controls use every fig helper, so the shell checks have something real to
 * measure. "fixture-img" is a display-only img stage with an aspect ratio.
 * Only function declarations, plain constants and the WIDGETS assignments run
 * when the file loads, so node:vm can load it with { WIDGETS: {} }. */

var FIXTURE_STRINGS = {
  en: {
    handle: "Handle position",
    response: "Response",
    stepping: "Stepping",
    exact: "Exact",
    euler: "Euler",
    damping: "Damping",
    critical: "Critical",
    bouncy: "Bouncy",
    trail: "Show trail",
    trailLength: "Trail",
    dots: " dots",
    nudge: "Nudge",
    kick: "Kick",
    lock: "Lock controls",
    offset: "Offset",
    seconds: " s",
    pixels: " px",
    resting: "The handle rests at ",
  },
  "zh-Hans": {
    handle: "手柄位置",
    response: "响应",
    stepping: "步进",
    exact: "精确",
    euler: "欧拉",
    damping: "阻尼",
    critical: "临界",
    bouncy: "回弹",
    trail: "显示轨迹",
    trailLength: "轨迹",
    dots: " 个点",
    nudge: "推一下",
    kick: "弹一下",
    lock: "锁定控件",
    offset: "偏移",
    seconds: " 秒",
    pixels: " 像素",
    resting: "手柄停在 ",
  },
}

var FIXTURE_IMG_STRINGS = {
  en: { ratio: "Damping ratio", overshoot: "overshoot", none: "no overshoot", second: " s" },
  "zh-Hans": { ratio: "阻尼比", overshoot: "超调", none: "没有超调", second: " 秒" },
}

var FIXTURE_RULER = 28
var FIXTURE_TRAIL_MAX = 24
var FIXTURE_ZETAS = [0.5, 1, 1.5]

/* ---------- pure models (window.__essayInteractives.models) ---------- */

function fixtureBound(width) {
  return Math.max(40, width / 2 - 56)
}

// Offset shown for raw travel, stretched past the bound.
function fixtureBand(raw, bound) {
  var over = Math.abs(raw) - bound
  return over <= 0 ? raw : (raw < 0 ? -1 : 1) * (bound + rubberBand(over, bound))
}

function fixtureUnband(shown, bound) {
  var over = Math.abs(shown) - bound
  return over <= 0 ? shown : (shown < 0 ? -1 : 1) * (bound + rubberBandInverse(over, bound))
}

// Peak overshoot of a step response as a fraction of the step.
function fixtureOvershoot(zeta) {
  return zeta >= 1 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
}

/* ---------- fixture: group stage ---------- */

WIDGETS["fixture"] = function (fig) {
  var s = fig.strings(FIXTURE_STRINGS)
  var response = 0.35
  var damping = 1
  var exact = true
  var width = 0
  var bound = 40
  var offset = 0
  var grab = 0
  var showTrail = false
  var locked = false
  var trailLength = 12
  var trailX = new Float64Array(FIXTURE_TRAIL_MAX)
  var trailV = new Float64Array(FIXTURE_TRAIL_MAX)
  var trailT = new Float64Array(FIXTURE_TRAIL_MAX)
  var trail = { x: trailX, v: trailV, target: trailT }
  var trailParams = fig.uiSpring(0.12)
  trailParams.exact = true
  var springMoving = false
  var sizeCalls = 0
  var scopeKeys = 0
  var kicks = 0
  var spring = makeSpring(0, 0)

  fig.root.setAttribute("data-lang", fig.lang)

  var surface = fig.canvas({ paint: paint })
  var ruler = fig.svg({ height: FIXTURE_RULER, onSize: placeLabels })
  var handle = document.createElement("div")
  handle.style.cssText =
    "position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;cursor:grab"
  fig.box.appendChild(handle)
  var kick = document.createElement("button")
  kick.type = "button"
  kick.className = "essay-fig__button"
  kick.textContent = s.kick
  kick.style.cssText = "position:absolute;right:8px;bottom:8px"
  fig.box.appendChild(kick)

  var labels = [0, 1, 2].map(function () {
    var text = document.createElementNS("http://www.w3.org/2000/svg", "text")
    text.setAttribute("y", "18")
    text.setAttribute("text-anchor", "middle")
    text.setAttribute("fill", "currentColor")
    text.setAttribute("font-size", "12")
    ruler.el.appendChild(text)
    return text
  })

  function makeSpring(value, velocity) {
    return fig.spring({
      response: response,
      dampingRatio: damping,
      exact: exact,
      value: value,
      velocity: velocity,
    })
  }

  function clampInside(x) {
    return Math.max(-bound, Math.min(bound, x))
  }

  function percent(x) {
    return Math.round((x / bound) * 100)
  }

  function placeLabels(w) {
    var b = fixtureBound(w)
    labels[0].setAttribute("x", String(w / 2 - b))
    labels[1].setAttribute("x", String(w / 2))
    labels[2].setAttribute("x", String(w / 2 + b))
    labels[0].textContent = "-" + Math.round(b) + s.pixels
    labels[1].textContent = "0"
    labels[2].textContent = Math.round(b) + s.pixels
  }

  function paint(ctx, w, h, pal) {
    if (w !== width) {
      width = w
      bound = fixtureBound(w)
    }
    var cx = w / 2
    var y = (h + ruler.height()) / 2
    ctx.fillStyle = pal.canvas
    ctx.fillRect(0, 0, w, h)
    ctx.lineCap = "round"
    ctx.strokeStyle = pal.line
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - bound, y)
    ctx.lineTo(cx + bound, y)
    ctx.stroke()
    ctx.strokeStyle = pal.muted
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - bound, y - 8)
    ctx.lineTo(cx - bound, y + 8)
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx, y + 6)
    ctx.moveTo(cx + bound, y - 8)
    ctx.lineTo(cx + bound, y + 8)
    ctx.stroke()
    if (showTrail) {
      ctx.fillStyle = pal.muted
      ctx.globalAlpha = 0.2
      for (var i = 0; i < trailLength; i++) {
        ctx.beginPath()
        ctx.arc(cx + trailX[i], y, 4, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = pal.accent
    ctx.beginPath()
    ctx.arc(cx + offset, y, 11, 0, 2 * Math.PI)
    ctx.fill()
    handle.style.transform = "translate(" + (cx + offset - 22) + "px," + (y - 22) + "px)"
  }

  function render() {
    surface.draw()
    readout.set(offset)
    fig.root.setAttribute("data-offset", offset.toFixed(1))
  }

  // Typed-array views change only with the trail length, never per frame.
  function setTrailLength(n) {
    trailLength = n
    trail.x = trailX.subarray(0, n)
    trail.v = trailV.subarray(0, n)
    trail.target = trailT.subarray(0, n)
    for (var i = 0; i < n; i++) {
      trailX[i] = offset
      trailV[i] = 0
    }
  }

  // Each dot follows the one ahead of it; under reduced motion they jump.
  function stepTrail(dt) {
    var n = trailLength
    var i
    if (!showTrail || fig.reducedMotion()) {
      for (i = 0; i < n; i++) {
        trailX[i] = offset
        trailV[i] = 0
      }
      return false
    }
    trailT[0] = offset
    for (i = 1; i < n; i++) trailT[i] = trailX[i - 1]
    return !fig.stepSpring(trail, trailParams, dt, 0.5, 5)
  }

  function settled() {
    keys.set(percent(offset))
    fig.describe(s.resting + Math.round(offset) + s.pixels)
  }

  var loop = fig.loop(function (dt) {
    var held = drag.held()
    var moving = false
    if (!held) {
      moving = spring.step(dt)
      offset = spring.value
    }
    var trailing = stepTrail(dt)
    render()
    if (springMoving && !moving && !held) settled()
    springMoving = moving
    return moving || trailing || false
  })

  // Frames run only while something has somewhere to go. Under reduced motion
  // retarget has already jumped, so the settled state is drawn at once.
  function follow() {
    springMoving = !spring.resting
    if (springMoving || (showTrail && !fig.reducedMotion())) {
      loop.start()
      if (springMoving) return
    } else {
      loop.stop()
    }
    offset = spring.value
    stepTrail(0)
    render()
    settled()
  }

  function nudge(dir) {
    spring.retarget(dir > 0 ? bound : -bound)
    keys.set(dir > 0 ? 100 : -100)
    follow()
  }

  // The keyboard alternative to the drag, on the same element: arrows step,
  // Shift steps 25, PageUp and PageDown walk the marks, Enter nudges.
  var keys = fig.keySlider(handle, {
    min: -100,
    max: 100,
    step: 1,
    shiftStep: 25,
    value: 0,
    marks: [-50, 0, 50],
    label: s.handle,
    valueText: function (v) {
      return Math.round((v / 100) * bound) + s.pixels
    },
    onInput: function (v) {
      spring.retarget((v / 100) * bound)
      follow()
    },
    extraKeys: {
      Enter: function () {
        nudge(1)
      },
      "Shift+Enter": function () {
        nudge(-1)
      },
    },
  })

  var drag = fig.drag(
    handle,
    {
      onStart: function () {
        // Keys keep working on the handle after a drag, so the press takes focus.
        handle.focus({ preventScroll: true })
        offset = spring.value
        spring.set(offset)
        springMoving = false
        // Catch the handle where it is, stretched or not.
        grab = fixtureUnband(offset, bound)
        render()
      },
      onMove: function (point, delta) {
        offset = fixtureBand(grab + delta.x, bound)
        render()
        if (showTrail) loop.start()
      },
      onEnd: function (point, velocity) {
        spring.set(offset, velocity.x)
        spring.retarget(clampInside(offset))
        keys.set(percent(clampInside(offset)))
        keys.commit()
        follow()
      },
      onCancel: function () {
        offset = fixtureBand(grab, bound)
        spring.set(offset)
        spring.retarget(clampInside(offset))
        follow()
      },
    },
    { touchAction: "none" },
  )

  fig.press(kick, function () {
    kicks += 1
    fig.root.setAttribute("data-kicks", String(kicks))
    spring.set(offset, kicks % 2 ? 1200 : -1200)
    spring.retarget(clampInside(offset))
    follow()
  })

  // Plain letters move the handle while focus is inside the stage; everything
  // else, Cmd and Ctrl shortcuts included, goes on to the page.
  fig.keyScope(function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return false
    var target
    if (e.key === "a") target = -bound
    else if (e.key === "s") target = 0
    else if (e.key === "d") target = bound
    else return false
    scopeKeys += 1
    fig.root.setAttribute("data-scope-keys", String(scopeKeys))
    fig.root.setAttribute("data-last-key", e.key)
    spring.retarget(target)
    keys.set(percent(target))
    follow()
    return true
  })

  function respring() {
    var target = spring.target
    spring = makeSpring(spring.value, spring.velocity)
    spring.retarget(target)
    follow()
  }

  var responseSlider = fig.slider({
    label: s.response,
    min: 0.2,
    max: 0.8,
    step: 0.05,
    value: response,
    format: function (v) {
      return v.toFixed(2) + s.seconds
    },
    onInput: function (v) {
      response = v
      respring()
    },
  })

  var steppingChoice = fig.segmented({
    label: s.stepping,
    options: [
      { value: "exact", label: s.exact },
      { value: "euler", label: s.euler },
    ],
    value: "exact",
    onChange: function (v) {
      exact = v === "exact"
      respring()
    },
  })

  var dampingChoice = fig.segmented({
    label: s.damping,
    options: [
      { value: 1, label: s.critical },
      { value: 0.6, label: s.bouncy },
    ],
    value: damping,
    onChange: function (v) {
      damping = v
      respring()
    },
  })

  var trailToggle = fig.toggle({
    label: s.trail,
    checked: false,
    onChange: function (on) {
      showTrail = on
      trailRuler.setDisabled(locked || !on)
      setTrailLength(trailLength)
      render()
    },
  })

  var trailRuler = fig.ruler({
    label: s.trailLength,
    min: 4,
    max: 24,
    step: 4,
    value: trailLength,
    maxWidth: 280,
    valueText: function (v) {
      return v + s.dots
    },
    onInput: function (v) {
      setTrailLength(v)
      fig.root.setAttribute("data-trail", String(v))
      render()
    },
    onChange: function (v) {
      fig.root.setAttribute("data-trail-committed", String(v))
    },
  })
  trailRuler.setDisabled(true)

  var nudgeButton = fig.button({
    label: s.nudge,
    onClick: function () {
      nudge(spring.target < bound / 2 ? 1 : -1)
    },
  })

  function lock(on) {
    locked = on
    responseSlider.setDisabled(on)
    steppingChoice.setDisabled(on)
    dampingChoice.setDisabled(on)
    trailToggle.setDisabled(on)
    nudgeButton.setDisabled(on)
    trailRuler.setDisabled(on || !showTrail)
    fig.root.setAttribute("data-locked", on ? "1" : "0")
  }

  var lockToggle = fig.toggle({ label: s.lock, checked: false, onChange: lock })

  var readout = fig.readout({
    label: s.offset,
    format: function (v) {
      return Math.round(v) + s.pixels
    },
  })

  // Narrow figures give the ruler more room; setHeight keeps its viewBox equal
  // to its CSS size, and the canvas repaints around it.
  fig.onSizeChange(function (size, w) {
    sizeCalls += 1
    fig.root.setAttribute("data-size-calls", String(sizeCalls))
    fig.root.setAttribute("data-size-width", String(Math.round(w)))
    var rulerHeight = size === "narrow" ? 32 : FIXTURE_RULER
    if (ruler.height() !== rulerHeight) {
      ruler.setHeight(rulerHeight)
      surface.invalidate()
    }
  })

  fig.model({
    bound: fixtureBound,
    band: fixtureBand,
    unband: fixtureUnband,
    springAt: fig.springAt,
  })

  fig.onReset(function () {
    loop.stop()
    response = 0.35
    damping = 1
    exact = true
    showTrail = false
    if (locked) {
      lockToggle.set(false)
      lock(false)
    }
    responseSlider.set(response)
    steppingChoice.set("exact")
    dampingChoice.set(damping)
    trailToggle.set(false)
    trailRuler.set(12)
    trailRuler.setDisabled(true)
    spring = makeSpring(0, 0)
    springMoving = false
    offset = 0
    setTrailLength(12)
    keys.reset(0)
    render()
    fig.describe(fig.alt)
  })

  setTrailLength(trailLength)
  placeLabels(ruler.width())
  render()

  return { destroy: function () {} }
}

/* ---------- fixture-img: display-only img stage ---------- */

WIDGETS["fixture-img"] = function (fig) {
  var s = fig.strings(FIXTURE_IMG_STRINGS)
  var omega = Math.sqrt(320)
  var zeta = 0.5
  var svgNS = "http://www.w3.org/2000/svg"

  var plot = fig.svg({ onSize: draw })
  var band = document.createElement("div")
  band.style.cssText =
    "position:absolute;left:12px;top:8px;font-family:var(--font-code, ui-monospace, monospace);font-size:13px;line-height:20px;color:var(--ink-color);font-variant-numeric:tabular-nums"
  fig.box.appendChild(band)

  function svgEl(tag, attrs) {
    var node = document.createElementNS(svgNS, tag)
    for (var key in attrs) node.setAttribute(key, attrs[key])
    plot.el.appendChild(node)
    return node
  }

  var rest = svgEl("path", {
    fill: "none",
    stroke: "var(--line-strong-color)",
    "stroke-width": "1",
  })
  var traces = FIXTURE_ZETAS.map(function () {
    return svgEl("path", { fill: "none", "stroke-width": "1.5", "stroke-linejoin": "round" })
  })
  var ticks = [0, 0.5, 1].map(function () {
    return svgEl("text", { "font-size": "12", fill: "currentColor", "text-anchor": "middle" })
  })

  function draw() {
    var w = plot.width()
    var h = plot.height()
    if (!(w > 0 && h > 0)) return
    var left = 16
    var right = w - 16
    var top = 40
    var bottom = h - 28
    function px(t) {
      return left + t * (right - left)
    }
    function py(y) {
      return top + ((1 - y) / 1.2) * (bottom - top)
    }
    rest.setAttribute("d", "M" + left + " " + py(0) + "H" + right)
    for (var k = 0; k < FIXTURE_ZETAS.length; k++) {
      var d = ""
      for (var i = 0; i <= 120; i++) {
        var t = i / 120
        d +=
          (i ? "L" : "M") +
          px(t).toFixed(1) +
          " " +
          py(fig.springAt(1, 0, FIXTURE_ZETAS[k], omega, t)).toFixed(1)
      }
      traces[k].setAttribute("d", d)
      traces[k].style.stroke =
        FIXTURE_ZETAS[k] === zeta ? "var(--accent-color)" : "var(--ink-muted-color)"
    }
    // Narrow figures label only the ends of the time axis.
    var narrow = fig.size() === "narrow"
    for (var j = 0; j < ticks.length; j++) {
      var tv = [0, 0.5, 1][j]
      ticks[j].setAttribute("x", String(px(tv)))
      ticks[j].setAttribute("y", String(h - 8))
      ticks[j].textContent = tv === 0 ? "0" : tv + s.second
      ticks[j].style.display = narrow && tv === 0.5 ? "none" : ""
    }
  }

  function text() {
    var o = fixtureOvershoot(zeta)
    return "ζ " + zeta + ", " + (o > 0 ? s.overshoot + " " + (o * 100).toFixed(1) + "%" : s.none)
  }

  function update() {
    band.textContent = text()
    fig.root.setAttribute("data-zeta", String(zeta))
    draw()
  }

  var choice = fig.segmented({
    label: s.ratio,
    options: FIXTURE_ZETAS.map(function (z) {
      return { value: z, label: String(z) }
    }),
    value: zeta,
    onChange: function (v) {
      zeta = v
      update()
      fig.describe(fig.alt + " " + text())
    },
  })

  fig.onSizeChange(draw)
  fig.model({ overshoot: fixtureOvershoot })
  fig.onReset(function () {
    zeta = 0.5
    choice.set(zeta)
    update()
    fig.describe(fig.alt)
  })

  update()
  return { destroy: function () {} }
}
