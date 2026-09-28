import test, { describe } from "node:test"
import assert from "node:assert"
import { render } from "preact-render-to-string"
import { formatDate, isoDate } from "./dates.js"
import { t } from "./locale.js"
import { renderSpine, spineLength } from "./spine.js"
import {
  backlinksOf,
  claimsOf,
  entryNumber,
  renderCard,
  renderHero,
  renderLedgerRow,
  renderTitleBlock,
  seriesOf,
} from "./plates.js"
import {
  essaysForWork,
  hrefOf,
  readingMinutes,
  relatedWork,
  renderWorkRow,
  selectEssays,
  selectWorks,
} from "./rows.js"
import { PageHeader } from "../presence-header/components/index.js"
import { HomeIndex } from "../presence-index/components/index.js"
import { EndMatter } from "../presence-end/components/index.js"
import { Colophon } from "../presence-colophon/components/index.js"

// Synthetic pages in the shapes i18n-slug and presence-derive store.
const apple = {
  slug: "writing/apple",
  frontmatter: {
    title: "Apple product design as physics — springs",
    description: "Damping ratios and torque.",
    date: "2026-09-11",
  },
  i18n: { lang: "en", base: "writing/apple", alternates: [] },
  presence: {
    kind: "essay",
    figures: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
    intro: { words: 200 },
    sections: [{ words: 1000 }, { words: 1500 }, { words: 2100 }],
    figureOffsets: [100, 900, 2500, 4700],
    words: 4800,
    readingMinutes: 24,
    relation: null,
  },
}
const keyboard = {
  slug: "writing/keyboard",
  frontmatter: { title: "Keyboard shortcut systems", date: "2026-09-11" },
  i18n: { lang: "en", base: "writing/keyboard", alternates: [{ lang: "zh-Hans", slug: "writing/keyboard/zh" }] },
  presence: {
    kind: "essay",
    figures: [],
    intro: null,
    sections: [{ words: 500 }, { words: 500 }, { words: 600 }],
    figureOffsets: [],
    words: 1600,
    readingMinutes: 8,
    relation: null,
  },
}
const keyboardZh = {
  slug: "writing/keyboard/zh",
  unlisted: true,
  frontmatter: { title: "快捷键系统", date: "2026-09-11", lang: "zh-Hans" },
  i18n: { lang: "zh-Hans", base: "writing/keyboard", alternates: [{ lang: "en", slug: "writing/keyboard" }] },
  presence: { kind: "essay", figures: [], sections: [], words: 5200, readingMinutes: 13, relation: null },
}
const cuda = {
  slug: "writing/cuda",
  frontmatter: { title: "You can finish a CUDA course", date: "2026-09-10" },
  i18n: { lang: "en", base: "writing/cuda", alternates: [] },
  presence: { kind: "essay", figures: [], sections: [], words: 900, readingMinutes: 5, relation: "works/course" },
}
const course = {
  slug: "works/course",
  links: ["writing/cuda"],
  frontmatter: {
    title: "CUDA C++ Course",
    description: "Fifteen lessons.",
    date: "2026-09-11",
    live: "https://example.org/course/",
    source: "https://example.org/course.git",
    live_zh: "https://example.org/course/zh/",
    image: "works/course-home.webp",
    image_alt: "Course home page",
  },
  i18n: { lang: "en", base: "works/course", alternates: [] },
  presence: { kind: "work" },
}
const writingFolder = { slug: "writing/index", frontmatter: { title: "Writing" }, presence: { kind: "folder" } }
const home = {
  slug: "index",
  frontmatter: {
    title: "RoobLi",
    description: "Fewer pages. Harder claims.",
    intro: "Public surface.",
    links: [{ label: "RSS", href: "/index.xml" }],
  },
  presence: { kind: "home" },
}
const allFiles = [keyboardZh, cuda, writingFolder, keyboard, apple, course, home]
const cfg = { pageTitle: "RoobLi" }
const props = (fileData) => ({ fileData, allFiles, cfg })

describe("dates and strings", () => {
  test("formats the literal date in both languages", () => {
    assert.equal(isoDate("2026-09-11"), "2026-09-11")
    assert.equal(isoDate(new Date("2026-09-11T00:00:00Z")), "2026-09-11")
    assert.equal(isoDate("2026-13-01"), null)
    assert.equal(formatDate("2026-09-11", "en"), "Sep 11, 2026")
    assert.equal(formatDate("2026-09-11", "zh-Hans"), "2026年9月11日")
  })

  test("reads the zh table for any zh language", () => {
    assert.equal(t("en", "minRead", { n: 24 }), "24 min read")
    assert.equal(t("zh", "minRead", { n: 8 }), "约 8 分钟")
    assert.equal(t("en", "liveFigures", { n: 1 }), "1 live figure")
    assert.equal(t("en", "liveFigures", { n: 4 }), "4 live figures")
    assert.equal(t("zh-Hans", "allWriting", { n: 3 }), "全部文章（3）")
  })
})

