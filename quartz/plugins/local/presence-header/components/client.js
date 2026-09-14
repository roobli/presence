// SPA navigation morphs <body> and swaps <head>, but never touches <html>.
// Copy the page-lang marker that i18n-slug writes into every head, so the
// document language follows the page after each navigation.
//
// A switch through the header's language control keeps the reading position.
// The click records where the link goes, which h2 or h3 section the reader is
// in and how far through it; the next page, when it is that destination and
// has the same number of h2 and h3 headings, opens at the same point instead
// of the top.
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

function samePath(a, b) {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "")
}

function recordPosition(link) {
  var article = pageArticle()
  var headings = headingsIn(article)
  var line = readingLine()
  var index = -1
  for (var i = 0; i < headings.length; i++) {
    if (headings[i].getBoundingClientRect().top > line) break
    index = i
  }
  try {
    // Above the first heading the next page simply opens at the top.
    if (index < 0) return sessionStorage.removeItem(JUMP_KEY)
    var span = sectionSpan(article, headings, index)
    sessionStorage.setItem(
      JUMP_KEY,
      JSON.stringify({
        path: new URL(link.href, location.href).pathname,
        count: headings.length,
        index: index,
        ratio: Math.min(1, (line - span.top) / span.height),
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

  // Runs before the SPA router's window listener, so the position is saved
  // before the page changes. A modified click opens another tab: skip it.
  function onClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    var target = event.target
    var link = target instanceof Element ? target.closest(".page-header .ph-lang a") : null
    if (link) recordPosition(link)
  }
  document.addEventListener("click", onClick)
  window.addCleanup(function () {
    document.removeEventListener("click", onClick)
  })
})
