import { h } from "preact"
import { formatDate, isoDate } from "./dates.js"
import { isZh, langOf, t, ZH } from "./locale.js"
import { hrefOf, joined, readingMinutes, selectEntries, workLinks, workShot } from "./rows.js"
import { sectionOf, SECTIONS } from "./sections.js"
import { renderSpine } from "./spine.js"

// Markup for the index surfaces and the linked end matter.
//
// The notebook's grammar with a casebook's details: every entry carries its
// number in order of publication; title blocks set a page's facts as labelled
// fields; the featured essay is a night page (the theme's dark canvas) and the
// next three are index cards in the theme's code colours, each torn off along a
// perforated foot; the index is a ruled ledger with column heads.
//
// Plates carry an essay's claims, from its frontmatter:
//
//   claims:
//     - figure: "54%"
//       text: "of 2024 global software spend landed in the U.S."
//     - quote: "Harsh can be faked. Precise can't."
//
// A figure is a short value set large with a caption that completes the
// sentence; a quote is a line from the essay, verbatim. A plain string reads
// as a quote. Claims are optional: a plate without them shows the dek.
//
// Series and links: `series: "Name"` with `part: n` in frontmatter joins an
// essay to a series (seriesOf), and backlinksOf lists the entries that link to
// a page, from the links Quartz records for every file.

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

/**
 * Tags shown on a label line, leaving out one that only repeats the section's
 * name (a work tagged "works"). The page header reads it too.
 */
export function tagsOf(file, max) {
  const section = sectionOf(file.slug)?.id ?? ""
  return (Array.isArray(file.frontmatter?.tags) ? file.frontmatter.tags : [])
    .filter((tag) => typeof tag === "string" && tag.trim() && tag.toLowerCase() !== section)
    .slice(0, max)
}

// A block in a language other than the page's says so.
const langIfOther = (own, other) => (own === other ? undefined : own)

const baseSlug = (file) => file.i18n?.base ?? file.slug
const translationOf = (file) => file.i18n?.alternates?.find((version) => isZh(version.lang))

/** The 中文 link an entry offers when it has a translation. */
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

function timeEl(file, lang) {
  const date = dateOf(file)
  return date ? h("time", { datetime: date }, formatDate(date, lang)) : null
}

/**
 * An entry's number in its section, in order of publication: the oldest is 1.
 * A translation takes its original's number. Null outside a section.
 */
export function entryNumber(file, allFiles) {
  const base = baseSlug(file)
  const section = sectionOf(base)
  if (!section) return null
  const oldestFirst = selectEntries(allFiles, section).reverse()
  const index = oldestFirst.findIndex((entry) => entry.slug === base)
  return index < 0 ? null : index + 1
}

function numberLabel(file, ctx) {
  const n = entryNumber(file, ctx.allFiles)
  return n ? h("span", { class: "entry-no" }, t(ctx.lang, "no", { n })) : null
}

/**
 * A title block: facts as labelled fields in a ruled row, the way a casebook
 * heads a case or a drawing its sheet. cells is [{ label, value }]; a cell
 * with no value is left out.
 */
export function renderTitleBlock(cells, className = "") {
  const kept = cells.filter((cell) => cell.value !== null && cell.value !== undefined)
  if (kept.length === 0) return null
  return h(
    "dl",
    { class: `titleblock ${className}`.trim() },
    kept.map((cell) =>
      h("div", { class: "tb-cell" }, h("dt", null, cell.label), h("dd", null, cell.value)),
    ),
  )
}

/** A section's head on the index: its name set large and a note beside it. */
export function renderSectionHead(id, label, note) {
  return h(
    "div",
    { class: "sec-head" },
    h("h2", { id, class: "sec-title" }, label),
    note ? h("p", { class: "sec-note" }, note) : null,
  )
}

// A plate's foot: the spine, the perforation, then the facts line.
function plateFoot(file, own, lang, facts, go) {
  return h(
    "footer",
    { class: "plate-foot", lang: langIfOther(lang, own) },
    renderSpine(file.presence),
    h("div", { class: "perf", "aria-hidden": "true" }),
    h(
      "p",
      { class: "plate-facts" },
      h("span", null, joined(facts, "plate-sep")),
      go ? h("span", { class: "plate-go", "aria-hidden": "true" }, go) : null,
    ),
  )
}

/**
 * The hero: the newest essay as a night page. Its number, section and tags on
 * the label line, the full title, the dek and a call to read, with its claims
 * in a column beside them and a torn-off foot.
 */
export function renderHero(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const href = hrefOf(file.slug)
  const fm = file.frontmatter ?? {}
  const section = sectionOf(file.slug)
  const claims = claimsOf(file).slice(0, 3)
  const label = [
    numberLabel(file, ctx),
    section ? t(lang, section.label) : null,
    ...tagsOf(file, 2),
  ].filter(Boolean)
  const facts = [timeEl(file, lang), ...shortFacts(file, ctx), zhLink(file, "plate-alt")].filter(
    Boolean,
  )

  return h(
    "article",
    { class: "plate plate--night hero", lang: langIfOther(own, lang) },
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
    plateFoot(file, own, lang, facts, null),
  )
}

const CARD_TONES = ["slate", "sage", "clay"]

