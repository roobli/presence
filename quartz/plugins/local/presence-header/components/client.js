// SPA navigation morphs <body> and swaps <head>, but never touches <html>.
// Copy the page-lang marker that i18n-slug writes into every head, so the
// document language follows the page after each navigation.
//
// A switch through the header's language control keeps the reading position:
// the h2 or h3 section the reader is in and how far through it. The next page,
// when it is the link's destination and has the same number of h2 and h3
// headings, opens at the same point instead of the top.
//
// The control sits in the page header, above the first heading, and does not
// stick. A reader reaches it by scrolling back up, or by Tab, which scrolls it
// into view, so when it is activated every heading is below the reading line
// and the click itself says nothing about the place being read. The place is
// taken earlier instead: on each move down the page while the control is out
// of view. Moving back up to the control, by any means, leaves it as it was.
var JUMP_KEY = "presence-lang-jump"

// Mermaid diagrams, live figures and late fonts render after the navigation
// and change section heights under the restored position. Until the reader
// scrolls, taps, clicks or types, or HOLD_MS passes, every change in the
// article's size puts the position back.
var HOLD_MS = 4000
var TAKEOVER_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"]

// Headings are read against the top of the viewport, below the sticky mobile
// header when there is one (roob-ui sets scroll-padding-top to its height).
function readingLine() {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
}

function pageArticle() {
  return document.querySelector(".center article")
}

function headingsIn(article) {
  return article ? Array.prototype.slice.call(article.querySelectorAll("h2, h3")) : []
}

// A heading's section runs to the next h2 or h3, or to the end of the article.
function sectionSpan(article, headings, index) {
  var top = headings[index].getBoundingClientRect().top
  var next = headings[index + 1]
  var end = next ? next.getBoundingClientRect().top : article.getBoundingClientRect().bottom
  return { top: top, height: Math.max(1, end - top) }
}

// The last h2 or h3 at or above the reading line, and how far the line is into
// its section. Null above the first heading, where a switch opens at the top.
function placeIn(article) {
  var headings = headingsIn(article)
  var line = readingLine()
  var index = -1
  for (var i = 0; i < headings.length; i++) {
    if (headings[i].getBoundingClientRect().top > line) break
    index = i
  }
  if (index < 0) return null
  var span = sectionSpan(article, headings, index)
  return {
    count: headings.length,
    index: index,
    ratio: Math.min(1, (line - span.top) / span.height),
  }
}

function inView(element) {
  var rect = element.getBoundingClientRect()
  return rect.bottom > readingLine() && rect.top < window.innerHeight
}

// Overscroll bounce reports offsets past either end. Clamp them, so the spring
// back after a fling to the top does not count as a move down.
function scrollOffset() {
  var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  return Math.min(Math.max(0, window.scrollY), max)
}

function samePath(a, b) {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "")
}

function recordPlace(link, place) {
  try {
    if (!place) return sessionStorage.removeItem(JUMP_KEY)
    sessionStorage.setItem(
      JUMP_KEY,
      JSON.stringify({
        path: new URL(link.href, location.href).pathname,
        count: place.count,
        index: place.index,
        ratio: place.ratio,
      }),
    )
  } catch (e) {}
}

function restorePosition() {
  var saved = null
  try {
    saved = JSON.parse(sessionStorage.getItem(JUMP_KEY) || "null")
    sessionStorage.removeItem(JUMP_KEY)
  } catch (e) {}
  // A switch that never arrived (another navigation was in flight) must not
  // move whichever page comes next.
  if (!saved || typeof saved.path !== "string" || !samePath(saved.path, location.pathname)) return
  var article = pageArticle()
  if (headingsIn(article).length !== saved.count) return

  function place() {
    var headings = headingsIn(article)
    if (headings.length !== saved.count || !headings[saved.index]) return
    var span = sectionSpan(article, headings, saved.index)
    var offset = span.top + saved.ratio * span.height - readingLine()
    if (Math.abs(offset) >= 1) {
      window.scrollTo({ top: window.scrollY + offset, behavior: "instant" })
    }
  }

  place()
  if (typeof ResizeObserver !== "function") return

  var observer = new ResizeObserver(place)
  var timer = setTimeout(release, HOLD_MS)
  function release() {
    observer.disconnect()
    clearTimeout(timer)
    TAKEOVER_EVENTS.forEach(function (type) {
      window.removeEventListener(type, release, true)
    })
  }
  observer.observe(article)
  TAKEOVER_EVENTS.forEach(function (type) {
    window.addEventListener(type, release, { capture: true, passive: true })
  })
  window.addCleanup(release)
}

document.addEventListener("nav", function () {
  var marker = document.head.querySelector('meta[name="page-lang"]')
  if (marker && marker.content) document.documentElement.lang = marker.content

  restorePosition()

  var article = pageArticle()
  var control = document.querySelector(".page-header .ph-lang")
  if (!article || !control) return

  // After a restored switch this is the carried place; after a hash link, the
  // target's section. Scroll events keep it current from here.
  var place = placeIn(article)
  var lastOffset = scrollOffset()
  var frame = 0

  function onScroll() {
    if (frame) return
    frame = requestAnimationFrame(function () {
      frame = 0
      var offset = scrollOffset()
      if (offset > lastOffset && !inView(control)) place = placeIn(article)
      lastOffset = offset
    })
  }

  // Runs before the SPA router's window listener, so the place is saved
  // before the page changes. A modified click opens another tab: skip it.
  function onClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    var target = event.target
    var link = target instanceof Element ? target.closest(".page-header .ph-lang a") : null
    if (link) recordPlace(link, place)
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  document.addEventListener("click", onClick)
  window.addCleanup(function () {
    window.removeEventListener("scroll", onScroll)
    cancelAnimationFrame(frame)
    document.removeEventListener("click", onClick)
  })
})
