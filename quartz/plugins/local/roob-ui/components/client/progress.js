// Reading progress on one column: a 2px bar along the header's bottom edge,
// one segment per h2 section, each as wide as its section is tall, filling
// left to right as the article scrolls by. Scroll maps straight to the fill,
// so reduced motion needs nothing. Essays with fewer than three h2 get no bar.

STRINGS.progress = {
  en: { label: "Reading progress" },
  "zh-Hans": { label: "阅读进度" },
}

var progressState = null

/** 0 when the article's top meets the header, 1 when its bottom meets the
 *  bottom of the window. */
function readingProgress(scrollY, headerH, articleTop, articleHeight, viewportH) {
  var read = scrollY + headerH - articleTop
  var span = articleHeight - viewportH + headerH
  if (span <= 0) return read >= 0 ? 1 : 0
  return clamp(read / span, 0, 1)
}

/** How full each segment is, from the share of the article where each one
 *  starts (ascending, the first at 0). */
function segmentFills(progress, starts) {
  var fills = []
  for (var i = 0; i < starts.length; i += 1) {
    var start = starts[i]
    var end = i + 1 < starts.length ? starts[i + 1] : 1
    if (end > start) fills.push(clamp((progress - start) / (end - start), 0, 1))
    else fills.push(progress >= end ? 1 : 0)
  }
  return fills
}

function measureProgress(state) {
  if (!isNarrow()) return
  var rect = state.article.getBoundingClientRect()
  state.height = rect.height
  state.headerH = state.bar.parentElement ? state.bar.parentElement.offsetHeight : 48
  var starts = []
  for (var i = 0; i < state.heads.length; i += 1) {
    // Whatever comes before the first h2 reads as part of its section.
    var offset = i === 0 ? 0 : state.heads[i].getBoundingClientRect().top - rect.top
    starts.push(rect.height > 0 ? clamp(offset / rect.height, 0, 1) : 0)
  }
  state.starts = starts
  for (var j = 0; j < starts.length; j += 1) {
    var end = j + 1 < starts.length ? starts[j + 1] : 1
    state.segments[j].seg.style.flexGrow = String(Math.max(1, Math.round((end - starts[j]) * rect.height)))
  }
}

function paintProgress(state) {
  state.frame = 0
  if (!isNarrow() || !state.bar.isConnected || !state.starts.length) return
  var top = state.article.getBoundingClientRect().top + window.scrollY
  var progress = readingProgress(window.scrollY, state.headerH, top, state.height, window.innerHeight)
  var fills = segmentFills(progress, state.starts)
  for (var i = 0; i < fills.length; i += 1) {
    var segment = state.segments[i]
    if (Math.abs(fills[i] - segment.shown) < 0.0005) continue
    segment.shown = fills[i]
    segment.fill.style.transform = "scaleX(" + fills[i].toFixed(4) + ")"
  }
  var now = Math.round(progress * 20) * 5
  if (now !== state.valueNow) {
    state.valueNow = now
    state.bar.setAttribute("aria-valuenow", String(now))
  }
}

function teardownProgress(state) {
  if (!state) return
  window.removeEventListener("scroll", state.onScroll)
  window.removeEventListener("resize", state.onResize)
  narrowQuery.removeEventListener("change", state.onResize)
  if (state.observer) state.observer.disconnect()
  if (state.frame) window.cancelAnimationFrame(state.frame)
  state.frame = 0
  if (progressState === state) progressState = null
}

function refreshProgress() {
  var sidebar = document.querySelector(".sidebar.left")
  var article = document.querySelector(".page > #quartz-body > .center > article")
  var bar = document.getElementById("tpl-progress")
  if (progressState && bar && bar.isConnected && progressState.bar === bar && progressState.article === article) {
    return
  }
  teardownProgress(progressState)
  if (bar) bar.remove()
  if (!sidebar || sidebar.dataset.tplNav !== "ready" || !article) return
  if (document.body.getAttribute("data-kind") !== "essay") return
  var heads = article.querySelectorAll("h2")
  if (heads.length < 3) return

  bar = el("div", "")
  bar.id = "tpl-progress"
  bar.setAttribute("role", "progressbar")
  bar.setAttribute("aria-label", t("progress", "label"))
  bar.setAttribute("aria-valuemin", "0")
  bar.setAttribute("aria-valuemax", "100")
  bar.setAttribute("aria-valuenow", "0")
  var segments = []
  for (var i = 0; i < heads.length; i += 1) {
    var seg = el("span", "tpl-progress-seg")
    var fill = el("span", "tpl-progress-fill")
    seg.appendChild(fill)
    bar.appendChild(seg)
    segments.push({ seg: seg, fill: fill, shown: -1 })
  }
  sidebar.appendChild(bar)

  var state = {
    bar: bar,
    article: article,
    heads: heads,
    segments: segments,
    starts: [],
    height: 0,
    headerH: 48,
    frame: 0,
    valueNow: 0,
    observer: null,
  }
  state.onScroll = function () {
    if (!state.frame) {
      state.frame = window.requestAnimationFrame(function () {
        paintProgress(state)
      })
    }
  }
  state.onResize = function () {
    measureProgress(state)
    state.onScroll()
  }
  progressState = state
  window.addEventListener("scroll", state.onScroll, { passive: true })
  window.addEventListener("resize", state.onResize)
  narrowQuery.addEventListener("change", state.onResize)
  // Figures mounting, fonts arriving and images loading all change the
  // sections' heights after this first measure.
  if (typeof ResizeObserver !== "undefined") {
    state.observer = new ResizeObserver(state.onResize)
    state.observer.observe(article)
  }
  measureProgress(state)
  paintProgress(state)
  if (typeof window.addCleanup === "function") {
    window.addCleanup(function () {
      teardownProgress(state)
    })
  }
}
