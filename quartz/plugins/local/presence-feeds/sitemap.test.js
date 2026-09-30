import test, { describe } from "node:test"
import assert from "node:assert"
import { generateSitemap, lastModified } from "./index.js"

const page = (slug, modified) => ({ slug, dates: modified ? { modified } : undefined })

const pages = [
  page("index", "2026-09-01"),
  page("about", "2026-09-20"),
  page("essays/index", "2026-09-01"),
  page("essays/a", "2026-09-11"),
  page("essays/b", "2026-09-28"),
  page("series/index", "2026-09-01"),
  page("series/k/index", "2026-09-02"),
  page("series/k/01", "2026-09-15"),
  page("notes/index"),
]

const iso = (data) => lastModified(data, pages)?.toISOString().slice(0, 10)

describe("presence-feeds sitemap lastmod", () => {
  test("an entry keeps its own date", () => {
    assert.equal(iso(pages[3]), "2026-09-11")
    assert.equal(iso(pages[1]), "2026-09-20")
  })

  test("a section's page moves with the newest entry under it", () => {
    assert.equal(iso(pages[2]), "2026-09-28")
    assert.equal(iso(pages[5]), "2026-09-15")
  })

  test("a series' page moves with its newest episode", () => {
    assert.equal(iso(pages[6]), "2026-09-15")
  })

  test("the homepage moves with section entries but not with plain pages", () => {
    // about (Sep 20) is not listed on the homepage; essays/b (Sep 28) is.
    assert.equal(iso(pages[0]), "2026-09-28")
    const withoutB = pages.filter((data) => data.slug !== "essays/b")
    assert.equal(lastModified(pages[0], withoutB).toISOString().slice(0, 10), "2026-09-15")
  })

  test("the homepage does not move with posts, which it leaves out; the timeline does", () => {
    const withPost = [...pages, page("posts/index"), page("posts/2026-09-30-x", "2026-09-30")]
    assert.equal(lastModified(pages[0], withPost).toISOString().slice(0, 10), "2026-09-28")
    assert.equal(lastModified(withPost.at(-2), withPost).toISOString().slice(0, 10), "2026-09-30")
  })

  test("a listing with no dates anywhere has no lastmod", () => {
    assert.equal(lastModified(pages[8], [pages[8]]), undefined)
  })

  test("the file is plain sitemap XML: translations listed, no XHTML alternates", () => {
    const xml = generateSitemap("www.roobli.org", [
      page("essays/a", "2026-09-11"),
      {
        ...page("essays/a/zh", "2026-09-11"),
        i18n: { lang: "zh-Hans", base: "essays/a", alternates: [{ lang: "en", slug: "essays/a" }] },
      },
    ])
    assert.match(
      xml,
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">\n/,
    )
    assert.ok(!xml.includes("xhtml"))
    assert.ok(xml.includes("<loc>https://www.roobli.org/essays/a/zh</loc>"))
  })
})
