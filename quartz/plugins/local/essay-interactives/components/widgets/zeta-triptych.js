/* zeta-triptych: the same unit pull released under three damping ratios and
 * under the reader's own ζ, over 1.2 s, with what each ζ costs underneath.
 * Overshoot exists only below ζ = 1 and extra settle time is drawn only among
 * settings that never overshoot, so both cost rows reach zero together at
 * ζ = 1. Every curve is a closed form of the essay's spring (m = 1, k = 320).
 * Only function declarations, constants and the WIDGETS assignment run when the
 * file loads, so node:vm can load it with { WIDGETS: {} }. */

var ZETA_STRINGS = {
  en: {
    legend: ["ζ 0.5 overshoot", "ζ 1 clean settle", "ζ 1.5 crawl", "your ζ"],
    direct: ["ζ 0.5", "ζ 1", "ζ 1.5"],
    overshoot: "overshoot",
    extraRow: "extra time to settle vs ζ = 1, among settings that never overshoot",
    oscillates: "oscillates",
    tickWide: "SwiftUI default 0.825",
    tickNarrow: "SwiftUI 0.825",
    zetaAxis: "damping ratio ζ",
    timeAxis: "time after release (s)",
    rest: "rest",
    play: "Play in real time",
    slider: "Damping ratio ζ",
    under: "ζ {z} · overshoot {o}% · oscillates",
    over: "ζ {z} · no overshoot · settles {e}% later than ζ = 1",
    critical: "ζ 1.00 · no overshoot · the fastest settle that never overshoots",
    underText: "ζ {z}, overshoot {o} percent, oscillates",
    overText: "ζ {z}, no overshoot, settles {e} percent later than ζ 1",
    criticalText: "ζ 1.00, no overshoot, the fastest settle that never overshoots",
  },
  "zh-Hans": {
    legend: ["ζ 0.5 过冲", "ζ 1 干净停稳", "ζ 1.5 缓慢爬行", "当前 ζ"],
    direct: ["ζ 0.5", "ζ 1", "ζ 1.5"],
    overshoot: "过冲",
    extraRow: "与 ζ = 1 相比多用的停稳时间（仅限不过冲的设置）",
    oscillates: "会振荡",
    tickWide: "SwiftUI 默认值 0.825",
    tickNarrow: "SwiftUI 0.825",
    zetaAxis: "阻尼比 ζ",
    timeAxis: "松手后的时间（秒）",
    rest: "静止位置",
    play: "按真实时间播放",
    slider: "阻尼比 ζ",
    under: "ζ {z} · 过冲 {o}% · 会振荡",
    over: "ζ {z} · 无过冲 · 停稳比 ζ = 1 慢 {e}%",
    critical: "ζ 1.00 · 无过冲 · 不过冲前提下最快停稳",
    underText: "ζ {z}，过冲 {o}%，会振荡",
    overText: "ζ {z}，无过冲，停稳比 ζ = 1 慢 {e}%",
    criticalText: "ζ 1.00，无过冲，不过冲前提下最快停稳",
  },
}

var ZETA_OMEGA = Math.sqrt(320)
var ZETA_MIN = 0.3
var ZETA_MAX = 2
var ZETA_REFS = [0.5, 1, 1.5]
var ZETA_KEYS = ["05", "1", "15"]
var ZETA_MARKS = [0.3, 0.5, 0.825, 1, 1.5, 2]
var ZETA_TICKS = [0.3, 0.5, 1, 1.5, 2]
var ZETA_TIMES = [0, 0.4, 0.8, 1.2]
var ZETA_T_END = 1.2
var ZETA_X_TOP = 1.05
var ZETA_X_SPAN = 1.5
var ZETA_OS_TOP = 0.4
var ZETA_EXTRA_TOP = 1.75
var ZETA_BAND = 0.01
var ZETA_DETENT = 0.015
var ZETA_INSET = 22
var ZETA_SVG = "http://www.w3.org/2000/svg"
var ZETA_PAD = { l: 8, r: 8, t: 20, b: 22 }
// Strip rows in px from the strip top: label band, curve area, zero line, ticks.
// Tick labels sit below the 16px knob dot, which rides the ζ axis (timeZero).
var ZETA_ROWS_WIDE = {
  osTop: 14,
  osZero: 56,
  timeLabel: 79,
  timeTop: 82,
  timeZero: 138,
  ticks: 158,
}
var ZETA_ROWS_NARROW = {
  osTop: 14,
  osZero: 50,
  timeLabel: 71,
  timeTop: 88,
  timeZero: 124,
  ticks: 144,
}
// Wide-layout direct labels [t, dx, dy, anchor], each at its trace's defining
// feature, because all three traces meet the rest line well before 1.2 s.
var ZETA_DIRECT = [
  [0.2028, 0, 16, "middle"],
  [0.16, -6, 12, "end"],
  [0.42, 2, -8, "start"],
]

