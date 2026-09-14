import test, { describe } from "node:test"
import assert from "node:assert"
import { FolderPage } from "@quartz-community/folder-page"
import { render } from "preact-render-to-string"
import PresenceFolderPage from "./index.js"

const props = {
  tree: { type: "root", children: [] },
  fileData: { slug: "writing/index", frontmatter: { title: "Writing" } },
  allFiles: [
    {
      slug: "writing/spring-essay",
      frontmatter: { title: "Spring essay", tags: ["design", "motion"] },
    },
    { slug: "writing/untagged-essay", frontmatter: { title: "Untagged essay" } },
  ],
  cfg: { locale: "en-US" },
  ctx: {},
}

describe("presence-index folder page type", () => {
  test("keeps the stock matcher, layout and styles", () => {
    const pageType = PresenceFolderPage()
    const stock = FolderPage()
    assert.equal(pageType.layout, stock.layout)
    assert.equal(pageType.priority, stock.priority)
    assert.equal(pageType.match({ slug: "writing/index" }), true)
    assert.equal(pageType.match({ slug: "writing/spring-essay" }), false)
    assert.deepStrictEqual(pageType.body(undefined).css, stock.body(undefined).css)
  })

  test("renders the folder rows without tag lists", () => {
    // The stock list still renders a tag list per row for this input. When a
    // folder-page upgrade stops doing that, the wrapper can go.
    const stockHtml = render(FolderPage().body(undefined)(props))
    assert.match(stockHtml, /<ul class="tags">/)

    const html = render(PresenceFolderPage().body(undefined)(props))
    assert.match(html, /class="page-listing"/)
    assert.match(html, /2 items under this folder\./)
    assert.match(html, /Spring essay/)
    assert.match(html, /Untagged essay/)
    assert.doesNotMatch(html, /class="tags"/)
    assert.doesNotMatch(html, /tags\//)
  })
})
