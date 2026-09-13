import assert from "node:assert/strict"
import { test } from "node:test"
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
    { name: "demo", status: "live", adapter: null, style: "--fig-aspect:16 / 7", cites: ["320"] },
  ],
  ["gone", { name: "gone", status: "strip", adapter: null, style: "", cites: [] }],
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
      '<div class="essay-fig__stage" role="img" aria-label="A mass at rest"><p class="essay-fig__fallback">A mass at rest <span class="essay-fig__nojs">Live figure. It needs JavaScript.</span></p></div>',
      '<div class="essay-fig__rail"></div>',
      '<figcaption class="essay-fig__caption"><span class="essay-fig__look">Look for</span> Watch &lt;the&gt; mass</figcaption>',
      '<p class="essay-fig__model"><span class="essay-fig__model-label">Model</span> m = 1</p>',
      "</figure>",
    ].join("\n"),
  )
})

test("title and model line are omitted when the marker has none", () => {
  const out = replaceMarkers(essay, registry)
  const second = out.slice(out.indexOf('id="fig-2"'))
  const block = second.slice(0, second.indexOf("</figure>"))
  assert.ok(!block.includes("essay-fig__title"))
  assert.ok(!block.includes("essay-fig__model"))
})

test("zh pages get zh frame labels", () => {
  const html = renderFigure(
    { name: "demo", attrs: { caption: "质量怎样停下", alt: "静止的质量", model: "m = 1" } },
    3,
    registry.get("demo"),
    localeFor("zh-Hans"),
  )
  assert.ok(html.includes('<span class="essay-fig__num">图 3</span>'))
  assert.ok(html.includes('<span class="essay-fig__look">留意</span> 质量怎样停下'))
  assert.ok(html.includes('<span class="essay-fig__model-label">模型</span> m = 1'))
  assert.ok(html.includes('<span class="essay-fig__nojs">交互图，需要启用 JavaScript。</span>'))
  assert.equal(localeFor("en"), localeFor(undefined))
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

test("registry: pre-shell widgets use the adapter; fixtures need the flag", () => {
  const plain = loadRegistry(undefined, false)
  for (const name of ["spring-zeta", "zeta-triptych", "squircle-compare", "curvature-comb"]) {
    assert.equal(plain.get(name)?.status, "live", name)
    assert.equal(plain.get(name)?.adapter, "root", name)
  }
  assert.equal(plain.get("hinge-diagram")?.status, "strip")
  assert.ok(plain.get("spring-zeta").cites.includes("320"))
  assert.equal(plain.has("fixture"), false)
  assert.equal(loadRegistry(undefined, true).get("fixture")?.status, "live")
})
