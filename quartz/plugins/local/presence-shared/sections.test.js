import test, { describe } from "node:test"
import assert from "node:assert"
import {
  indexSlugOf,
  pageKind,
  SECTIONS,
  sectionById,
  sectionOf,
  sectionOfIndex,
  sectionOfKind,
} from "./sections.js"
import { listingSlugOf, selectEntries } from "./rows.js"
import { t } from "./locale.js"

describe("sections", () => {
  test("pageKind reads the section table", () => {
    assert.equal(pageKind("index"), "home")
    assert.equal(pageKind("writing/index"), "folder")
    assert.equal(pageKind("works/index"), "folder")
    assert.equal(pageKind("writing/an-unchecked-todo"), "essay")
    // A translation passes its original's slug; its own slug still resolves.
    assert.equal(pageKind("writing/an-unchecked-todo/zh"), "essay")
    assert.equal(pageKind("works/cuda-cpp-course"), "work")
    assert.equal(pageKind("about"), "page")
    // A prefix match needs the slash: "writings" is not the writing section.
    assert.equal(pageKind("writings/foo"), "page")
  })

  test("lookups", () => {
    assert.equal(sectionOf("writing/foo")?.id, "writing")
    assert.equal(sectionOf("about"), null)
    assert.equal(sectionOfIndex("works/index")?.id, "works")
    assert.equal(sectionOfIndex("works/cuda-cpp-course"), null)
    assert.equal(sectionOfKind("essay")?.id, "writing")
    assert.equal(sectionById("nope"), null)
    assert.equal(indexSlugOf(sectionById("writing")), "writing/index")
    assert.equal(listingSlugOf("essay"), "writing/index")
    assert.equal(listingSlugOf("nothing"), "index")
  })

  test("every section has a chrome label in both languages", () => {
    for (const section of SECTIONS) {
      assert.ok(t("en", section.label))
      assert.ok(t("zh-Hans", section.label))
    }
  })

  test("selectEntries skips the section page, translations and unlisted pages", () => {
    const writing = sectionById("writing")
    const files = [
      { slug: "writing/index", frontmatter: { title: "Writing" } },
      { slug: "writing/a", frontmatter: { title: "A", date: "2026-01-02" } },
      { slug: "writing/b", frontmatter: { title: "B", date: "2026-03-04" } },
      {
        slug: "writing/b/zh",
        frontmatter: { title: "B zh", date: "2026-03-04" },
        i18n: { base: "writing/b" },
      },
      { slug: "writing/hidden", frontmatter: { title: "H", unlisted: true } },
      { slug: "works/w", frontmatter: { title: "W" } },
    ]
    assert.deepEqual(
      selectEntries(files, writing).map((file) => file.slug),
      ["writing/b", "writing/a"],
    )
  })
})
