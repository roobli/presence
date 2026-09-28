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
  episodeNumber,
  hrefOf,
  placeInSeries,
  projectLog,
  projectOf,
  readingMinutes,
  selectEssays,
  selectNotes,
  selectProjects,
  selectSeries,
  selectWriting,
  tagsOf,
  writingForProject,
} from "./entries.js"
import {
  renderCard,
  renderLedgerRow,
  renderSpread,
  renderTitleBlock,
  renderTrack,
} from "./views.js"
import { PageHeader } from "../presence-header/components/index.js"
import { HomeIndex } from "../presence-index/components/index.js"
import { EndMatter } from "../presence-end/components/index.js"
import { Colophon } from "../presence-colophon/components/index.js"
import { SectionTree } from "../presence-tree/components/index.js"

// Synthetic pages in the shapes i18n-slug and presence-derive store.
const reading = (extra = {}) => ({
  kind: "essay",
  figures: [],
  intro: null,
  sections: [],
  figureOffsets: [],
  words: 400,
  readingMinutes: 2,
  relation: null,
  ...extra,
})
const page = (slug, frontmatter, presence, more = {}) => ({
  slug,
  frontmatter,
  i18n: { lang: "en", base: slug, alternates: [] },
  presence,
  ...more,
})

const apple = page(
  "essays/apple",
  {
    title: "Apple product design as physics — springs",
    description: "Damping ratios and torque.",
    date: "2026-09-11",
    tags: ["design", "motion"],
    claims: [{ figure: "ζ = 1", text: "is critical damping." }, { quote: "Not taste." }],
  },
  reading({
    entry: "essay",
    figures: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
    intro: { words: 200 },
    sections: [{ words: 1000 }, { words: 1500 }, { words: 2100 }],
    figureOffsets: [100, 900, 2500, 4700],
    words: 4800,
    readingMinutes: 24,
  }),
)
const keyboard = page(
  "essays/keyboard",
  { title: "Keyboard shortcut systems", date: "2026-09-11", tags: ["keyboard"] },
  reading({
    entry: "essay",
    sections: [{ words: 500 }, { words: 500 }, { words: 600 }],
    words: 1600,
    readingMinutes: 8,
  }),
  {
    i18n: {
      lang: "en",
      base: "essays/keyboard",
      alternates: [{ lang: "zh-Hans", slug: "essays/keyboard/zh" }],
    },
  },
)
const keyboardZh = {
  slug: "essays/keyboard/zh",
  unlisted: true,
  frontmatter: { title: "快捷键系统", date: "2026-09-11", lang: "zh-Hans" },
  i18n: {
    lang: "zh-Hans",
    base: "essays/keyboard",
    alternates: [{ lang: "en", slug: "essays/keyboard" }],
  },
  presence: reading({ entry: "essay", words: 5200, readingMinutes: 13 }),
}
const cuda = page(
  "essays/cuda",
  { title: "You can finish a CUDA course", description: "What no GPU covers.", date: "2026-09-10" },
  reading({ entry: "essay", readingMinutes: 5, relation: "projects/course" }),
)
const course = page(
  "projects/course",
  {
    title: "CUDA C++ Course",
    description: "Fifteen lessons.",
    date: "2026-09-10",
    live: "https://example.org/course/",
    source: "https://example.org/course.git",
    live_zh: "https://example.org/course/zh/",
    image: "projects/course-home.webp",
    image_alt: "Course home page",
    status: "live",
    figures: [
      { label: "Lessons", value: 15 },
      { label: "Labs", value: 4 },
    ],
    log: [{ date: "2026-09-10", kind: "launch", text: "The course goes live." }],
  },
  { kind: "project", entry: "project" },
  { links: ["essays/cuda"] },
)
const kernels = page(
  "series/kernels/index",
  {
    title: "Kernels",
    description: "One idea at a time.",
    status: "in-progress",
    cadence: "Weekly",
    project: "projects/course",
    start: "essays/cuda",
    planned: ["Warp shuffles"],
  },
  { kind: "folder", entry: "folder" },
)
const episode = (n, date, title) =>
  page(`series/kernels/0${n}`, { title, date, part: n }, reading({ entry: "episode" }))
