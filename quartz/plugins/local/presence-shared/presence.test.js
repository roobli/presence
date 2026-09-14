import test, { describe } from "node:test"
import assert from "node:assert"
import { render } from "preact-render-to-string"
import { formatDate, isoDate } from "./dates.js"
import { t } from "./locale.js"
import { renderSpine, spineLength } from "./spine.js"
import {
  essaysForWork,
  hrefOf,
  readingMinutes,
  relatedWork,
  renderWorkRow,
  renderWritingRow,
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

  test("an essay row states date, minutes and live figures", () => {
    const html = render(renderWritingRow(apple, ctx))
    assert.match(html, /<time datetime="2026-09-11">Sep 11, 2026<\/time>/)
    assert.match(html, /24 min read/)
    assert.match(html, /4 live figures/)
    assert.doesNotMatch(html, /idx-alt/)
  })

  test("only a paired essay links its translation", () => {
    const html = render(renderWritingRow(keyboard, ctx))
    assert.match(
      html,
      /<a class="idx-alt" href="\/writing\/keyboard\/zh" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a>/,
    )
    assert.doesNotMatch(html, /live figure/)
  })

  test("on a zh page an English row says so and keeps zh chrome", () => {
    const html = render(renderWritingRow(apple, { lang: "zh-Hans", allFiles }))
    assert.match(html, /<li class="idx-row" lang="en">/)
    assert.match(html, /<p class="idx-meta" lang="zh-Hans">/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /约 24 分钟/)
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
    assert.match(html, /<p class="ph-kicker"><a href="\/writing\/">Writing<\/a><\/p>/)
    assert.match(html, /<h1 class="article-title ph-title">Keyboard shortcut systems<\/h1>/)
    assert.match(html, /<p class="ph-facts">.*<span class="ph-lang"><a href="[^"]+" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a><\/span><\/p>/)
    assert.doesNotMatch(html, /aria-current|ph-lang-seg|<nav/)
  })

  test("page header on the translation uses zh chrome and the original's minutes", () => {
    const html = render(PageHeader()(props(keyboardZh)))
    assert.match(html, /<a href="\/writing\/">文章<\/a>/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /约 8 分钟/)
    assert.match(html, /<span class="ph-lang"><a href="\/writing\/keyboard" lang="en" hreflang="en" rel="alternate">English<\/a><\/span>/)
  })

  test("page header: nothing on home, title only on a folder", () => {
    assert.equal(render(PageHeader()(props(home))), "")
    const html = render(PageHeader()(props(writingFolder)))
    assert.equal(html, '<header class="ph"><h1 class="article-title ph-title">Writing</h1></header>')
  })

  test("page header on a work shows links and the screenshot", () => {
    const html = render(PageHeader()(props(course)))
    assert.match(html, /<p class="ph-links">/)
    assert.match(html, /<img class="ph-shot"/)
    assert.doesNotMatch(html, /ph-facts|Design essay/)
  })

  test("home index renders the thesis, rows and works only where it belongs", () => {
    const html = render(HomeIndex()(props(home)))
    assert.equal(html.match(/<h1/g).length, 1)
    assert.match(html, /<h1 class="home-thesis">Fewer pages. Harder claims.<\/h1>/)
    assert.equal(html.match(/class="idx-row"/g).length, 3)
    assert.equal(html.match(/class="work-row"/g).length, 1)
    assert.equal(render(HomeIndex()(props(writingFolder))).match(/class="idx-row"/g).length, 3)
    assert.equal(render(HomeIndex()(props(apple))), "")
  })

  test("end matter under essays and works", () => {
    const underCuda = render(EndMatter()(props(cuda)))
    assert.match(underCuda, /Related work/)
    assert.match(underCuda, /href="\/works\/course"/)
    const underApple = render(EndMatter()(props(apple)))
    assert.doesNotMatch(underApple, /Related work/)
    assert.equal(underApple.match(/class="idx-row"/g).length, 2)
    const underZh = render(EndMatter()(props(keyboardZh)))
    assert.match(underZh, /更多文章/)
    assert.doesNotMatch(underZh, /href="\/writing\/keyboard"/)
    const underWork = render(EndMatter()(props(course)))
    assert.match(underWork, /Essays about this work/)
    assert.equal(underWork.match(/class="idx-row"/g).length, 3)
  })

  test("colophon credit in both languages", () => {
    assert.match(render(Colophon()(props(apple))), /Built with <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a>/)
    assert.match(render(Colophon()(props(keyboardZh))), /用 <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a> 构建/)
  })
})
