/**
 * fig.ruler: a detent slider for the rail, built on createDrag, createKeySlider
 * and a critically damped spring.
 *
 * DOM: div.essay-fig__control.essay-fig__ruler > span.essay-fig__label and
 * div.essay-fig__ruler-track, which holds div.essay-fig__ruler-line, one
 * span.essay-fig__ruler-tick[data-value] per detent (its text is the tick
 * label) and div.essay-fig__ruler-handle[role=slider] > span.essay-fig__ruler-dot.
 *
 * Geometry: detents sit 22px in from each end of the track, spaced
 * sp = (width - 44) / (n - 1). The handle's hit box is 44 x 56 px.
 *
 * Handle: the press catches the handle at its presentation position (a
 * settle in flight stops there) and it follows 1:1 with the grab offset,
 * stretched with rubberBand(overshoot, sp) past the end detents. The value is
 * the nearest detent, and onInput runs on every change. Release springs from
 * the tracked velocity to that detent (response 0.3 s, damping ratio 1, no
 * projection). Escape restores the value from the press.
 * Track: a press marks the nearest tick is-pressed; a tap under 6px sets that
 * detent; horizontal travel over 6px (more than vertical) captures the pointer
 * and scrubs detent by detent, the handle springing to each; pointercancel
 * before that changes nothing.
 * Keys (on the handle): arrows step, Shift steps x10, Home and End and PageUp
 * and PageDown go to the bounds. onChange and one announcement of valueText run
 * per commit: release, tap, 400 ms after the last arrow key, keyup after a
 * jump. Never on mount, never from set().
 */

var RULER_INSET = 22
var RULER_TAP_SLOP = 6

