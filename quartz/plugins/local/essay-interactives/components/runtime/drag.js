/**
 * Pointer and keyboard helpers for figure controls: a keyboard slider, a pointer
 * drag (optionally with a keyboard slider on the same element) and a press
 * helper for buttons. None of them touches the DOM when the file loads.
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
var PRESS_SLOP = 8
var PRESS_TOUCH_MS = 500

function keyName(e) {
  return e.key === " " || e.key === "Spacebar" ? "Space" : e.key
}

/**
 * createKeySlider(el, {min, max, value, step, shiftStep = step * 10, marks,
 *   label, valueText, onInput, onChange, extraKeys, announce})
 * Gives el the slider role with aria-valuemin, aria-valuemax, aria-valuenow and
 * aria-valuetext from valueText. ArrowRight and ArrowUp add step, ArrowLeft and
 * ArrowDown subtract it, Shift uses shiftStep. PageUp and PageDown jump to the
 * next mark (to the bounds when there are no marks); Home and End jump to the
 * bounds. onInput(value) runs on every change. commit() runs onChange and the
 * announcement once for a settled value: 400 ms after the last arrow key, at
 * keyup after PageUp, PageDown, Home and End, and when a pointer gesture ends.
 * extraKeys maps other keys to callbacks, {"Enter": fn, "Shift+Enter": fn,
 * "Space": fn, "Escape": fn}; fn(event, value) runs on keydown and the key's
 * default is prevented unless fn returns false. Keys held with Alt, Ctrl or
 * Meta are never handled. set(value) moves the value without announcing;
 * reset(value) also marks it committed.
 */