describe("section spine", () => {
  test("length follows reading time between a fifth and the full row", () => {
    assert.equal(spineLength(24), 0.8)
    assert.equal(spineLength(2), 0.2)
    assert.equal(spineLength(90), 1)
  })

  test("draws a segment per section and a dot per figure", () => {
    const html = render(renderSpine(apple.presence))
    assert.match(html, /style="--spine-len:0.8"/)
    assert.equal(html.match(/<i /g).length, 4)
    assert.equal(html.match(/<b /g).length, 4)
    // The fourth figure sits in the last of 4 segments, 3 gaps in.
    assert.match(html, /left:calc\(97.92% \+ 0.06 \* var\(--spine-gap\)\)/)
  })

  test("skips pages with fewer than 3 sections", () => {
    assert.equal(renderSpine(cuda.presence), null)
  })
})

describe("row data", () => {
  test("selects listed essays and works, newest first", () => {
    assert.deepStrictEqual(
      selectEssays(allFiles).map((file) => file.slug),
      ["writing/apple", "writing/keyboard", "writing/cuda"],
    )
    assert.deepStrictEqual(selectWorks(allFiles).map((file) => file.slug), ["works/course"])
  })

  test("a translation reads its original's minutes", () => {
    assert.equal(readingMinutes(keyboardZh, allFiles), 8)
    assert.equal(readingMinutes(apple, allFiles), 24)
  })

  test("relates essays and works in both directions", () => {
    assert.equal(relatedWork(cuda, allFiles), course)
    assert.equal(relatedWork(apple, allFiles), null)
    assert.deepStrictEqual(essaysForWork(course, allFiles), [cuda])
  })

  test("site paths", () => {
    assert.equal(hrefOf("index"), "/")
    assert.equal(hrefOf("writing/index"), "/writing/")
    assert.equal(hrefOf("writing/keyboard/zh"), "/writing/keyboard/zh")
  })
})

describe("rows", () => {
  const ctx = { lang: "en", allFiles }

  test("a ledger row states date, minutes and live figures", () => {
    const html = render(renderLedgerRow(apple, ctx))
    assert.match(html, /<time datetime="2026-09-11">Sep 11, 2026<\/time>/)
    assert.match(html, /24 min/)
    assert.match(html, /4 live figures/)
    assert.doesNotMatch(html, /idx-alt/)
  })

  test("only a paired essay links its translation", () => {
    const html = render(renderLedgerRow(keyboard, ctx))
    assert.match(
      html,
      /<a class="idx-alt" href="\/writing\/keyboard\/zh" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a>/,
    )
    assert.doesNotMatch(html, /live figure/)
  })

  test("on a zh page an English row says so and keeps zh chrome", () => {
    const html = render(renderLedgerRow(apple, { lang: "zh-Hans", allFiles }))
    assert.match(html, /<li class="ledger-row" lang="en">/)
    assert.match(html, /<p class="ledger-meta" lang="zh-Hans">/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /24 分钟/)
  })

  test("a work row links the site, the source, the zh site and its essay", () => {
    const html = render(renderWorkRow(course, ctx))
    assert.match(html, /<img src="\/works\/course-home.webp" width="1280" height="800" alt="Course home page"/)
    assert.match(html, /Live site/)
    assert.match(html, /中文版/)
    assert.match(html, /<a href="\/writing\/cuda">Design essay<\/a>/)
    const compact = render(renderWorkRow(course, { ...ctx, compact: true }))
    assert.match(compact, /work-row--compact/)
    assert.doesNotMatch(compact, /中文版|Design essay/)
  })
})

