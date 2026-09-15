import test, { describe } from "node:test"
import assert from "node:assert"
import { generateLlmsTxt } from "./index.js"

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
          filePath: "content/writing/keyboard-shortcut-systems.md",
          slug: "writing/keyboard-shortcut-systems",
          presence: { kind: "essay" },
          frontmatter: {
            title: "Keyboard shortcut systems",
            description: "From Emacs prefixes to Cmd+K.",
            date: "2026-09-11",
          },
          i18n: { lang: "en", base: "writing/keyboard-shortcut-systems", alternates: [] },
        },
        {
          filePath: "content/writing/keyboard-shortcut-systems.zh.md",
          slug: "writing/keyboard-shortcut-systems/zh",
          presence: { kind: "essay" },
          unlisted: true,
          frontmatter: { title: "快捷键系统", description: "中文版" },
          i18n: {
            lang: "zh-Hans",
            base: "writing/keyboard-shortcut-systems",
            alternates: [{ lang: "en", slug: "writing/keyboard-shortcut-systems" }],
          },
        },
        {
          filePath: "content/writing/index.md",
          slug: "writing/index",
          presence: { kind: "folder" },
          frontmatter: { title: "Writing" },
        },
      ],
    )

    assert.match(txt, /^# RoobLi\n/)
    assert.ok(txt.includes("> Fewer pages. Harder claims."))
    assert.ok(txt.includes("- Site: https://www.roobli.org/"))
    assert.ok(txt.includes("- About: https://www.roobli.org/about"))
    assert.ok(txt.includes("- Writing: https://www.roobli.org/writing/"))
    assert.ok(txt.includes("- Works: https://www.roobli.org/works/"))
    assert.ok(
      txt.includes(
        "- [Keyboard shortcut systems](https://www.roobli.org/writing/keyboard-shortcut-systems) — From Emacs prefixes to Cmd+K.",
      ),
    )
    assert.ok(!txt.includes("快捷键系统"), "zh translations stay out of the essay list")
    assert.ok(txt.includes("Internal RooB notes are not published"))
    assert.ok(txt.includes("中文："))
  })
})
