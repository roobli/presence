import test, { describe } from "node:test"
import assert from "node:assert"
import { render } from "preact-render-to-string"
import { selectPosts, writingForProject } from "./entries.js"
import { renderPost } from "./views.js"
import { PageHeader } from "../presence-header/components/index.js"
import { HomeIndex } from "../presence-index/components/index.js"
import { EndMatter } from "../presence-end/components/index.js"
import { SectionTree } from "../presence-tree/components/index.js"
import { dateOnly, excerptOf, summaryOf } from "../presence-derive/derive.js"
import { postsFeedHead } from "../presence-derive/head.js"
import { generateFeed } from "../presence-feeds/index.js"

// Synthetic posts in the shapes i18n-slug, presence-derive and OFM store.
const p = (text) => ({
  type: "element",
  tagName: "p",
  properties: {},
  children: [{ type: "text", value: text }],
})
const tree = (...paragraphs) => ({ type: "root", children: paragraphs.map(p) })

const post = (
  slug,
  frontmatter,
  { minutes = 1, untitled = false, relation = null, lang = "en" } = {},
) => ({
  slug,
  frontmatter: { lang, ...frontmatter },
  i18n: { lang, base: slug, alternates: [] },
  presence: { kind: "essay", entry: "post", readingMinutes: minutes, untitled, relation },
  htmlAst: tree("First paragraph.", "Second paragraph."),
})

const morning = post(
  "posts/2026-09-30-1",
  { title: "Morning", date: "2026-09-30", tags: ["gpu"] },
  { untitled: true },
)
const evening = post("posts/2026-09-30-2", {
  title: "Evening post",
  date: "2026-09-30",
})
const august = post(
  "posts/2026-08-02-long",
  { title: "长的一条", date: "2026-08-02" },
  { minutes: 3, lang: "zh-Hans", relation: "projects/course" },
)
const course = {
  slug: "projects/course",
  frontmatter: { title: "Course", date: "2026-08-01", status: "live" },
  i18n: { lang: "en", base: "projects/course", alternates: [] },
  presence: { kind: "project", entry: "project" },
}
const postsIndex = {
  slug: "posts/index",
  frontmatter: { title: "Posts" },
  i18n: { lang: "en", base: "posts/index", alternates: [] },
  presence: { kind: "folder", entry: "folder" },
}
const allFiles = [morning, evening, august, course, postsIndex]
const cfg = { pageTitle: "RoobLi", baseUrl: "www.roobli.org" }
const props = (fileData) => ({ fileData, allFiles, cfg })

describe("post dates", () => {
  test("a time written into a post's date is cut back to the day, dates included", () => {
    const fm = { date: "2026-09-30T21:40-07:00" }
    const file = { data: { relativePath: "posts/x.md", dates: { created: new Date(), modified: new Date() } } }
    const warn = console.warn
    console.warn = () => {}
    try {
      dateOnly(file, fm)
    } finally {
      console.warn = warn
    }
    assert.equal(fm.date, "2026-09-30")
    assert.equal(file.data.dates.modified.toISOString(), "2026-09-30T00:00:00.000Z")
  })

  test("posts of one day list by file name, newest first", () => {
    assert.deepStrictEqual(
      selectPosts(allFiles).map((file) => file.slug),
      ["posts/2026-09-30-2", "posts/2026-09-30-1", "posts/2026-08-02-long"],
    )
  })

  test("a post about a project goes into its log", () => {
    assert.ok(writingForProject(course, allFiles).includes(august))
  })
})