describe("components", () => {
  test("page header on an essay pair", () => {
    const html = render(PageHeader()(props(keyboard)))
    assert.match(html, /<p class="ph-kicker"><a href="\/writing\/">Writing<\/a>.*<span class="entry-no">No\. 002<\/span><\/p>/)
    assert.match(html, /<h1 class="article-title ph-title">Keyboard shortcut systems<\/h1>/)
    assert.match(html, /<dl class="titleblock titleblock--spec">/)
    assert.match(html, /<dt>Published<\/dt><dd><time datetime="2026-09-11">Sep 11, 2026<\/time><\/dd>/)
    assert.match(html, /<dt>Reading<\/dt><dd>8 min<\/dd>/)
    assert.doesNotMatch(html, /Live figures/)
    assert.match(html, /<dt>Language<\/dt><dd><span>English<\/span>.*<span class="ph-lang"><a href="[^"]+" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a><\/span><\/dd>/)
    assert.doesNotMatch(html, /aria-current|ph-lang-seg|<nav/)
  })

  test("page header on the translation uses zh chrome and the original's minutes", () => {
    const html = render(PageHeader()(props(keyboardZh)))
    assert.match(html, /<a href="\/writing\/">文章<\/a>/)
    assert.match(html, /No\. 002/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /<dt>阅读<\/dt><dd>8 分钟<\/dd>/)
    assert.match(html, /<span class="ph-lang"><a href="\/writing\/keyboard" lang="en" hreflang="en" rel="alternate">English<\/a><\/span>/)
  })

  test("page header: nothing on home, title only on a folder", () => {
    assert.equal(render(PageHeader()(props(home))), "")
    const html = render(PageHeader()(props(writingFolder)))
    assert.equal(html, '<header class="ph"><h1 class="article-title ph-title">Writing</h1></header>')
  })

  test("page header on a work shows links and the screenshot", () => {
    const html = render(PageHeader()(props(course)))
    assert.match(html, /<dt>Links<\/dt><dd><span class="ph-links">/)
    assert.match(html, /<img class="ph-shot"/)
    assert.doesNotMatch(html, /Reading|Design essay/)
  })

  test("home index renders the thesis, rows and works only where it belongs", () => {
    const html = render(HomeIndex()(props(home)))
    assert.equal(html.match(/<h1/g).length, 1)
    assert.match(html, /<h1 class="home-thesis">Fewer pages. Harder claims.<\/h1>/)
    // The newest essay is the hero, the rest are cards, and the ledger lists all.
    assert.equal(html.match(/class="plate plate--night hero"/g).length, 1)
    assert.equal(html.match(/class="plate plate--\w+ card"/g).length, 2)
    assert.equal(html.match(/class="ledger-row"/g).length, 3)
    assert.equal(html.match(/class="plate plate--paper work-plate"/g).length, 1)
    assert.match(html, /<dt>Essays<\/dt><dd>03<\/dd>/)
    assert.match(html, /<dt>Works<\/dt><dd>01<\/dd>/)
    assert.match(html, /<dt>Since<\/dt><dd>2026<\/dd>/)
    assert.match(html, /class="ledger-head" aria-hidden="true"/)
    assert.equal(render(HomeIndex()(props(writingFolder))).match(/class="ledger-row"/g).length, 3)
    assert.equal(render(HomeIndex()(props(apple))), "")
  })

  test("end matter under essays and works", () => {
    const underCuda = render(EndMatter()(props(cuda)))
    assert.match(underCuda, /Related work/)
    assert.match(underCuda, /href="\/works\/course"/)
    const underApple = render(EndMatter()(props(apple)))
    assert.doesNotMatch(underApple, /Related work/)
    assert.equal(underApple.match(/class="ledger-row"/g).length, 2)
    const underZh = render(EndMatter()(props(keyboardZh)))
    assert.match(underZh, /更多文章/)
    assert.doesNotMatch(underZh, /href="\/writing\/keyboard"/)
    const underWork = render(EndMatter()(props(course)))
    assert.match(underWork, /Essays about this work/)
    assert.equal(underWork.match(/class="ledger-row"/g).length, 3)
  })

  test("colophon credit in both languages", () => {
    assert.match(render(Colophon()(props(apple))), /Built with <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a>/)
    assert.match(render(Colophon()(props(keyboardZh))), /用 <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a> 构建/)
  })
})

