/**
 * After Quartz OFM renders Mermaid, re-init with theme "base" + paper tokens.
 * Keeps diagrams on the site palette in both light and dark; no motion.
 */

function mermaidPaper() {
  var TOKEN_VARS = [
    "--canvas-color",
    "--surface-color",
    "--surface-subtle-color",
    "--ink-color",
    "--ink-strong-color",
    "--ink-muted-color",
    "--line-color",
    "--line-strong-color",
    "--accent-color",
    "--font-ui",
    "--font-body",
  ]

  function cssVar(name) {
    return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  function tokens() {
    var out = {}
    for (var i = 0; i < TOKEN_VARS.length; i++) {
      out[TOKEN_VARS[i]] = cssVar(TOKEN_VARS[i])
    }
    return out
  }

  function themeVariables(t) {
    return {
      darkMode: document.documentElement.getAttribute("saved-theme") === "dark",
      background: t["--canvas-color"] || "#faf9f6",
      fontFamily: t["--font-ui"] || "sans-serif",
      fontSize: "13px",
      primaryColor: t["--surface-color"] || "#f2f1ee",
      primaryTextColor: t["--ink-color"] || "#34312e",
      primaryBorderColor: t["--line-strong-color"] || "#c9c3bb",
      secondaryColor: t["--surface-subtle-color"] || "#f7f6f3",
      tertiaryColor: t["--surface-subtle-color"] || "#f7f6f3",
      lineColor: t["--ink-muted-color"] || "#6f6b66",
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

  var themeCSS = [
    ".node rect,.node circle,.node ellipse,.node polygon{filter:none!important}",
    ".edgePath .path{stroke-width:1.15px}",
    ".cluster rect{rx:4;ry:4}",
  ].join("")

  var mermaidMod = null
  var sources = new WeakMap()
  var timer = null

  function collectNodes() {
    var center = document.querySelector(".center")
    if (!center) return []
    return Array.prototype.slice.call(center.querySelectorAll("code.mermaid"))
  }

  async function ensureMermaid() {
    if (mermaidMod) return mermaidMod
    mermaidMod = await import("https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs")
    return mermaidMod
  }

  async function restyle() {
    var nodes = collectNodes()
    if (!nodes.length) return
    for (var i = 0; i < nodes.length; i++) {
      if (!sources.has(nodes[i])) sources.set(nodes[i], nodes[i].innerText)
    }
    var mod = await ensureMermaid()
    var api = mod.default
    var t = tokens()
    api.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      look: "classic",
      themeVariables: themeVariables(t),
      themeCSS: themeCSS,
      flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
    })
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j]
      n.removeAttribute("data-processed")
      var src = sources.get(n)
      if (src) n.innerHTML = src
    }
    await api.run({ nodes: nodes })
  }

  function schedule() {
    if (timer) window.clearTimeout(timer)
    // Run after OFM's bundled mermaid handler finishes its pass.
    timer = window.setTimeout(function () {
      restyle().catch(function () {})
    }, 80)
  }

  document.addEventListener("nav", schedule)
  document.addEventListener("render", schedule)
  document.addEventListener("themechange", schedule)
  schedule()
}

const script = "(" + mermaidPaper.toString() + ")()"

const MermaidPaper = () => {
  const Component = () => null
  Component.afterDOMLoaded = script
  return Component
}

export { MermaidPaper }
