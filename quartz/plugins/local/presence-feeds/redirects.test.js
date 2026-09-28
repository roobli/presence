import test, { describe } from "node:test"
import assert from "node:assert"
import { generateRedirects, redirectRules } from "./redirects.js"

const page = (slug, aliases) => ({ filePath: `content/${slug}.md`, slug, aliases })

describe("presence-feeds _redirects", () => {
  test("an alias answers 301 with its page's canonical path", () => {
    assert.deepEqual(redirectRules([page("essays/foo", ["writing/foo"])]), [
      ["/writing/foo", "/essays/foo"],
    ])
  })

  test("a folder alias redirects with and without its slash to the folder", () => {
    assert.deepEqual(redirectRules([page("essays/index", ["writing/index"])]), [
      ["/writing", "/essays/"],
      ["/writing/", "/essays/"],
    ])
  })

  test("a translation's older forms all lead to its own path", () => {
    const rules = redirectRules([
      page("essays/foo/zh", ["writing/foo/zh", "zh/writing/foo", "essays/foo.zh"]),
    ])
    assert.deepEqual(rules, [
      ["/essays/foo.zh", "/essays/foo/zh"],
      ["/writing/foo/zh", "/essays/foo/zh"],
      ["/zh/writing/foo", "/essays/foo/zh"],
    ])
  })

  test("an alias that is a live page is skipped, so the page is not hidden", () => {
    const rules = redirectRules([page("essays/foo", ["essays/bar"]), page("essays/bar", [])])
    assert.deepEqual(rules, [])
  })

  test("a relative alias resolves against the page, as alias-redirects reads it", () => {
    assert.deepEqual(redirectRules([page("essays/foo", ["./old-foo"])]), [
      ["/essays/old-foo", "/essays/foo"],
    ])
  })

  test("the first page to claim an alias keeps it", () => {
    const rules = redirectRules([page("essays/a", ["writing/x"]), page("essays/b", ["writing/x"])])
    assert.deepEqual(rules, [["/writing/x", "/essays/a"]])
  })

  test("paths are percent-encoded as in the canonical link", () => {
    assert.deepEqual(redirectRules([page("essays/café", ["writing/café"])]), [
      ["/writing/caf%C3%A9", "/essays/caf%C3%A9"],
    ])
  })

  test("the file is comment lines, then one 301 rule per line", () => {
    const text = generateRedirects([page("essays/foo", ["writing/foo"]), page("about", [])])
    const rules = text.split("\n").filter((line) => line && !line.startsWith("#"))
    assert.deepEqual(rules, ["/writing/foo /essays/foo 301"])
    assert.ok(text.endsWith("\n"))
  })
})
