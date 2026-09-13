/**
 * Pointer drag and keyboard slider helpers for figure handles.
 */

var SLIDER_KEYS = {
  ArrowLeft: true,
  ArrowRight: true,
  ArrowUp: true,
  ArrowDown: true,
  PageUp: true,
  PageDown: true,
  Home: true,
  End: true,
}
var KEY_ANNOUNCE_IDLE_MS = 400

/**
 * createKeySlider(el, {min, max, step, value, marks, label, valueText, onInput,
 *   onChange, announce})
 * Gives el the slider role. Arrows step (Shift steps x10), PageUp and PageDown
 * move to the next mark (10 steps when there are no marks), Home and End jump to
 * the bounds. onInput(value) runs per key. onChange(value) and announce run once
 * the keys have been quiet for 400 ms, or at keyup after PageUp, PageDown, Home
 * and End. set(value) is for pointer updates and never announces; call
 * announce() on pointerup.
 */
function createKeySlider(el, opts) {
  var o = opts || {}
  var min = o.min == null ? 0 : o.min
  var max = o.max == null ? 100 : o.max
  var step = o.step > 0 ? o.step : (max - min) / 100
  var marks = (o.marks || []).slice().sort(function (a, b) {
    return a - b
  })
  var valueText = o.valueText || String
  var value = clamp(o.value == null ? min : o.value)
  var committed = value
  var timer = 0
  var jumped = false

  function clamp(v) {
    return Math.min(max, Math.max(min, v))
  }

  // toFixed drops float noise such as 0.30000000000000004.
  function snap(v) {
    return clamp(parseFloat((Math.round((v - min) / step) * step + min).toFixed(10)))
  }

  function nextMark(dir) {
    if (!marks.length) return snap(value + dir * step * 10)
    var i
    if (dir > 0) {
      for (i = 0; i < marks.length; i++) if (marks[i] > value + 1e-9) return clamp(marks[i])
      return max
    }
    for (i = marks.length - 1; i >= 0; i--) if (marks[i] < value - 1e-9) return clamp(marks[i])
    return min
  }

  function render() {
    el.setAttribute("aria-valuenow", String(value))
    el.setAttribute("aria-valuetext", valueText(value))
  }

  function say() {
    committed = value
    if (o.announce) o.announce(valueText(value))
  }

  function commit() {
    timer = 0
    if (value === committed) return
    if (o.onChange) o.onChange(value)
    say()
  }

  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !SLIDER_KEYS[e.key]) return
    var times = e.shiftKey ? 10 : 1
    var next
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = snap(value + step * times)
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = snap(value - step * times)
    else if (e.key === "PageUp") next = nextMark(1)
    else if (e.key === "PageDown") next = nextMark(-1)
    else if (e.key === "Home") next = min
    else next = max
    e.preventDefault()
    jumped = e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End"
    if (timer) {
      clearTimeout(timer)
      timer = 0
    }
    if (next !== value) {
      value = next
      render()
      if (o.onInput) o.onInput(value)
    }
  }

  function onKeyUp(e) {
    if (!SLIDER_KEYS[e.key]) return
    if (timer) clearTimeout(timer)
    timer = 0
    if (jumped) {
      jumped = false
      commit()
    } else {
      timer = setTimeout(commit, KEY_ANNOUNCE_IDLE_MS)
    }
  }

  if (!el.hasAttribute("tabindex")) el.tabIndex = 0
  el.setAttribute("role", "slider")
  if (o.label) el.setAttribute("aria-label", o.label)
  el.setAttribute("aria-valuemin", String(min))
  el.setAttribute("aria-valuemax", String(max))
  render()
  el.addEventListener("keydown", onKeyDown)
  el.addEventListener("keyup", onKeyUp)

  return {
    get: function () {
      return value
    },
    set: function (v) {
      var next = clamp(v)
      if (next === value) return
      value = next
      render()
    },
    announce: say,
    destroy: function () {
      if (timer) clearTimeout(timer)
      timer = 0
      el.removeEventListener("keydown", onKeyDown)
      el.removeEventListener("keyup", onKeyUp)
    },
  }
}

