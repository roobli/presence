import { h } from "preact"
import { formatDate, isoDate } from "./dates.js"
import { isZh, langOf, t, ZH } from "./locale.js"
import { hrefOf, joined, readingMinutes, workLinks, workShot } from "./rows.js"
import { sectionOf } from "./sections.js"
import { renderSpine } from "./spine.js"

// Markup for the index surfaces: the homepage hero and cards ("plates"), the
// index ledger on the homepage, section pages and end matter, and the work
// plate. Plates carry an essay's claims, from its frontmatter:
//
//   claims:
//     - figure: "54%"
//       text: "of 2024 global software spend landed in the U.S."
//     - quote: "Harsh can be faked. Precise can't."
//
// A figure is a short value set large, its text a caption that completes the
// sentence; a quote is a line from the essay, verbatim. A plain string is read
// as a quote. Claims are optional: a plate without them falls back to the dek.

/** An entry's claims as { figure, text } or { quote }, dropping malformed ones. */
export function claimsOf(file) {
  const raw = file.frontmatter?.claims
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) out.push({ quote: item.trim() })
    else if (typeof item?.quote === "string" && item.quote.trim()) {
      out.push({ quote: item.quote.trim() })
    } else if (typeof item?.figure === "string" || typeof item?.figure === "number") {
      const figure = String(item.figure).trim()
      const text = typeof item.text === "string" ? item.text.trim() : ""
      if (figure) out.push({ figure, text })
    }
  }
  return out
}

// A trailing unit (%, ×) is set smaller than the number it follows.
function figureParts(figure) {
  const match = /^(.*?[^\s])\s?(%|×)$/.exec(figure)
  return match ? [match[1], match[2]] : [figure, null]
}

function renderFigure(figure, className) {
  const [value, unit] = figureParts(figure)
  return h("p", { class: className }, value, unit ? h("span", { class: "fig-unit" }, unit) : null)
}

const titleOf = (file) => file.frontmatter?.title ?? file.slug

// The part of a title before a spaced em dash, for plates with little room.
function shortTitle(file) {
  const title = titleOf(file)
  const cut = title.indexOf(" — ")
  return cut > 0 ? title.slice(0, cut) : title
}

// Tags shown on a plate's label line, leaving out one that only repeats the
// section's name (a work tagged "works").
function tagsOf(file, max) {
  const section = sectionOf(file.slug)?.id ?? ""
  return (Array.isArray(file.frontmatter?.tags) ? file.frontmatter.tags : [])
    .filter((tag) => typeof tag === "string" && tag.trim() && tag.toLowerCase() !== section)
    .slice(0, max)
}

// A row or plate in a language other than the page's says so.
const langIfOther = (own, other) => (own === other ? undefined : own)

const translationOf = (file) => file.i18n?.alternates?.find((version) => isZh(version.lang))

// The 中文 link a row offers when the essay has a translation.
function zhLink(file, className) {
  const translation = translationOf(file)
  if (!translation) return null
  return h(
    "a",
    { class: className, href: hrefOf(translation.slug), lang: ZH, hreflang: ZH, rel: "alternate" },
    "中文",
  )
}

// Reading time and live figures in the short form plates use.
function shortFacts(file, { lang, allFiles }) {
  const facts = []
  const minutes = readingMinutes(file, allFiles)
  if (minutes) facts.push(t(lang, "minShort", { n: minutes }))
  const figures = file.presence?.figures?.length ?? 0
  if (figures > 0) facts.push(t(lang, "figuresShort", { n: figures }))
  return facts
}

const dateOf = (file) => isoDate(file.frontmatter?.date)

function timeEl(file, lang, className) {
  const date = dateOf(file)
  return date ? h("time", { class: className, datetime: date }, formatDate(date, lang)) : null
}

/**
 * The hero plate: the newest essay with its label line (section, tags, date),
 * full title, dek, a call to read, and its claims in a column beside it. The
 * foot carries the spine and the short facts.
 */
export function renderHero(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const href = hrefOf(file.slug)
  const fm = file.frontmatter ?? {}
  const section = sectionOf(file.slug)
  const claims = claimsOf(file).slice(0, 3)
  const label = [
    section ? t(lang, section.label) : null,
    ...tagsOf(file, 2),
    dateOf(file) ? h("time", { datetime: dateOf(file) }, dateOf(file)) : null,
  ].filter(Boolean)
  const facts = [...shortFacts(file, ctx), zhLink(file, "plate-alt")].filter(Boolean)

  return h(
    "article",
    { class: "plate plate--ink hero", lang: langIfOther(own, lang) },
    h(
      "div",
      { class: "hero-main" },
      h("p", { class: "plate-label", lang: langIfOther(lang, own) }, joined(label, "plate-sep")),
      h("h3", { class: "hero-title" }, h("a", { href }, titleOf(file))),
      fm.description ? h("p", { class: "hero-dek" }, fm.description) : null,
      h(
        "p",
        { class: "hero-cta", lang: langIfOther(lang, own) },
        h(
          "a",
          { class: "cta", href },
          t(lang, "readEssay"),
          h("span", { "aria-hidden": "true" }, "→"),
        ),
      ),
    ),
    claims.length > 0
      ? h(
          "ul",
          { class: "hero-claims" },
          claims.map((claim) =>
            claim.quote
              ? h("li", { class: "claim claim--quote" }, h("q", null, claim.quote))
              : h(
                  "li",
                  { class: "claim" },
                  renderFigure(claim.figure, "claim-figure"),
                  claim.text ? h("p", { class: "claim-text" }, claim.text) : null,
                ),
          ),
        )
      : null,
    h(
      "footer",
      { class: "plate-foot", lang: langIfOther(lang, own) },
      renderSpine(file.presence),
      facts.length > 0 ? h("p", { class: "plate-facts" }, joined(facts, "plate-sep")) : null,
    ),
  )
}

