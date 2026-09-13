// The <head> script, a separate beforeDOMLoaded string. components/index.js
// wraps it in a function whose prefs argument is SIDEBAR_PREFS.

/**
 * Dev-only cache buster.
 *
 * The dev server sends index.css with no Cache-Control and no ETag, so Chrome
 * reuses it on heuristic freshness, and Quartz marks the link data-persist so
 * the SPA router never replaces it either. A stylesheet edit then shows up
 * only after a manual hard reload, which makes every visual change look like
 * it did not take. Localhost gets a stamped href; nothing else is touched.
 *
 * A restamped sheet can land after roob-ui has measured the right gutter
 * against an unstyled page. Each sheet announces its load, and roob-ui runs
 * applyLayout again (boot.js).
 */
function roobDevCacheBust() {
  var host = location.hostname
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") return
  var stamp = String(Date.now())
  var landed = function () {
    document.dispatchEvent(new CustomEvent("tpl-styles-loaded"))
  }
  var apply = function () {
    var links = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]')
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href")
      if (!href || href.indexOf("tplcb=") !== -1) continue
      links[i].addEventListener("load", landed)
      links[i].setAttribute("href", href + (href.indexOf("?") === -1 ? "?" : "&") + "tplcb=" + stamp)
    }
  }
  apply()
  document.addEventListener("DOMContentLoaded", apply)
}

/**
 * Panel width, collapse and text width before first paint.
 *
 * roob-ui runs after the body has been parsed, so a stored width, a folded
 * panel or a wide column used to arrive a frame late, over a first paint at
 * the stylesheet's defaults. This runs in <head>, where only <html> exists,
 * and <html> is where all three live. It has to land on the values roob-ui
 * computes (resize.js, width.js).
 */
function roobSidebarPrepaint(prefs) {
  var read = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (e) {
      return fallback
    }
  }
  var width = read(prefs.widthKey, prefs.defaultWidth)
  if (typeof width !== "number" || width < prefs.min || width > prefs.max) {
    width = prefs.defaultWidth
  }
  var max = Math.max(prefs.min, Math.min(prefs.max, window.innerWidth - prefs.columnReserve))
  width = Math.round(Math.min(max, Math.max(prefs.min, width)))
  var collapsed = read(prefs.collapsedKey, false) === true
  var docEl = document.documentElement
  docEl.setAttribute("data-tpl-sidebar", collapsed ? "collapsed" : "open")
  docEl.style.setProperty("--tpl-sidebar-width", (collapsed ? 0 : width) + "px")

  // The mode is a plain string, not JSON.
  var mode = "default"
  try {
    mode = localStorage.getItem(prefs.modeKey) || "default"
  } catch (e) {
    /* private mode */
  }
  if (mode !== "wide" && mode !== "full") mode = "default"
  docEl.setAttribute("data-tpl-width", mode)
}

/**
 * A first visit opens on Writing. Quartz's explorer reads its folder state
 * from this key and keys folders by slug, and it never reads a default of its
 * own, so the seed has to be in place before its script runs.
 */
function roobSeedFileTree() {
  try {
    if (localStorage.getItem("fileTree") === null) {
      localStorage.setItem("fileTree", '[{"path":"writing/index","collapsed":false}]')
    }
  } catch (e) {
    /* private mode */
  }
}

roobDevCacheBust()
roobSidebarPrepaint(prefs)
roobSeedFileTree()
