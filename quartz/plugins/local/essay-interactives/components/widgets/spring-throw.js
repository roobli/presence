/* spring-throw: a spring row and a 250 ms tween row follow one finger. Both
 * start where the finger lets go and both can be caught mid-flight; only the
 * spring keeps the release speed. Positions are in H, half a lane's travel in
 * CSS px. Only declarations and the WIDGETS assignment run at load (node:vm). */

var THROW_STRINGS = {
  en: {
    spring: "Spring",
    tween: "250 ms tween",
    hint: "Flick either row sideways and let go, then grab it again on the way back. Both rows follow the same finger.",
    keyhelp: "Arrow keys move both cards. Enter lets go. Shift+Enter throws.",
    slider: "Card position",
    held: "Held {n} percent toward the {side} end",
    left: "left",
    right: "right",
    returning: "Returning",
    rest: "At rest",
    events: ["finger down", "let go", "caught", "let go"],
    legend: ["finger", "spring", "250 ms tween"],
    recorded: "Recorded example",
    live: "Your throw",
    axis: "time (s)",
    replay: "Replay example",
    thrown: "Let go. The spring row keeps the throw; the tween row turns home at once.",
    letGo: "Let go.",
  },
  "zh-Hans": {
    spring: "弹簧",
    tween: "250 毫秒补间",
    hint: "横向甩动任意一行后松手，在它回来的路上再抓住。两行跟随同一根手指。",
    keyhelp: "方向键同时移动两张卡片，Enter 松手，Shift+Enter 甩出。",
    slider: "卡片位置",
    held: "按住，朝{side}端 {n}%",
    left: "左",
    right: "右",
    returning: "正在返回",
    rest: "静止",
    events: ["按下", "松手", "接住", "松手"],
    legend: ["手指", "弹簧", "250 毫秒补间"],
    recorded: "录制示例",
    live: "你的甩动",
    axis: "时间（秒）",
    replay: "重放示例",
    thrown: "已松手。弹簧那一行保留了甩出的速度，补间那一行立刻掉头回原位。",
    letGo: "已松手。",
  },
}

var THROW_OMEGA = Math.sqrt(320) // illustrative k = 320, m = 1, critically damped
var THROW_SPRING = { k: 320, zeta: 1, m: 1, exact: true }
var THROW_TWEEN = 0.25
var THROW_KEY_SPEED = 8 // H/s for Shift+Enter, never printed
var THROW_STEP = 0.08
var THROW_SHIFT_STEP = 0.24
var THROW_ARROWS = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
var THROW_WINDOW = 1.6
var THROW_CAP = 512
var THROW_EVENTS = [0.1, 0.49, 0.59, 0.78] // recorded: down, let go, caught, let go
var THROW_PAD = { l: 8, r: 8, t: 20, b: 20 }
var THROW_SVG = "http://www.w3.org/2000/svg"

/* ---------- pure models (window.__essayInteractives.models) ---------- */

// Shown position for raw travel u: 1:1 inside the lane, then line 25's edge
// resistance (the shell's rubber band with d = 1 H) past either end.
function throwResist(u) {
  var a = Math.abs(u)
  return a <= 1 ? u : (u < 0 ? -1 : 1) * (1 + rubberBand(a - 1, 1))
}

function throwUnresist(p) {
  var a = Math.abs(p)
  return a <= 1 ? p : (p < 0 ? -1 : 1) * (1 + rubberBandInverse(a - 1, 1))
}

// The tween row: from pr, a fixed 250 ms ease-out home that ignores velocity.
function throwTween(pr, tau) {
  if (!(tau > 0)) return pr
  var q = 1 - tau / THROW_TWEEN
  return q <= 0 ? 0 : pr * q * q * q
}

function throwSmooth(s) {
  return s * s * (3 - 2 * s)
}

// The recorded finger while it drives both rows (0.10 to 0.49 s), else NaN.
function throwFinger(t) {
  if (!(t >= 0.1 && t <= 0.49)) return NaN
  if (t <= 0.35) return -0.9 * throwSmooth((t - 0.1) / 0.25)
  if (t <= 0.38) return -0.9 + 0.5 * (8 / 0.03) * (t - 0.35) * (t - 0.35)
  return -0.78 + 8 * (t - 0.38)
}