describe("the timeline", () => {
  const html = render(HomeIndex()(props(postsIndex)))

  test("months are headings with their counts, newest first", () => {
    const months = [...html.matchAll(/id="m-(\d{4}-\d{2})"/g)].map((match) => match[1])
    assert.deepStrictEqual(months, ["2026-09", "2026-08"])
    assert.match(html, /September 2026<span class="ptl-count">2 posts<\/span>/)
  })

  test("each day is written once, in the margin, with its weekday", () => {
    assert.equal((html.match(/class="pday"/g) ?? []).length, 2)
    assert.match(
      html,
      /<time datetime="2026-09-30"><span class="pday-day">Sep 30<\/span><span class="pday-dow">Wed<\/span>/,
    )
  })

  test("a post links its own page, and an untitled post shows no title", () => {
    assert.match(
      html,
      /<a class="post-permalink" href="\/posts\/2026-09-30-1">Permalink<\/a>/,
    )
    assert.doesNotMatch(html, />Morning</)
    assert.match(
      html,
      /<h3 class="post-title"><a href="\/posts\/2026-09-30-2">Evening post<\/a>/,
    )
  })

  test("a post over a minute of reading folds to its first block", () => {
    const long = html.slice(html.indexOf('id="p-2026-08-02-long"'))
    assert.match(long, /First paragraph/)
    assert.doesNotMatch(long.slice(0, long.indexOf("post-meta")), /Second paragraph/)
    assert.match(long, /class="post-more"><a href="\/posts\/2026-08-02-long">继续读/)
  })

  test("a post in the other language says so", () => {
    assert.match(html, /<article class="post" id="p-2026-08-02-long" lang="zh-Hans">/)
  })
})