describe("plates", () => {
  const ctx = { lang: "en", allFiles }

  test("claims read figures, quotes and plain strings, and drop the rest", () => {
    const file = {
      frontmatter: {
        claims: [
          { figure: "54%", text: "of spend" },
          { quote: "Harsh can be faked." },
          "A plain line.",
          { figure: 9 },
          { text: "no figure" },
          42,
        ],
      },
    }
    assert.deepStrictEqual(claimsOf(file), [
      { figure: "54%", text: "of spend" },
      { quote: "Harsh can be faked." },
      { quote: "A plain line." },
      { figure: "9", text: "" },
    ])
    assert.deepStrictEqual(claimsOf({ frontmatter: {} }), [])
  })

  test("a hero sets its claims beside the title, units smaller", () => {
    const file = {
      ...apple,
      frontmatter: {
        ...apple.frontmatter,
        claims: [{ figure: "54%", text: "of spend" }, { quote: "A line." }],
      },
    }
    const html = render(renderHero(file, ctx))
    assert.match(html, /<p class="claim-figure">54<span class="fig-unit">%<\/span><\/p>/)
    assert.match(html, /<li class="claim claim--quote"><q>A line.<\/q><\/li>/)
    assert.match(html, /Read the essay/)
  })

  test("cards cycle tones and fall back to the dek without claims", () => {
    assert.match(render(renderCard(apple, 0, ctx)), /plate--slate card/)
    assert.match(render(renderCard(apple, 1, ctx)), /plate--sage card/)
    assert.match(render(renderCard(apple, 2, ctx)), /plate--clay card/)
    const html = render(renderCard(apple, 0, ctx))
    assert.match(html, /class="card-caption"/)
    assert.doesNotMatch(html, /card-figure|card-quote/)
  })
})

describe("links between entries", () => {
  test("entries are numbered in order of publication, per section", () => {
    assert.equal(entryNumber(cuda, allFiles), 1)
    assert.equal(entryNumber(keyboard, allFiles), 2)
    assert.equal(entryNumber(apple, allFiles), 3)
    // A translation takes its original's number; a work counts in its own section.
    assert.equal(entryNumber(keyboardZh, allFiles), 2)
    assert.equal(entryNumber(course, allFiles), 1)
    assert.equal(entryNumber(home, allFiles), null)
  })

  test("a title block leaves out the fields it has no value for", () => {
    const html = render(renderTitleBlock([{ label: "A", value: "1" }, { label: "B", value: null }]))
    assert.equal(html, '<dl class="titleblock"><div class="tb-cell"><dt>A</dt><dd>1</dd></div></dl>')
    assert.equal(renderTitleBlock([{ label: "B", value: null }]), null)
  })

  const part = (slug, n, date) => ({
    slug,
    frontmatter: { title: `Part ${n}`, date, series: "Kernels", part: n },
    i18n: { lang: "en", base: slug, alternates: [] },
    presence: { kind: "essay", figures: [], sections: [], words: 400, readingMinutes: 2 },
  })
  const one = part("writing/k1", 1, "2026-10-01")
  const two = part("writing/k2", 2, "2026-10-08")
  const three = part("writing/k3", 3, "2026-10-02")
  const linker = {
    slug: "writing/linker",
    links: ["writing/k2", "works/course"],
    frontmatter: { title: "Linker", date: "2026-10-09" },
    i18n: { lang: "en", base: "writing/linker", alternates: [] },
    presence: { kind: "essay", figures: [], sections: [], words: 400, readingMinutes: 2 },
  }
  const files = [...allFiles, three, one, two, linker]

  test("a series orders its parts by part number, whatever the dates", () => {
    const series = seriesOf(two, files)
    assert.equal(series.name, "Kernels")
    assert.deepStrictEqual(
      series.parts.map((entry) => entry.slug),
      ["writing/k1", "writing/k2", "writing/k3"],
    )
    assert.equal(series.index, 1)
    assert.equal(seriesOf(apple, files), null)
  })

  test("backlinks list the entries that link to a page", () => {
    assert.deepStrictEqual(
      backlinksOf(two, files).map((entry) => entry.slug),
      ["writing/linker"],
    )
    assert.deepStrictEqual(
      backlinksOf(course, files).map((entry) => entry.slug),
      ["writing/linker"],
    )
    assert.deepStrictEqual(backlinksOf(one, files), [])
  })

  test("end matter shows the series, then Linked from, and lists nothing twice", () => {
    const html = render(EndMatter()({ fileData: two, allFiles: files, cfg }))
    assert.match(html, /<section class="end-series">/)
    assert.match(html, /Part 2 of 3/)
    assert.match(html, /<li class="is-current"><span aria-current="page">Part 2<\/span><\/li>/)
    assert.match(html, /rel="previous"[^>]*>.*Part 1/)
    assert.match(html, /rel="next"[^>]*>.*Part 3/)
    assert.match(html, /<section class="end-linked">.*Linker/)
    // Parts already listed in the series are not repeated under More writing.
    const more = html.slice(html.indexOf('class="end-more"'))
    assert.doesNotMatch(more, /Part 1|Part 3|Linker/)
  })
})
