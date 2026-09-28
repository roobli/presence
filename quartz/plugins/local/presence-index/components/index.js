import { h } from "preact"
import { formatDate, isoDate } from "../../presence-shared/dates.js"
import { langOf, t } from "../../presence-shared/locale.js"
import {
  renderCard,
  renderHero,
  renderLedgerRow,
  renderWorkPlate,
} from "../../presence-shared/plates.js"
import {
  essaysForWork,
  HOME_ROWS,
  hrefOf,
  joined,
  selectEntries,
  selectEssays,
} from "../../presence-shared/rows.js"
import { indexSlugOf, SECTIONS, sectionOfIndex } from "../../presence-shared/sections.js"

/**
 * Home index.
 *
 * The homepage: the mast (a label line of counts, the thesis from index.md's
 * description, its intro and links), then Latest, the newest essay as the hero
 * plate with the next three as cards, then each work section's plates, then
 * the Index ledger of every essay, newest first, with "All writing (N)" past
 * HOME_ROWS. Essays come from every essay-kind section in sections.js.
 *
 * A section's own page (/writing/, /works/): an essay section's ledger,
 * grouped under year headings once the dates span more than one year; a work
 * section's plates. Section pages hide FolderPage's stock list
 * (_folder-listing.scss), and their page header already names the section.
 *
 * Every other page renders nothing.
 */

/** Cards after the hero on the homepage. */
const HOME_CARDS = 3

function mast(fm, lang, allFiles) {
  const links = (Array.isArray(fm.links) ? fm.links : []).filter(
    (link) => typeof link?.label === "string" && typeof link?.href === "string",
  )

  // The label line states what the site holds and when it last changed.
  const counts = []
  let newest = ""
  for (const section of SECTIONS.filter((candidate) => candidate.home)) {
    const entries = selectEntries(allFiles, section)
    if (entries.length === 0) continue
    const key = section.kind === "essay" ? "essaysCount" : "worksCount"
    counts.push(t(lang, key, { n: entries.length }))
    const date = isoDate(entries[0].frontmatter?.date) ?? ""
    if (date > newest) newest = date
  }
  if (newest) {
    counts.push(t(lang, "updated", { date: formatDate(newest, lang) }))
  }

  return h(
    "header",
    { class: "home-mast" },
    counts.length > 0
      ? h("p", { class: "plate-label home-label" }, joined(counts, "plate-sep"))
      : null,
    h("h1", { class: "home-thesis" }, fm.description ?? fm.title),
    typeof fm.intro === "string" && fm.intro.trim()
      ? h("p", { class: "home-intro" }, fm.intro)
      : null,
    links.length > 0
      ? h(
          "ul",
          { class: "home-links" },
          links.map((link) => h("li", null, h("a", { href: link.href }, link.label))),
        )
      : null,
  )
}

const yearOf = (file) => (isoDate(file.frontmatter?.date) ?? "").slice(0, 4)

// One ledger, or one per year under a year heading once the dates span years.
function byYear(essays, list) {
  const years = [...new Set(essays.map(yearOf))]
  if (years.length <= 1) return h("section", { class: "idx idx--ledger" }, list(essays))
  return years.map((year) =>
    h(
      "section",
      { class: "idx idx--ledger" },
      year ? h("h2", { class: "idx-year" }, year) : null,
      list(essays.filter((essay) => yearOf(essay) === year)),
    ),
  )
}

export const HomeIndex = () => {
  const Component = ({ fileData, allFiles }) => {
    const isHome = fileData.slug === "index"
    const own = isHome ? null : sectionOfIndex(fileData.slug)
    if (!isHome && !own) return null
    const lang = langOf(fileData)
    const ctx = { lang, allFiles }
    const ledger = (files) =>
      h(
        "ul",
        { class: "ledger" },
        files.map((file) => renderLedgerRow(file, ctx)),
      )
    const workPlates = (files) =>
      h(
        "ul",
        { class: "work-plates" },
        files.map((work) => renderWorkPlate(work, ctx, essaysForWork(work, allFiles))),
      )

    if (own) {
      const entries = selectEntries(allFiles, own)
      return h(
        "section",
        { class: "home home--folder" },
        own.kind === "essay"
          ? byYear(entries, ledger)
          : h("section", { class: "idx idx--works" }, workPlates(entries)),
      )
    }

    const essays = selectEssays(allFiles)
    const [hero, ...rest] = essays
    const cards = rest.slice(0, HOME_CARDS)
    const essayHome = SECTIONS.find((section) => section.home && section.kind === "essay")

    const latest = hero
      ? h(
          "section",
          { class: "feat", "aria-labelledby": "feat-label" },
          h(
            "div",
            { class: "feat-head" },
            h("h2", { id: "feat-label", class: "idx-label" }, t(lang, "latest")),
            h("p", { class: "feat-note" }, t(lang, "latestNote", { n: cards.length })),
          ),
          renderHero(hero, ctx),
          cards.length > 0
            ? h(
                "ul",
                { class: "cards" },
                cards.map((file, index) => renderCard(file, index, ctx)),
              )
            : null,
        )
      : null

    // Each homepage section of works, in sections.js order.
    const works = SECTIONS.filter((section) => section.home && section.kind !== "essay").map(
      (section) => {
        const entries = selectEntries(allFiles, section)
        if (entries.length === 0) return null
        const id = `idx-${section.id}`
        return h(
          "section",
          { class: "idx idx--works", "aria-labelledby": id },
          h("h2", { id, class: "idx-label" }, t(lang, section.label)),
          workPlates(entries),
        )
      },
    )

    const index =
      essays.length > 0
        ? h(
            "section",
            { class: "idx idx--ledger", "aria-labelledby": "idx-index" },
            h("h2", { id: "idx-index", class: "idx-label" }, t(lang, "index")),
            ledger(essays.slice(0, HOME_ROWS)),
            essays.length > HOME_ROWS && essayHome
              ? h(
                  "p",
                  { class: "idx-more" },
                  h(
                    "a",
                    { href: hrefOf(indexSlugOf(essayHome)) },
                    t(lang, "allWriting", { n: essays.length }),
                  ),
                )
              : null,
          )
        : null

    return h(
      "section",
      { class: "home" },
      mast(fileData.frontmatter ?? {}, lang, allFiles),
      latest,
      works,
      index,
    )
  }
  return Component
}