// The recorded episode at t into out {finger (NaN while lifted), spring, tween}:
// let go at 0.49 s from 0.10 H at 8 H/s, caught at 0.59 s, let go at 0.78 s.
function throwSampleInto(t, out) {
  var f = NaN
  var sp = 0
  var tw = 0
  if (t >= 0.1 && t <= 0.49) {
    f = throwFinger(t)
    sp = f
    tw = f
  } else if (t > 0.49 && t < 0.59) {
    sp = springAt(0.1, 8, 1, THROW_OMEGA, t - 0.49)
    tw = throwTween(0.1, t - 0.49)
  } else if (t >= 0.59) {
    var cs = springAt(0.1, 8, 1, THROW_OMEGA, 0.1)
    var cw = throwTween(0.1, 0.1)
    if (t <= 0.78) {
      f = cs
      sp = cs
      tw = cw
    } else {
      sp = springAt(cs, 0, 1, THROW_OMEGA, t - 0.78)
      tw = throwTween(cw, t - 0.78)
    }
  }
  out.finger = f
  out.spring = sp
  out.tween = tw
  return out
}

function throwSample(t) {
  return throwSampleInto(t, { finger: NaN, spring: 0, tween: 0 })
}

function throwNode(ns, tag, cls, parent) {
  var node = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  if (cls) node.setAttribute("class", cls)
  if (parent) parent.appendChild(node)
  return node
}

function throwLane(parent, kind, label) {
  var lane = throwNode(null, "div", "spring-throw__lane spring-throw__lane--" + kind, parent)
  throwNode(null, "span", "spring-throw__label", lane).textContent = label
  throwNode(null, "span", "spring-throw__home", lane)
  return { el: lane, card: throwNode(null, "div", "spring-throw__card", lane) }
}

function throwPaths(group) {
  return {
    finger: throwNode(THROW_SVG, "path", "spring-throw__path--finger", group),
    tween: throwNode(THROW_SVG, "path", "spring-throw__path--tween", group),
    spring: throwNode(THROW_SVG, "path", "spring-throw__path--spring", group),
  }
}

function throwR(v) {
  return Math.round(v * 10) / 10
}

function throwLine(node, x1, y1, x2, y2) {
  node.setAttribute("x1", String(throwR(x1)))
  node.setAttribute("y1", String(throwR(y1)))
  node.setAttribute("x2", String(throwR(x2)))
  node.setAttribute("y2", String(throwR(y2)))
}

/* ---------- widget ---------- */