const CARD_TONES = ["vellum", "ink", "clay"]

/**
 * A card plate: date and first tag on the label line, the short title, then
 * the essay's first claim set large (a figure with its caption, or a quote),
 * else its dek. The foot carries the spine, the short facts and a read link.
 * Tones cycle vellum, ink, clay by position.
 */
export function renderCard(file, index, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const href = hrefOf(file.slug)
  const fm = file.frontmatter ?? {}
  const tone = CARD_TONES[index % CARD_TONES.length]
  const claim = claimsOf(file)[0]
  const [tag] = tagsOf(file, 1)

  let body
  if (claim?.figure) {
    body = [
      renderFigure(claim.figure, "card-figure"),
      claim.text ? h("p", { class: "card-caption" }, claim.text) : null,
    ]
  } else if (claim?.quote) {
    body = h("blockquote", { class: "card-quote" }, h("p", null, claim.quote))
  } else {
    body = fm.description ? h("p", { class: "card-caption" }, fm.description) : null
  }

  return h(
    "li",
    { class: `plate plate--${tone} card`, lang: langIfOther(own, lang) },
    h(
      "p",
      { class: "plate-label plate-label--split", lang: langIfOther(lang, own) },
      timeEl(file, lang, null),
      tag ? h("span", null, tag) : null,
    ),
    h("h3", { class: "card-title" }, h("a", { href, title: titleOf(file) }, shortTitle(file))),
    h("div", { class: "card-body" }, body),
    h(
      "footer",
      { class: "plate-foot", lang: langIfOther(lang, own) },
      renderSpine(file.presence),
      h(
        "p",
        { class: "plate-facts plate-facts--split" },
        h("span", null, joined(shortFacts(file, ctx), "plate-sep")),
        h(
          "a",
          { class: "plate-go", href, tabindex: "-1", "aria-hidden": "true" },
          t(lang, "read"),
          " →",
        ),
      ),
    ),
  )
}

/**
 * One ledger row: the date in the margin, then title, dek and spine, then the
 * short facts and the 中文 link. The index on the homepage, the section pages
 * and the end matter all use it.
 */
export function renderLedgerRow(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const fm = file.frontmatter ?? {}
  const facts = [...shortFacts(file, ctx), zhLink(file, "idx-alt")].filter(Boolean)
  return h(
    "li",
    { class: "ledger-row", lang: langIfOther(own, lang) },
    h("p", { class: "ledger-date", lang: langIfOther(lang, own) }, timeEl(file, lang, null)),
    h(
      "div",
      { class: "ledger-body" },
      h("h3", { class: "ledger-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
      fm.description ? h("p", { class: "ledger-dek" }, fm.description) : null,
      renderSpine(file.presence),
    ),
    facts.length > 0
      ? h("p", { class: "ledger-meta", lang: langIfOther(lang, own) }, joined(facts, "plate-sep"))
      : null,
  )
}

/**
 * A work plate: the screenshot, then a label line, the title, the dek and the
 * work's links, with the essays about it last.
 */
export function renderWorkPlate(work, ctx, essays = []) {
  const { lang } = ctx
  const own = langOf(work)
  const fm = work.frontmatter ?? {}
  const href = hrefOf(work.slug)
  const shot = workShot(work, { className: "work-plate-shot" })
  const links = workLinks(work, lang, { essays })
  const date = dateOf(work)
  const label = [date ? h("time", { datetime: date }, date) : null, ...tagsOf(work, 2)].filter(
    Boolean,
  )
  return h(
    "li",
    { class: "plate plate--paper work-plate", lang: langIfOther(own, lang) },
    shot
      ? h("a", { class: "work-plate-media", href, tabindex: "-1", "aria-hidden": "true" }, shot)
      : null,
    h(
      "div",
      { class: "work-plate-body" },
      label.length > 0
        ? h("p", { class: "plate-label", lang: langIfOther(lang, own) }, joined(label, "plate-sep"))
        : null,
      h("h3", { class: "work-plate-title" }, h("a", { href }, titleOf(work))),
      fm.description ? h("p", { class: "work-plate-dek" }, fm.description) : null,
      links.length > 0
        ? h(
            "p",
            { class: "work-plate-links", lang: langIfOther(lang, own) },
            joined(links, "plate-sep"),
          )
        : null,
    ),
  )
}
