/**
 * Instrument shell. Mounts each figure.essay-fig the transformer emitted and
 * hands its widget a fig API:
 *   WIDGETS["name"] = function (fig) { ...; return { destroy: function () {} } }
 * The shell renders one polite live region per figure and one Reset button,
 * always last in the rail. Everything made through fig (controls, listeners,
 * surfaces, observers, loops, drags, key scopes, presses, rulers) is released on
 * SPA cleanup, then the widget's destroy runs.
 */

var FIG_SVG_NS = "http://www.w3.org/2000/svg"
var FIG_NARROW_BELOW = 560
var FIG_FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable=""], [contenteditable="true"]'
var mountedFigures = []
var figureCleanupQueued = false

function runSafely(fn) {
  try {
    fn()
  } catch (err) {
    console.error("[essay-fig]", err)
  }
}

// Filled part of a native range track, read by the rail styles.
function syncRangeFill(input) {
  var min = parseFloat(input.min) || 0
  var max = parseFloat(input.max)
  if (!(max > min)) max = min + 100
  var pct = ((parseFloat(input.value) - min) / (max - min)) * 100
  input.style.setProperty("--fig-fill", Math.min(100, Math.max(0, pct)) + "%")
}

// data-size from the box width (the same 560px break as the container query on
// the stage), then every onSizeChange callback with the class and the width.
function applyFigureSize(rec, measured) {
  if (!(measured > 0)) return
  var width = Math.round(measured * 100) / 100
  var size = width < FIG_NARROW_BELOW ? "narrow" : "wide"
  if (size === rec.size && width === rec.width) return
  rec.width = width
  if (size !== rec.size) {
    rec.size = size
    rec.root.setAttribute("data-size", size)
  }
  var fns = rec.sizeFns.slice()
  for (var i = 0; i < fns.length; i++) fns[i](size, width)
}

/**
 * A "group" stage: role group, labelled by the figure title (the number when
 * there is no title) and described by a visually hidden element that holds the
 * alt text, or whatever fig.describe last said.
 */
function exposeGroup(rec) {
  if (rec.desc) return
  var base = rec.root.id || "fig-" + rec.n
  var title = rec.root.querySelector(".essay-fig__title")
  var label = title || rec.root.querySelector(".essay-fig__num")
  rec.stage.setAttribute("role", "group")
  rec.stage.removeAttribute("aria-label")
  if (label) {
    if (!label.id) {
      label.id = base + (title ? "-title" : "-num")
      rec.labelIdSet = label
    }
    rec.stage.setAttribute("aria-labelledby", label.id)
  }
  rec.desc = el("div", { class: "essay-fig__desc", id: base + "-desc", text: rec.description })
  rec.stage.parentNode.insertBefore(rec.desc, rec.stage)
  rec.stage.setAttribute("aria-describedby", rec.desc.id)
}

function restoreStage(rec) {
  if (rec.desc) {
    rec.desc.remove()
    rec.desc = null
    rec.stage.removeAttribute("aria-labelledby")
    rec.stage.removeAttribute("aria-describedby")
  }
  if (rec.labelIdSet) {
    rec.labelIdSet.removeAttribute("id")
    rec.labelIdSet = null
  }
  if (rec.alt) {
    rec.stage.setAttribute("role", "img")
    rec.stage.setAttribute("aria-label", rec.alt)
  }
}

// An "img" stage hides its children from assistive technology, so a focusable
// element inside one would be unreachable. Make it a group and say so.
function checkImgStage(rec) {
  if (rec.desc || !rec.stage.querySelector(FIG_FOCUSABLE)) return
  console.warn(
    "[essay-fig] " + rec.name + ': the stage holds a focusable element; register "stage": "group"',
  )
  exposeGroup(rec)
}