/* ---------- pure models (window.__essayInteractives.models) ---------- */

// Displacement t seconds after releasing a unit pull at rest velocity.
function zetaX(z, t) {
  return springAt(1, 0, z, ZETA_OMEGA, t)
}

function zetaOvershoot(z) {
  return z < 1 ? Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)) : 0
}

// The last time |x| is at least 1% of the pull, for ζ >= 1 only, where x
// falls monotonically; found by bisection on [0, 3] s.
function zetaSettle(z) {
  if (!(z >= 1)) return NaN
  var lo = 0
  var hi = 3
  for (var i = 0; i < 50; i++) {
    var mid = (lo + hi) / 2
    if (Math.abs(zetaX(z, mid)) >= ZETA_BAND) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function zetaExtra(z) {
  return zetaSettle(z) / zetaSettle(1) - 1
}

// Fixed decimals that round 0.825 up, as the printed tables do.
function zetaFixed(v, digits) {
  var scale = Math.pow(10, digits)
  return (Math.round(v * scale + 1e-7) / scale).toFixed(digits)
}

// The readout (spoken false) or aria-valuetext (spoken true) for ζ, branched on
// the three-decimal value that data-zeta shows.
function zetaSay(table, z, spoken) {
  var z3 = Math.round(z * 1000) / 1000
  if (z3 === 1) return spoken ? table.criticalText : table.critical
  if (z3 < 1) {
    return (spoken ? table.underText : table.under)
      .replace("{z}", zetaFixed(z3, 2))
      .replace("{o}", zetaFixed(zetaOvershoot(z3) * 100, 1))
  }
  return (spoken ? table.overText : table.over)
    .replace("{z}", zetaFixed(z3, 2))
    .replace("{e}", String(Math.round(zetaExtra(z3) * 100)))
}

// The narrow strip breaks the time row's label after its comma (en) or before
// its parenthesis (zh), keeping every word.
function zetaSplit(text) {
  var comma = text.indexOf(", ")
  if (comma > 0) return [text.slice(0, comma + 1), text.slice(comma + 2)]
  var paren = text.indexOf("（")
  return paren > 0 ? [text.slice(0, paren), text.slice(paren)] : [text, ""]
}

function zetaNode(ns, tag, cls, parent) {
  var node = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  if (cls) node.setAttribute("class", cls)
  if (parent) parent.appendChild(node)
  return node
}

function zetaText(parent, cls, text, anchor) {
  var node = zetaNode(ZETA_SVG, "text", cls, parent)
  if (text) node.textContent = text
  if (anchor) node.setAttribute("text-anchor", anchor)
  return node
}

function zetaR(v) {
  return Math.round(v * 10) / 10
}

function zetaAt(node, x, y) {
  node.setAttribute("x", String(zetaR(x)))
  node.setAttribute("y", String(zetaR(y)))
}

function zetaLine(node, x1, y1, x2, y2) {
  node.setAttribute("x1", String(zetaR(x1)))
  node.setAttribute("y1", String(zetaR(y1)))
  node.setAttribute("x2", String(zetaR(x2)))
  node.setAttribute("y2", String(zetaR(y2)))
}

/* ---------- widget ---------- */

WIDGETS["zeta-triptych"] = function (fig) {
  var s = fig.strings(ZETA_STRINGS)
  var settleOne = zetaSettle(1)
  var zeta = 1
  var zetaShown = ""
  var readoutShown = ""
  var phase = ""
  var playingShown = ""
  var playing = false
  var firstFrame = false
  var playT = -1
  var playFrom = 0
  var headShown = null
  var knobX = 0
  var grab = 0
  var stripLeft = 0
  var settleToOne = false
  var pw = 0
  var ph = 0
  var sw = 0
  var narrow = fig.size() === "narrow"

  var root = zetaNode(null, "div", "zeta-triptych", fig.box)
  root.setAttribute("data-size", fig.size())

  var legend = zetaNode(null, "ul", "zeta-triptych__legend", root)
  s.legend.forEach(function (label, i) {
    var li = zetaNode(null, "li", null, legend)
    var swatch = zetaNode(ZETA_SVG, "svg", "zeta-triptych__swatch", li)
    swatch.setAttribute("width", "20")
    swatch.setAttribute("height", "12")
    swatch.setAttribute("aria-hidden", "true")
    var cls = i < 3 ? "zeta-triptych__ref--" + ZETA_KEYS[i] : "zeta-triptych__swatch-live"
    zetaNode(ZETA_SVG, "path", cls, swatch).setAttribute("d", "M1 6H19")
    li.appendChild(document.createTextNode(label))
  })

  /* plot */
  var plotWrap = zetaNode(null, "div", "zeta-triptych__plot-wrap", root)
  var plot = fig.svg({ parent: plotWrap, onSize: drawPlot })
  plot.el.setAttribute("class", plot.el.getAttribute("class") + " zeta-triptych__plot")
  var axis = zetaNode(ZETA_SVG, "g", "zeta-triptych__axis", plot.el)
  var axisLine = zetaNode(ZETA_SVG, "path", "zeta-triptych__axis-line", axis)
  var timeTicks = ZETA_TIMES.map(function (t, i) {
    var anchor = i === 0 ? "start" : i === ZETA_TIMES.length - 1 ? "end" : "middle"
    return zetaText(axis, "zeta-triptych__tick", String(t), anchor)
  })
  var timeTitle = zetaText(axis, "zeta-triptych__axis-title", s.timeAxis, "end")
  var restLabel = zetaText(axis, "zeta-triptych__axis-title", s.rest, "start")
  var restLine = zetaNode(ZETA_SVG, "line", "zeta-triptych__rest", plot.el)
  var refs = ZETA_KEYS.map(function (key) {
    return zetaNode(ZETA_SVG, "path", "zeta-triptych__ref zeta-triptych__ref--" + key, plot.el)
  })
  var live = zetaNode(ZETA_SVG, "path", "zeta-triptych__live", plot.el)
  var playhead = zetaNode(ZETA_SVG, "line", "zeta-triptych__playhead", plot.el)
  var dots = ["05", "1", "15", "live"].map(function (key) {
    var dot = zetaNode(ZETA_SVG, "circle", "zeta-triptych__dot zeta-triptych__dot--" + key, plot.el)
    dot.setAttribute("r", key === "live" ? "4" : "3")
    return dot
  })
  var directs = s.direct.map(function (label, i) {
    return zetaText(plot.el, "zeta-triptych__direct", label, ZETA_DIRECT[i][3])
  })

  /* cost strip */
  var strip = zetaNode(null, "div", "zeta-triptych__strip", root)
  var cost = fig.svg({ parent: strip, onSize: drawCost })
  cost.el.setAttribute("class", cost.el.getAttribute("class") + " zeta-triptych__cost")
  var rowOs = zetaNode(ZETA_SVG, "g", "zeta-triptych__row--overshoot", cost.el)
  var osLabel = zetaText(rowOs, "zeta-triptych__row-label", s.overshoot, "end")
  var osZero = zetaNode(ZETA_SVG, "line", "zeta-triptych__zero", rowOs)
  var costOs = zetaNode(ZETA_SVG, "path", "zeta-triptych__cost-os", rowOs)
  var rowTime = zetaNode(ZETA_SVG, "g", "zeta-triptych__row--time", cost.el)
  var timeLabel = zetaText(rowTime, "zeta-triptych__row-label", "", "start")
  var timeLine1 = zetaNode(ZETA_SVG, "tspan", null, timeLabel)
  var timeLine2 = zetaNode(ZETA_SVG, "tspan", null, timeLabel)
  var timeZero = zetaNode(ZETA_SVG, "line", "zeta-triptych__zero", rowTime)
  var costTime = zetaNode(ZETA_SVG, "path", "zeta-triptych__cost-time", rowTime)
  var oscillates = zetaText(rowTime, "zeta-triptych__oscillates", s.oscillates, "middle")
  var zetaTitle = zetaText(rowTime, "zeta-triptych__axis-title", s.zetaAxis, "end")
  var guide = zetaNode(ZETA_SVG, "line", "zeta-triptych__guide", cost.el)
  var tick = zetaNode(ZETA_SVG, "line", "zeta-triptych__tick--0825", cost.el)
  var tickLabel = zetaText(cost.el, "zeta-triptych__tick-label", "", "end")
  var zAxis = zetaNode(ZETA_SVG, "g", "zeta-triptych__zaxis", cost.el)
  var zMarks = zetaNode(ZETA_SVG, "path", "zeta-triptych__axis-line", zAxis)
  var zTicks = ZETA_TICKS.map(function (v) {
    return zetaText(zAxis, "zeta-triptych__tick", String(v), "middle")
  })

  var knob = zetaNode(null, "div", "zeta-triptych__knob", strip)
  zetaNode(null, "span", "zeta-triptych__handle", knob)
  zetaNode(null, "span", "zeta-triptych__knob-dot", knob)

  /* rail: readout, Play, then the shell's Reset */
  var readout = zetaNode(null, "output", "zeta-triptych__readout")
  var playButton = fig.button({ label: s.play })
  fig.rail.insertBefore(readout, playButton.el)
  fig.press(playButton.el, startPlay)

  var spring = fig.spring({ response: 0.3, dampingRatio: 1, exact: true })

  function px(t) {
    return ZETA_PAD.l + (t / ZETA_T_END) * (pw - ZETA_PAD.l - ZETA_PAD.r)
  }

  function py(x) {
    return ZETA_PAD.t + ((ZETA_X_TOP - x) / ZETA_X_SPAN) * (ph - ZETA_PAD.t - ZETA_PAD.b)
  }

  function zx(z) {
    return ZETA_INSET + ((z - ZETA_MIN) / (ZETA_MAX - ZETA_MIN)) * (sw - 2 * ZETA_INSET)
  }

  function zOf(x) {
    var z = ZETA_MIN + ((x - ZETA_INSET) / (sw - 2 * ZETA_INSET)) * (ZETA_MAX - ZETA_MIN)
    return Math.min(ZETA_MAX, Math.max(ZETA_MIN, z))
  }

  function trace(z) {
    var n = Math.max(2, Math.round((pw - ZETA_PAD.l - ZETA_PAD.r) / 2))
    var d = ""
    for (var i = 0; i <= n; i++) {
      var t = (ZETA_T_END * i) / n
      d += (i ? "L" : "M") + zetaR(px(t)) + " " + zetaR(py(zetaX(z, t)))
    }
    return d
  }

  // References, axes and labels change only with the plot size.
  function drawPlot() {
    pw = plot.width()
    ph = plot.height()
    if (!(pw > 0 && ph > 0)) return
    var bottom = ph - ZETA_PAD.b
    var marks = "M" + ZETA_PAD.l + " " + zetaR(bottom) + "H" + zetaR(pw - ZETA_PAD.r)
    for (var i = 0; i < ZETA_TIMES.length; i++) {
      marks += "M" + zetaR(px(ZETA_TIMES[i])) + " " + zetaR(bottom) + "v4"
      zetaAt(timeTicks[i], px(ZETA_TIMES[i]), ph - 5)
    }
    axisLine.setAttribute("d", marks)
    zetaAt(timeTitle, pw - ZETA_PAD.r, 12)
    zetaAt(restLabel, ZETA_PAD.l, py(0) - 5)
    zetaLine(restLine, ZETA_PAD.l, py(0), pw - ZETA_PAD.r, py(0))
    for (var k = 0; k < refs.length; k++) {
      var at = ZETA_DIRECT[k]
      refs[k].setAttribute("d", trace(ZETA_REFS[k]))
      directs[k].setAttribute("visibility", narrow ? "hidden" : "visible")
      zetaAt(directs[k], px(at[0]) + at[1], py(zetaX(ZETA_REFS[k], at[0])) + at[2])
    }
    live.setAttribute("d", trace(zeta))
    placeHead()
  }

  function placeHead() {
    var show = playT >= 0 && pw > 0
    if (show !== headShown) {
      headShown = show
      playhead.setAttribute("visibility", show ? "visible" : "hidden")
      for (var i = 0; i < dots.length; i++)
        dots[i].setAttribute("visibility", show ? "visible" : "hidden")
    }
    if (!show) return
    var x = px(playT)
    zetaLine(playhead, x, ZETA_PAD.t, x, ph - ZETA_PAD.b)
    for (var k = 0; k < dots.length; k++) {
      dots[k].setAttribute("cx", String(zetaR(x)))
      dots[k].setAttribute("cy", String(zetaR(py(zetaX(k < 3 ? ZETA_REFS[k] : zeta, playT)))))
    }
  }

  // Cost rows, guide, tick and ζ axis change only with the strip size.
  function drawCost() {
    sw = cost.width()
    if (!(sw > 0)) return
    var g = narrow ? ZETA_ROWS_NARROW : ZETA_ROWS_WIDE
    var lo = zx(ZETA_MIN)
    var hi = zx(ZETA_MAX)
    var one = zx(1)
    var tx = zx(0.825)
    zetaLine(osZero, lo, g.osZero, hi, g.osZero)
    zetaLine(timeZero, lo, g.timeZero, hi, g.timeZero)
    zetaLine(guide, one, g.osTop, one, g.timeZero)
    zetaLine(tick, tx, g.osTop, tx, g.osZero)
    tickLabel.textContent = narrow ? s.tickNarrow : s.tickWide
    zetaAt(tickLabel, tx, 11)
    // The row title sits over the flat zero line at the right end, where the
    // row is empty, so it never reads as a plot tick above it.
    zetaAt(osLabel, sw, g.osZero - 6)
    var parts = narrow ? zetaSplit(s.extraRow) : [s.extraRow, ""]
    timeLine1.textContent = parts[0]
    timeLine2.textContent = parts[1]
    timeLine1.setAttribute("x", "0")
    timeLine2.setAttribute("x", "0")
    timeLine2.setAttribute("dy", "14")
    timeLabel.setAttribute("y", String(g.timeLabel))
    zetaAt(oscillates, zx(0.65), (g.timeTop + g.timeZero) / 2 + 4)
    zetaAt(zetaTitle, hi, g.timeZero - 5)
    var marks = ""
    for (var i = 0; i < ZETA_TICKS.length; i++) {
      marks += "M" + zetaR(zx(ZETA_TICKS[i])) + " " + g.timeZero + "v4"
      zetaAt(zTicks[i], zx(ZETA_TICKS[i]), g.ticks)
    }
    zMarks.setAttribute("d", marks)
    var n = Math.max(2, Math.ceil((one - lo) / 2))
    var d = ""
    var j
    for (j = 0; j <= n; j++) {
      var zo = ZETA_MIN + ((1 - ZETA_MIN) * j) / n
      var yo = g.osZero - (zetaOvershoot(zo) / ZETA_OS_TOP) * (g.osZero - g.osTop)
      d += (j ? "L" : "M") + zetaR(zx(zo)) + " " + zetaR(yo)
    }
    costOs.setAttribute("d", d)
    n = Math.max(2, Math.ceil((hi - one) / 2))
    d = ""
    for (j = 0; j <= n; j++) {
      var zt = 1 + j / n
      var extra = j ? zetaSettle(zt) / settleOne - 1 : 0
      var yt = g.timeZero - (extra / ZETA_EXTRA_TOP) * (g.timeZero - g.timeTop)
      d += (j ? "L" : "M") + zetaR(zx(zt)) + " " + zetaR(yt)
    }
    costTime.setAttribute("d", d)
    if (phase === "settling") finishSettle()
    if (phase !== "held") knobX = zx(zeta)
    placeKnob()
  }

  function placeKnob() {
    knob.style.transform = "translate3d(" + zetaR(knobX - ZETA_INSET) + "px,0,0)"
  }

  // The live trace follows ζ; nothing else redraws on a ζ change.
  function setZeta(z) {
    zeta = Math.min(ZETA_MAX, Math.max(ZETA_MIN, z))
    var text = zeta.toFixed(3)
    if (text === zetaShown) return
    zetaShown = text
    root.setAttribute("data-zeta", text)
    if (pw > 0) live.setAttribute("d", trace(zeta))
    if (playT >= 0) placeHead()
    var say = zetaSay(s, zeta, false)
    if (say !== readoutShown) {
      readoutShown = say
      readout.textContent = say
    }
  }

  function setPhase(next) {
    if (next === phase) return
    phase = next
    root.setAttribute("data-phase", next)
  }

  function setPlaying(flag) {
    playing = flag
    var text = flag ? "true" : "false"
    if (text === playingShown) return
    playingShown = text
    root.setAttribute("data-playing", text)
  }

  function band(raw) {
    var lo = zx(ZETA_MIN)
    var hi = zx(ZETA_MAX)
    if (raw < lo) return lo - fig.rubberBand(lo - raw, hi - lo)
    if (raw > hi) return hi + fig.rubberBand(raw - hi, hi - lo)
    return raw
  }

  function unband(x) {
    var lo = zx(ZETA_MIN)
    var hi = zx(ZETA_MAX)
    if (x < lo) return lo - fig.rubberBandInverse(lo - x, hi - lo)
    if (x > hi) return hi + fig.rubberBandInverse(x - hi, hi - lo)
    return x
  }

  function finishSettle() {
    knobX = spring.target
    spring.set(knobX)
    setZeta(settleToOne ? 1 : zOf(knobX))
    settleToOne = false
    placeKnob()
    setPhase("rest")
  }

  // Within 0.015 of 1 the knob snaps to 1; past an end it returns there;
  // anywhere else it stays. The readout is spoken for where it ends up.
  function release() {
    var lo = zx(ZETA_MIN)
    var hi = zx(ZETA_MAX)
    settleToOne = zeta !== 1 && Math.abs(zeta - 1) <= ZETA_DETENT
    var target = settleToOne ? zx(1) : Math.min(hi, Math.max(lo, knobX))
    fig.announce(zetaSay(s, settleToOne ? 1 : zeta, false))
    keys.reset(settleToOne ? 1 : zeta)
    spring.set(knobX, 0)
    spring.retarget(target)
    if (spring.resting || Math.abs(target - knobX) < 0.5) {
      finishSettle()
      return
    }
    setPhase("settling")
    loop.start()
  }

  function startPlay() {
    if (fig.reducedMotion()) {
      endPlay()
      return
    }
    playT = 0
    playFrom = performance.now()
    firstFrame = true
    setPlaying(true)
    placeHead()
    loop.start()
  }

  function endPlay() {
    playT = ZETA_T_END
    setPlaying(false)
    placeHead()
    fig.announce(zetaSay(s, zeta, false))
  }

  var loop = fig.loop(function (dt) {
    var more = false
    if (phase === "settling") {
      if (spring.step(dt)) {
        knobX = spring.value
        setZeta(zOf(knobX))
        placeKnob()
        more = true
      } else {
        finishSettle()
      }
    }
    if (playing) {
      // The first frame measures the time since the press; later frames add
      // the clamped frame time, so an off-screen pause resumes without a jump.
      playT = firstFrame ? (performance.now() - playFrom) / 1000 : playT + dt
      firstFrame = false
      if (playT >= ZETA_T_END) {
        endPlay()
      } else {
        placeHead()
        more = true
      }
    }
    return more
  })

  fig.drag(
    strip,
    {
      onStart: function (point) {
        settleToOne = false
        spring.set(knobX)
        stripLeft = strip.getBoundingClientRect().left
        var local = point.x - stripLeft
        // A press off the knob brings it to the pointer and grabs it there.
        if (Math.abs(local - knobX) > ZETA_INSET) {
          knobX = band(local)
          setZeta(zOf(knobX))
          placeKnob()
        }
        grab = unband(knobX) - local
        knob.focus({ preventScroll: true })
        setPhase("held")
      },
      onMove: function (point) {
        knobX = band(point.x - stripLeft + grab)
        setZeta(zOf(knobX))
        placeKnob()
      },
      onEnd: release,
      onCancel: release,
    },
    { touchAction: "pan-y" },
  )

  var keys = fig.keySlider(knob, {
    min: ZETA_MIN,
    max: ZETA_MAX,
    step: 0.025,
    shiftStep: 0.1,
    marks: ZETA_MARKS,
    value: 1,
    label: s.slider,
    valueText: function (v) {
      return zetaSay(s, v, true)
    },
    onInput: function (v) {
      settleToOne = false
      setPhase("rest")
      setZeta(v)
      knobX = zx(zeta)
      spring.set(knobX)
      placeKnob()
    },
    // The live region speaks the readout, not the value text.
    announce: function () {
      fig.announce(zetaSay(s, zeta, false))
    },
  })

  fig.onSizeChange(function (size) {
    var next = size === "narrow"
    if (next === narrow) return
    narrow = next
    root.setAttribute("data-size", size)
    drawPlot()
    drawCost()
  })

  fig.onReducedMotionChange(function () {
    if (!fig.reducedMotion()) return
    if (phase === "settling") finishSettle()
    if (playing) endPlay()
  })

  fig.model({ x: zetaX, overshoot: zetaOvershoot, settle: zetaSettle, extra: zetaExtra })

  fig.onReset(function () {
    loop.stop()
    settleToOne = false
    playT = -1
    setPlaying(false)
    setPhase("rest")
    setZeta(1)
    knobX = zx(1)
    spring.set(knobX)
    placeKnob()
    placeHead()
    keys.reset(1)
  })

  setPhase("rest")
  setPlaying(false)
  setZeta(1)
  drawPlot()
  drawCost()
  placeHead()

  return {
    destroy: function () {
      loop.stop()
    },
  }
}