describe("a post's page", () => {
  test("the label line carries its day and no time; an untitled post's h1 is hidden", () => {
    const html = render(PageHeader()(props(morning)))
    assert.match(html, /<time datetime="2026-09-30">Sep 30, 2026<\/time>/)
    assert.doesNotMatch(html, /\d{2}:\d{2}/)
    assert.match(html, /class="article-title ph-title ph-title--hidden"/)
    assert.doesNotMatch(html, /titleblock--spec/)
  })

  test("the end matter links the older and newer post and the way back", () => {
    const html = render(EndMatter()(props(morning)))
    assert.match(html, /pn-link--older" href="\/posts\/2026-08-02-long"/)
    assert.match(html, /pn-link--newer" href="\/posts\/2026-09-30-2"/)
    assert.match(html, /href="\/posts\/#p-2026-09-30-1"/)
  })

  test("the sidebar lists posts by month and marks the open post's month", () => {
    const html = render(SectionTree()(props(morning)))
    assert.match(html, /data-folderpath="posts\/index" data-count="03"/)
    assert.match(html, /is-active" href="\/posts\/#m-2026-09"/)
    assert.match(html, /href="\/posts\/#m-2026-08"/)
    assert.doesNotMatch(html, /href="\/posts\/2026-09-30-1"/)
  })
})

describe("untitled posts", () => {
  test("take their first sentence as a title when it fits", () => {
    assert.equal(
      excerptOf(tree("A fly was wired to Doom. Then more."), "en"),
      "A fly was wired to Doom",
    )
    assert.equal(excerptOf(tree("容器假在视图和配额。后面还有。"), "zh-Hans"), "容器假在视图和配额")
  })

  test("else their first words, cut at a word", () => {
    const text =
      "One long sentence that keeps going well past the eighty character limit without a stop"
    const title = excerptOf(tree(text), "en")
    assert.ok(title.endsWith("…"))
    assert.ok(title.length <= 81)
    assert.ok(text.startsWith(title.slice(0, -1)))
  })
})

describe("the posts feed", () => {
  test("names its own channel and self link", () => {
    const xml = generateFeed(cfg, [morning, evening], {
      title: "RoobLi Posts",
      slug: "posts/index",
      description: "Short dated posts",
      path: "posts/index.xml",
    })
    assert.match(xml, /<title>RoobLi Posts<\/title>/)
    assert.match(xml, /<link>https:\/\/www\.roobli\.org\/posts\/<\/link>/)
    assert.match(xml, /href="https:\/\/www\.roobli\.org\/posts\/index\.xml" rel="self"/)
    assert.ok(xml.indexOf("2026-09-30-2") < xml.indexOf("2026-09-30-1"))
  })
})

describe("post descriptions and head", () => {
  test("an untitled post's description starts after the sentence that titles it", () => {
    const text = tree("A fly was wired to Doom. The review is the useful part.")
    assert.equal(summaryOf(text, "en", "A fly was wired to Doom"), "The review is the useful part.")
    assert.equal(summaryOf(text, "en"), "A fly was wired to Doom. The review is the useful part.")
  })

  test("a long post's description ends on a sentence near snippet length", () => {
    const long = `${"Word ".repeat(20).trim()}. ${"More words here ".repeat(10).trim()}`
    const summary = summaryOf(tree(long), "en")
    assert.ok(summary.length <= 155)
    assert.ok(summary.endsWith(".") || summary.endsWith("…"))
  })

  test("the timeline and each post name the posts feed; other pages do not", () => {
    const html = (fileData) => render(postsFeedHead(cfg, fileData) ?? "")
    assert.match(html(morning), /href="\/posts\/index\.xml"/)
    assert.match(html(postsIndex), /title="RoobLi Posts"/)
    assert.equal(html(course), "")
  })
})

describe("review fixes", () => {
  test("a post without a date is left off the timeline instead of breaking the build", () => {
    const undated = post("posts/undated", { title: "No date" })
    const files = [...allFiles, undated]
    assert.ok(!selectPosts(files).includes(undated))
    const html = render(HomeIndex()({ fileData: postsIndex, allFiles: files, cfg }))
    assert.doesNotMatch(html, /No date/)
  })

  test("a post and an essay of one day keep kind order", () => {
    const essay = {
      slug: "essays/same-day",
      frontmatter: { title: "Same day", date: "2026-09-30" },
      i18n: { lang: "en", base: "essays/same-day", alternates: [] },
      presence: { kind: "essay", entry: "essay" },
    }
    const late = post("posts/late", { title: "Late", date: "2026-09-30" })
    const order = writingForProject(
      { slug: "projects/x", links: ["essays/same-day", "posts/late"] },
      [late, essay],
    ).map((file) => file.slug)
    assert.deepStrictEqual(order, ["essays/same-day", "posts/late"])
  })

  test("the timeline drops ids, sends in-page links to the post, and leaves footnotes there", () => {
    const withNote = post("posts/2026-09-30-note", {
      title: "With a footnote",
      date: "2026-09-30",
    })
    withNote.htmlAst = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: { id: "x" },
          children: [
            { type: "text", value: "Claim" },
            {
              type: "element",
              tagName: "a",
              properties: { href: "#fn-1", id: "fnref-1" },
              children: [{ type: "text", value: "1" }],
            },
          ],
        },
        {
          type: "element",
          tagName: "section",
          properties: { dataFootnotes: true },
          children: [{ type: "text", value: "The footnote" }],
        },
      ],
    }
    const html = render(renderPost(withNote, { lang: "en", allFiles: [withNote] }))
    assert.doesNotMatch(html, /id="x"|id="fnref-1"/)
    assert.match(html, /href="\/posts\/2026-09-30-note#fn-1"/)
    assert.doesNotMatch(html, /The footnote/)
    assert.match(html, /class="post-more"/)
  })

  test("a link that is not http(s) is not rendered", () => {
    const bad = post("posts/bad", {
      title: "Bad",
      date: "2026-09-30",
      link: "javascript:alert(1)",
    })
    assert.doesNotMatch(render(renderPost(bad, { lang: "en", allFiles: [bad] })), /javascript:/)
  })

  test("an abbreviation does not end the title sentence", () => {
    assert.equal(
      excerptOf(tree("See e.g. the docs for this one. More."), "en"),
      "See e.g. the docs for this one",
    )
  })

  test("the posts feed names no language, the main feed stays English", () => {
    assert.doesNotMatch(
      generateFeed(cfg, [morning], { path: "posts/index.xml", language: null }),
      /<language>/,
    )
    assert.match(generateFeed(cfg, []), /<language>en<\/language>/)
  })
})
