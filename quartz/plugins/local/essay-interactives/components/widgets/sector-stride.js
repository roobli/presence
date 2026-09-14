// Ported from lr00rl/cuda-cpp-course src/components/labs/coalescing-lab.tsx (L10-11, L45-68), commit 5d2777f.
/* sector-stride: Fig. 1 of cuda-course-without-a-gpu.
 * One warp of 32 threads reads 4 B floats at in[i * stride], offset 0, and the
 * hardware moves whole 32 B sectors. The stage shows the 32 sectors a stride
 * of 1 to 8 can touch, which of them are fetched, and the slot each read lands
 * in; a detent ruler in the rail picks the stride. The grid never animates:
 * every frame is model output for the current stride, and only the ruler
 * handle moves. Only function declarations, constants and the WIDGETS
 * assignment run at load, so node:vm can load this file with { WIDGETS: {} }. */

var SS_SECTOR_BYTES = 32
var SS_WARP = 32
var SS_ELEM = 4
var SS_OFFSET = 0
var SS_SLOTS = SS_SECTOR_BYTES / SS_ELEM
var SS_GRID = 32
var SS_MIN = 1
var SS_MAX = 8
var SS_DEFAULT = 8
var SS_PAD = 16
var SS_GAP = 6
var SS_LANE = 18
var SS_INDEX_ROW = 22
var SS_OUTSET = 3
var SS_SVG_NS = "http://www.w3.org/2000/svg"

var SS_STRINGS = {
  en: {
    rulerLabel: "stride (elements)",
    effLabel: "Bandwidth efficiency",
    txLabel: "Sector transactions",
    movedLabel: "Bytes moved",
    usedLabel: "Bytes used",
    bytes: "{n} B",
    bracket: "Stride 1 fits in these 4",
    legendFetched: "Fetched sector",
    legendRead: "4 B read",
    legendIdle: "Not fetched",
    indexFirst: "sector 0",
    indexLast: "sector 31",
    valueText: "Stride {s}: {T} sector transactions, {moved} B moved, {eff} efficiency",
    describe:
      "Stride {s}. Sectors 0 to {last} fetched, {T} sector transactions, {moved} B moved for {used} B used, {eff} efficiency.",
  },
  "zh-Hans": {
    rulerLabel: "stride（元素步长）",
    effLabel: "带宽利用率",
    txLabel: "sector 事务数",
    movedLabel: "实际搬运",
    usedLabel: "真正用到",
    bytes: "{n} B",
    bracket: "stride 为 1 时只需这 4 个",
    legendFetched: "被搬运的 sector",
    legendRead: "4 B 读取",
    legendIdle: "未触及",
    indexFirst: "sector 0",
    indexLast: "sector 31",
    valueText: "stride {s}：{T} 次 sector 事务，搬运 {moved} B，带宽利用率 {eff}",
    describe:
      "stride {s}。搬运 sector 0 到 {last}，共 {T} 次 sector 事务，搬运 {moved} B、用到 {used} B，带宽利用率 {eff}。",
  },
}

/* ---------- model: coalescing-lab.tsx L45-68 with elem 4 B, offset 0 ---------- */

/**
 * sectorStrideModel(stride) for an integer stride (1 to 8 in the figure).
 * Course fields: lanes (lane, byteAddr, firstSector, lastSector), sectors (the
 * fetched set, ascending), bytesMoved, bytesUsed, efficiency, and
 * efficiencyText as the lab prints it (L141). Presentation fields: slot per
 * lane, (byteAddr mod 32) / 4; reads, the read count per sector from 0 to
 * lastSector; lastSector, the highest fetched sector.
 */
function sectorStrideModel(stride) {
  var lanes = []
  var reads = []
  var sectors = []
  for (var lane = 0; lane < SS_WARP; lane++) {
    var byteAddr = (SS_OFFSET + lane * stride) * SS_ELEM
    var firstSector = Math.floor(byteAddr / SS_SECTOR_BYTES)
    var lastSector = Math.floor((byteAddr + SS_ELEM - 1) / SS_SECTOR_BYTES)
    for (var k = firstSector; k <= lastSector; k++) {
      while (reads.length <= k) reads.push(0)
      if (reads[k] === 0) sectors.push(k)
      reads[k] += 1
    }
    lanes.push({
      lane: lane,
      byteAddr: byteAddr,
      firstSector: firstSector,
      lastSector: lastSector,
      slot: (byteAddr % SS_SECTOR_BYTES) / SS_ELEM,
    })
  }
  sectors.sort(function (a, b) {
    return a - b
  })
  var bytesMoved = sectors.length * SS_SECTOR_BYTES
  var bytesUsed = SS_WARP * SS_ELEM
  var efficiency = bytesUsed / bytesMoved
  return {
    stride: stride,
    lanes: lanes,
    sectors: sectors,
    reads: reads,
    lastSector: sectors.length ? sectors[sectors.length - 1] : 0,
    transactions: sectors.length,
    bytesMoved: bytesMoved,
    bytesUsed: bytesUsed,
    efficiency: efficiency,
    efficiencyText: (efficiency * 100).toFixed(1) + "%",
  }
}

