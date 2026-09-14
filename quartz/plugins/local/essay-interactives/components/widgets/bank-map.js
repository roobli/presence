// Ported from lr00rl/cuda-cpp-course src/components/labs/bank-conflict-lab.tsx (L10-11, L25-58, generated code L64-84), commit 5d2777f.
/* bank-map: Fig. 2 of cuda-course-without-a-gpu.
 * Where one warp of 32 thread reads lands on 32 banks. Each read is a brick;
 * a bank's stack height is the number of distinct addresses on it, the lab's
 * conflict degree, so a tower is a real conflict, a row of single bricks is a
 * clean landing, and 32 bricks on one spot are a broadcast. Access (column
 * read, XOR swizzle, same address) and Row width (32 to 36, the lab's
 * padding 0 to 4) sit in the rail. Bricks move on critically damped springs
 * from where they are. Only function declarations, constants and the WIDGETS
 * assignment run at load, so node:vm can load this file with { WIDGETS: {} }. */

var BM_BANKS = 32
var BM_WARP = 32
var BM_TILE_COLS = 32
var BM_WIDTH_MIN = 32
var BM_WIDTH_MAX = 36
var BM_PAD = 16
var BM_LABEL_LANE = 18
var BM_AXIS_ROW = 22
var BM_RESPONSE = 0.35
var BM_SVG_NS = "http://www.w3.org/2000/svg"

var BM_STRINGS = {
  en: {
    accessLabel: "Access",
    column: "Column read",
    swizzle: "XOR swizzle",
    same: "Same address",
    rulerLabel: "Row width",
    worstLabel: "Max conflict degree",
    banksLabel: "Banks used",
    worstValue: "{n}×",
    banksValue: "{n} / 32",
    stateConflict: "{n}-way conflict",
    stateNone: "No conflict",
    stateSame: "All 32 threads read one address: a broadcast, not a conflict",
    labelSame: "32 threads, 1 address",
    axisFirst: "bank 0",
    axisLast: "bank 31",
    context: "Row width {W}",
    sentence: "{context}: {state}, {b} of 32 banks used.",
    describe: "{decl} {access} {state}. Banks used {b} / 32.",
  },
  "zh-Hans": {
    accessLabel: "访问方式",
    column: "按列读取",
    swizzle: "XOR swizzle",
    same: "同址广播",
    rulerLabel: "行宽",
    worstLabel: "最大冲突路数",
    banksLabel: "用到的 bank",
    worstValue: "{n}×",
    banksValue: "{n} / 32",
    stateConflict: "{n} 路冲突",
    stateNone: "无冲突",
    stateSame: "32 个线程读同一个地址：这是广播，不是冲突",
    labelSame: "32 个线程，1 个地址",
    axisFirst: "bank 0",
    axisLast: "bank 31",
    context: "行宽 {W}",
    sentence: "{context}：{state}，用到 {b} / 32 个 bank。",
    describe: "{decl} {access} {state}。用到的 bank {b} / 32。",
  },
}

/* ---------- model: bank-conflict-lab.tsx L25-58, tile columns fixed at 32 ---------- */

/**
 * bankMapModel(pattern, rowWidth), pattern "column", "swizzle" or "same";
 * rowWidth (the lab's tileCols + pad) applies to "column" only.
 * Course fields per lane: words, banks (L40). Per bank: degree, the number of
 * distinct words (L52-56). worst = max(1, max degree); banksUsed = non-empty
 * banks (L58). Presentation fields: levels (rank of a lane's word among the
 * distinct words on its bank, ascending), multiplicity (lanes sharing that
 * word) and conflictBank (the lowest bank whose degree is worst, when worst > 1,
 * else -1).
 */
