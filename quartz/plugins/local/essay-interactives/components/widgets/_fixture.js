/* _fixture: a test widget for the instrument shell, built only with
 * ESSAY_FIG_FIXTURES=1. A handle on a track follows the pointer 1:1, stretches
 * past either end, and a spring brings it back inside on release. It uses every
 * part of the fig API, so the shell checks have something real to measure. */

var STRINGS = {
  en: {
    handle: "Handle position",
    response: "Response",
    damping: "Damping",
    critical: "Critical",
    bouncy: "Bouncy",
    trail: "Show trail",
    nudge: "Nudge",
    offset: "Offset",
    seconds: " s",
    pixels: " px",
  },
  "zh-Hans": {
    handle: "手柄位置",
    response: "响应",
    damping: "阻尼",
    critical: "临界",
    bouncy: "回弹",
    trail: "显示轨迹",
    nudge: "推一下",
    offset: "偏移",
    seconds: " 秒",
    pixels: " 像素",
  },
}

var HANDLE = 44
var RULER = 28
var TRAIL = 24

function boundFor(width) {
  return Math.max(40, width / 2 - 56)
}

WIDGETS["fixture"] = function (fig) {
  var s = fig.strings(STRINGS)
  var response = 0.35
  var damping = 1
  var width = 0
  var bound = 40
  var offset = 0
  var grab = 0
  var showTrail = false
  var trail = new Float32Array(TRAIL)
  var trailAt = 0
  var spring = fig.spring({ response: response, dampingRatio: damping })

  var handle = document.createElement("div")
  handle.style.cssText =
    "position:absolute;left:0;top:0;width:" +
    HANDLE +
    "px;height:" +
    HANDLE +
    "px;border-radius:50%;cursor:grab"
  var surface = fig.canvas({ paint: paint })
  var ruler = fig.svg({ height: RULER, onSize: placeLabels })
  fig.stage.appendChild(handle)

  var labels = [0, 1, 2].map(function () {
    var text = document.createElementNS("http://www.w3.org/2000/svg", "text")
    text.setAttribute("y", "18")
    text.setAttribute("text-anchor", "middle")
    text.setAttribute("fill", "currentColor")
    text.setAttribute("font-size", "12")
    ruler.el.appendChild(text)
    return text
  })

  function clampInside(x) {
    return Math.max(-bound, Math.min(bound, x))
  }

  function band(raw) {
    var over = Math.abs(raw) - bound
    return over <= 0 ? raw : Math.sign(raw) * (bound + fig.rubberBand(over, bound))
  }

  function unband(shown) {
    var over = Math.abs(shown) - bound
    return over <= 0 ? shown : Math.sign(shown) * (bound + fig.rubberBandInverse(over, bound))
  }

  function percent(x) {
    return Math.round((x / bound) * 100)
  }

  function placeLabels(w) {
    var b = boundFor(w)
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
      bound = boundFor(w)
    }
    var cx = w / 2
    var y = (h + RULER) / 2
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
      for (var i = 0; i < TRAIL; i++) {
        ctx.beginPath()
        ctx.arc(cx + trail[i], y, 4, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = pal.accent
    ctx.beginPath()
    ctx.arc(cx + offset, y, 11, 0, 2 * Math.PI)
    ctx.fill()
    handle.style.transform =
      "translate(" + (cx + offset - HANDLE / 2) + "px," + (y - HANDLE / 2) + "px)"
  }

  function render() {
    trail[trailAt] = offset
    trailAt = (trailAt + 1) % TRAIL
    surface.draw()
    readout.set(offset)
    fig.root.setAttribute("data-offset", offset.toFixed(1))
  }

  var loop = fig.loop(function (dt) {
    var moving = spring.step(dt)
    offset = spring.value
    render()
    if (!moving) drag.keys.set(percent(offset))
    return moving
  })

  // Frames run only while the spring has somewhere to go. Under reduced motion
  // retarget has already jumped, so the settled state is drawn at once.
  function follow() {
    if (!spring.resting) {
      loop.start()
      return
    }
    loop.stop()
    offset = spring.value
    render()
    drag.keys.set(percent(offset))
  }

  var drag = fig.drag(handle, {
    onStart: function () {
      loop.stop()
      // Catch the handle where it is, stretched or not.
      offset = spring.value
      spring.set(offset)
      grab = unband(offset)
      render()
    },
    onMove: function (point, delta) {
      offset = band(grab + delta.x)
      render()
    },
    onEnd: function (point, velocity) {
      spring.set(offset, velocity.x)
      spring.retarget(clampInside(offset))
      drag.keys.set(percent(clampInside(offset)))
      follow()
    },
    onCancel: function () {
      offset = band(grab)
      spring.set(offset)
      spring.retarget(clampInside(offset))
      follow()
    },
    keyboard: {
      min: -100,
      max: 100,
      step: 1,
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
    },
  })

  function respring() {
    var target = spring.target
    spring = fig.spring({
      response: response,
      dampingRatio: damping,
      value: spring.value,
      velocity: spring.velocity,
    })
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
      surface.draw()
    },
  })

  fig.button({
    label: s.nudge,
    onClick: function () {
      spring.retarget(spring.target < bound / 2 ? bound : -bound)
      follow()
    },
  })

  var readout = fig.readout({
    label: s.offset,
    format: function (v) {
      return Math.round(v) + s.pixels
    },
  })

  fig.onReset(function () {
    loop.stop()
    response = 0.35
    damping = 1
    showTrail = false
    responseSlider.set(response)
    dampingChoice.set(damping)
    trailToggle.set(false)
    spring = fig.spring({ response: response, dampingRatio: damping })
    offset = 0
    for (var i = 0; i < TRAIL; i++) trail[i] = 0
    drag.keys.set(0)
    render()
  })

  placeLabels(ruler.width())
  render()

  return { destroy: function () {} }
}