WIDGETS["spring-throw"] = function (fig) {
  var s = fig.strings(THROW_STRINGS)
  var out = { finger: NaN, spring: 0, tween: 0 }
  var vel = { x: 0, y: 0 }
  var tracker = fig.velocityTracker()
  var catchS = springAt(0.1, 8, 1, THROW_OMEGA, 0.1)

  var narrow = false
  var H = 1
  var phase = ""
  var episode = ""
  var spring = { x: 0, v: 0, target: 0 } // the spring row in H and H/s
  var tween = { p: 0, pr: 0, tr: 0 } // position, release position, release time
  var u0s = 0 // raw travel of each row at the grab
  var u0w = 0
  var uS = 0
  var uW = 0
  var downX = 0
  var lastX = 0
  var pointerHeld = false
  var lastDir = 1
  var epT = 0 // live episode clock, s
  var replayT = 0
  var dotX = 0
  var dotDown = false
  var shownS = null
  var shownW = null
  var shownDot = null
  var shownNow = null
  var shownText = null

  // Live samples in a ring buffer: time, finger (NaN while lifted), both rows.
  var bufT = new Float64Array(THROW_CAP)
  var bufF = new Float64Array(THROW_CAP)
  var bufS = new Float64Array(THROW_CAP)
  var bufW = new Float64Array(THROW_CAP)
  var head = 0
  var count = 0

  // y fits the episode with a 10% margin, never tighter than 0.25 H. The
  // recorded one spans the finger's -0.90 H to the spring's peak after release.
  var recMin = -0.9
  var recMax = throwSample(0.49 + 8 / (THROW_OMEGA * (8 + 0.1 * THROW_OMEGA))).spring
  var rawLo = recMin
  var rawHi = recMax
  var lo = 0
  var hi = 0
  var rangeDirty = false
  var t0 = 0
  var plotW = 0
  var plotH = 0
  var recN = 0
  var recT = null
  var recF = null
  var recS = null
  var recW = null

  /* ---------- DOM ---------- */

  var root = throwNode(null, "div", "spring-throw", fig.box)
  var lanes = throwNode(null, "div", "spring-throw__lanes", root)
  var laneS = throwLane(lanes, "spring", s.spring)
  var laneW = throwLane(lanes, "tween", s.tween)
  var dot = throwNode(null, "div", "spring-throw__finger-dot", laneS.el)
  dot.hidden = true

  var traceWrap = throwNode(null, "div", "spring-throw__trace-wrap", root)
  var trace = fig.svg({ parent: traceWrap, onSize: layoutTrace })
  trace.el.setAttribute("class", trace.el.getAttribute("class") + " spring-throw__trace")
  var axis = throwNode(THROW_SVG, "g", "spring-throw__axis", trace.el)
  var axisLine = throwNode(THROW_SVG, "path", "spring-throw__axis-line", axis)
  var tickText = []
  for (var i = 0; i < 4; i++) {
    tickText.push(throwNode(THROW_SVG, "text", "spring-throw__tick", axis))
  }
  var axisTitle = throwNode(THROW_SVG, "text", "spring-throw__axis-title", axis)
  axisTitle.textContent = s.axis
  var homeLine = throwNode(THROW_SVG, "line", "spring-throw__home-line", trace.el)
  var recGroup = throwNode(THROW_SVG, "g", "spring-throw__recorded", trace.el)
  var rec = throwPaths(recGroup)
  var ticks = throwNode(THROW_SVG, "g", "spring-throw__ticks", trace.el)
  var tickLines = []
  var tickNums = []
  for (i = 0; i < THROW_EVENTS.length; i++) {
    tickLines.push(throwNode(THROW_SVG, "line", "spring-throw__event", ticks))
    tickNums.push(throwNode(THROW_SVG, "text", "spring-throw__event-num", ticks))
    tickNums[i].textContent = String(i + 1)
  }
  var live = throwPaths(throwNode(THROW_SVG, "g", "spring-throw__live", trace.el))

  var key = throwNode(null, "div", "spring-throw__key", root)
  var tag = throwNode(null, "span", "spring-throw__tag", key)
  var tagText = throwNode(null, "span", null, tag)
  var events = throwNode(null, "ol", "spring-throw__events", key)
  s.events.forEach(function (label, n) {
    var li = throwNode(null, "li", null, events)
    var num = throwNode(null, "span", "spring-throw__num", li)
    num.textContent = String(n + 1)
    num.setAttribute("aria-hidden", "true")
    li.appendChild(document.createTextNode(label))
  })
  var legend = throwNode(null, "ul", "spring-throw__legend", key)
  ;["finger", "spring", "tween"].forEach(function (kind, n) {
    var li = throwNode(null, "li", null, legend)
    var swatch = throwNode(THROW_SVG, "svg", "spring-throw__swatch", li)
    swatch.setAttribute("width", "18")
    swatch.setAttribute("height", "10")
    swatch.setAttribute("aria-hidden", "true")
    throwNode(THROW_SVG, "path", "spring-throw__path--" + kind, swatch).setAttribute("d", "M1 5H17")
    li.appendChild(document.createTextNode(s.legend[n]))
  })
  var keyhelp = throwNode(null, "span", "spring-throw__keyhelp", root)
  keyhelp.id = (fig.root.id || "fig-" + fig.n) + "-keyhelp"
  keyhelp.textContent = s.keyhelp

  lanes.tabIndex = 0
  lanes.setAttribute("role", "slider")
  lanes.setAttribute("aria-label", s.slider)
  lanes.setAttribute("aria-valuemin", "-100")
  lanes.setAttribute("aria-valuemax", "100")
  lanes.setAttribute("aria-describedby", keyhelp.id)

  var replayButton = fig.button({ label: s.replay })
  var hint = throwNode(null, "p", "spring-throw__hint")
  hint.textContent = s.hint
  fig.rail.insertBefore(hint, replayButton.el)
  fig.press(replayButton.el, replay)

  /* ---------- state and drawing ---------- */

  function setPhase(next) {
    if (next === phase) return
    phase = next
    root.setAttribute("data-phase", next)
    render()
  }

  function setEpisode(next) {
    if (next === episode) return
    episode = next
    root.setAttribute("data-episode", next)
    tagText.textContent = next === "live" ? s.live : s.recorded
    tag.setAttribute("data-other", next === "live" ? s.recorded : s.live)
  }

  // Cards move by transform; slider value and text are written on change only.
  function render() {
    var xs = Math.round(spring.x * H * 100) / 100
    var xw = Math.round(tween.p * H * 100) / 100
    if (xs !== shownS) {
      shownS = xs
      laneS.card.style.transform = "translate3d(" + xs + "px,0,0)"
    }
    if (xw !== shownW) {
      shownW = xw
      laneW.card.style.transform = "translate3d(" + xw + "px,0,0)"
    }
    var n = Math.max(-100, Math.min(100, Math.round(100 * spring.x)))
    if (n !== shownNow) {
      shownNow = n
      lanes.setAttribute("aria-valuenow", String(n))
    }
    var text = phase === "rest" ? s.rest : s.returning
    if (phase === "held") {
      text = s.held.replace("{n}", String(Math.abs(n))).replace("{side}", n < 0 ? s.left : s.right)
    }
    if (text !== shownText) {
      shownText = text
      lanes.setAttribute("aria-valuetext", text)
    }
  }

  function placeDot(down) {
    var x = Math.round(dotX * H * 100) / 100
    if (x !== shownDot) {
      shownDot = x
      dot.style.transform = "translate3d(" + x + "px,0,0)"
    }
    if (down !== dotDown) {
      dotDown = down
      dot.classList.toggle("is-down", down)
    }
  }

  function fit() {
    var span = rawHi - rawLo
    var nextLo = Math.min(rawLo - 0.1 * span, -0.25)
    var nextHi = Math.max(rawHi + 0.1 * span, 0.25)
    if (nextLo === lo && nextHi === hi) return false
    lo = nextLo
    hi = nextHi
    return true
  }

  function grow(v) {
    if (v < rawLo) rawLo = v
    else if (v > rawHi) rawHi = v
    else return
    if (fit()) rangeDirty = true
  }

  function push(t, f, sp, tw) {
    var at = (head + count) % THROW_CAP
    if (count < THROW_CAP) count += 1
    else head = (head + 1) % THROW_CAP
    bufT[at] = t
    bufF[at] = f
    bufS[at] = sp
    bufW[at] = tw
    grow(sp)
    grow(tw)
    if (f === f) grow(Math.max(-2, Math.min(2, f)))
  }

  function record() {
    push(epT, phase === "held" ? uS : NaN, spring.x, tween.p)
  }

  function mapX(t) {
    return THROW_PAD.l + ((t - t0) / THROW_WINDOW) * plotW
  }

  function recX(t) {
    return THROW_PAD.l + (t / THROW_WINDOW) * plotW
  }

  function mapY(p) {
    return THROW_PAD.t + ((hi - p) / (hi - lo)) * plotH
  }

  function drawAxis() {
    if (!(plotW > 0)) return
    var bottom = throwR(THROW_PAD.t + plotH)
    var first = Math.ceil(t0 * 2 - 1e-9) / 2
    var d = "M" + THROW_PAD.l + " " + bottom + "H" + throwR(THROW_PAD.l + plotW)
    for (var k = 0; k < tickText.length; k++) {
      var v = first + k / 2
      var node = tickText[k]
      var show = v <= t0 + THROW_WINDOW + 1e-9
      node.setAttribute("visibility", show ? "visible" : "hidden")
      if (!show) continue
      var x = throwR(mapX(v))
      d += "M" + x + " " + bottom + "v4"
      if (node.textContent !== String(v)) node.textContent = String(v)
      node.setAttribute("x", String(x))
      node.setAttribute("y", String(throwR(bottom + 17)))
    }
    axisLine.setAttribute("d", d)
    axisTitle.setAttribute("x", String(throwR(THROW_PAD.l + plotW)))
    axisTitle.setAttribute("y", "12")
  }

  // Once a live episode scrolls, the recorded example no longer lines up.
  function showRecorded() {
    var v = t0 > 0 ? "hidden" : "visible"
    recGroup.setAttribute("visibility", v)
    ticks.setAttribute("visibility", v)
  }

  // Path data for one episode's three lines; the finger line breaks where the
  // finger is lifted (NaN).
  var accS = ""
  var accW = ""
  var accF = ""
  var accPen = false

  function pathStart() {
    accS = ""
    accW = ""
    accF = ""
    accPen = false
  }

  function pathAdd(x, sp, tw, f) {
    var px = throwR(x)
    accS += (accS ? "L" : "M") + px + " " + throwR(mapY(sp))
    accW += (accW ? "L" : "M") + px + " " + throwR(mapY(tw))
    if (f === f) {
      accF += (accPen ? "L" : "M") + px + " " + throwR(mapY(Math.max(-2, Math.min(2, f))))
      accPen = true
    } else {
      accPen = false
    }
  }

  function pathEnd(paths) {
    paths.spring.setAttribute("d", accS)
    paths.tween.setAttribute("d", accW)
    paths.finger.setAttribute("d", accF)
  }

  // The recorded episode up to upTo seconds (Replay draws it in real time).
  function drawRecorded(upTo) {
    if (!(plotW > 0) || !recT) return
    var end = Math.min(upTo, THROW_WINDOW)
    pathStart()
    for (var k = 0; k < recN && recT[k] <= end; k++) {
      pathAdd(recX(recT[k]), recS[k], recW[k], recF[k])
    }
    if (end < THROW_WINDOW) {
      throwSampleInto(end, out)
      pathAdd(recX(end), out.spring, out.tween, out.finger)
    }
    pathEnd(rec)
  }

  // The live episode, scrolled to show its latest 1.6 s.
  function drawLive() {
    if (!(plotW > 0)) return
    if (rangeDirty) {
      redraw()
      return
    }
    var lastT = count ? bufT[(head + count - 1) % THROW_CAP] : 0
    var nextT0 = Math.max(0, lastT - THROW_WINDOW)
    if (nextT0 !== t0) {
      t0 = nextT0
      drawAxis()
      showRecorded()
    }
    pathStart()
    for (var k = 0; k < count; k++) {
      var at = (head + k) % THROW_CAP
      if (bufT[at] >= t0) pathAdd(mapX(bufT[at]), bufS[at], bufW[at], bufF[at])
    }
    pathEnd(live)
  }

  function redraw() {
    if (!(plotW > 0)) return
    rangeDirty = false
    drawAxis()
    var home = mapY(0)
    throwLine(homeLine, THROW_PAD.l, home, THROW_PAD.l + plotW, home)
    for (var k = 0; k < THROW_EVENTS.length; k++) {
      var x = recX(THROW_EVENTS[k])
      throwLine(tickLines[k], x, THROW_PAD.t - 4, x, THROW_PAD.t + plotH)
      tickNums[k].setAttribute("x", String(throwR(x)))
      tickNums[k].setAttribute("y", "12")
    }
    drawRecorded(phase === "replaying" ? replayT : Infinity)
    drawLive()
  }

  // Samples every 2 px plus the recorded events, rebuilt on resize only.
  function layoutTrace() {
    var w = trace.width()
    var h = trace.height()
    if (!(w > 0 && h > 0)) return
    plotW = w - THROW_PAD.l - THROW_PAD.r
    plotH = h - THROW_PAD.t - THROW_PAD.b
    var n = Math.max(8, Math.ceil(plotW / 2))
    var times = THROW_EVENTS.slice()
    for (var k = 0; k <= n; k++) times.push((THROW_WINDOW * k) / n)
    times.sort(function (a, b) {
      return a - b
    })
    recN = times.length
    recT = new Float64Array(times)
    recF = new Float64Array(recN)
    recS = new Float64Array(recN)
    recW = new Float64Array(recN)
    for (k = 0; k < recN; k++) {
      throwSampleInto(recT[k], out)
      recF[k] = out.finger
      recS[k] = out.spring
      recW[k] = out.tween
    }
    redraw()
  }

  function clearTrace() {
    head = 0
    count = 0
    epT = 0
    t0 = 0
    rawLo = recMin
    rawHi = recMax
    fit()
    showRecorded()
    live.spring.setAttribute("d", "")
    live.tween.setAttribute("d", "")
    live.finger.setAttribute("d", "")
    redraw()
  }

  /* ---------- behavior ---------- */

  function dropPointer() {
    pointerHeld = false
    if (drag.held()) {
      drag.setDisabled(true)
      drag.setDisabled(false)
    }
  }

  // Catch: each row freezes at its presentation position and keeps its own u0.
  function grab() {
    if (phase === "held") {
      u0s = uS
      u0w = uW
      return
    }
    var fresh = phase !== "returning"
    if (fresh) {
      replayT = THROW_WINDOW // a replay stops; the full recorded trace stays under
      clearTrace()
      setEpisode("live")
    }
    dot.hidden = true
    spring.v = 0
    u0s = uS = throwUnresist(spring.x)
    u0w = uW = throwUnresist(tween.p)
    setPhase("held")
    if (fresh) {
      record()
      drawLive()
    }
    loop.start()
  }

  function applyHold() {
    var dx = pointerHeld ? (lastX - downX) / H : 0
    uS = u0s + dx
    uW = u0w + dx
    spring.x = throwResist(uS)
    tween.p = throwResist(uW)
    render()
  }

  function letGo(v0) {
    if (phase !== "held") return
    dropPointer()
    record()
    spring.v = v0
    tween.pr = tween.p
    tween.tr = epT
    fig.announce(Math.abs(v0) >= 1 ? s.thrown : s.letGo)
    setPhase("returning")
    if (fig.reducedMotion()) settleNow()
    else loop.start()
  }

  // Reduced motion: both computed returns go on the trace at once and the
  // cards show home on the next frame.
  function settleNow() {
    var base = epT
    var since = epT - tween.tr
    for (var k = 1; k <= 360; k++) {
      // Exact steps at 60 Hz are the closed form sampled, with the same rest snap.
      var rested = fig.stepSpring(spring, THROW_SPRING, 1 / 60, 0.5 / H, 5 / H)
      var yw = throwTween(tween.pr, since + k / 60)
      push(base + k / 60, NaN, spring.x, yw)
      if (rested && yw === 0) break
    }
    epT = base + k / 60
    loop.stop()
    spring.x = 0
    spring.v = 0
    tween.p = 0
    setPhase("rest")
    drawLive()
  }

  function stepReplay(dt) {
    replayT = Math.min(THROW_WINDOW, replayT + dt)
    throwSampleInto(replayT, out)
    spring.x = out.spring
    tween.p = out.tween
    if (out.finger === out.finger) dotX = out.finger
    placeDot(out.finger === out.finger)
    drawRecorded(replayT)
    var after = replayT - 0.78
    var still =
      after > 0 &&
      Math.abs(out.spring) * H < 0.5 &&
      Math.abs(springVelocityAt(catchS, 0, 1, THROW_OMEGA, after)) * H < 5 &&
      out.tween === 0
    if (still || replayT >= THROW_WINDOW) {
      finishReplay()
      return false
    }
    render()
    return true
  }

  function finishReplay() {
    spring.x = 0
    tween.p = 0
    dot.hidden = true
    placeDot(false)
    replayT = THROW_WINDOW
    setPhase("rest")
    drawRecorded(Infinity)
  }

  function replay() {
    dropPointer()
    loop.stop()
    spring.x = 0
    spring.v = 0
    tween.p = 0
    dot.hidden = true
    setEpisode("recorded")
    setPhase("rest")
    clearTrace()
    if (fig.reducedMotion()) return
    replayT = 0
    dotX = 0
    placeDot(false)
    dot.hidden = false
    setPhase("replaying")
    drawRecorded(0)
    loop.start()
  }

  var loop = fig.loop(function (dt) {
    if (phase === "replaying") return stepReplay(dt)
    if (phase !== "held" && phase !== "returning") return false
    epT += dt
    if (phase === "returning") {
      var rested = fig.stepSpring(spring, THROW_SPRING, dt, 0.5 / H, 5 / H)
      tween.p = throwTween(tween.pr, epT - tween.tr)
      record()
      if (rested && tween.p === 0) {
        setPhase("rest")
        drawLive()
        return false
      }
      render()
    } else {
      record()
    }
    drawLive()
    return true
  })

  /* ---------- input ---------- */

  function trackAt(timeStamp, clientX) {
    tracker.add(timeStamp, H * throwResist(u0s + (clientX - downX) / H), 0)
  }

  var drag = fig.drag(
    lanes,
    {
      onStart: function (point, e) {
        grab()
        pointerHeld = true
        downX = point.x
        lastX = point.x
        lanes.focus({ preventScroll: true })
        tracker.reset()
        trackAt(e.timeStamp, point.x)
      },
      onMove: function (point) {
        if (!pointerHeld || phase !== "held") return
        lastX = point.x
        applyHold()
      },
      onEnd: function (point, velocity, e) {
        if (!pointerHeld) return
        var v0 = 0
        if (e && e.type !== "pointercancel") {
          if (e.type === "pointerup") trackAt(e.timeStamp, e.clientX)
          v0 = tracker.velocity(e.timeStamp, vel).x / H
        }
        pointerHeld = false
        letGo(v0)
      },
      // Escape lets go, as Enter does.
      onCancel: function () {
        if (!pointerHeld) return
        pointerHeld = false
        letGo(0)
      },
    },
    { touchAction: "pan-y" },
  )

  // v0 is the slope of the shown spring position, from every coalesced move.
  fig.listen(lanes, "pointermove", function (e) {
    if (!pointerHeld || !e.isPrimary) return
    var list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null
    if (!list || !list.length) return trackAt(e.timeStamp, e.clientX)
    for (var k = 0; k < list.length; k++) trackAt(list[k].timeStamp, list[k].clientX)
  })

  fig.listen(lanes, "keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    var k = e.key
    if (THROW_ARROWS[k]) {
      lastDir = THROW_ARROWS[k]
      grab()
      u0s += lastDir * (e.shiftKey ? THROW_SHIFT_STEP : THROW_STEP)
      u0w += lastDir * (e.shiftKey ? THROW_SHIFT_STEP : THROW_STEP)
      applyHold()
    } else if (k === "Home" || k === "End") {
      lastDir = k === "End" ? 1 : -1
      grab()
      var dx = pointerHeld ? (lastX - downX) / H : 0
      u0s = lastDir - dx
      u0w = lastDir - dx
      applyHold()
    } else if (k === "Enter" && e.shiftKey) {
      grab()
      letGo(lastDir * THROW_KEY_SPEED)
    } else if (k === "Enter" || k === " " || k === "Escape") {
      if (phase !== "held") return
      letGo(0)
    } else {
      return
    }
    e.preventDefault()
  })

  fig.listen(lanes, "blur", function () {
    if (phase === "held") letGo(0)
  })

  fig.onSizeChange(setSize)

  function setSize(size, width) {
    if ((size === "narrow") !== narrow || !root.hasAttribute("data-size")) {
      narrow = size === "narrow"
      root.setAttribute("data-size", narrow ? "narrow" : "wide")
    }
    var next = Math.max(1, (width - 40 - (narrow ? 48 : 56)) / 2)
    if (next === H) return
    H = next
    root.setAttribute("data-h", String(Math.round(H * 100) / 100))
    render()
    placeDot(dotDown)
  }

  fig.onReducedMotionChange(function () {
    if (!fig.reducedMotion()) return
    if (phase === "returning") settleNow()
    else if (phase === "replaying") {
      loop.stop()
      finishReplay()
    }
  })

  fig.onReset(function () {
    dropPointer()
    loop.stop()
    spring.x = 0
    spring.v = 0
    tween.p = 0
    tween.pr = 0
    dot.hidden = true
    placeDot(false)
    setEpisode("recorded")
    setPhase("rest")
    clearTrace()
  })

  fig.model({ recorded: { sample: throwSample }, springAt: springAt })

  setSize(fig.size(), fig.width())
  setEpisode("recorded")
  setPhase("rest")
  fit()
  layoutTrace()

  return {
    destroy: function () {
      loop.stop()
    },
  }
}