function bankMapModel(pattern, rowWidth) {
  var words = []
  var banks = []
  var byBank = []
  var degree = []
  var levels = []
  var multiplicity = []
  var b
  var lane
  for (b = 0; b < BM_BANKS; b++) byBank.push([])
  for (lane = 0; lane < BM_WARP; lane++) {
    var word
    if (pattern === "swizzle") word = lane * BM_TILE_COLS + (0 ^ (lane & (BM_BANKS - 1)))
    else if (pattern === "same") word = 0
    else word = lane * rowWidth
    var bank = ((word % BM_BANKS) + BM_BANKS) % BM_BANKS
    words.push(word)
    banks.push(bank)
    if (byBank[bank].indexOf(word) < 0) byBank[bank].push(word)
  }
  var worst = 1
  var banksUsed = 0
  var conflictBank = -1
  for (b = 0; b < BM_BANKS; b++) {
    byBank[b].sort(function (x, y) {
      return x - y
    })
    degree.push(byBank[b].length)
    if (byBank[b].length) banksUsed += 1
    worst = Math.max(worst, byBank[b].length)
  }
  for (b = 0; b < BM_BANKS && worst > 1; b++) {
    if (degree[b] === worst) {
      conflictBank = b
      break
    }
  }
  for (lane = 0; lane < BM_WARP; lane++) {
    levels.push(byBank[banks[lane]].indexOf(words[lane]))
    var same = 0
    for (var other = 0; other < BM_WARP; other++) if (words[other] === words[lane]) same += 1
    multiplicity.push(same)
  }
  return {
    pattern: pattern,
    rowWidth: rowWidth,
    words: words,
    banks: banks,
    levels: levels,
    multiplicity: multiplicity,
    degree: degree,
    worst: worst,
    banksUsed: banksUsed,
    conflictBank: conflictBank,
  }
}

/**
 * Layout in CSS px for an svg S px wide (the stage content width; the 16px pad
 * is inside the svg). Written into out, so a sidebar drag allocates nothing.
 */
function bankMapGeometry(S, narrow, out) {
  var g = out || {}
  g.width = S
  g.p = (S - 2 * BM_PAD) / BM_BANKS
  g.bw = Math.min(24, Math.max(4, g.p - 2))
  g.lp = narrow ? 7 : 8
  g.bh = g.lp - 2
  g.towerBottom = BM_LABEL_LANE + BM_WARP * g.lp - 2
  g.height = g.towerBottom + BM_AXIS_ROW
  return g
}

function bmBrickX(g, bank) {
  return BM_PAD + bank * g.p + (g.p - g.bw) / 2
}

function bmBrickY(g, level) {
  return g.towerBottom - (level + 1) * g.lp + 2
}

function bmFill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (match, key) {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  })
}

/* ---------- widget ---------- */