const ep1 = episode(1, "2026-10-01", "A kernel that is correct")
const ep2 = episode(2, "2026-10-08", "Coalescing")
// Dated before part 2: parts order a series, not dates.
const ep3 = episode(3, "2026-10-02", "Shared memory")
const note = page(
  "notes/reading-log",
  { title: "Reading log", description: "Four books.", date: "2026-10-05" },
  reading({ entry: "note" }),
)
const linker = page(
  "essays/linker",
  { title: "Linker", date: "2026-10-09" },
  reading({ entry: "essay" }),
  { links: ["series/kernels/02", "projects/course"] },
)
const essaysFolder = {
  slug: "essays/index",
  frontmatter: { title: "Essays" },
  presence: { kind: "folder" },
}
const seriesFolder = {
  slug: "series/index",
  frontmatter: { title: "Series" },
  presence: { kind: "folder" },
}
const notesFolder = { slug: "notes/index", frontmatter: {}, presence: { kind: "folder" } }
const about = page("about", { title: "About" }, { kind: "page", entry: "page" })
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
const allFiles = [
  keyboardZh,
  cuda,
  essaysFolder,
  keyboard,
  apple,
  course,
  kernels,
  ep3,
  ep1,
  ep2,
  note,
  linker,
  seriesFolder,
  notesFolder,
  about,
  home,
]
const cfg = { pageTitle: "RoobLi" }
const props = (fileData, files = allFiles) => ({ fileData, allFiles: files, cfg })
const ctx = { lang: "en", allFiles }
const slugs = (files) => files.map((file) => file.slug)