function buildFig(rec) {
  function own(dispose) {
    rec.disposers.push(dispose)
  }

  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options)
    own(function () {
      target.removeEventListener(type, fn, options)
    })
  }

  function nextId(kind) {
    rec.ids += 1
    return (rec.root.id || "fig-" + rec.n) + "-" + kind + rec.ids
  }

  function addControl(node) {
    rec.rail.insertBefore(node, rec.reset)
    return node
  }

  function announce(text) {
    clearTimeout(rec.announceTimer)
    rec.live.textContent = ""
    rec.announceTimer = setTimeout(function () {
      rec.live.textContent = text
    }, 20)
  }

  function slider(o) {
    var id = nextId("slider")
    var format = o.format || String
    var input = el("input", {
      type: "range",
      id: id,
      min: o.min,
      max: o.max,
      step: o.step == null ? "any" : o.step,
    })
    input.value = String(o.value)
    var output = el("output", { class: "essay-fig__value", for: id })
    var keyTimer = 0
    var byKeys = false

    function read() {
      return parseFloat(input.value)
    }

    function sync() {
      var text = format(read())
      output.textContent = text
      input.setAttribute("aria-valuetext", text)
      syncRangeFill(input)
    }

    function say() {
      keyTimer = 0
      announce(o.label + " " + format(read()))
    }

    listen(input, "input", function () {
      sync()
      if (o.onInput) o.onInput(read())
    })
    // change fires on pointerup, and on every key press; keys announce once
    // they have been quiet for a while.
    listen(input, "change", function () {
      if (o.onChange) o.onChange(read())
      if (!byKeys) say()
    })
    listen(input, "pointerdown", function () {
      byKeys = false
    })
    listen(input, "keydown", function (e) {
      if (!SLIDER_KEYS[e.key]) return
      byKeys = true
      clearTimeout(keyTimer)
    })
    listen(input, "keyup", function (e) {
      if (!SLIDER_KEYS[e.key]) return
      clearTimeout(keyTimer)
      keyTimer = setTimeout(say, KEY_ANNOUNCE_IDLE_MS)
    })
    own(function () {
      clearTimeout(keyTimer)
    })

    sync()
    var control = addControl(
      el("div", { class: "essay-fig__control essay-fig__slider" }, [
        el("label", { class: "essay-fig__label", for: id, text: o.label }),
        input,
        output,
      ]),
    )
    return {
      el: input,
      get: read,
      set: function (v) {
        input.value = String(v)
        sync()
      },
      setDisabled: function (flag) {
        input.disabled = !!flag
        control.classList.toggle("is-disabled", !!flag)
      },
    }
  }

  function segmented(o) {
    var labelId = nextId("label")
    var group = el("div", {
      class: "essay-fig__options",
      role: "radiogroup",
      "aria-labelledby": labelId,
    })
    var buttons = []
    var index = 0

    function render() {
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("aria-checked", i === index ? "true" : "false")
        buttons[i].tabIndex = i === index ? 0 : -1
      }
    }

    function select(i, byUser) {
      var changed = i !== index
      index = i
      render()
      if (byUser && changed && o.onChange) o.onChange(o.options[i].value)
    }

    function onKey(e) {
      var last = buttons.length - 1
      var next
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1
      else if (e.key === "Home") next = 0
      else if (e.key === "End") next = last
      else return
      e.preventDefault()
      select(next, true)
      buttons[next].focus()
    }

    o.options.forEach(function (option, i) {
      var button = el("button", { type: "button", role: "radio", text: option.label })
      if (option.value === o.value) index = i
      listen(button, "click", function () {
        select(i, true)
      })
      listen(button, "keydown", onKey)
      buttons.push(button)
      group.appendChild(button)
    })
    render()
    var control = addControl(
      el("div", { class: "essay-fig__control essay-fig__segmented" }, [
        el("span", { class: "essay-fig__label", id: labelId, text: o.label }),
        group,
      ]),
    )
    return {
      el: group,
      get: function () {
        return o.options[index].value
      },
      set: function (value) {
        for (var i = 0; i < o.options.length; i++) {
          if (o.options[i].value === value) select(i, false)
        }
      },
      setDisabled: function (flag) {
        var off = !!flag
        for (var i = 0; i < buttons.length; i++) buttons[i].disabled = off
        if (off) group.setAttribute("aria-disabled", "true")
        else group.removeAttribute("aria-disabled")
        control.classList.toggle("is-disabled", off)
      },
    }
  }

  function toggle(o) {
    var input = el("input", { type: "checkbox" })
    input.checked = !!o.checked
    listen(input, "change", function () {
      if (o.onChange) o.onChange(input.checked)
    })
    var control = addControl(
      el("label", { class: "essay-fig__control essay-fig__toggle" }, [
        input,
        el("span", { text: o.label }),
      ]),
    )
    return {
      el: input,
      get: function () {
        return input.checked
      },
      set: function (value) {
        input.checked = !!value
      },
      setDisabled: function (flag) {
        input.disabled = !!flag
        control.classList.toggle("is-disabled", !!flag)
      },
    }
  }

  function button(o) {
    var node = el("button", { type: "button", class: "essay-fig__button", text: o.label })
    listen(node, "click", function (e) {
      if (o.onClick) o.onClick(e)
    })
    addControl(node)
    return {
      el: node,
      setLabel: function (text) {
        node.textContent = text
      },
      setDisabled: function (flag) {
        node.disabled = !!flag
        node.classList.toggle("is-disabled", !!flag)
      },
    }
  }

  function readout(o) {
    var labelId = nextId("label")
    var output = el("output", { class: "essay-fig__value", "aria-labelledby": labelId })
    var format = o.format || String
    var shown = null
    addControl(
      el("div", { class: "essay-fig__control essay-fig__readout" }, [
        el("span", { class: "essay-fig__label", id: labelId, text: o.label }),
        output,
      ]),
    )
    return {
      set: function (value) {
        var text = format(value)
        if (text === shown) return
        shown = text
        output.textContent = text
      },
    }
  }

  // paint(ctx, w, h, palette) in CSS px. Without height or aspect the canvas
  // fills the box, whose height the registry reserves. Call draw() to paint.
  function canvas(o) {
    var node = el("canvas", { class: "essay-fig__canvas", "aria-hidden": "true" })
    var fixed = o.height > 0 ? Number(o.height) : null
    if (fixed) node.style.height = fixed + "px"
    else if (o.aspect) node.style.aspectRatio = String(o.aspect)
    else node.classList.add("essay-fig__canvas--fill")
    ;(o.parent || rec.box).appendChild(node)
    var surface = createSurface(node, fixed, o.paint)
    own(surface.destroy)
    return { el: node, draw: surface.draw, invalidate: surface.invalidate }
  }

  // An SVG whose viewBox always equals its CSS size, so 12px text stays 12px.
  // The size is set before this returns; onSize(w, h) runs on later changes,
  // coalesced into one animation frame. setHeight(h) changes the CSS height
  // and the viewBox at once.
  function svg(o) {
    var node = document.createElementNS(FIG_SVG_NS, "svg")
    node.setAttribute("class", "essay-fig__svg" + (o.height > 0 ? "" : " essay-fig__svg--fill"))
    node.setAttribute("aria-hidden", "true")
    if (o.height > 0) node.style.height = o.height + "px"
    ;(o.parent || rec.box).appendChild(node)

    var width = 0
    var height = 0
    var nextW = 0
    var nextH = 0
    var frame = 0

    function apply(w, h) {
      w = Math.round(w * 100) / 100
      h = Math.round(h * 100) / 100
      if (w === width && h === height) return false
      width = w
      height = h
      node.setAttribute("viewBox", "0 0 " + w + " " + h)
      node.setAttribute("width", String(w))
      node.setAttribute("height", String(h))
      return true
    }

    var box = node.getBoundingClientRect()
    apply(box.width || o.viewBoxWidth || 0, box.height || o.height || 0)

    var observer = new ResizeObserver(function (entries) {
      var rect = entries[entries.length - 1].contentRect
      nextW = rect.width
      nextH = rect.height
      if (
        frame ||
        (Math.round(nextW * 100) / 100 === width && Math.round(nextH * 100) / 100 === height)
      )
        return
      frame = requestAnimationFrame(function () {
        frame = 0
        if (apply(nextW, nextH) && o.onSize) o.onSize(width, height)
      })
    })
    observer.observe(node)
    own(function () {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    })
    return {
      el: node,
      width: function () {
        return width
      },
      height: function () {
        return height
      },
      setHeight: function (h) {
        node.classList.remove("essay-fig__svg--fill")
        node.style.height = h + "px"
        apply(width || node.getBoundingClientRect().width, h)
      },
    }
  }

  // data-moving="1" on the figure while any of its loops runs.
  function onLoopRun(running) {
    rec.running = Math.max(0, rec.running + (running ? 1 : -1))
    if (rec.running > 0) {
      if (!rec.root.hasAttribute("data-moving")) rec.root.setAttribute("data-moving", "1")
    } else {
      rec.root.removeAttribute("data-moving")
    }
  }

  function loop(step) {
    var handle = createLoop(step, onLoopRun)
    handle.pause(!rec.visible)
    rec.loops.push(handle)
    own(handle.stop)
    return { start: handle.start, stop: handle.stop, running: handle.running }
  }

  function spring(o) {
    var options = { reducedMotion: prefersReducedMotion }
    for (var key in o) if (Object.prototype.hasOwnProperty.call(o, key)) options[key] = o[key]
    return createSpring(options)
  }

  function drag(node, handlers, opts) {
    if (handlers && handlers.keyboard && !handlers.keyboard.announce) {
      handlers.keyboard.announce = announce
    }
    var handle = createDrag(node, handlers, opts)
    own(handle.destroy)
    return handle
  }

  function keySlider(node, o) {
    if (!o.announce) o.announce = announce
    var handle = createKeySlider(node, o)
    own(handle.destroy)
    return handle
  }

  function press(node, fn) {
    var handle = createPress(node, fn)
    own(handle.destroy)
    return handle
  }

  // One bubble-phase keydown listener on the stage for every handler; the
  // first handler that returns true takes the key.
  function keyScope(handler) {
    rec.keyHandlers.push(handler)
    if (rec.keyHandlers.length > 1) return
    var root = rec.root
    var stage = rec.stage
    listen(stage, "keydown", function (e) {
      var list = rec.keyHandlers
      for (var i = 0; i < list.length; i++) {
        if (list[i](e) === true) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
    })
    listen(stage, "focusin", function () {
      root.setAttribute("data-keys", "figure")
    })
    listen(stage, "focusout", function (e) {
      if (!e.relatedTarget || !stage.contains(e.relatedTarget))
        root.setAttribute("data-keys", "page")
    })
    own(function () {
      root.removeAttribute("data-keys")
    })
    root.setAttribute("data-keys", stage.contains(document.activeElement) ? "figure" : "page")
  }

  var api = {
    root: rec.root,
    stage: rec.stage,
    box: rec.box,
    rail: rec.rail,
    lang: rec.lang,
    n: rec.n,
    name: rec.name,
    alt: rec.alt,
    strings: function (table) {
      return pickStrings(table, rec.lang)
    },
    describe: function (text) {
      rec.description = text
      if (rec.desc) {
        rec.desc.textContent = text
      } else {
        if (!rec.stage.hasAttribute("role")) rec.stage.setAttribute("role", "img")
        rec.stage.setAttribute("aria-label", text)
      }
    },
    announce: announce,
    listen: listen,
    slider: slider,
    segmented: segmented,
    toggle: toggle,
    button: button,
    readout: readout,
    onReset: function (fn) {
      rec.resetFn = fn
    },
    canvas: canvas,
    svg: svg,
    loop: loop,
    spring: spring,
    drag: drag,
    keySlider: keySlider,
    keyScope: keyScope,
    press: press,
    velocityTracker: createVelocityTracker,
    stepSpring: stepSpring,
    uiSpring: uiSpring,
    springAt: springAt,
    springVelocityAt: springVelocityAt,
    rubberBand: rubberBand,
    rubberBandInverse: rubberBandInverse,
    project: project,
    reducedMotion: prefersReducedMotion,
    onReducedMotionChange: function (fn) {
      own(onReducedMotionChange(fn))
    },
    size: function () {
      return rec.size
    },
    width: function () {
      return rec.width
    },
    onSizeChange: function (fn) {
      rec.sizeFns.push(fn)
    },
    model: function (fns) {
      var ns = window.__essayInteractives
      if (!ns.models) ns.models = {}
      ns.models[rec.name] = fns
      own(function () {
        if (ns.models[rec.name] === fns) delete ns.models[rec.name]
      })
      return fns
    },
  }
  api.ruler = function (o) {
    return createRuler(api, { addControl: addControl, own: own, listen: listen, nextId: nextId }, o)
  }
  return api
}

