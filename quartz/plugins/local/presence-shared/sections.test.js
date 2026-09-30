import test, { describe } from "node:test"
import assert from "node:assert"
import {
  entryKind,
  formerSlugs,
  indexSlugOf,
  isSeriesIndex,
  layoutOf,
  pageKind,
  SECTIONS,
  sectionById,
  sectionOf,
  sectionOfIndex,
  sectionOfKind,
  seriesIdOf,
  seriesIndexSlug,
} from "./sections.js"
import { selectEntries } from "./entries.js"
import { t } from "./locale.js"

describe("sections", () => {
  test("five sections, in homepage and sidebar order", () => {
    assert.deepStrictEqual(
      SECTIONS.map((section) => `${section.id}:${section.kind}`),
      ["essays:essay", "series:episode", "projects:project", "notes:note", "posts:post"],
    )
  })

  test("posts stay off the homepage and the main feed, and list by month", () => {
    const posts = SECTIONS.find((section) => section.id === "posts")
    assert.equal(posts.home, false)
    assert.equal(posts.feed, false)
    assert.equal(posts.months, true)
    assert.equal(entryKind("posts/2026-09-30-2140"), "post")
    assert.equal(pageKind("posts/2026-09-30-2140"), "essay")
  })

  test("entryKind is what a page is, pageKind the layout it is read in", () => {
    assert.equal(entryKind("index"), "home")
    assert.equal(entryKind("essays/index"), "folder")
    assert.equal(entryKind("series/kernels/index"), "folder")
    assert.equal(entryKind("essays/an-unchecked-todo"), "essay")
    assert.equal(entryKind("series/kernels/02-coalescing"), "episode")
    assert.equal(entryKind("projects/cuda-cpp-course"), "project")
    assert.equal(entryKind("notes/reading-log"), "note")
    assert.equal(entryKind("about"), "page")
    // A translation passes its original's slug; its own slug still resolves.
    assert.equal(entryKind("essays/an-unchecked-todo/zh"), "essay")
    // A prefix match needs the slash: "essayser" is not the essays section.
    assert.equal(entryKind("essayser/foo"), "page")

    assert.equal(pageKind("series/kernels/02-coalescing"), "essay")
    assert.equal(pageKind("notes/reading-log"), "essay")
    assert.equal(pageKind("projects/cuda-cpp-course"), "project")
    assert.equal(layoutOf("episode"), "essay")
    assert.equal(layoutOf("folder"), "folder")
  })

  test("series nest one folder deep", () => {
    assert.equal(seriesIdOf("series/kernels/02-coalescing"), "kernels")
    assert.equal(seriesIdOf("series/kernels/index"), "kernels")
    assert.equal(seriesIdOf("series/index"), null)
    assert.equal(seriesIdOf("series/loose-page"), null)
    assert.equal(seriesIdOf("essays/kernels/x"), null)
    assert.equal(seriesIndexSlug("kernels"), "series/kernels/index")
    assert.equal(isSeriesIndex("series/kernels/index"), true)
    assert.equal(isSeriesIndex("series/kernels/02-coalescing"), false)
    assert.equal(isSeriesIndex("series/index"), false)
  })

  test("lookups", () => {
    assert.equal(sectionOf("essays/foo")?.id, "essays")
    assert.equal(sectionOf("about"), null)
    assert.equal(sectionOfIndex("projects/index")?.id, "projects")
    assert.equal(sectionOfIndex("projects/cuda-cpp-course"), null)
    assert.equal(sectionOfKind("essay")?.id, "essays")
    assert.equal(sectionById("nope"), null)
    assert.equal(indexSlugOf(sectionById("essays")), "essays/index")
  })

  test("renamed sections keep their pages' old slugs", () => {
    assert.deepStrictEqual(formerSlugs("essays/foo"), ["writing/foo"])
    assert.deepStrictEqual(formerSlugs("essays/foo/zh"), ["writing/foo/zh"])
    assert.deepStrictEqual(formerSlugs("projects/index"), ["works/index"])
    assert.deepStrictEqual(formerSlugs("notes/foo"), [])
    assert.deepStrictEqual(formerSlugs("about"), [])
  })

  test("every section has a chrome label, a note and an All link in both languages", () => {
    for (const section of SECTIONS) {
      for (const lang of ["en", "zh-Hans"]) {
        assert.ok(t(lang, section.label))
        assert.ok(t(lang, `note_${section.id}`))
        assert.ok(t(lang, `all_${section.id}`))
      }
    }
  })

  test("selectEntries skips the section page, translations and unlisted pages", () => {
    const essays = sectionById("essays")
    const files = [
      { slug: "essays/index", frontmatter: { title: "Essays" } },
      { slug: "essays/a", frontmatter: { title: "A", date: "2026-01-02" } },
      { slug: "essays/b", frontmatter: { title: "B", date: "2026-03-04" } },
      {
        slug: "essays/b/zh",
        frontmatter: { title: "B zh", date: "2026-03-04" },
        i18n: { base: "essays/b" },
      },
      { slug: "essays/hidden", frontmatter: { title: "H", unlisted: true } },
      { slug: "projects/w", frontmatter: { title: "W" } },
    ]
    assert.deepStrictEqual(
      selectEntries(files, essays).map((file) => file.slug),
      ["essays/b", "essays/a"],
    )
  })
})