WIDGETS["bank-map"] = function (fig) {
  var s = fig.strings(BM_STRINGS)
  var lowerAfterColon = fig.lang !== "zh-Hans"
  var pattern = "column"
  var rowWidth = BM_WIDTH_MIN
  var model = bankMapModel(pattern, rowWidth)
  var geo = bankMapGeometry(fig.width() || 640, fig.size() === "narrow", {})
  var laidWidth = 0
  var laidNarrow = null

  // One spring state per axis over the 32 lanes, stepped in place.
  var params = fig.uiSpring(BM_RESPONSE)
  var springX = {
    x: new Float64Array(BM_WARP),
    v: new Float64Array(BM_WARP),
    target: new Float64Array(BM_WARP),
  }
  var springY = {
    x: new Float64Array(BM_WARP),
    v: new Float64Array(BM_WARP),
    target: new Float64Array(BM_WARP),
  }

  function html(tag, className, text, parent) {
    var node = document.createElement(tag)
    node.className = className
    if (text != null) node.textContent = text
    parent.appendChild(node)
    return node
  }

  function svgNode(tag, className, parent) {
    var node = document.createElementNS(BM_SVG_NS, tag)
    node.setAttribute("class", className)
    parent.appendChild(node)
    return node
  }

  function place(node, x, y, w, h) {
    node.setAttribute("x", String(x))
    node.setAttribute("y", String(y))
    if (w != null) node.setAttribute("width", String(Math.max(0, w)))
    if (h != null) node.setAttribute("height", String(Math.max(0, h)))
  }

  /* code, state line and stats above the chart, display only */

  var band = html("div", "bm-band", null, fig.box)
  var code = html("div", "bm-code", null, band)
  var declNode = html("code", "bm-code__decl", "", code)
  var accessNode = html("code", "bm-code__access", "", code)
  var stateNode = html("p", "bm-state", "", band)
  var stats = html("div", "bm-stats", null, band)

  function stat(label) {
    var node = html("div", "bm-stat", null, stats)
    html("span", "bm-stat__label", label, node)
    return html("span", "bm-stat__value", "", node)
  }

  var worstValue = stat(s.worstLabel)
  var banksValue = stat(s.banksLabel)

  /* the 32 banks and the warp's 32 reads */

  var chart = fig.svg({
    height: geo.height,
    onSize: function (w) {
      layout(w, fig.size() === "narrow")
    },
  })
  chart.el.classList.add("bm-chart")

  var label = svgNode("text", "bm-label", chart.el)
  var baseLayer = svgNode("g", "bm-bases", chart.el)
  var baseNodes = []
  for (var b = 0; b < BM_BANKS; b++) {
    var base = svgNode("rect", "bm-base", baseLayer)
    base.setAttribute("data-bank", String(b))
    baseNodes.push(base)
  }

  // Lane order is z order. Each brick owns one SVGTransform made here; frames
  // only call setTranslate on it.
  var brickLayer = svgNode("g", "bm-bricks", chart.el)
  var brickNodes = []
  var moves = []
  for (var t = 0; t < BM_WARP; t++) {
    var brick = svgNode("rect", "bm-brick", brickLayer)
    brick.setAttribute("data-lane", String(t))
    brick.setAttribute("rx", "1")
    brick.transform.baseVal.appendItem(chart.el.createSVGTransform())
    brickNodes.push(brick)
    moves.push(brick.transform.baseVal.getItem(0))
  }

  var axisFirst = svgNode("text", "bm-axis bm-axis--first", chart.el)
  axisFirst.textContent = s.axisFirst
  var axisLast = svgNode("text", "bm-axis bm-axis--last", chart.el)
  axisLast.setAttribute("text-anchor", "end")
  axisLast.textContent = s.axisLast

  /* motion */

  var loop = fig.loop(function (dt) {
    var restX = fig.stepSpring(springX, params, dt, 0.5, 5)
    var restY = fig.stepSpring(springY, params, dt, 0.5, 5)
    paint()
    return !(restX && restY)
  })

  function paint() {
    for (var t = 0; t < BM_WARP; t++) moves[t].setTranslate(springX.x[t], springY.x[t])
  }

  function jump() {
    for (var t = 0; t < BM_WARP; t++) {
      springX.x[t] = springX.target[t]
      springX.v[t] = 0
      springY.x[t] = springY.target[t]
      springY.v[t] = 0
    }
    paint()
  }

  // New targets keep every brick's position and velocity, so a change in
  // flight bends the motion instead of restarting it.
  function retarget(animate) {
    var far = false
    for (var t = 0; t < BM_WARP; t++) {
      springX.target[t] = bmBrickX(geo, model.banks[t])
      springY.target[t] = bmBrickY(geo, model.levels[t])
      if (
        Math.abs(springX.x[t] - springX.target[t]) > 0.5 ||
        Math.abs(springY.x[t] - springY.target[t]) > 0.5 ||
        springX.v[t] !== 0 ||
        springY.v[t] !== 0
      ) {
        far = true
      }
    }
    if (animate && far && !fig.reducedMotion()) {
      loop.start()
    } else {
      loop.stop()
      jump()
    }
  }

  /* geometry: on mount and on width or size class changes */

  function layout(width, narrow) {
    if (!(width > 0) || (width === laidWidth && narrow === laidNarrow)) return
    laidWidth = width
    laidNarrow = narrow
    bankMapGeometry(width, narrow, geo)
    if (chart.height() !== geo.height) chart.setHeight(geo.height)
    for (var t = 0; t < BM_WARP; t++) {
      brickNodes[t].setAttribute("width", String(geo.bw))
      brickNodes[t].setAttribute("height", String(geo.bh))
    }
    place(axisFirst, bmBrickX(geo, 0), geo.height - 6)
    place(axisLast, bmBrickX(geo, BM_BANKS - 1) + geo.bw, geo.height - 6)
    placeBases()
    placeLabel()
    retarget(false)
  }

  function placeBases() {
    for (var b = 0; b < BM_BANKS; b++) {
      var conflict = model.degree[b] > 1
      var h = conflict ? 3 : 1
      baseNodes[b].classList.toggle("is-conflict", conflict)
      place(baseNodes[b], bmBrickX(geo, b), geo.towerBottom + 4 - h, geo.bw, h)
    }
  }

  // "N×" above the tallest stack, or the broadcast note above bank 0.
  function placeLabel() {
    var text = ""
    var x = BM_PAD
    var y = BM_LABEL_LANE
    if (model.pattern === "same") {
      text = s.labelSame
      x = bmBrickX(geo, 0)
      y = bmBrickY(geo, 0) - 6
    } else if (model.worst > 1) {
      text = bmFill(s.worstValue, { n: model.worst })
      x = bmBrickX(geo, model.conflictBank)
      y = bmBrickY(geo, model.worst - 1) - 6
    }
    label.textContent = text
    place(label, Math.max(BM_PAD, x), y)
  }

  /* state: pattern and row width; everything else is bankMapModel */

  function stateText(m) {
    if (m.pattern === "same") return s.stateSame
    return m.worst > 1 ? bmFill(s.stateConflict, { n: m.worst }) : s.stateNone
  }

  function sentence(context, m) {
    var state = stateText(m)
    if (lowerAfterColon) state = state.charAt(0).toLowerCase() + state.slice(1)
    return bmFill(s.sentence, { context: context, state: state, b: m.banksUsed })
  }

  function declText() {
    if (pattern === "same") return "__shared__ float sdata[32];"
    return "__shared__ float tile[32][" + (pattern === "column" ? rowWidth : BM_TILE_COLS) + "];"
  }

  function accessText() {
    if (pattern === "same") return "v = sdata[0];"
    return pattern === "swizzle" ? "v = tile[tid][swz(tid, 0)];" : "v = tile[tid][0];"
  }

  function render(animate) {
    model = bankMapModel(pattern, rowWidth)
    var root = fig.root
    root.setAttribute("data-pattern", pattern)
    root.setAttribute("data-row-width", String(rowWidth))
    root.setAttribute("data-worst", String(model.worst))
    root.setAttribute("data-banks-used", String(model.banksUsed))
    var decl = declText()
    var access = accessText()
    var state = stateText(model)
    declNode.textContent = decl
    accessNode.textContent = access
    stateNode.textContent = state
    worstValue.textContent = bmFill(s.worstValue, { n: model.worst })
    banksValue.textContent = bmFill(s.banksValue, { n: model.banksUsed })
    placeBases()
    placeLabel()
    ruler.setDisabled(pattern !== "column")
    fig.describe(bmFill(s.describe, { decl: decl, access: access, state: state, b: model.banksUsed }))
    retarget(animate)
  }

  var accessChoice = fig.segmented({
    label: s.accessLabel,
    options: [
      { value: "column", label: s.column },
      { value: "swizzle", label: s.swizzle },
      { value: "same", label: s.same },
    ],
    value: pattern,
    onChange: function (next) {
      pattern = next
      render(true)
      fig.announce(sentence(s[next], model))
    },
  })

  // The ruler says its valueText once per commit, so valueText is the whole
  // sentence, period included.
  var ruler = fig.ruler({
    label: s.rulerLabel,
    min: BM_WIDTH_MIN,
    max: BM_WIDTH_MAX,
    step: 1,
    value: rowWidth,
    maxWidth: 320,
    tickLabel: String,
    valueText: function (w) {
      return sentence(bmFill(s.context, { W: w }), bankMapModel("column", w))
    },
    onInput: function (w) {
      if (w === rowWidth) return
      rowWidth = w
      render(true)
    },
  })

  fig.onReset(function () {
    pattern = "column"
    rowWidth = BM_WIDTH_MIN
    accessChoice.set("column")
    ruler.setDisabled(false)
    ruler.set(BM_WIDTH_MIN, { animate: true })
    render(true)
  })

  fig.onSizeChange(function (size, width) {
    layout(width, size === "narrow")
  })

  // Bricks and a settling ruler handle jump to their targets when reduced
  // motion turns on mid-flight; a held handle keeps tracking.
  fig.onReducedMotionChange(function () {
    if (!fig.reducedMotion()) return
    if (loop.running()) {
      loop.stop()
      jump()
    }
    if (fig.root.hasAttribute("data-moving") && !ruler.handle.classList.contains("is-held")) {
      ruler.set(ruler.get())
    }
  })

  fig.model({ bankMap: bankMapModel, geometry: bankMapGeometry })

  layout(chart.width() || fig.width(), fig.size() === "narrow")
  render(false)

  return { destroy: function () {} }
}