function mountWidget(rec) {
  rec.handle = rec.mount(rec.fig)
  // Nodes a widget put straight into the stage belong in the box, which holds
  // the reserved height; outside it they would add to that height.
  var kids = rec.stage.children
  for (var k = kids.length - 1; k >= 0; k--) {
    if (kids[k] !== rec.box) rec.box.appendChild(kids[k])
  }
  // Reset stays last whatever the widget appended.
  rec.rail.appendChild(rec.reset)
  var ranges = rec.rail.querySelectorAll('input[type="range"]')
  for (var i = 0; i < ranges.length; i++) syncRangeFill(ranges[i])
  checkImgStage(rec)
}

// Shell-made resources first, then the widget's own destroy.
function disposeWidget(rec) {
  var disposers = rec.disposers
  rec.disposers = []
  rec.loops = []
  rec.sizeFns = []
  rec.keyHandlers = []
  rec.resetFn = null
  for (var i = disposers.length - 1; i >= 0; i--) runSafely(disposers[i])
  rec.running = 0
  rec.root.removeAttribute("data-moving")
  var handle = rec.handle
  rec.handle = null
  if (handle && typeof handle.destroy === "function") runSafely(handle.destroy)
}

function disposeFigure(rec) {
  disposeWidget(rec)
  var disposers = rec.shellDisposers
  rec.shellDisposers = []
  for (var i = disposers.length - 1; i >= 0; i--) runSafely(disposers[i])
}