describe("dates and strings", () => {
  test("formats the literal date in both languages", () => {
    assert.equal(isoDate("2026-09-11"), "2026-09-11")
    assert.equal(isoDate(new Date("2026-09-11T00:00:00Z")), "2026-09-11")
    assert.equal(isoDate("2026-13-01"), null)
    assert.equal(formatDate("2026-09-11", "en"), "Sep 11, 2026")
    assert.equal(formatDate("2026-09-11", "zh-Hans"), "2026年9月11日")
  })

  test("reads the zh table for any zh language", () => {
    assert.equal(t("en", "minShort", { n: 24 }), "24 min")
    assert.equal(t("zh", "minShort", { n: 8 }), "8 分钟")
    assert.equal(t("en", "epOf", { n: 2, total: 5 }), "Ep 02 of 05")
    assert.equal(t("zh-Hans", "epOf", { n: 2, total: 5 }), "第 2 集，共 5 集")
    assert.equal(t("zh-Hans", "notes"), "随笔")
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

describe("the content model", () => {
  test("selects each kind, newest first, without translations or folder pages", () => {
    assert.deepStrictEqual(slugs(selectEssays(allFiles)), [
      "essays/linker",
      "essays/apple",
      "essays/keyboard",
      "essays/cuda",
    ])
    assert.deepStrictEqual(slugs(selectProjects(allFiles)), ["projects/course"])
    assert.deepStrictEqual(slugs(selectNotes(allFiles)), ["notes/reading-log"])
    // Writing is essays and episodes together; notes are not in it.
    assert.deepStrictEqual(slugs(selectWriting(allFiles)).slice(0, 4), [
      "essays/linker",
      "series/kernels/02",
      "series/kernels/03",
      "series/kernels/01",
    ])
  })

  test("a series reads its folder: parts in order, planned episodes, facts", () => {
    const [series] = selectSeries(allFiles)
    assert.equal(series.id, "kernels")
    assert.equal(series.slug, "series/kernels/index")
    assert.equal(series.title, "Kernels")
    assert.deepStrictEqual(slugs(series.episodes), [
      "series/kernels/01",
      "series/kernels/02",
      "series/kernels/03",
    ])
    assert.deepStrictEqual(series.planned, ["Warp shuffles"])
    assert.equal(series.total, 4)
    assert.equal(series.status, "in-progress")
    assert.equal(series.started, "2026-10-01")
    assert.equal(series.latest, "2026-10-08")
    assert.equal(series.project, "projects/course")
    assert.deepStrictEqual(placeInSeries(ep2, allFiles).index, 1)
    assert.equal(episodeNumber(ep3, allFiles), 3)
    assert.equal(placeInSeries(apple, allFiles), null)
  })

  test("a series without planned episodes or a status reads complete", () => {
    const done = { ...kernels, frontmatter: { title: "Kernels" } }
    const files = allFiles.map((file) => (file === kernels ? done : file))
    assert.equal(selectSeries(files)[0].status, "complete")
    // A series with nothing published and nothing planned is not listed.
    assert.deepStrictEqual(selectSeries([done]), [])
  })

  test("essays are numbered in order of publication; translations share it", () => {
    assert.equal(entryNumber(cuda, allFiles), 1)
    assert.equal(entryNumber(keyboard, allFiles), 2)
    assert.equal(entryNumber(apple, allFiles), 3)
    assert.equal(entryNumber(keyboardZh, allFiles), 2)
    assert.equal(entryNumber(ep1, allFiles), null)
    assert.equal(entryNumber(course, allFiles), null)
  })

  test("a translation reads its original's minutes", () => {
    assert.equal(readingMinutes(keyboardZh, allFiles), 8)
    assert.equal(readingMinutes(apple, allFiles), 24)
  })

  test("pages find their project, directly or through their series", () => {
    assert.equal(projectOf(cuda, allFiles), course)
    assert.equal(projectOf(ep2, allFiles), course)
    assert.equal(projectOf(apple, allFiles), null)
    assert.deepStrictEqual(slugs(writingForProject(course, allFiles)), [
      "series/kernels/02",
      "series/kernels/03",
      "series/kernels/01",
      "essays/cuda",
    ])
  })

  test("a project's log gathers its own entries, its series and writing, newest first", () => {
    const log = projectLog(course, allFiles).map((item) => [item.date, item.kind])
    assert.deepStrictEqual(log, [
      ["2026-10-08", "episode"],
      ["2026-10-02", "episode"],
      ["2026-10-01", "episode"],
      ["2026-10-01", "series"],
      ["2026-09-10", "essay"],
      ["2026-09-10", "launch"],
    ])
  })

  test("backlinks list the entries that link to a page", () => {
    assert.deepStrictEqual(slugs(backlinksOf(ep2, allFiles)), ["essays/linker"])
    assert.deepStrictEqual(slugs(backlinksOf(course, allFiles)), ["essays/linker"])
    assert.deepStrictEqual(backlinksOf(ep1, allFiles), [])
  })

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

  test("tags leave out one that repeats the section's name", () => {
    const tagged = page("projects/x", { tags: ["projects", "cuda"] }, {})
    assert.deepStrictEqual(tagsOf(tagged), ["cuda"])
  })

  test("site paths", () => {
    assert.equal(hrefOf("index"), "/")
    assert.equal(hrefOf("essays/index"), "/essays/")
    assert.equal(hrefOf("essays/keyboard/zh"), "/essays/keyboard/zh")
  })
})

describe("views", () => {
  test("a title block leaves out the fields it has no value for", () => {
    const html = render(
      renderTitleBlock([
        { label: "A", value: "1" },
        { label: "B", value: null },
      ]),
    )
    assert.equal(
      html,
      '<dl class="titleblock"><div class="tb-cell"><dt>A</dt><dd>1</dd></div></dl>',
    )
    assert.equal(renderTitleBlock([{ label: "B", value: null }]), null)
  })

  test("a ledger row states number, date, minutes and live figures", () => {
    const html = render(renderLedgerRow(apple, ctx))
    assert.match(html, /<span class="ledger-no">003<\/span>/)
    assert.match(html, /<time datetime="2026-09-11">Sep 11, 2026<\/time>/)
    assert.match(html, /24 min/)
    assert.match(html, /4 live figures/)
    assert.doesNotMatch(html, /中文/)
  })

  test("only a paired essay links its translation", () => {
    const html = render(renderLedgerRow(keyboard, ctx))
    assert.match(
      html,
      /<a class="zh" href="\/essays\/keyboard\/zh" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a>/,
    )
  })

  test("an episode's row is labelled with its place in the series", () => {
    assert.match(render(renderLedgerRow(ep2, ctx)), /<span class="ledger-no">Ep 02<\/span>/)
  })

  test("on a zh page an English row says so and keeps zh chrome", () => {
    const html = render(renderLedgerRow(apple, { lang: "zh-Hans", allFiles }))
    assert.match(html, /<li class="ledger-row" lang="en">/)
    assert.match(html, /<span class="ledger-meta" lang="zh-Hans">/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /24 分钟/)
  })

  test("the spread writes the claims in the margin; without claims it is one page", () => {
    const html = render(renderSpread(apple, ctx))
    assert.match(html, /<article class="spread">/)
    assert.match(html, /<aside class="leaf leaf--margin" aria-label="In the margin">/)
    assert.match(html, /<li class="claim"><strong>ζ = 1<\/strong> is critical damping.<\/li>/)
    assert.match(html, /<li class="claim claim--quote"><q>Not taste.<\/q><\/li>/)
    assert.match(html, /Read the essay/)
    const single = render(renderSpread(cuda, ctx))
    assert.match(single, /<article class="spread spread--single">/)
    assert.doesNotMatch(single, /leaf--margin/)
  })

  test("a card leads with its first claim, else the dek; an episode names its series", () => {
    const card = render(renderCard(apple, ctx))
    assert.match(card, /<p class="card-claim"><strong>ζ = 1<\/strong> is critical damping.<\/p>/)
    assert.match(card, /<span>design<\/span>/)
    // The short title on the card, the full one in its tooltip.
    assert.match(
      card,
      /title="Apple product design as physics — springs">Apple product design as physics</,
    )
    assert.match(render(renderCard(cuda, ctx)), /<p class="card-claim">What no GPU covers.<\/p>/)
    const episodeCard = render(renderCard(ep2, ctx))
    assert.match(episodeCard, /<span class="no">Ep 02<\/span>/)
    assert.match(episodeCard, /<span>Kernels<\/span>/)
  })

  test("a track fills published stops, rings the current one and leaves planned ones hollow", () => {
    const [series] = selectSeries(allFiles)
    const html = render(renderTrack(series, ctx, { current: "series/kernels/02" }))
    assert.equal(html.match(/class="step is-done"/g).length, 2)
    assert.equal(html.match(/class="step is-done is-current"/g).length, 1)
    assert.equal(html.match(/class="step is-planned"/g).length, 1)
    assert.match(html, /<span title="Ep 02 · Coalescing" aria-current="page">/)
    assert.match(html, /<a href="\/series\/kernels\/01" title="Ep 01 · A kernel that is correct">/)
    assert.match(html, /title="Ep 04 · Warp shuffles \(Planned\)"/)
  })
})

describe("components", () => {
  test("page header on an essay pair", () => {
    const html = render(PageHeader()(props(keyboard)))
    assert.match(
      html,
      /<p class="ph-kicker"><a href="\/essays\/">Essays<\/a>.*<span class="entry-no">No\. 002<\/span>.*<span>keyboard<\/span><\/p>/,
    )
    assert.match(html, /<h1 class="article-title ph-title">Keyboard shortcut systems<\/h1>/)
    assert.match(html, /<dl class="titleblock titleblock--spec">/)
    assert.match(
      html,
      /<dt>Published<\/dt><dd><time datetime="2026-09-11">Sep 11, 2026<\/time><\/dd>/,
    )
    assert.match(html, /<dt>Reading<\/dt><dd>8 min<\/dd>/)
    assert.doesNotMatch(html, /Live figures/)
    assert.match(
      html,
      /<dt>Language<\/dt><dd><span>English<\/span>.*<span class="ph-lang"><a href="[^"]+" lang="zh-Hans" hreflang="zh-Hans" rel="alternate">中文<\/a><\/span><\/dd>/,
    )
  })

  test("page header on the translation uses zh chrome and the original's number and minutes", () => {
    const html = render(PageHeader()(props(keyboardZh)))
    assert.match(html, /<a href="\/essays\/">文章<\/a>/)
    assert.match(html, /No\. 002/)
    assert.match(html, /2026年9月11日/)
    assert.match(html, /<dt>阅读<\/dt><dd>8 分钟<\/dd>/)
    assert.match(
      html,
      /<span class="ph-lang"><a href="\/essays\/keyboard" lang="en" hreflang="en" rel="alternate">English<\/a><\/span>/,
    )
  })

  test("page header on an episode states its series and place", () => {
    const html = render(PageHeader()(props(ep2)))
    assert.match(html, /<a href="\/series\/">Series<\/a>/)
    assert.match(html, /<a href="\/series\/kernels\/">Kernels<\/a>/)
    assert.match(html, /<span class="entry-no">Ep 02 of 04<\/span>/)
  })

  test("page header: nothing on home, the path and the name on folder pages", () => {
    assert.equal(render(PageHeader()(props(home))), "")
    const html = render(PageHeader()(props(essaysFolder)))
    assert.match(html, /<p class="ph-kicker"><a href="\/">RoobLi<\/a>.*<span>Essays<\/span><\/p>/)
    assert.match(html, /<h1 class="article-title ph-title">Essays<\/h1>/)
    // A folder page without its own title reads the section's name.
    assert.match(render(PageHeader()(props(notesFolder))), /ph-title">Notes<\/h1>/)
    assert.match(render(PageHeader()(props(kernels))), /<a href="\/series\/">Series<\/a>/)
  })

  test("page header on a project: status, links, figures and the screenshot", () => {
    const html = render(PageHeader()(props(course)))
    assert.match(html, /<dt>Status<\/dt><dd><span class="status status--live">/)
    assert.match(html, /<dt>Links<\/dt><dd><span class="tb-links">/)
    assert.match(html, /<dl class="figs"><div><dt>Lessons<\/dt><dd>15<\/dd><\/div>/)
    assert.match(html, /<figure class="ph-figure"><img class="ph-shot"/)
    assert.doesNotMatch(html, /Reading/)
  })

  test("home index: thesis, the open essay and cards, then each section and the index", () => {
    const html = render(HomeIndex()(props(home)))
    assert.equal(html.match(/<h1/g).length, 1)
    assert.match(html, /<h1 class="home-thesis">Fewer pages. Harder claims.<\/h1>/)
    assert.equal(html.match(/<article class="spread/g).length, 1)
    assert.equal(html.match(/<li class="card"/g).length, 3)
    assert.equal(html.match(/<article class="series-row">/g).length, 1)
    assert.equal(html.match(/<article class="proj"/g).length, 1)
    assert.equal(html.match(/<li class="note"/g).length, 1)
    assert.match(html, /<ol class="ledger ledger--compact">/)
    assert.equal(html.slice(html.indexOf("idx--index")).match(/class="ledger-row"/g).length, 4)
    for (const [label, n] of [
      ["Essays", "04"],
      ["Series", "01"],
      ["Projects", "01"],
      ["Notes", "01"],
    ]) {
      assert.match(html, new RegExp(`<dt>${label}</dt><dd>${n}</dd>`))
    }
    assert.match(html, /<dt>Since<\/dt><dd>2026<\/dd>/)
    assert.equal(render(HomeIndex()(props(apple))), "")
  })

  test("a home without series or notes leaves those sections out", () => {
    const html = render(HomeIndex()(props(home, [apple, cuda, course, home])))
    assert.doesNotMatch(html, /idx--series|idx--notes|<dt>Series<\/dt>|<dt>Notes<\/dt>/)
  })

  test("section pages: essays as a ledger, notes by month, series with tracks", () => {
    const essays = render(HomeIndex()(props(essaysFolder)))
    assert.equal(essays.match(/class="ledger-row"/g).length, 4)
    assert.match(essays, /<dt>In 中文<\/dt><dd>01<\/dd>/)
    const series = render(HomeIndex()(props(seriesFolder)))
    assert.match(series, /<article class="series-row">/)
    assert.match(series, /<dt>Episodes<\/dt><dd>03<\/dd>/)
    const notes = render(HomeIndex()(props(notesFolder)))
    assert.match(notes, /<li class="note"/)
  })

  test("a series page: its facts, its track, every episode and where to start", () => {
    const html = render(HomeIndex()(props(kernels)))
    assert.match(html, /<dt>Status<\/dt><dd>In progress<\/dd>/)
    assert.match(html, /<dt>Published<\/dt><dd>3 of 4<\/dd>/)
    assert.match(html, /<dt>Cadence<\/dt><dd>Weekly<\/dd>/)
    assert.match(html, /<ol class="track track--big"/)
    assert.equal(html.match(/<li class="ep">/g).length, 3)
    assert.match(html, /<li class="ep is-planned"><span class="ep-n">04<\/span>/)
    assert.match(html, /Start here.*href="\/essays\/cuda"/)
  })

  test("end matter under an episode: series, project, links, more; nothing twice", () => {
    const html = render(EndMatter()(props(ep2)))
    assert.match(html, /<section class="end-block end-series">/)
    assert.match(html, /3 of 4 published/)
    assert.match(html, /rel="previous"[^>]*>.*A kernel that is correct/)
    assert.match(html, /rel="next"[^>]*>.*Shared memory/)
    assert.match(html, /<section class="end-block end-project">.*CUDA C\+\+ Course/)
    assert.match(html, /<section class="end-block end-linked">.*Linker/)
    const more = html.slice(html.indexOf("end-more"))
    assert.doesNotMatch(more, /Linker|Coalescing/)
  })

  test("end matter under a project: its log and its series", () => {
    const html = render(EndMatter()(props(course)))
    assert.match(html, /<section class="end-block end-log">/)
    assert.match(html, /<li data-kind="launch">.*The course goes live./)
    assert.match(html, /Ep 02 · Kernels/)
    assert.match(html, /<section class="end-block end-series-list">/)
    // Linker links the project but is not about it, so it is Linked from.
    assert.match(html, /end-linked.*Linker/)
  })

  test("end matter under a translation reads its original's relations in zh", () => {
    const html = render(EndMatter()(props(keyboardZh)))
    assert.match(html, /更多文章/)
    assert.doesNotMatch(html, /href="\/essays\/keyboard"/)
  })

  test("colophon credit in both languages", () => {
    assert.match(
      render(Colophon()(props(apple))),
      /Built with <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a>/,
    )
    assert.match(
      render(Colophon()(props(keyboardZh))),
      /用 <a href="https:\/\/quartz.jzhao.xyz\/">Quartz<\/a> 构建/,
    )
  })
})

describe("sidebar tree", () => {
  const tree = (fileData) => render(SectionTree()(props(fileData)))

  test("each section with entries is a folder with its count, in registry order", () => {
    const html = tree(apple)
    const order = [...html.matchAll(/data-folderpath="(\w+)\/index" data-count="(\d+)"/g)].map(
      (match) => match.slice(1).join(":"),
    )
    assert.deepStrictEqual(order, ["essays:04", "series:01", "projects:01", "notes:01"])
    assert.match(
      html,
      /<li class="tree-loose"><a class="nav-file-title tree-item-self" href="\/about">/,
    )
  })

  test("a series folder shows its progress, numbered episodes and planned ones", () => {
    const html = tree(apple)
    assert.match(html, /data-folderpath="series\/kernels\/index" data-count="3 of 4"/)
    assert.match(
      html,
      /<span class="tree-no">02<\/span><span class="tpl-tree-label">Coalescing<\/span>/,
    )
    assert.match(
      html,
      /<span class="nav-file-title tree-item-self is-planned"[^>]*><span class="tree-no">04<\/span>/,
    )
  })

  test("notes carry their dates and projects their status", () => {
    const html = tree(apple)
    assert.match(
      html,
      /Reading log<\/span><time class="tree-meta tree-date" datetime="2026-10-05">Oct 5<\/time>/,
    )
    assert.match(
      html,
      /<span class="tree-meta tree-status tree-status--live" title="Live"><\/span>/,
    )
  })

  test("the open page is marked, a translation marking its original, and its folders open", () => {
    const html = tree(keyboardZh)
    assert.match(
      html,
      /class="nav-file-title tree-item-self active is-active" href="\/essays\/keyboard"[^>]*aria-current="page"/,
    )
    assert.match(html, /文章/)
    const episodePage = tree(ep2)
    assert.match(
      episodePage,
      /class="folder-container nav-folder-title tree-item-self is-on-path" data-folderpath="series\/kernels\/index"/,
    )
    const folderPage = tree(essaysFolder)
    assert.match(folderPage, /is-current" data-folderpath="essays\/index"/)
    // The shortened title keeps the full one as its tooltip.
    assert.match(html, /title="Apple product design as physics — springs" data-full-title/)
  })
})
