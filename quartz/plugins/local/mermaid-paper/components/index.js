/**
 * The single Mermaid renderer. OFM's own mermaid pass is off (mermaid: false),
 * so fences arrive as syntax-highlighted code[data-language="mermaid"] blocks.
 * Sources are read synchronously when a page mounts, rendered off-DOM with
 * theme "base" and the site tokens, and each block is swapped once for a
 * .mermaid-paper container. themechange re-renders from the kept sources.
 *
 * A diagram always fits its column. When fitting shrinks its smallest label
 * below MIN_LABEL_PX, the container becomes a button that opens the diagram
 * in a full-screen viewer, where it fits the screen if it can stay legible and
 * pans otherwise. That is what a phone shows for any diagram wider than it.
 */

function mermaidPaper() {
  var MERMAID_URL = "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs"

  var TOKEN_VARS = [
    "--canvas-color",
    "--surface-color",
    "--surface-subtle-color",
    "--ink-color",
    "--ink-muted-color",
    "--line-color",
    "--line-strong-color",
    "--font-interface",
    "--font-body",
    "--font-ui",
  ]

  function tokens() {
    var style = window.getComputedStyle(document.documentElement)
    var out = {}
    for (var i = 0; i < TOKEN_VARS.length; i++) {
      out[TOKEN_VARS[i]] = style.getPropertyValue(TOKEN_VARS[i]).trim()
    }
    return out
  }

  // Quartz core aliases --font-interface to the body font until the type tokens
  // define it, so an interface font equal to the body font means --font-ui.
  function interfaceFont(t) {
    var iface = t["--font-interface"]
    if (!iface || iface === t["--font-body"]) return t["--font-ui"] || iface || "sans-serif"
    return iface
  }

  function themeVariables(t) {
    return {
      darkMode: document.documentElement.getAttribute("saved-theme") === "dark",
      background: t["--canvas-color"] || "#faf9f6",
      fontFamily: interfaceFont(t),
      fontSize: "13px",
      primaryColor: t["--surface-color"] || "#f2f1ee",
      primaryTextColor: t["--ink-color"] || "#34312e",
      primaryBorderColor: t["--line-strong-color"] || "#c9c3bb",
      secondaryColor: t["--surface-subtle-color"] || "#f7f6f3",
      tertiaryColor: t["--surface-subtle-color"] || "#f7f6f3",
      lineColor: t["--ink-muted-color"] || "#6f6b66",
      arrowheadColor: t["--ink-muted-color"] || "#6f6b66",
      textColor: t["--ink-color"] || "#34312e",
      mainBkg: t["--surface-color"] || "#f2f1ee",
      nodeBorder: t["--line-strong-color"] || "#c9c3bb",
      clusterBkg: t["--surface-subtle-color"] || "#f7f6f3",
      clusterBorder: t["--line-color"] || "#ddd9d2",
      titleColor: t["--ink-muted-color"] || "#6f6b66",
      edgeLabelBackground: t["--canvas-color"] || "#faf9f6",
      nodeTextColor: t["--ink-color"] || "#34312e",
      tertiaryTextColor: t["--ink-muted-color"] || "#6f6b66",
      secondaryTextColor: t["--ink-color"] || "#34312e",
      secondaryBorderColor: t["--line-color"] || "#ddd9d2",
      tertiaryBorderColor: t["--line-color"] || "#ddd9d2",
      noteBkgColor: t["--surface-color"] || "#f2f1ee",
      noteTextColor: t["--ink-color"] || "#34312e",
      noteBorderColor: t["--line-color"] || "#ddd9d2",
      actorBkg: t["--surface-color"] || "#f2f1ee",
      actorBorder: t["--line-strong-color"] || "#c9c3bb",
      actorTextColor: t["--ink-color"] || "#34312e",
      actorLineColor: t["--ink-muted-color"] || "#6f6b66",
      signalColor: t["--ink-muted-color"] || "#6f6b66",
      signalTextColor: t["--ink-color"] || "#34312e",
      labelBoxBkgColor: t["--canvas-color"] || "#faf9f6",
      labelBoxBorderColor: t["--line-color"] || "#ddd9d2",
      labelTextColor: t["--ink-color"] || "#34312e",
      loopTextColor: t["--ink-muted-color"] || "#6f6b66",
      activationBorderColor: t["--line-strong-color"] || "#c9c3bb",
      activationBkgColor: t["--surface-subtle-color"] || "#f7f6f3",
      sequenceNumberColor: t["--canvas-color"] || "#faf9f6",
    }
  }

  // What themeVariables cannot express. It sits in the SVG's own style
  // element, so mermaid measures labels with it applied.
  var THEME_CSS = [
    ".node rect,.node circle,.node ellipse,.node polygon,.node path{filter:none!important;stroke-width:1.15px}",
    ".flowchart-link,.edgePath .path{stroke-width:1.15px}",
    ".cluster rect{rx:4;ry:4}",
    ".nodeLabel{font-weight:500}",
    ".cluster-label .nodeLabel{font-size:12.5px;font-weight:600}",
  ].join("")

  // The smallest label size a diagram is read at. Below it, the column's copy
  // offers the full-size viewer.
  var MIN_LABEL_PX = 12

  var STRINGS = {
    en: {
      region: "Diagram",
      open: "Diagram. Open at full size",
      hint: "Full size",
      close: "Close",
      zoomIn: "Tap the diagram to zoom in",
      zoomOut: "Tap to fit the screen",
    },
    zh: {
      region: "图表",
      open: "图表，点按查看原图",
      hint: "查看原图",
      close: "关闭",
      zoomIn: "点按图表放大",
      zoomOut: "点按适配屏幕",
    },
  }

  function strings() {
    return /^zh(-|$)/i.test((document.body && document.body.lang) || "") ? STRINGS.zh : STRINGS.en
  }

  // The smallest label's size at the diagram's own scale, in CSS pixels. Mermaid
  // sizes a flowchart to its container (width 100%, max-width the viewBox
  // width), so on screen every label is this times the rendered/viewBox ratio.
  function smallestLabel(svg) {
    var smallest = Infinity
    var walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT)
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var parent = node.parentElement
      if (!parent || !node.nodeValue.trim() || parent.closest("style, title, desc")) continue
      var size = parseFloat(window.getComputedStyle(parent).fontSize)
      if (size > 0 && size < smallest) smallest = size
    }
    return smallest === Infinity ? 0 : smallest
  }

  // Marks a container whose diagram the column has shrunk past legibility, and
  // makes it the button that opens the viewer. Re-run whenever its width changes.
  function fit(box) {
    var svg = box.querySelector(":scope > svg")
    var viewBox = svg && svg.viewBox && svg.viewBox.baseVal
    if (!viewBox || !viewBox.width) return
    if (!box.dataset.smallest) box.dataset.smallest = String(smallestLabel(svg))
    var smallest = Number(box.dataset.smallest)
    var scale = svg.getBoundingClientRect().width / viewBox.width
    var shrunk = smallest > 0 && smallest * scale < MIN_LABEL_PX - 0.25
    var text = strings()
    if (shrunk === box.hasAttribute("data-zoom")) return
    if (shrunk) {
      box.setAttribute("data-zoom", "")
      box.setAttribute("data-hint", text.hint)
      box.setAttribute("role", "button")
      box.setAttribute("aria-label", text.open)
      box.tabIndex = 0
    } else {
      box.removeAttribute("data-zoom")
      box.removeAttribute("data-hint")
      box.setAttribute("role", "group")
      box.setAttribute("aria-label", text.region)
      box.removeAttribute("tabindex")
    }
  }

  var resizer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) fit(entries[i].target)
        })
      : null

  // --- the full-size viewer ------------------------------------------------------
  // The diagram itself moves into a modal dialog and back, so its ids and the
  // style rules scoped to them stay unique. The column keeps the box's height
  // while it is away.
  //
  // It opens fitted to the screen, so the whole diagram is in view. Where that
  // is still too small to read, a tap zooms to the size at which the smallest
  // label reads at MIN_LABEL_PX, keeping the tapped spot under the finger, and
  // the stage pans; another tap fits it again.
  var viewer = null

  function openViewer(box) {
    var svg = box.querySelector(":scope > svg")
    var viewBox = svg && svg.viewBox && svg.viewBox.baseVal
    if (viewer || !viewBox || !viewBox.width || typeof HTMLDialogElement !== "function") return
    var text = strings()
    var smallest = Number(box.dataset.smallest) || MIN_LABEL_PX
    var readable = Math.min(viewBox.width, Math.ceil((viewBox.width * MIN_LABEL_PX) / smallest))

    var dialog = document.createElement("dialog")
    dialog.className = "mermaid-viewer"
    dialog.setAttribute("aria-label", text.region)
    var stage = document.createElement("div")
    stage.className = "mermaid-viewer-stage"
    var close = document.createElement("button")
    close.type = "button"
    close.className = "mermaid-viewer-close"
    close.setAttribute("aria-label", text.close)
    close.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    var hint = document.createElement("p")
    hint.className = "mermaid-viewer-hint"

    box.style.minHeight = box.offsetHeight + "px"
    stage.appendChild(svg)
    dialog.appendChild(stage)
    dialog.appendChild(close)
    dialog.appendChild(hint)
    document.body.appendChild(dialog)
    document.documentElement.classList.add("mermaid-viewing")
    viewer = { dialog: dialog, box: box, svg: svg }

    var zoomed = false
    function zoomable() {
      return readable > svg.getBoundingClientRect().width + 1 || zoomed
    }
    function sync() {
      var can = zoomable()
      stage.setAttribute("data-zoom", can ? (zoomed ? "in" : "out") : "none")
      hint.hidden = !can
      hint.textContent = zoomed ? text.zoomOut : text.zoomIn
    }

    close.addEventListener("click", closeViewer)
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault()
      closeViewer()
    })
    dialog.addEventListener("click", function (event) {
      // A click on the backdrop or the empty stage closes it.
      if (event.target === dialog || event.target === stage) return closeViewer()
      if (!svg.contains(event.target) || !zoomable()) return
      var before = svg.getBoundingClientRect()
      var rx = (event.clientX - before.left) / before.width
      var ry = (event.clientY - before.top) / before.height
      zoomed = !zoomed
      if (zoomed) svg.style.minWidth = readable + "px"
      else svg.style.removeProperty("min-width")
      var after = svg.getBoundingClientRect()
      stage.scrollLeft += after.left + rx * after.width - event.clientX
      stage.scrollTop += after.top + ry * after.height - event.clientY
      sync()
    })
    dialog.showModal()
    sync()
    close.focus({ preventScroll: true })
  }

  function closeViewer() {
    if (!viewer) return
    var v = viewer
    viewer = null
    v.svg.style.removeProperty("min-width")
    // A theme change while it was open re-rendered the box; keep the new one.
    if (v.box.isConnected && !v.box.querySelector(":scope > svg")) v.box.appendChild(v.svg)
    v.box.style.removeProperty("min-height")
    if (v.dialog.open) v.dialog.close()
    v.dialog.remove()
    document.documentElement.classList.remove("mermaid-viewing")
    if (v.box.isConnected) {
      fit(v.box)
      if (v.box.hasAttribute("data-zoom")) v.box.focus({ preventScroll: true })
    }
  }

  // Taken on the document: micromorph can hand a node to another element after
  // a navigation, and a listener on the node would go with it.
  document.addEventListener("click", function (event) {
    var box =
      event.target && event.target.closest
        ? event.target.closest(".mermaid-paper[data-zoom]")
        : null
    if (box) openViewer(box)
  })
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return
    var box = event.target
    if (!box || !box.matches || !box.matches(".mermaid-paper[data-zoom]")) return
    event.preventDefault()
    openViewer(box)
  })
  document.addEventListener("prenav", closeViewer)

  var loading = null
  var items = []
  var captured = new WeakSet()
  var generation = 0
  var queue = Promise.resolve()
  var seq = 0
  var listening = false
  var cleanupQueued = false

  function loadMermaid() {
    if (!loading) {
      loading = import(MERMAID_URL).then(
        function (mod) {
          return mod.default
        },
        function (err) {
          loading = null
          throw err
        },
      )
    }
    return loading
  }

  function config() {
    return {
      startOnLoad: false,
      securityLevel: "loose",
      suppressErrorRendering: true,
      theme: "base",
      look: "classic",
      themeVariables: themeVariables(tokens()),
      themeCSS: THEME_CSS,
      flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
    }
  }

  async function renderPass(batch, gen) {
    var api = await loadMermaid()
    if (gen !== generation) return
    api.initialize(config())
    var results = []
    for (var i = 0; i < batch.length; i++) {
      var result = null
      try {
        // Fresh ids: render() removes any element that already has the id.
        result = await api.render("mermaid-paper-" + ++seq, batch[i].source)
      } catch (err) {
        // Navigation morphs <body> and drops mermaid's measuring node, so a
        // superseded pass can throw; only the current pass reports.
        if (gen === generation) console.error("mermaid-paper: diagram failed to render", err)
      }
      if (gen !== generation) return
      results.push(result)
    }
    // Swap in one go so the page reflows once per pass.
    for (var j = 0; j < batch.length; j++) {
      var item = batch[j]
      var res = results[j]
      if (!res) showSource(item)
      if (!res || !item.el.isConnected) continue
      if (!item.box) {
        item.box = document.createElement("div")
        item.box.className = "mermaid-paper"
        item.box.setAttribute("role", "group")
        item.box.setAttribute("aria-label", strings().region)
      }
      item.box.innerHTML = res.svg
      delete item.box.dataset.smallest
      if (item.el !== item.box) {
        item.el.replaceWith(item.box)
        item.el = item.box
      }
      if (res.bindFunctions) res.bindFunctions(item.box)
    }
    // Every render replaces the SVG, so the fit is decided again, and again
    // whenever the column's width changes.
    for (var k = 0; k < batch.length; k++) {
      var box = batch[k].box
      if (!results[k] || !box || !box.isConnected) continue
      fit(box)
      if (resizer) resizer.observe(box)
    }
  }

  // A newer pass (theme toggle, decrypted content, navigation) supersedes any
  // pass still in flight; passes run one at a time because initialize() is global.
  function schedule() {
    var gen = ++generation
    var batch = items.slice()
    queue = queue
      .then(function () {
        return renderPass(batch, gen)
      })
      .catch(function (err) {
        console.error("mermaid-paper: render pass failed", err)
        if (gen === generation) batch.forEach(showSource)
      })
  }

  // A fence waiting for its diagram keeps its space with the source hidden
  // (_mermaid.scss). Only mount() sets the mark, so with JavaScript off the
  // source shows as written; a failed import or render takes the mark off.
  var PENDING = "data-mermaid-pending"

  function showSource(item) {
    if (item.el !== item.box) item.el.removeAttribute(PENDING)
  }

  function unmount() {
    generation++
    closeViewer()
    if (resizer) resizer.disconnect()
    items = []
    captured = new WeakSet()
    cleanupQueued = false
    if (listening) {
      listening = false
      document.removeEventListener("themechange", schedule)
    }
  }

  function mount() {
    var codes = document.querySelectorAll('.center code[data-language="mermaid"]')
    var found = false
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i]
      if (captured.has(code)) continue
      captured.add(code)
      var source = code.textContent.trim()
      if (!source) continue
      var el = code.closest("figure[data-rehype-pretty-code-figure]") || code.closest("pre") || code
      el.setAttribute(PENDING, "")
      items.push({ el: el, source: source, box: null })
      found = true
    }
    if (!items.length) return
    if (!listening) {
      listening = true
      document.addEventListener("themechange", schedule)
    }
    // The SPA router loads after this script, so on a full load the cleanup is
    // registered by the router's first nav event.
    if (!cleanupQueued && typeof window.addCleanup === "function") {
      cleanupQueued = true
      window.addCleanup(unmount)
    }
    if (found) schedule()
  }

  document.addEventListener("nav", mount)
  document.addEventListener("render", mount)
  mount()
}

const script = "(" + mermaidPaper.toString() + ")()"

const MermaidPaper = () => {
  const Component = () => null
  Component.afterDOMLoaded = script
  return Component
}

export { MermaidPaper }
