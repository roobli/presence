import test, { describe } from "node:test"
import assert from "node:assert"
import { generateLlmsTxt, guidLine } from "./index.js"

describe("presence-feeds llms.txt", () => {
  test("lists site map and English essays from page data", () => {
    const txt = generateLlmsTxt(
      { baseUrl: "www.roobli.org", pageTitle: "RoobLi" },
      [
        {
          filePath: "content/index.md",
          slug: "index",
          frontmatter: { title: "RoobLi", description: "Fewer pages. Harder claims." },
        },
        {
          filePath: "content/essays/keyboard-shortcut-systems.md",
          slug: "essays/keyboard-shortcut-systems",
          presence: { kind: "essay" },
          frontmatter: {
            title: "Keyboard shortcut systems",
            description: "From Emacs prefixes to Cmd+K.",
            date: "2026-09-11",
          },
          i18n: { lang: "en", base: "essays/keyboard-shortcut-systems", alternates: [] },
        },
        {
          filePath: "content/essays/keyboard-shortcut-systems.zh.md",
          slug: "essays/keyboard-shortcut-systems/zh",
          presence: { kind: "essay" },
          unlisted: true,
          frontmatter: { title: "快捷键系统", description: "中文版" },
          i18n: {
            lang: "zh-Hans",
            base: "essays/keyboard-shortcut-systems",
            alternates: [{ lang: "en", slug: "essays/keyboard-shortcut-systems" }],
          },
        },
        {
          filePath: "content/essays/index.md",
          slug: "essays/index",
          presence: { kind: "folder" },
          frontmatter: { title: "Essays" },
        },
        {
          filePath: "content/notes/reading-log.md",
          slug: "notes/reading-log",
          presence: { kind: "essay", entry: "note" },
          frontmatter: { title: "Reading log", description: "Four books.", date: "2026-09-26" },
          i18n: { lang: "en", base: "notes/reading-log", alternates: [] },
        },
      ],
    )

    assert.match(txt, /^# RoobLi\n/)
    assert.ok(txt.includes("> Fewer pages. Harder claims."))
    assert.ok(txt.includes("- Site: https://www.roobli.org/"))
    assert.ok(txt.includes("- About: https://www.roobli.org/about"))
    assert.ok(txt.includes("- Essays: https://www.roobli.org/essays/"))
    assert.ok(txt.includes("- Series: https://www.roobli.org/series/"))
    assert.ok(txt.includes("- Projects: https://www.roobli.org/projects/"))
    assert.ok(txt.includes("- Notes: https://www.roobli.org/notes/"))
    assert.ok(
      txt.includes(
        "- [Keyboard shortcut systems](https://www.roobli.org/essays/keyboard-shortcut-systems) — From Emacs prefixes to Cmd+K.",
      ),
    )
    assert.ok(!txt.includes("快捷键系统"), "zh translations stay out of the essay list")
    // A section with entries gets its own list; an empty one is left out.
    assert.ok(txt.includes("## Notes\n\n- [Reading log](https://www.roobli.org/notes/reading-log) — Four books."))
    assert.ok(!txt.includes("## Series"))
    assert.ok(!txt.includes("## Projects"))
    assert.ok(txt.includes("Internal RooB notes are not published"))
    assert.ok(txt.includes("中文："))
  })
})

describe("presence-feeds index.xml", () => {
  test("a moved page keeps the feed ID it was first published under", () => {
    const url = "https://www.roobli.org/essays/keyboard"
    assert.equal(
      guidLine({ guid: "https://www.roobli.org/writing/keyboard" }, url).trim(),
      '<guid isPermaLink="false">https://www.roobli.org/writing/keyboard</guid>',
    )
    assert.equal(guidLine({}, url).trim(), `<guid isPermaLink="true">${url}</guid>`)
  })
})