/**
 * An index card: number and first tag on the label line, the short title, the
 * essay's first claim set large (a figure with its caption, or a quote), else
 * its dek, then a torn-off foot. The title's link covers the whole card; the
 * foot's "Read" is its visible cue. Tones run slate, sage, clay by position.
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

  // A card's foot has room for the date and the reading time; the live
  // figures are on the ledger row below.
  const minutes = readingMinutes(file, ctx.allFiles)
  const facts = [timeEl(file, lang), minutes ? t(lang, "minShort", { n: minutes }) : null].filter(
    Boolean,
  )
  return h(
    "li",
    { class: `plate plate--${tone} card`, lang: langIfOther(own, lang) },
    h(
      "p",
      { class: "plate-label plate-label--split", lang: langIfOther(lang, own) },
      numberLabel(file, ctx),
      tag ? h("span", null, tag) : null,
    ),
    h(
      "h3",
      { class: "card-title" },
      h("a", { class: "card-link", href, title: titleOf(file) }, shortTitle(file)),
    ),
    h("div", { class: "card-body" }, body),
    plateFoot(file, own, lang, facts, [t(lang, "read"), " →"]),
  )
}

/** The ledger's column heads, drawn once above its rows on wide screens. */
export function renderLedgerHead(lang) {
  return h(
    "li",
    { class: "ledger-head", "aria-hidden": "true" },
    h("span", null, t(lang, "colNo")),
    h("span", null, t(lang, "colDate")),
    h("span", null, t(lang, "colEntry")),
    h("span", null, t(lang, "colReading")),
  )
}

/**
 * One ledger row: the entry's number and date in the margin, then title, dek
 * and spine, then the short facts and the 中文 link. The index on the
 * homepage, the section pages and the end matter all use it.
 */
export function renderLedgerRow(file, ctx) {
  const { lang, allFiles } = ctx
  const own = langOf(file)
  const fm = file.frontmatter ?? {}
  const n = entryNumber(file, allFiles)
  const facts = [...shortFacts(file, ctx), zhLink(file, "idx-alt")].filter(Boolean)
  return h(
    "li",
    { class: "ledger-row", lang: langIfOther(own, lang) },
    h(
      "p",
      { class: "ledger-no", lang: langIfOther(lang, own) },
      n ? String(n).padStart(3, "0") : null,
    ),
    h("p", { class: "ledger-date", lang: langIfOther(lang, own) }, timeEl(file, lang)),
    h(
      "div",
      { class: "ledger-body" },
      h("h3", { class: "ledger-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
      fm.description ? h("p", { class: "ledger-dek" }, fm.description) : null,
      renderSpine(file.presence),
    ),
    h(
      "p",
      { class: "ledger-meta", lang: langIfOther(lang, own) },
      facts.length > 0 ? joined(facts, "plate-sep") : null,
    ),
  )
}

/** A ruled ledger of entries, with column heads unless head is false. */
export function renderLedger(files, ctx, { head = true } = {}) {
  return h(
    "ul",
    { class: head ? "ledger" : "ledger ledger--bare" },
    head ? renderLedgerHead(ctx.lang) : null,
    files.map((file) => renderLedgerRow(file, ctx)),
  )
}

/**
 * A work plate: the screenshot, then its number, date and tags, the title,
 * the dek and the work's links, with the essays about it last.
 */
export function renderWorkPlate(work, ctx, essays = []) {
  const { lang } = ctx
  const own = langOf(work)
  const fm = work.frontmatter ?? {}
  const href = hrefOf(work.slug)
  const shot = workShot(work, { className: "work-plate-shot" })
  const links = workLinks(work, lang, { essays })
  const label = [numberLabel(work, ctx), timeEl(work, lang), ...tagsOf(work, 2)].filter(Boolean)
  return h(
    "li",
    { class: "plate plate--paper work-plate", lang: langIfOther(own, lang) },
    shot
      ? h("a", { class: "work-plate-media", href, tabindex: "-1", "aria-hidden": "true" }, shot)
      : null,
    h(
      "div",
      { class: "work-plate-body" },
      h("p", { class: "plate-label", lang: langIfOther(lang, own) }, joined(label, "plate-sep")),
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

// --- links between entries ---------------------------------------------------

// Listed entries of every section, translations and section pages left out.
const allEntries = (allFiles) => SECTIONS.flatMap((section) => selectEntries(allFiles, section))

/**
 * The series an entry belongs to: { name, parts, index } with parts in order
 * (frontmatter part, then date), or null. A translation reads its original's.
 */
export function seriesOf(file, allFiles) {
  const base = allFiles.find((candidate) => candidate.slug === baseSlug(file)) ?? file
  const name = base.frontmatter?.series
  if (typeof name !== "string" || !name.trim()) return null
  const partOf = (entry) =>
    Number.isInteger(entry.frontmatter?.part) ? entry.frontmatter.part : Infinity
  const parts = allEntries(allFiles)
    .filter((entry) => entry.frontmatter?.series === name)
    .sort((a, b) => partOf(a) - partOf(b) || (dateOf(a) ?? "").localeCompare(dateOf(b) ?? ""))
  const index = parts.findIndex((entry) => entry.slug === base.slug)
  return index < 0 ? null : { name: name.trim(), parts, index }
}

/**
 * Entries that link to this page, newest first. A translation lists its
 * original's. The page itself is left out.
 */
export function backlinksOf(file, allFiles) {
  const target = baseSlug(file)
  return allEntries(allFiles).filter(
    (entry) => entry.slug !== target && (entry.links ?? []).includes(target),
  )
}
