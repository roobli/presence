/**
 * Shared runtime for the essay figures. components/index.js concatenates the
 * runtime files (core, locale, motion, drag, shell) and then the widget files
 * into one IIFE. Top-level names declared in runtime files are visible to every
 * widget; each widget file runs in its own function scope and registers
 * WIDGETS["name"] = function (fig) { ...; return { destroy: fn } }.
 */

var WIDGETS = {}

function el(tag, attrs, kids) {
  var node = document.createElement(tag)
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k]
      else if (attrs[k] != null) node.setAttribute(k, attrs[k])
    })
  }
  ;(kids || []).forEach(function (c) {
    if (c) node.appendChild(c)
  })
  return node
}

function cssVar(name, fallback) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// Pre-shell widgets announce through a live region of their own.
function announce(live, text) {
  if (!live) return
  live.textContent = ""
  window.setTimeout(function () {
    live.textContent = text
  }, 20)
}

/* ---------- palette ---------- */

var palette = null

// Theme tokens for canvas drawing, read once and again after each theme switch.
function getPalette() {
  if (!palette) {
    palette = {
      ink: cssVar("--ink-color", "#34312e"),
      muted: cssVar("--ink-muted-color", "#6f6b66"),
      canvas: cssVar("--canvas-color", "#faf9f6"),
      surface: cssVar("--surface-color", "#f2f1ee"),
      line: cssVar("--line-color", "#ddd9d2"),
      lineStrong: cssVar("--line-strong-color", "#c9c3bb"),
      accent: cssVar("--accent-color", "#a85d3b"),
      fontUi: cssVar("--font-interface", "") || cssVar("--font-ui", "sans-serif"),
      fontCode: cssVar("--font-code", "ui-monospace, monospace"),
    }
  }
  return palette
}

// darkmode sets saved-theme before it dispatches, so the next read sees the new
// tokens. This listener is registered before any surface's, so surfaces that
// redraw on the same event never paint with the old palette.
document.addEventListener("themechange", function () {
  palette = null
})

/* ---------- reduced motion ---------- */

var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

function prefersReducedMotion() {
  return reducedMotionQuery.matches
}

// Returns the unsubscribe function for the widget's destroy().
function onReducedMotionChange(fn) {
  reducedMotionQuery.addEventListener("change", fn)
  return function () {
    reducedMotionQuery.removeEventListener("change", fn)
  }
}

/* ---------- canvas surface ---------- */

/**
 * Keep a canvas backing store at its CSS size times devicePixelRatio. cssH fixes
 * the CSS height in px; null takes the height from layout (a canvas that fills
 * its stage or keeps an aspect ratio). paint(ctx, cssW, cssH, palette) draws in
 * CSS pixels. draw() paints now, from a widget's own frame or an input handler;
 * invalidate() paints in the next frame. Resizes (window, sidebar drag, width
 * modes), DPR changes and theme switches are coalesced into one animation frame,
 * and the bitmap is reallocated only when the CSS size or the DPR changed.
 */
function createSurface(canvas, cssH, paint) {
  var ctx = canvas.getContext("2d")
  var fixedH = typeof cssH === "number" && cssH > 0 ? cssH : null
  var cssW = 0
  var curH = 0
  var dpr = 0
  var frame = 0
  var dirty = false
  var dprQuery = null

  function measureW() {
    return canvas.clientWidth || 640
  }

  function measureH() {
    return fixedH === null ? canvas.clientHeight : fixedH
  }

  // Assigning width or height clears the bitmap, so only do it on a real change.
  function fit() {
    var w = measureW()
    var h = measureH()
    var d = window.devicePixelRatio || 1
    if (w === cssW && h === curH && d === dpr) return false
    cssW = w
    curH = h
    dpr = d
    canvas.width = Math.round(w * d)
    canvas.height = Math.round(h * d)
    return true
  }

  function draw() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    dirty = false
    fit()
    // Start every paint from a clear bitmap and default context state.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, cssW, curH, getPalette())
    ctx.restore()
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(onFrame)
  }

  function onFrame() {
    frame = 0
    var resized = fit()
    if (resized || dirty) draw()
    // A sidebar drag or width transition usually moves again next frame.
    // Checking before that frame paints keeps a stretched bitmap off screen.
    if (resized) schedule()
  }

  function invalidate() {
    dirty = true
    schedule()
  }

  // Reallocating inside the observer callback would resize the observed canvas
  // again in the same frame, so defer to the animation frame.
  function onResize() {
    if (measureW() !== cssW || measureH() !== curH) schedule()
  }

  function watchDpr() {
    if (dprQuery) dprQuery.removeEventListener("change", onDprChange)
    dprQuery = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)")
    dprQuery.addEventListener("change", onDprChange)
  }

  function onDprChange() {
    watchDpr()
    schedule()
  }

  var observer = new ResizeObserver(onResize)
  observer.observe(canvas)
  watchDpr()
  document.addEventListener("themechange", invalidate)

  return {
    draw: draw,
    invalidate: invalidate,
    destroy: function () {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      observer.disconnect()
      dprQuery.removeEventListener("change", onDprChange)
      document.removeEventListener("themechange", invalidate)
    },
  }
}
