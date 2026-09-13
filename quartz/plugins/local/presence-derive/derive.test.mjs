import test, { describe } from "node:test"
import assert from "node:assert"
import { countWords, htmlPlugins, markdownPlugins } from "./derive.js"

const text = (value) => ({ type: "text", value })
const el = (tagName, properties, ...children) => ({
  type: "element",
  tagName,
  properties,
  children: children.map((child) => (typeof child === "string" ? text(child) : child)),
})
const root = (...children) => ({ type: "root", children })
// Stand-in prose of exactly n words.
const prose = (n) => Array.from({ length: n }, (_, i) => `w${i + 1}`).join(" ")
// A heading as GFM leaves it: slug id plus an appended icon-only anchor.
const h2 = (id, title) =>
  el("h2", { id }, title, el("a", { href: `#${id}` }, el("svg", {}, el("path", { d: "M0 0" }))))

function derive(tree, data, allSlugs = []) {
  const ctx = { allSlugs }
  const file = { data: { frontmatter: {}, ...data } }
  for (const attach of markdownPlugins(ctx)) attach()(root(), file)
  for (const attach of htmlPlugins(ctx)) attach()(tree, file)
  return file
}

describe("presence-derive", () => {
  test("an essay with an intro, 3 h2 and 2 figures", () => {
    const tree = root(
      el("p", {}, prose(60)),
      text("\n"),
      { type: "comment", value: " interactive:unregistered " },
      el("div", { className: ["essay-interactive"], dataInteractive: "spring-zeta" }),
      h2("springs", "Springs"),
      el("p", {}, prose(40)),
      el(
        "figure",
        {
          className: ["essay-fig"],
          id: "fig-2",
          dataInteractive: "zeta-triptych",
          dataFigure: "2",
        },
        el(
          "div",
          { className: ["essay-fig__head"] },
          el("span", { className: ["essay-fig__num"] }, "Fig. 2"),
          el("span", { className: ["essay-fig__title"] }, "Three dampings"),
        ),
        el(
          "div",
          { className: ["essay-fig__stage"] },
          el("p", { className: ["essay-fig__fallback"] }, "Live figure. It needs JavaScript."),
        ),
        el("figcaption", { className: ["essay-fig__caption"] }, "Look for the overshoot."),
      ),
      h2("corners", "Corners"),
      el(
        "figure",
        { dataRehypePrettyCodeFigure: "" },
        el("pre", {}, el("code", {}, "G0 G1 G2 continuity notes, set as code")),
      ),
      el(
        "table",
        {},
        el("tr", {}, el("th", {}, "Ratio"), el("th", {}, "Regime")),
        el("tr", {}, el("td", {}, "Under"), el("td", {}, "Bounce")),
      ),
      el("p", {}, "Critically damped springs settle fastest."),
      h2("hinges", "Hinge torque"),
      el("p", {}, "Lift the lid with one ", el("strong", {}, "hand"), "."),
      el(
        "p",
        {},
        "The torque ",
        el("code", { className: ["language-math", "math-inline"] }, "\\tau < \\tau_{max}"),
        " holds the base.",
      ),
      el("p", {}, "The ", el("em", {}, "fast"), "est settle."),
      el("script", {}, "window.figureCount = 4"),
      el(
        "pre",
        {},
        el("code", { className: ["language-math", "math-display"] }, "\\tau = F r \\sin\\theta"),
      ),
      el(
        "section",
        { dataFootnotes: "", className: ["footnotes"] },
        el("h2", { id: "footnote-label", className: ["sr-only"] }, "Footnotes"),
        el("ol", {}, el("li", {}, el("p", {}, prose(30)))),
      ),
    )
    const file = derive(tree, {
      slug: "writing/springs",
      i18n: { lang: "en", base: "writing/springs", alternates: [] },
      links: ["writing/corners"],
    })

    assert.equal(file.data.presence.kind, "essay")
    assert.equal(file.data.frontmatter.essayFrame, true)
    assert.deepStrictEqual(file.data.presence.figures, [
      { n: 1, name: "spring-zeta", title: null },
      { n: 2, name: "zeta-triptych", title: "Three dampings" },
    ])
    // Intro 60; Springs 1 + 40; Corners 1 + 8 code + 4 cells + 5;
    // Hinge torque 2 + 6 + 7 + 3 + 4 display math. Script, figure text and footnotes add nothing.
    assert.deepStrictEqual(file.data.presence.intro, { words: 60 })
    assert.deepStrictEqual(file.data.presence.sections, [
      { id: "springs", title: "Springs", words: 41 },
      { id: "corners", title: "Corners", words: 18 },
      { id: "hinges", title: "Hinge torque", words: 22 },
    ])
    assert.equal(file.data.presence.words, 141)
    assert.deepStrictEqual(file.data.presence.figureOffsets, [60, 101])
    assert.equal(file.data.presence.readingMinutes, 1)
    assert.equal(file.data.presence.relation, null)
  })

  test("a short lead joins the first section, and a page without h2 has no sections", () => {
    const essay = derive(root(el("p", {}, prose(20)), h2("only", "Only"), el("p", {}, prose(10))), {
      slug: "writing/short",
    })
    assert.deepStrictEqual(essay.data.presence.sections, [{ id: "only", title: "Only", words: 31 }])
    assert.equal(essay.data.presence.intro, null)
    assert.equal(essay.data.presence.words, 31)

    const about = derive(root(el("p", {}, prose(401))), { slug: "about" })
    assert.equal(about.data.presence.kind, "page")
    assert.equal(about.data.frontmatter.essayFrame, false)
    assert.deepStrictEqual(about.data.presence.sections, [])
    assert.equal(about.data.presence.intro, null)
    assert.deepStrictEqual(about.data.presence.figures, [])
    assert.equal(about.data.presence.words, 401)
    assert.equal(about.data.presence.readingMinutes, 3)
  })

  test("a zh-Hans translation counts Han characters as words and reads by Han / 400", () => {
    const tree = root(
      el("p", {}, "快捷键是一种命名空间。".repeat(5)),
      h2("grammar", "共享语法"),
      el("p", {}, "按 Cmd+K 打开命令面板，再输入 Emacs 的 M-x 命令。"),
      el("p", {}, "命名空间".repeat(100)),
      h2("history", "历史"),
      el("p", {}, "从 vi 模态开始"),
      h2("practice", "练习"),
      el("p", {}, "每天练习十分钟"),
    )
    const file = derive(tree, {
      slug: "writing/keys/zh",
      i18n: {
        lang: "zh-Hans",
        base: "writing/keys",
        alternates: [{ lang: "en", slug: "writing/keys" }],
      },
      frontmatter: { title: "快捷键系统", lang: "zh-Hans" },
    })

    assert.equal(file.data.presence.kind, "essay")
    assert.equal(file.data.frontmatter.essayFrame, true)
    // Han: 50 + (4 + 13 + 400) + (2 + 5) + (2 + 7) = 483; Latin: Cmd+K, Emacs, M-x, vi.
    assert.deepStrictEqual(file.data.presence.intro, { words: 50 })
    assert.deepStrictEqual(file.data.presence.sections, [
      { id: "grammar", title: "共享语法", words: 420 },
      { id: "history", title: "历史", words: 8 },
      { id: "practice", title: "练习", words: 9 },
    ])
    assert.equal(file.data.presence.words, 487)
    // ceil(483 / 400); the same words on an English page would read 3 minutes.
    assert.equal(file.data.presence.readingMinutes, 2)
  })

  test("an essay's relation is frontmatter work, else its first works link", (t) => {
    const linked = derive(root(), {
      slug: "writing/cuda",
      links: ["writing/springs", "works/index", "works/cuda-cpp-course", "works/other"],
    })
    assert.equal(linked.data.presence.relation, "works/cuda-cpp-course")

    const named = derive(
      root(),
      {
        slug: "writing/cuda",
        frontmatter: { work: "/works/other/" },
        links: ["works/cuda-cpp-course"],
      },
      ["works/other", "works/cuda-cpp-course"],
    )
    assert.equal(named.data.presence.relation, "works/other")

    const warn = t.mock.method(console, "warn", () => {})
    const typo = derive(root(), { slug: "writing/cuda", frontmatter: { work: "works/cuda" } }, [
      "works/cuda-cpp-course",
    ])
    assert.equal(typo.data.presence.relation, "works/cuda")
    assert.equal(warn.mock.callCount(), 1)
    assert.match(warn.mock.calls[0].arguments[0], /work "works\/cuda" is not a page slug/)

    const work = derive(root(), { slug: "works/cuda-cpp-course", links: ["works/other"] })
    assert.equal(work.data.presence.relation, null)
    assert.equal(derive(root(), { slug: "writing/solo" }).data.presence.relation, null)
  })

  test("kind comes from the slug, or from the original's slug on a translation", () => {
    const zh = (base) => ({ lang: "zh-Hans", base, alternates: [] })
    const cases = [
      [{ slug: "index" }, "home"],
      [{ slug: "writing/index" }, "folder"],
      [{ slug: "works/index" }, "folder"],
      [{ slug: "writing/springs" }, "essay"],
      [{ slug: "works/spring-lab" }, "work"],
      [{ slug: "about" }, "page"],
      [{ slug: "writing/springs/zh", i18n: zh("writing/springs") }, "essay"],
      [{ slug: "writing/zh", i18n: zh("writing/index") }, "folder"],
      [{ slug: "zh", i18n: zh("index") }, "home"],
    ]
    for (const [data, kind] of cases) {
      assert.equal(derive(root(), data).data.presence.kind, kind, data.slug)
    }

    const handSet = derive(root(), { slug: "writing/springs", frontmatter: { essayFrame: false } })
    assert.equal(handSet.data.frontmatter.essayFrame, false)
  })

  test("countWords skips punctuation-only tokens and splits Han characters", () => {
    assert.deepStrictEqual(countWords("Don't stop — the G2 corner, k = 320."), { words: 7, han: 0 })
    assert.deepStrictEqual(countWords("按 Cmd+K 打开"), { words: 4, han: 3 })
    assert.deepStrictEqual(countWords("  \n "), { words: 0, han: 0 })
  })
})