function createRuler(fig, internal, o) {
  var min = o.min == null ? 0 : Number(o.min)
  var step = o.step > 0 ? Number(o.step) : 1
  var max = o.max == null ? min + 10 * step : Number(o.max)
  var count = Math.max(2, Math.round((max - min) / step) + 1)
  var tickLabel = o.tickLabel || String
  var valueText = o.valueText || String
  var width = 0
  var sp = 0
  var pos = RULER_INSET
  var raw0 = 0
  var pressValue = 0
  var disabled = false
  var scrub = null
  var resizeFrame = 0

  function clampIndex(i) {
    return Math.max(0, Math.min(count - 1, i))
  }

  function valueOf(i) {
    return parseFloat((min + clampIndex(i) * step).toFixed(10))
  }

  function indexOfValue(v) {
    return clampIndex(Math.round((v - min) / step))
  }

  function indexAt(x) {
    return sp > 0 ? clampIndex(Math.round((x - RULER_INSET) / sp)) : indexOfValue(value)
  }

  function xOf(v) {
    return RULER_INSET + indexOfValue(v) * sp
  }

  var value = valueOf(indexOfValue(o.value == null ? min : Number(o.value)))

  function band(x) {
    if (!(sp > 0)) return x
    var lo = RULER_INSET
    var hi = RULER_INSET + (count - 1) * sp
    if (x < lo) return lo - fig.rubberBand(lo - x, sp)
    if (x > hi) return hi + fig.rubberBand(x - hi, sp)
    return x
  }

  function unband(p) {
    if (!(sp > 0)) return p
    var lo = RULER_INSET
    var hi = RULER_INSET + (count - 1) * sp
    if (p < lo) return lo - fig.rubberBandInverse(lo - p, sp)
    if (p > hi) return hi + fig.rubberBandInverse(p - hi, sp)
    return p
  }

  /* ---------- DOM ---------- */

  var labelId = internal.nextId("label")
  var track = el("div", { class: "essay-fig__ruler-track" })
  track.style.setProperty("--ruler-n", String(count))
  track.appendChild(el("div", { class: "essay-fig__ruler-line", "aria-hidden": "true" }))
  var ticks = []
  for (var i = 0; i < count; i++) {
    var tick = el("span", {
      class: "essay-fig__ruler-tick",
      "data-value": String(valueOf(i)),
      "aria-hidden": "true",
      text: tickLabel(valueOf(i)),
    })
    tick.style.setProperty("--i", String(i))
    ticks.push(tick)
    track.appendChild(tick)
  }
  var handle = el("div", { class: "essay-fig__ruler-handle", "aria-labelledby": labelId }, [
    el("span", { class: "essay-fig__ruler-dot" }),
  ])
  track.appendChild(handle)
  var control = el("div", { class: "essay-fig__control essay-fig__ruler" }, [
    el("span", { class: "essay-fig__label", id: labelId, text: o.label }),
    track,
  ])
  if (o.maxWidth > 0) control.style.setProperty("--ruler-max", o.maxWidth + "px")
  internal.addControl(control)

  /* ---------- motion ---------- */

  var spring = fig.spring({ response: 0.3, dampingRatio: 1, exact: true, value: pos })
  var loop = fig.loop(function (dt) {
    var moving = spring.step(dt)
    pos = spring.value
    render()
    return moving
  })

  function render() {
    handle.style.transform = "translate3d(" + (pos - RULER_INSET) + "px,0,0)"
  }

  // Run the spring toward its target, or draw where it already is.
  function follow() {
    if (spring.resting) {
      loop.stop()
      pos = spring.value
      render()
    } else {
      loop.start()
    }
  }

  function settle(velocity) {
    spring.set(pos, velocity || 0)
    spring.retarget(xOf(value))
    follow()
  }

  function change(next) {
    if (next === value) return false
    value = next
    keys.set(value)
    if (o.onInput) o.onInput(value)
    return true
  }

  /* ---------- handle ---------- */

  var drag = fig.drag(
    handle,
    {
      onStart: function () {
        loop.stop()
        pos = spring.value
        spring.set(pos)
        raw0 = unband(pos)
        pressValue = value
        render()
      },
      onMove: function (point, delta) {
        pos = band(raw0 + delta.x)
        render()
        change(valueOf(indexAt(pos)))
      },
      onEnd: function (point, velocity) {
        settle(velocity.x)
      },
      onCancel: function () {
        change(pressValue)
        settle(0)
      },
      keyboard: {
        min: min,
        max: valueOf(count - 1),
        step: step,
        shiftStep: step * 10,
        value: value,
        valueText: valueText,
        onInput: function (v) {
          value = valueOf(indexOfValue(v))
          if (o.onInput) o.onInput(value)
          spring.retarget(xOf(value))
          follow()
        },
        onChange: function (v) {
          if (o.onChange) o.onChange(v)
        },
      },
    },
    { touchAction: "none" },
  )
  var keys = drag.keys

  /* ---------- track ---------- */

  function onScrubEscape(e) {
    if (e.key !== "Escape" || !scrub || !scrub.captured) return
    e.preventDefault()
    e.stopPropagation()
    endScrub()
    change(pressValue)
    spring.retarget(xOf(value))
    follow()
  }

  function endScrub() {
    var was = scrub
    scrub = null
    if (!was) return null
    if (was.tick) was.tick.classList.remove("is-pressed")
    document.removeEventListener("keydown", onScrubEscape, true)
    try {
      if (track.hasPointerCapture(was.id)) track.releasePointerCapture(was.id)
    } catch (err) {}
    return was
  }

  function onTrackDown(e) {
    if (disabled || scrub || drag.held() || !e.isPrimary || handle.contains(e.target)) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    var left = track.getBoundingClientRect().left
    scrub = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: left,
      captured: false,
      tick: ticks[indexAt(e.clientX - left)],
    }
    scrub.tick.classList.add("is-pressed")
    if (e.pointerType === "mouse") e.preventDefault()
  }

  function onTrackMove(e) {
    if (!scrub || e.pointerId !== scrub.id) return
    if (!scrub.captured) {
      var dx = Math.abs(e.clientX - scrub.x)
      var dy = Math.abs(e.clientY - scrub.y)
      if (dx > RULER_TAP_SLOP && dx > dy) {
        scrub.captured = true
        scrub.tick.classList.remove("is-pressed")
        scrub.tick = null
        pressValue = value
        try {
          track.setPointerCapture(e.pointerId)
        } catch (err) {}
        document.addEventListener("keydown", onScrubEscape, true)
      } else {
        // Vertical travel is a page scroll or a stray press, never a tap.
        if (dy > RULER_TAP_SLOP) endScrub()
        return
      }
    }
    if (change(valueOf(indexAt(e.clientX - scrub.left)))) {
      spring.retarget(xOf(value))
      follow()
    }
  }

  function onTrackUp(e) {
    if (!scrub || e.pointerId !== scrub.id) return
    var was = endScrub()
    if (!was.captured && change(valueOf(indexAt(was.x - was.left)))) {
      spring.retarget(xOf(value))
      follow()
    }
    keys.commit()
  }

  // Before capture nothing changed; a scrub keeps the detent it reached.
  function onTrackCancel(e) {
    if (!scrub || e.pointerId !== scrub.id) return
    var was = endScrub()
    if (was.captured) keys.commit()
  }

  internal.listen(track, "pointerdown", onTrackDown)
  internal.listen(track, "pointermove", onTrackMove)
  internal.listen(track, "pointerup", onTrackUp)
  internal.listen(track, "pointercancel", onTrackCancel)
  internal.listen(track, "lostpointercapture", onTrackCancel)

  /* ---------- size ---------- */

  function measure() {
    resizeFrame = 0
    var w = track.clientWidth
    if (!(w > 0) || w === width) return
    width = w
    sp = (w - 2 * RULER_INSET) / (count - 1)
    if (drag.held() || (scrub && scrub.captured)) return
    loop.stop()
    spring.set(xOf(value))
    pos = spring.value
    render()
  }

  var observer = new ResizeObserver(function () {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(measure)
  })
  observer.observe(track)
  internal.own(function () {
    observer.disconnect()
    if (resizeFrame) cancelAnimationFrame(resizeFrame)
    endScrub()
  })
  measure()

  function setDisabled(flag) {
    var next = !!flag
    if (next === disabled) return
    disabled = next
    control.classList.toggle("is-disabled", next)
    if (next) {
      endScrub()
      drag.setDisabled(true)
      settle(0)
    } else {
      drag.setDisabled(false)
    }
  }

  return {
    el: control,
    handle: handle,
    get: function () {
      return value
    },
    set: function (v, opts) {
      value = valueOf(indexOfValue(Number(v)))
      keys.reset(value)
      if (opts && opts.animate) {
        spring.retarget(xOf(value))
        follow()
      } else {
        loop.stop()
        spring.set(xOf(value))
        pos = spring.value
        render()
      }
    },
    setDisabled: setDisabled,
  }
}
