import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import vm from "vm"
import { render } from "preact-render-to-string"
import {
  BODY_FONT_HREF,
  ITALIC_FONT_HREF,
  ITALIC_UNICODE_RANGE,
  additionalHead,
  italicFaceScript,
} from "./head.js"

const quartzDir = new URL("../../../", import.meta.url)
const TEXT_STACK = '"Source Serif 4 Variable", "SS4 Fallback Georgia", Georgia, serif'

// Runs the serialized script against a stub page: listeners, computed styles and FontFace.
function stubPage(elements) {
  const listeners = { window: {}, document: {} }
  const on = (target) => (type, fn) => (listeners[target][type] ??= []).push(fn)
  const created = []
  const added = []
  const document = {
    readyState: "interactive",
    querySelectorAll: () => elements,
    addEventListener: on("document"),
    fonts: { add: (face) => added.push(face) },
  }
  class FontFace {
    constructor(family, source, descriptors) {
      Object.assign(this, { family, source, descriptors })
      created.push(this)
    }
    load() {
      return Promise.resolve(this)
    }
  }
  vm.runInContext(
    italicFaceScript,
    vm.createContext({
      document,
      FontFace,
      getComputedStyle: (el) => el.style,
      addEventListener: on("window"),
    }),
  )
  const fire = async (target, type) => {
    for (const fn of listeners[target][type] ?? []) fn()
    await new Promise((resolve) => setImmediate(resolve))
  }
  return { document, created, added, fire }
}

const el = (fontStyle, fontFamily = TEXT_STACK) => ({ style: { fontStyle, fontFamily } })

describe("presence-derive head", () => {
  test("renders the body font preload and the italic script", () => {
    const html = render(additionalHead({}))
    assert.match(html, /<link rel="preload" href="[^"]+normal\.woff2" as="font" type="font\/woff2"/)
    assert.ok(html.includes(`href="${BODY_FONT_HREF}"`))
    assert.ok(html.includes("crossorigin"))
    assert.ok(html.includes(`<script>${italicFaceScript}</script>`))
    for (const href of [BODY_FONT_HREF, ITALIC_FONT_HREF]) {
      assert.ok(fs.existsSync(new URL("." + href, quartzDir)), `${href} is missing`)
    }
  })

  test("the script compiles as strict code", () => {
    assert.doesNotThrow(() => new vm.Script('"use strict";' + italicFaceScript))
  })

  test("adds the italic face once, after load, when italic text uses the text face", async () => {
    const page = stubPage([el("normal"), el("italic")])
    await page.fire("document", "nav")
    assert.equal(page.created.length, 0, "nothing before load")

    page.document.readyState = "complete"
    await page.fire("window", "load")
    assert.equal(page.created.length, 1)
    assert.deepEqual(page.added, page.created)
    const [face] = page.created
    assert.equal(face.family, "Source Serif 4 Variable")
    assert.ok(face.source.includes(ITALIC_FONT_HREF))
    assert.deepEqual(face.descriptors, {
      style: "italic",
      weight: "200 900",
      display: "swap",
      unicodeRange: ITALIC_UNICODE_RANGE,
    })

    await page.fire("document", "nav")
    assert.equal(page.created.length, 1, "later navigations reuse the face")
  })

  test("skips upright emphasis and other faces, then registers on a later navigation", async () => {
    const elements = [el("normal"), el("italic", "ui-monospace, monospace")]
    const page = stubPage(elements)
    page.document.readyState = "complete"
    await page.fire("window", "load")
    assert.equal(page.created.length, 0)

    elements.push(el("italic"))
    await page.fire("document", "nav")
    assert.equal(page.created.length, 1)
  })

  test("uses the same unicode-range as the Latin normal face in the stylesheet", () => {
    const scss = fs.readFileSync(new URL("styles/custom/_site-tokens.scss", quartzDir), "utf8")
    const block = scss
      .split("@font-face")
      .find((rule) => rule.includes("Source Serif 4 Variable") && rule.includes("latin-wght-normal"))
    const range = block.match(/unicode-range:([^;]+);/)[1].replace(/\s+/g, " ").trim()
    assert.equal(range, ITALIC_UNICODE_RANGE)
  })
})