function createKeySlider(el, opts) {
  var o = opts || {}
  var min = o.min == null ? 0 : o.min
  var max = o.max == null ? 100 : o.max
  var step = o.step > 0 ? o.step : (max - min) / 100
  var shiftStep = o.shiftStep > 0 ? o.shiftStep : step * 10
  var marks = (o.marks || []).slice().sort(function (a, b) {
    return a - b
  })
  var valueText = o.valueText || String
  var extraKeys = o.extraKeys || null
  var value = clamp(o.value == null ? min : o.value)
  var committed = value
  var timer = 0
  var jumped = false
  var disabled = false
  var savedTabIndex = null

  function clamp(v) {
    return Math.min(max, Math.max(min, v))
  }

  // toFixed drops float noise such as 0.30000000000000004.
  function snap(v) {
    return clamp(parseFloat((Math.round((v - min) / step) * step + min).toFixed(10)))
  }

  function nextMark(dir) {
    var i
    if (!marks.length) return dir > 0 ? max : min
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

  function clearTimer() {
    if (timer) clearTimeout(timer)
    timer = 0
  }

  function commit() {
    clearTimer()
    if (value === committed) return false
    committed = value
    if (o.onChange) o.onChange(value)
    if (o.announce) o.announce(valueText(value))
    return true
  }

  function extraKey(e) {
    if (!extraKeys) return null
    var name = keyName(e)
    if (e.shiftKey) {
      if (extraKeys["Shift+" + name]) return extraKeys["Shift+" + name]
      // Shift is part of characters such as "$" and "?"; not of Enter or Space.
      if (name.length !== 1) return null
    }
    return extraKeys[name] || (name === "Space" ? extraKeys[" "] : null) || null
  }

  function onKeyDown(e) {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return
    if (!SLIDER_KEYS[e.key]) {
      var fn = extraKey(e)
      if (fn && fn(e, value) !== false) e.preventDefault()
      return
    }
    var by = e.shiftKey ? shiftStep : step
    var next
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = snap(value + by)
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = snap(value - by)
    else if (e.key === "PageUp") next = nextMark(1)
    else if (e.key === "PageDown") next = nextMark(-1)
    else if (e.key === "Home") next = min
    else next = max
    e.preventDefault()
    jumped = e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End"
    clearTimer()
    if (next !== value) {
      value = next
      render()
      if (o.onInput) o.onInput(value)
    }
  }

  function onKeyUp(e) {
    if (disabled || !SLIDER_KEYS[e.key]) return
    clearTimer()
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
    reset: function (v) {
      clearTimer()
      value = clamp(v)
      committed = value
      render()
    },
    commit: commit,
    // Says the current value now, whether or not it changed.
    announce: function () {
      committed = value
      if (o.announce) o.announce(valueText(value))
    },
    disabled: function () {
      return disabled
    },
    setDisabled: function (flag) {
      var next = !!flag
      if (next === disabled) return
      disabled = next
      if (next) {
        commit()
        savedTabIndex = el.getAttribute("tabindex")
        el.setAttribute("tabindex", "-1")
        el.setAttribute("aria-disabled", "true")
      } else {
        if (savedTabIndex == null) el.removeAttribute("tabindex")
        else el.setAttribute("tabindex", savedTabIndex)
        el.removeAttribute("aria-disabled")
      }
    },
    destroy: function () {
      clearTimer()
      el.removeEventListener("keydown", onKeyDown)
      el.removeEventListener("keyup", onKeyUp)
    },
  }
}

/**
 * createDrag(el, {onStart(point, event), onMove(point, delta), onEnd(point,
 *   velocity, event), onCancel(point, event), keyboard}, {touchAction,
 *   velocityWindow})
 * The press responds in the same event: pointer capture on el, class is-held,
 * then onStart. Only the first pointer is tracked. Moves arrive once per
 * animation frame with delta measured from the press point, so a caller keeps
 * its grab offset by adding delta to the value it had at onStart. pointerup and
 * lostpointercapture end with the velocity in px/s over the last 100 ms;
 * pointercancel ends with velocity 0. Escape cancels and calls onCancel.
 * point, delta and velocity are reused objects: read them, do not keep them.
 * The caller owns touch-action: pass touchAction ("none" only on 44px handles,
 * "pan-y" for horizontal drags on lanes and strips) or set it in CSS. keyboard
 * takes createKeySlider options for the same element; its commit runs when a
 * pointer gesture ends. setDisabled(true) lets go of an active drag without
 * callbacks and ignores new presses and keys.
 */
function createDrag(el, handlers, opts) {
  var h = handlers || {}
  var o = opts || {}
  var pointerId = null
  var frame = 0
  var pending = false
  var disabled = false
  var start = { x: 0, y: 0 }
  var point = { x: 0, y: 0 }
  var delta = { x: 0, y: 0 }
  var velocity = { x: 0, y: 0 }
  var tracker = createVelocityTracker({ windowMs: o.velocityWindow })
  var keys = h.keyboard ? createKeySlider(el, h.keyboard) : null
  var touchAction = el.style.touchAction
  if (o.touchAction) el.style.touchAction = o.touchAction

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
    if (disabled || pointerId !== null || !e.isPrimary) return
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

  function end(e, v) {
    release()
    if (h.onEnd) h.onEnd(point, v, e)
    if (keys) keys.commit()
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return
    tracker.addEvent(e)
    track(e)
    end(e, tracker.velocity(e.timeStamp, velocity))
  }

  function onLost(e) {
    if (e.pointerId !== pointerId) return
    end(e, tracker.velocity(e.timeStamp, velocity))
  }

  function onPointerCancel(e) {
    if (e.pointerId !== pointerId) return
    tracker.reset()
    velocity.x = 0
    velocity.y = 0
    end(e, velocity)
  }

  function onEscape(e) {
    if (e.key !== "Escape" || pointerId === null) return
    e.preventDefault()
    e.stopPropagation()
    tracker.reset()
    release()
    if (h.onCancel) h.onCancel(point, e)
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
    setDisabled: function (flag) {
      disabled = !!flag
      if (disabled && pointerId !== null) {
        tracker.reset()
        pending = false
        release()
      }
      if (keys) keys.setDisabled(disabled)
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

/**
 * createPress(el, fn): one activation per gesture. Mouse and pen act on
 * pointerdown. Touch adds .is-pressed on pointerdown and acts on pointerup
 * within 8px and 500 ms of the press; more travel, a longer hold or
 * pointercancel clears it, so a scroll that starts on the button never
 * activates it. A click with detail 0 (Enter or Space on a button, or
 * assistive technology) acts; clicks that follow a pointer press are ignored
 * because the press already acted. Disabled or aria-disabled elements ignore
 * everything.
 */
function createPress(el, fn) {
  var touchId = null
  var startX = 0
  var startY = 0
  var startT = 0

  function blocked() {
    return el.disabled === true || el.getAttribute("aria-disabled") === "true"
  }

  function clear() {
    touchId = null
    el.classList.remove("is-pressed")
  }

  function onDown(e) {
    if (!e.isPrimary || blocked()) return
    if (e.pointerType === "touch") {
      touchId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startT = e.timeStamp
      el.classList.add("is-pressed")
      return
    }
    if (e.button !== 0) return
    fn(e)
  }

  function moved(e) {
    var dx = e.clientX - startX
    var dy = e.clientY - startY
    return dx * dx + dy * dy > PRESS_SLOP * PRESS_SLOP
  }

  function onMove(e) {
    if (e.pointerId === touchId && moved(e)) clear()
  }

  function onUp(e) {
    if (e.pointerId !== touchId) return
    var ok = !moved(e) && e.timeStamp - startT <= PRESS_TOUCH_MS
    clear()
    if (ok && !blocked()) fn(e)
  }

  function onCancel(e) {
    if (e.pointerId === touchId) clear()
  }

  function onClick(e) {
    if (e.detail !== 0 || blocked()) return
    fn(e)
  }

  el.addEventListener("pointerdown", onDown)
  el.addEventListener("pointermove", onMove)
  el.addEventListener("pointerup", onUp)
  el.addEventListener("pointercancel", onCancel)
  el.addEventListener("click", onClick)

  return {
    destroy: function () {
      clear()
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onCancel)
      el.removeEventListener("click", onClick)
    },
  }
}