// Without a reset function the widget is mounted again from scratch.
function resetFigure(rec) {
  if (rec.resetFn) {
    runSafely(rec.resetFn)
  } else {
    disposeWidget(rec)
    rec.box.textContent = ""
    var kids = rec.rail.children
    for (var i = kids.length - 1; i >= 0; i--) if (kids[i] !== rec.reset) kids[i].remove()
    try {
      mountWidget(rec)
    } catch (err) {
      console.error("[essay-fig] " + rec.name + " failed to mount:", err)
    }
  }
  rec.fig.announce(rec.strings.resetDone)
}

function mountFigure(root) {
  var name = root.getAttribute("data-interactive")
  var stage = root.querySelector(".essay-fig__stage")
  var rail = root.querySelector(".essay-fig__rail")
  if (!Object.prototype.hasOwnProperty.call(WIDGETS, name) || !stage || !rail) return null

  // Pages built before the box existed still get one.
  var box = stage.querySelector(".essay-fig__box")
  if (!box) {
    box = el("div", { class: "essay-fig__box" })
    while (stage.firstChild) box.appendChild(stage.firstChild)
    stage.appendChild(box)
  }

  var lang = figureLang(root)
  var alt = stage.getAttribute("aria-label") || ""
  var rec = {
    root: root,
    stage: stage,
    box: box,
    rail: rail,
    name: name,
    mount: WIDGETS[name],
    lang: lang,
    n: parseInt(root.getAttribute("data-figure"), 10) || 0,
    strings: pickStrings(SHELL_STRINGS, lang),
    alt: alt,
    description: alt,
    desc: null,
    labelIdSet: null,
    fig: null,
    handle: null,
    resetFn: null,
    disposers: [],
    shellDisposers: [],
    loops: [],
    sizeFns: [],
    keyHandlers: [],
    size: "",
    width: 0,
    running: 0,
    visible: true,
    ids: 0,
    announceTimer: 0,
  }

  rec.live = el("div", { class: "essay-fig__live", role: "status", "aria-live": "polite" })
  root.appendChild(rec.live)
  rec.reset = el("button", { type: "button", class: "essay-fig__reset", text: rec.strings.reset })
  rail.appendChild(rec.reset)

  function onReset() {
    resetFigure(rec)
  }
  function onRailInput(event) {
    if (event.target && event.target.type === "range") syncRangeFill(event.target)
  }
  rec.reset.addEventListener("click", onReset)
  rail.addEventListener("input", onRailInput)

  // Size class from the box, never the viewport, so a sidebar drag or a width
  // mode change reaches onSizeChange with no window resize. Observer callbacks
  // apply it in the next frame, so a layout change it causes cannot feed back
  // into the same observation.
  applyFigureSize(rec, box.getBoundingClientRect().width)
  var sizeFrame = 0
  var sizeWidth = 0
  var sizeObserver = new ResizeObserver(function (entries) {
    sizeWidth = entries[entries.length - 1].contentRect.width
    if (sizeFrame || !(sizeWidth > 0)) return
    sizeFrame = requestAnimationFrame(function () {
      sizeFrame = 0
      applyFigureSize(rec, sizeWidth)
    })
  })
  sizeObserver.observe(box)

  // Loops of a figure that is fully off screen hold still.
  var visibility = new IntersectionObserver(function (entries) {
    var visible = entries[entries.length - 1].isIntersecting
    if (visible === rec.visible) return
    rec.visible = visible
    for (var i = 0; i < rec.loops.length; i++) rec.loops[i].pause(!visible)
  })
  visibility.observe(root)

  rec.shellDisposers.push(function () {
    sizeObserver.disconnect()
    visibility.disconnect()
    if (sizeFrame) cancelAnimationFrame(sizeFrame)
    clearTimeout(rec.announceTimer)
    rec.reset.removeEventListener("click", onReset)
    rail.removeEventListener("input", onRailInput)
    rec.reset.remove()
    rec.live.remove()
    restoreStage(rec)
  })

  if (root.getAttribute("data-stage") === "group") exposeGroup(rec)
  rec.fig = buildFig(rec)
  var fallback = box.querySelector(".essay-fig__fallback")
  if (fallback) fallback.remove()
  try {
    mountWidget(rec)
  } catch (err) {
    console.error("[essay-fig] " + name + " failed to mount:", err)
    disposeFigure(rec)
    box.textContent = ""
    rail.textContent = ""
    if (fallback) box.appendChild(fallback)
    root.setAttribute("data-fig-state", "error")
    return null
  }
  root.setAttribute("data-fig-state", "live")
  return rec
}

function destroyFigures() {
  var list = mountedFigures
  mountedFigures = []
  figureCleanupQueued = false
  for (var i = 0; i < list.length; i++) disposeFigure(list[i])
}

function mountAll() {
  if (!document.querySelector("figure.essay-fig[data-interactive]")) return
  var nodes = document.querySelectorAll("figure.essay-fig[data-interactive]")
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    // Popover previews keep the static fallback.
    if (node.hasAttribute("data-fig-state") || node.closest(".popover")) continue
    var rec = mountFigure(node)
    if (rec) mountedFigures.push(rec)
  }
  // The SPA router runs and clears its cleanups before it morphs in the next
  // page. It loads after this script, so the first pass can mount before
  // addCleanup exists; the router's first nav event then registers the cleanup.
  if (mountedFigures.length && !figureCleanupQueued && typeof window.addCleanup === "function") {
    figureCleanupQueued = true
    window.addCleanup(destroyFigures)
  }
}

function boot() {
  var ns = window.__essayInteractives || (window.__essayInteractives = {})
  if (typeof ns.activeLoops !== "number") ns.activeLoops = 0
  if (!ns.models) ns.models = {}
  document.addEventListener("nav", mountAll)
  document.addEventListener("render", mountAll)
  mountAll()
}