/**
 * createDrag(el, {onStart(point, event), onMove(point, delta), onEnd(point,
 *   velocity, event), onCancel(), keyboard}, {touchAction})
 * The press responds in the same event: pointer capture, class is-held, then
 * onStart. Only the first pointer is tracked. Moves arrive once per animation
 * frame with delta measured from the press point, so a caller keeps its grab
 * offset by adding delta to the value it had at onStart. pointerup,
 * pointercancel and lostpointercapture release; velocity is in px/s from the
 * last 80 ms, and 0 after pointercancel. Escape cancels and calls onCancel.
 * touch-action defaults to none; pass touchAction "pan-y" for a horizontal drag
 * on a large region. point and delta are reused objects, so read them without
 * keeping them. keyboard takes createKeySlider options for the same element.
 */
function createDrag(el, handlers, opts) {
  var h = handlers || {}
  var o = opts || {}
  var pointerId = null
  var frame = 0
  var pending = false
  var start = { x: 0, y: 0 }
  var point = { x: 0, y: 0 }
  var delta = { x: 0, y: 0 }
  var tracker = createVelocityTracker()
  var keys = h.keyboard ? createKeySlider(el, h.keyboard) : null
  var touchAction = el.style.touchAction
  el.style.touchAction = o.touchAction || "none"

  function track(e) {
    if (e.clientX !== point.x || e.clientY !== point.y) pending = true
    point.x = e.clientX
    point.y = e.clientY
    delta.x = point.x - start.x
    delta.y = point.y - start.y
  }

  function flush() {
    frame = 0
    if (pointerId === null || !pending) return
    pending = false
    if (h.onMove) h.onMove(point, delta)
  }

  // Deliver the last position before any release callback, then let go.
  function release() {
    var id = pointerId
    pointerId = null
    document.removeEventListener("keydown", onEscape, true)
    el.classList.remove("is-held")
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (pending) {
      pending = false
      if (h.onMove) h.onMove(point, delta)
    }
    try {
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id)
    } catch (err) {}
  }

  function onDown(e) {
    if (pointerId !== null || !e.isPrimary) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    pointerId = e.pointerId
    try {
      el.setPointerCapture(pointerId)
    } catch (err) {}
    start.x = e.clientX
    start.y = e.clientY
    track(e)
    pending = false
    tracker.reset()
    tracker.addEvent(e)
    el.classList.add("is-held")
    document.addEventListener("keydown", onEscape, true)
    // No text selection or focus change from the press; a keyboard handle still
    // takes focus so its keys work after a drag.
    e.preventDefault()
    if (keys) el.focus({ preventScroll: true })
    if (h.onStart) h.onStart(point, e)
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return
    tracker.addEvent(e)
    track(e)
    if (!frame) frame = requestAnimationFrame(flush)
  }

  function end(e, velocity) {
    release()
    if (h.onEnd) h.onEnd(point, velocity, e)
    if (keys) keys.announce()
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return
    tracker.addEvent(e)
    track(e)
    end(e, tracker.velocity(e.timeStamp))
  }

  function onLost(e) {
    if (e.pointerId !== pointerId) return
    end(e, tracker.velocity(e.timeStamp))
  }

  function onPointerCancel(e) {
    if (e.pointerId !== pointerId) return
    tracker.reset()
    end(e, { x: 0, y: 0 })
  }

  function onEscape(e) {
    if (e.key !== "Escape" || pointerId === null) return
    e.preventDefault()
    e.stopPropagation()
    tracker.reset()
    release()
    if (h.onCancel) h.onCancel()
  }

  el.addEventListener("pointerdown", onDown)
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerup", onUp)
  el.addEventListener("pointercancel", onPointerCancel)
  el.addEventListener("lostpointercapture", onLost)

  return {
    keys: keys,
    held: function () {
      return pointerId !== null
    },
    destroy: function () {
      // Let go silently: the widget is going away.
      h = {}
      if (pointerId !== null) release()
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onPointerCancel)
      el.removeEventListener("lostpointercapture", onLost)
      el.style.touchAction = touchAction
      if (keys) keys.destroy()
    },
  }
}
