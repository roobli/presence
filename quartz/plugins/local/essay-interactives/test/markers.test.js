import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { Latex } from "@quartz-community/latex"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import {
  checkMarkers,
  loadRegistry,
  localeFor,
  renderFigure,
  replaceMarkers,
  scanMarkers,
} from "../index.js"

const registry = new Map([
  [
    "demo",
    {
      name: "demo",
      status: "live",
      stage: "img",
      style: "--fig-aspect:16 / 7",
      cites: ["320"],
    },
  ],
  [
    "chips",
    {
      name: "chips",
      status: "live",
      stage: "group",
      style: "--fig-min-h:320px",
      cites: [],
    },
  ],
  ["gone", { name: "gone", status: "strip", stage: "img", style: "", cites: [] }],
])

const essay = [
  "---",
  "title: Demo",
  "---",
  "",
  "Intro with k = 320.",
  "",
  '<!-- interactive:demo title="Spring &quot;one&quot;" caption="Watch <the> mass" alt="A mass at rest" model="m = 1" -->',
  "",
  "```md",
  "<!-- interactive:demo -->",
  "```",
  "",
  "~~~~",
  "<!-- interactive:demo -->",
  "```",
  "~~~~",
  "",
  "Write `<!-- interactive:demo -->` on its own line.",
  "",
  "<!-- interactive:gone -->",
  "",
  "<!-- interactive:unknown -->",
  "",
  '<!-- interactive:demo caption="Second" alt="Again" -->',
  "Tail paragraph.",
].join("\n")

function captureWarnings(fn) {
  const original = console.warn
  const seen = []
  console.warn = (message) => seen.push(String(message))
  try {
    fn()
  } finally {
    console.warn = original
  }
  return seen
}

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

test("live markers become figures numbered in document order", () => {
  const out = replaceMarkers(essay, registry)
  assert.deepEqual(
    [...out.matchAll(/data-figure="(\d+)"/g)].map((m) => m[1]),
    ["1", "2"],
  )
  assert.ok(
    out.includes('<figure class="essay-fig" id="fig-2" data-interactive="demo" data-figure="2"'),
  )
  assert.ok(out.includes("```md\n<!-- interactive:demo -->\n```"), "backtick fence untouched")
  assert.ok(out.includes("~~~~\n<!-- interactive:demo -->\n```\n~~~~"), "tilde fence untouched")
  assert.ok(
    out.includes("Write `<!-- interactive:demo -->` on its own line."),
    "inline code untouched",
  )
  assert.ok(!out.includes("interactive:gone"), "strip marker removed")
  assert.ok(out.includes("<!-- interactive:unknown -->"), "unregistered marker stays a comment")
  assert.ok(out.includes("</figure>\n\nTail paragraph."), "a blank line follows the block")
})

test("the figure is one HTML block in the contract markup, with escaped text", () => {
  const out = replaceMarkers(essay, registry)
  const block = out.slice(out.indexOf("<figure"), out.indexOf("</figure>") + "</figure>".length)
  assert.ok(!/\n[ \t]*\n/.test(block), "no blank line inside the block")
  assert.equal(
    block,
    [
      '<figure class="essay-fig" id="fig-1" data-interactive="demo" data-figure="1" style="--fig-aspect:16 / 7">',
      '<div class="essay-fig__head"><span class="essay-fig__num">Fig. 1</span><span class="essay-fig__title">Spring &quot;one&quot;</span></div>',
      '<div class="essay-fig__stage" role="img" aria-label="A mass at rest"><div class="essay-fig__box"><p class="essay-fig__fallback">A mass at rest <span class="essay-fig__nojs">Live figure. It needs JavaScript.</span></p></div></div>',
      '<div class="essay-fig__rail"></div>',
      '<figcaption class="essay-fig__caption"><span class="essay-fig__look">Look for</span>Watch &lt;the&gt; mass</figcaption>',
      '<p class="essay-fig__model"><span class="essay-fig__model-label">Model</span>m = 1</p>',
      "</figure>",
    ].join("\n"),
  )
})