/**
 * Layout in CSS px for an svg S px wide (the stage content width; the 16px pad
 * is inside the svg). Written into out, so a sidebar drag allocates nothing.
 */
function sectorStrideGeometry(S, narrow, out) {
  var g = out || {}
  g.width = S
  g.cols = narrow ? 4 : 8
  g.rows = SS_GRID / g.cols
  g.cw = (S - 2 * SS_PAD - (g.cols - 1) * SS_GAP) / g.cols
  g.slot = g.cw / SS_SLOTS
  g.ch = narrow ? 24 : 32
  g.rowGap = narrow ? 8 : 10
  g.gridBottom = SS_LANE + g.rows * g.ch + (g.rows - 1) * g.rowGap
  g.height = g.gridBottom + SS_INDEX_ROW
  return g
}

function ssSectorX(g, k) {
  return SS_PAD + (k % g.cols) * (g.cw + SS_GAP)
}

function ssSectorY(g, k) {
  return SS_LANE + Math.floor(k / g.cols) * (g.ch + g.rowGap)
}

function ssFill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (match, key) {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  })
}

/* ---------- widget ---------- */

WIDGETS["sector-stride"] = function (fig) {
  var s = fig.strings(SS_STRINGS)
  var stride = SS_DEFAULT
  var model = sectorStrideModel(stride)
  var geo = sectorStrideGeometry(fig.width() || 640, fig.size() === "narrow", {})
  var laidWidth = 0
  var laidNarrow = null

  function html(tag, className, text, parent) {
    var node = document.createElement(tag)
    node.className = className
    if (text != null) node.textContent = text
    parent.appendChild(node)
    return node
  }

  function svgNode(tag, className, parent) {
    var node = document.createElementNS(SS_SVG_NS, tag)
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

  function setHidden(node, flag) {
    if (flag) node.setAttribute("hidden", "")
    else node.removeAttribute("hidden")
  }

  /* readouts above the grid, display only */

  var band = html("div", "ss-band", null, fig.box)

  function stat(label, modifier) {
    var node = html("div", "ss-stat" + modifier, null, band)
    html("span", "ss-stat__label", label, node)
    return html("span", "ss-stat__value", "", node)
  }

  var effValue = stat(s.effLabel, " ss-stat--eff")
  var txValue = stat(s.txLabel, "")
  var movedValue = stat(s.movedLabel, "")
  var usedValue = stat(s.usedLabel, "")

  /* the 32 sectors, the reads and the stride 1 outline */

  var grid = fig.svg({
    height: geo.height,
    onSize: function (w) {
      layout(w, fig.size() === "narrow")
    },
  })
  grid.el.classList.add("ss-grid")

  var bracketLabel = svgNode("text", "ss-bracket-label", grid.el)
  bracketLabel.setAttribute("text-anchor", "end")
  bracketLabel.textContent = s.bracket
  var bracket = svgNode("rect", "ss-bracket", grid.el)

  var sectorLayer = svgNode("g", "ss-sectors", grid.el)
  var sectorNodes = []
  var boxNodes = []
  var slotNodes = []
  for (var k = 0; k < SS_GRID; k++) {
    var group = svgNode("g", "ss-sector", sectorLayer)
    group.setAttribute("data-sector", String(k))
    var box = svgNode("rect", "ss-sector__box", group)
    box.setAttribute("rx", "3")
    sectorNodes.push(group)
    boxNodes.push(box)
    slotNodes.push(svgNode("path", "ss-sector__slots", group))
  }

  var readLayer = svgNode("g", "ss-reads", grid.el)
  var readNodes = []
  for (var i = 0; i < SS_WARP; i++) {
    var read = svgNode("rect", "ss-read", readLayer)
    read.setAttribute("data-lane", String(i))
    readNodes.push(read)
  }

  // sector 0 sits above its own box, sector 31 under its own box, so each
  // index names the sector it touches in both 8 and 4 columns.
  var indexFirst = svgNode("text", "ss-index ss-index--first", grid.el)
  indexFirst.textContent = s.indexFirst
  var indexLast = svgNode("text", "ss-index ss-index--last", grid.el)
  indexLast.setAttribute("text-anchor", "end")
  indexLast.textContent = s.indexLast

  var legend = html("div", "ss-legend", null, fig.box)
  html("span", "ss-key ss-key--fetched", s.legendFetched, legend)
  html("span", "ss-key ss-key--read", s.legendRead, legend)
  html("span", "ss-key ss-key--idle", s.legendIdle, legend)

  /* geometry: on mount and on width or size class changes, never animated */

  function layout(width, narrow) {
    if (!(width > 0) || (width === laidWidth && narrow === laidNarrow)) return
    laidWidth = width
    laidNarrow = narrow
    sectorStrideGeometry(width, narrow, geo)
    if (grid.height() !== geo.height) grid.setHeight(geo.height)
    for (var k = 0; k < SS_GRID; k++) {
      var x = ssSectorX(geo, k)
      var y = ssSectorY(geo, k)
      place(boxNodes[k], x, y, geo.cw, geo.ch)
      var d = ""
      for (var j = 1; j < SS_SLOTS; j++) {
        d += "M" + (x + j * geo.slot).toFixed(2) + " " + (y + 1) + "V" + (y + geo.ch - 1)
      }
      slotNodes[k].setAttribute("d", d)
    }
    var span = 4 * geo.cw + 3 * SS_GAP
    var top = SS_LANE - SS_OUTSET
    place(bracket, SS_PAD - SS_OUTSET, top, span + 2 * SS_OUTSET, geo.ch + 2 * SS_OUTSET)
    place(bracketLabel, SS_PAD + span + SS_OUTSET, top - 4)
    place(indexFirst, SS_PAD, top - 4)
    place(indexLast, ssSectorX(geo, SS_GRID - 1) + geo.cw, geo.gridBottom + 16)
    placeReads()
  }

  function placeReads() {
    for (var i = 0; i < SS_WARP; i++) {
      var lane = model.lanes[i]
      var k = lane.firstSector
      place(
        readNodes[i],
        ssSectorX(geo, k) + lane.slot * geo.slot + 1,
        ssSectorY(geo, k) + 3,
        geo.slot - 2,
        geo.ch - 6,
      )
    }
  }

  /* state: stride only; everything else is sectorStrideModel(stride) */

  function render() {
    model = sectorStrideModel(stride)
    var root = fig.root
    root.setAttribute("data-stride", String(stride))
    root.setAttribute("data-transactions", String(model.transactions))
    root.setAttribute("data-efficiency", model.efficiencyText)
    root.setAttribute("data-moved", String(model.bytesMoved))
    root.setAttribute("data-used", String(model.bytesUsed))
    effValue.textContent = model.efficiencyText
    txValue.textContent = String(model.transactions)
    movedValue.textContent = ssFill(s.bytes, { n: model.bytesMoved })
    usedValue.textContent = ssFill(s.bytes, { n: model.bytesUsed })
    for (var k = 0; k < SS_GRID; k++) {
      sectorNodes[k].classList.toggle("is-fetched", (model.reads[k] || 0) > 0)
    }
    setHidden(bracket, stride === 1)
    setHidden(bracketLabel, stride === 1)
    placeReads()
    fig.describe(
      ssFill(s.describe, {
        s: stride,
        last: model.lastSector,
        T: model.transactions,
        moved: model.bytesMoved,
        used: model.bytesUsed,
        eff: model.efficiencyText,
      }),
    )
  }

  function valueText(v) {
    var m = sectorStrideModel(v)
    return ssFill(s.valueText, {
      s: v,
      T: m.transactions,
      moved: m.bytesMoved,
      eff: m.efficiencyText,
    })
  }

  var ruler = fig.ruler({
    label: s.rulerLabel,
    min: SS_MIN,
    max: SS_MAX,
    step: 1,
    value: stride,
    maxWidth: 480,
    tickLabel: String,
    valueText: valueText,
    onInput: function (v) {
      if (v === stride) return
      stride = v
      render()
    },
  })

  fig.onReset(function () {
    ruler.set(SS_DEFAULT, { animate: true })
    stride = SS_DEFAULT
    render()
  })

  fig.onSizeChange(function (size, width) {
    layout(width, size === "narrow")
  })

  // The ruler's settle spring runs to its end even when reduced motion turns
  // on meanwhile, so jump it to its detent; a held handle keeps tracking.
  fig.onReducedMotionChange(function () {
    if (
      fig.reducedMotion() &&
      fig.root.hasAttribute("data-moving") &&
      !ruler.handle.classList.contains("is-held")
    ) {
      ruler.set(ruler.get())
    }
  })

  fig.model({ sectorStride: sectorStrideModel, geometry: sectorStrideGeometry })

  layout(grid.width() || fig.width(), fig.size() === "narrow")
  render()

  return { destroy: function () {} }
}
