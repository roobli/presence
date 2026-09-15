import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import vm from "vm"
import { render } from "preact-render-to-string"
import {
  BODY_FONT_HREF,
  ITALIC_FONT_HREF,
  ITALIC_UNICODE_RANGE,
  PERSON_ID,
  WEBSITE_ID,
  additionalHead,
  buildJsonLdGraph,
  italicFaceScript,
  personNode,
  safeJsonLd,
  structuredDataHead,
} from "./head.js"

const quartzDir = new URL("../../../", import.meta.url)
const TEXT_STACK = '"Source Serif 4 Variable", "SS4 Fallback Georgia", Georgia, serif'

function staticHead(ctx = {}) {
  return additionalHead(ctx).filter((node) => typeof node !== "function")
}

function jsonLdFor(fileData, cfg = { baseUrl: "www.roobli.org" }) {
  return buildJsonLdGraph(cfg, fileData)
}

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
    const html = render(staticHead({}))
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

describe("presence-derive JSON-LD", () => {
  test("Person uses one stable @id and only known sameAs links", () => {
    const person = personNode()
    assert.equal(person["@id"], PERSON_ID)
    assert.equal(PERSON_ID, "https://www.roobli.org/about#person")
    assert.deepEqual(person.sameAs, ["https://github.com/lr00rl", "https://github.com/roobli"])
    assert.equal(person.url, "https://www.roobli.org/about")
  })

  test("homepage emits WebSite + Person sharing publisher @id", () => {
    const data = jsonLdFor({
      slug: "index",
      presence: { kind: "home" },
      frontmatter: { title: "RoobLi", description: "Fewer pages. Harder claims." },
    })
    assert.ok(data)
    const types = data["@graph"].map((n) => n["@type"])
    assert.deepEqual(types, ["WebSite", "Person"])
    const site = data["@graph"][0]
    assert.equal(site["@id"], WEBSITE_ID)
    assert.equal(site.name, "RoobLi")
    assert.equal(site.url, "https://www.roobli.org/")
    assert.equal(site.publisher["@id"], PERSON_ID)
    assert.equal(site.description, "Fewer pages. Harder claims.")
    assert.equal(data["@graph"][1]["@id"], PERSON_ID)
    // No SearchAction: site search is client-side, not a URL endpoint.
    assert.equal(site.potentialAction, undefined)
  })

  test("about page emits the same Person @id", () => {
    const data = jsonLdFor({ slug: "about", presence: { kind: "page" }, frontmatter: { title: "About" } })
    const person = data["@graph"].find((n) => n["@type"] === "Person")
    assert.equal(person["@id"], PERSON_ID)
  })

  test("essay emits Article with author @id matching Person and isPartOf WebSite", () => {
    const data = jsonLdFor({
      slug: "writing/keyboard-shortcut-systems",
      presence: { kind: "essay" },
      frontmatter: {
        title: "Keyboard shortcut systems",
        description: "A design history.",
        date: "2026-09-11",
        lang: "en",
      },
      i18n: {
        lang: "en",
        base: "writing/keyboard-shortcut-systems",
        alternates: [{ lang: "zh-Hans", slug: "writing/keyboard-shortcut-systems/zh" }],
      },
    })
    const article = data["@graph"].find((n) => n["@type"] === "Article")
    const person = data["@graph"].find((n) => n["@type"] === "Person")
    const site = data["@graph"].find((n) => n["@type"] === "WebSite")
    assert.equal(article.headline, "Keyboard shortcut systems")
    assert.equal(article.description, "A design history.")
    assert.equal(article.datePublished, "2026-09-11")
    assert.equal(article.dateModified, "2026-09-11")
    assert.equal(article.inLanguage, "en")
    assert.equal(article.author["@id"], PERSON_ID)
    assert.equal(person["@id"], PERSON_ID)
    assert.equal(article.isPartOf["@id"], WEBSITE_ID)
    assert.equal(site["@id"], WEBSITE_ID)
    assert.equal(article.url, "https://www.roobli.org/writing/keyboard-shortcut-systems")
    assert.equal(article.mainEntityOfPage["@id"], article.url)
    assert.deepEqual(article.workTranslation, [
      {
        "@type": "Article",
        url: "https://www.roobli.org/writing/keyboard-shortcut-systems/zh",
        inLanguage: "zh-Hans",
      },
    ])
  })

  test("zh essay uses zh-Hans and omits workTranslation when unpaired", () => {
    const data = jsonLdFor({
      slug: "writing/keyboard-shortcut-systems/zh",
      presence: { kind: "essay" },
      frontmatter: { title: "快捷键系统", description: "简述", date: "2026-09-11" },
      i18n: { lang: "zh-Hans", base: "writing/keyboard-shortcut-systems", alternates: [] },
    })
    const article = data["@graph"].find((n) => n["@type"] === "Article")
    assert.equal(article.inLanguage, "zh-Hans")
    assert.equal(article.workTranslation, undefined)
    assert.equal(article.author["@id"], PERSON_ID)
  })

  test("works and folder pages skip JSON-LD in v1", () => {
    assert.equal(
      jsonLdFor({ slug: "works/cuda-cpp-course", presence: { kind: "work" }, frontmatter: {} }),
      null,
    )
    assert.equal(jsonLdFor({ slug: "writing/index", presence: { kind: "folder" }, frontmatter: {} }), null)
  })

  test("safeJsonLd escapes angle brackets for script embedding", () => {
    const html = render(
      structuredDataHead(
        { baseUrl: "www.roobli.org" },
        {
          slug: "writing/demo",
          presence: { kind: "essay" },
          frontmatter: { title: "A <script> title", description: "x", date: "2026-09-11" },
        },
      ),
    )
    assert.match(html, /type="application\/ld\+json"/)
    assert.ok(html.includes("\\u003cscript>"))
    assert.ok(!html.includes("<script> title"))
    const payload = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
    assert.doesNotThrow(() => JSON.parse(payload))
    assert.equal(safeJsonLd({ a: "</script>" }), '{"a":"\\u003c/script>"}')
  })

  test("additionalHead includes a per-page JSON-LD function", () => {
    const resources = additionalHead({ cfg: { configuration: { baseUrl: "www.roobli.org" } } })
    const fn = resources.find((node) => typeof node === "function")
    assert.equal(typeof fn, "function")
    const html = render(
      fn({
        slug: "index",
        presence: { kind: "home" },
        frontmatter: { description: "Fewer pages. Harder claims." },
      }),
    )
    assert.match(html, /application\/ld\+json/)
    assert.ok(html.includes(PERSON_ID))
  })
})
