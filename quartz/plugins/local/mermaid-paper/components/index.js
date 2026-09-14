/**
 * The single Mermaid renderer. OFM's own mermaid pass is off (mermaid: false),
 * so fences arrive as syntax-highlighted code[data-language="mermaid"] blocks.
 * Sources are read synchronously when a page mounts, rendered off-DOM with
 * theme "base" and the site tokens, and each block is swapped once for a
 * .mermaid-paper container, which scrolls a diagram too wide for the column.
 * themechange re-renders from the kept sources.
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

  // Labels never render smaller than this. A diagram that would have to shrink
  // below it keeps its width and scrolls inside its container instead.
  var MIN_LABEL_PX = 12

  // The container can scroll, so it takes focus and needs a name.
  var REGION_LABEL = { en: "Diagram, scrolls sideways", zh: "图表，可横向滚动" }

  function regionLabel() {
    return /^zh(-|$)/i.test((document.body && document.body.lang) || "")
      ? REGION_LABEL.zh
      : REGION_LABEL.en
  }

  // Mermaid sizes a flowchart to its container (width 100%, max-width the
  // viewBox width), so a narrow column scales every label down with it. A
  // min-width at the scale that draws the smallest label at MIN_LABEL_PX stops
  // the shrinking; the viewBox width caps it. The column itself still sets the
  // width above that, so sidebar drags and resizes need no script.
  function holdLabelSize(box) {
    var svg = box.querySelector(":scope > svg")
    var viewBox = svg && svg.viewBox && svg.viewBox.baseVal
    if (!viewBox || !viewBox.width) return
    var smallest = Infinity
    var walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT)
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var parent = node.parentElement
      if (!parent || !node.nodeValue.trim() || parent.closest("style, title, desc")) continue
      var size = parseFloat(window.getComputedStyle(parent).fontSize)
      if (size > 0 && size < smallest) smallest = size
    }
    if (smallest === Infinity) return
    var width = Math.min(viewBox.width, Math.ceil((viewBox.width * MIN_LABEL_PX) / smallest))
    svg.style.minWidth = width + "px"
  }

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
        item.box.tabIndex = 0
        item.box.setAttribute("role", "region")
        item.box.setAttribute("aria-label", regionLabel())
      }
      item.box.innerHTML = res.svg
      if (item.el !== item.box) {
        item.el.replaceWith(item.box)
        item.el = item.box
      }
      if (res.bindFunctions) res.bindFunctions(item.box)
    }
    // Every theme re-render replaces the SVG, so its min-width is set again.
    for (var k = 0; k < batch.length; k++) {
      if (results[k] && batch[k].box && batch[k].box.isConnected) holdLabelSize(batch[k].box)
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