test("no space text node follows the Look for and Model labels", () => {
  const html = renderFigure(
    { name: "demo", attrs: { caption: "the settle", alt: "At rest", model: "k = 320" } },
    1,
    registry.get("demo"),
  )
  assert.ok(!/essay-fig__look">[^<]*<\/span>\s/.test(html))
  assert.ok(!/essay-fig__model-label">[^<]*<\/span>\s/.test(html))
})

test("title and model line are omitted when the marker has none", () => {
  const out = replaceMarkers(essay, registry)
  const second = out.slice(out.indexOf('id="fig-2"'))
  const block = second.slice(0, second.indexOf("</figure>"))
  assert.ok(!block.includes("essay-fig__title"))
  assert.ok(!block.includes("essay-fig__model"))
})

test("a group stage is marked for the shell and keeps the img fallback before scripts run", () => {
  const html = renderFigure(
    { name: "chips", attrs: { title: "Prefix tree", caption: "c", alt: "A tree of keys" } },
    4,
    registry.get("chips"),
  )
  assert.ok(
    html.startsWith(
      '<figure class="essay-fig" id="fig-4" data-interactive="chips" data-figure="4" data-stage="group" style="--fig-min-h:320px">',
    ),
  )
  assert.ok(
    html.includes(
      '<div class="essay-fig__stage" role="img" aria-label="A tree of keys"><div class="essay-fig__box">',
    ),
  )
  assert.ok(
    !renderFigure({ name: "demo", attrs: {} }, 1, registry.get("demo")).includes("data-stage"),
  )
})

test("zh pages get zh frame labels", () => {
  const html = renderFigure(
    { name: "demo", attrs: { caption: "质量怎样停下", alt: "静止的质量", model: "m = 1" } },
    3,
    registry.get("demo"),
    localeFor("zh-Hans"),
  )
  assert.ok(html.includes('<span class="essay-fig__num">图 3</span>'))
  assert.ok(html.includes('<span class="essay-fig__look">留意</span>质量怎样停下'))
  assert.ok(html.includes('<span class="essay-fig__model-label">模型</span>m = 1'))
  assert.ok(html.includes('<span class="essay-fig__nojs">交互图，需要启用 JavaScript。</span>'))
  assert.equal(localeFor("en"), localeFor(undefined))
})

test("marker text with $, brackets and 「」 stays one raw HTML block that math never parses", () => {
  const src = [
    "Inline $k = 320$ outside a figure is math.",
    "",
    '<!-- interactive:demo title="Keys $mod and c$" caption="Press $mod, then c$; see $x$, [32][33], 「32」, (tid & 31) and in[i * stride]." alt="A prefix key $mod and $x$ [32]" model="$$E = mc^2$$ with k = 320" -->',
    "",
    "Tail with [32][33].",
  ].join("\n")
  const latex = Latex({ renderEngine: "katex" })
  const md = unified().use(remarkParse).use(latex.markdownPlugins())
  const mdast = md.runSync(md.parse(replaceMarkers(src, registry)))

  const figures = []
  const math = []
  walk(mdast, (node) => {
    if (node.type === "html" && node.value.includes("<figure")) figures.push(node)
    if (node.type === "inlineMath" || node.type === "math") math.push(node)
  })
  assert.equal(figures.length, 1, "the figure is a single html node")
  assert.ok(figures[0].value.startsWith('<figure class="essay-fig"'))
  assert.ok(figures[0].value.endsWith("</figure>"))
  assert.ok(figures[0].value.includes("(tid &amp; 31) and in[i * stride]"))
  assert.ok(figures[0].value.includes("Keys $mod and c$"))
  assert.deepEqual(
    math.map((node) => node.value),
    ["k = 320"],
    "only the paragraph outside the figure holds math",
  )

  const html = unified().use(remarkRehype, { allowDangerousHtml: true }).use(latex.htmlPlugins())
  const hast = html.runSync(mdast)
  let katex = 0
  const raw = []
  walk(hast, (node) => {
    const names = node.properties?.className
    if (Array.isArray(names) && names.includes("katex")) katex++
    if (node.type === "raw" && node.value.includes('<figure class="essay-fig"'))
      raw.push(node.value)
  })
  assert.ok(katex > 0, "math outside the figure renders, so the check can see katex")
  assert.equal(raw.length, 1)
  assert.ok(!raw[0].includes("katex"), "no .katex inside figure.essay-fig")
})

test("build warnings: missing caption, alt, cites, unknown names and loose markers", () => {
  const src = [
    "<!-- interactive:demo -->",
    "",
    '<!-- interactive:demo caption="c" alt="a" colour="red" -->',
    "",
    "<!-- interactive:nope -->",
    "",
    "Text <!-- interactive:demo --> inline.",
  ].join("\n")
  let live
  const warnings = captureWarnings(() => {
    live = checkMarkers(src, registry, (line) => `essay.md:${line + 1}`)
  })
  assert.equal(live.length, 2)
  const text = warnings.join("\n")
  assert.match(text, /essay\.md:1: figure "demo" has no caption/)
  assert.match(text, /essay\.md:1: figure "demo" has no alt/)
  assert.match(text, /essay\.md:1: figure "demo" shows 320/)
  assert.match(text, /essay\.md:3: "demo" has unknown attribute colour/)
  assert.match(text, /essay\.md:5: no widgets\/nope\.json/)
  assert.match(text, /essay\.md:7: a figure marker must be alone on its line/)
})

test("a marker whose cites occur in the essay or its attributes stays quiet", () => {
  const src = '<!-- interactive:demo caption="c" alt="a" model="k = 320" -->'
  const warnings = captureWarnings(() => checkMarkers(src, registry, (line) => `x:${line + 1}`))
  assert.deepEqual(warnings, [])
})

test("markers in frontmatter are ignored", () => {
  const { markers } = scanMarkers("---\nnote: <!-- interactive:demo -->\n---\n\nBody")
  assert.equal(markers.length, 0)
})

test("registry: the apple figures are live group stages; fixtures need the flag; stage defaults to img", () => {
  const plain = loadRegistry(undefined, false)
  for (const name of ["spring-throw", "zeta-triptych", "curvature-comb"]) {
    assert.equal(plain.get(name)?.status, "live", name)
    assert.equal(plain.get(name)?.stage, "group", name)
  }
  assert.equal(plain.get("hinge-diagram")?.status, "strip")
  assert.deepEqual(plain.get("spring-throw").cites, ["250"])
  assert.equal(plain.has("fixture"), false)
  const fixtures = loadRegistry(undefined, true)
  assert.equal(fixtures.get("fixture")?.status, "live")
  assert.equal(fixtures.get("fixture")?.stage, "group")
  assert.equal(fixtures.get("fixture-img")?.stage, "img")
  assert.match(fixtures.get("fixture").style, /--fig-min-h:240px;--fig-min-h-narrow:300px/)
  assert.ok(
    !fixtures.get("fixture").style.includes("--fig-aspect"),
    "minHeight figures get no default aspect",
  )
})

test("registry: an unknown stage value warns and falls back to img", () => {
  const dir = mkdtempSync(join(tmpdir(), "essay-fig-registry-"))
  try {
    writeFileSync(
      join(dir, "odd.json"),
      JSON.stringify({ name: "odd", status: "live", stage: "canvas" }),
    )
    let entries
    const warnings = captureWarnings(() => {
      entries = loadRegistry(pathToFileURL(dir + "/"), false)
    })
    assert.equal(entries.get("odd").stage, "img")
    assert.match(warnings.join("\n"), /widgets\/odd\.json: stage must be "img" or "group"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
