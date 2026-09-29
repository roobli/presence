import test, { describe } from "node:test"
import assert from "node:assert"
import { generateRobotsTxt } from "./index.js"

describe("presence-feeds robots.txt", () => {
  test("allows every crawler everywhere and names the sitemap on the site's host", () => {
    const txt = generateRobotsTxt("www.roobli.org")
    assert.deepEqual(txt.split("\n"), [
      "User-agent: *",
      "Allow: /",
      "",
      "Sitemap: https://www.roobli.org/sitemap.xml",
      "",
    ])
  })
})
