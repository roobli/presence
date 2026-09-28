import { h } from "preact"
import { formatDate, isoDate } from "../../presence-shared/dates.js"
import { isZh, langOf, t } from "../../presence-shared/locale.js"
import {
  renderCard,
  renderHero,
  renderLedger,
  renderSectionHead,
  renderTitleBlock,
  renderWorkPlate,
} from "../../presence-shared/plates.js"
import {
  essaysForWork,
  HOME_ROWS,
  hrefOf,
  selectEntries,
  selectEssays,
} from "../../presence-shared/rows.js"
import { indexSlugOf, SECTIONS, sectionOfIndex } from "../../presence-shared/sections.js"

/**
 * Home index.
 *
 * The homepage opens like a notebook's first page: the thesis (index.md's
 * description) and intro, then a title block of what the notebook holds, when
 * it began and when it last changed, and where else to find it. Then Latest:
 * the newest essay as the night-page hero and the next three as index cards.
 * Then each work section's plates, then the Index ledger of every essay,
 * newest first, with "All writing (N)" past HOME_ROWS. Essays come from every
 * essay-kind section in sections.js.
 *
 * A section's own page (/writing/, /works/) opens with the section's title
 * block, then its ledger (essays) or plates (works). Section pages hide
 * FolderPage's stock list (_folder-listing.scss), and their page header
 * already names the section.
 *
 * Every other page renders nothing.
 */

/** Cards after the hero on the homepage. */
const HOME_CARDS = 3

const pad = (n) => String(n).padStart(2, "0")
const dateOf = (file) => isoDate(file.frontmatter?.date) ?? ""

function timeOf(date, lang) {
  return date ? h("time", { datetime: date }, formatDate(date, lang)) : null
}

function mast(fm, lang, allFiles) {
  const links = (Array.isArray(fm.links) ? fm.links : []).filter(
    (link) => typeof link?.label === "string" && typeof link?.href === "string",
  )

  // What the notebook holds, from the homepage sections.
  const cells = []
  let first = ""
  let latest = ""
  for (const section of SECTIONS.filter((candidate) => candidate.home)) {
    const entries = selectEntries(allFiles, section)
    if (entries.length === 0) continue
    const key = section.kind === "essay" ? "fieldEssays" : "fieldWorks"
    cells.push({ label: t(lang, key), value: pad(entries.length) })
    const newest = dateOf(entries[0])
    const oldest = dateOf(entries[entries.length - 1])
    if (newest > latest) latest = newest
    if (oldest && (!first || oldest < first)) first = oldest
  }
  if (first) cells.push({ label: t(lang, "fieldSince"), value: first.slice(0, 4) })
  if (latest) cells.push({ label: t(lang, "fieldUpdated"), value: timeOf(latest, lang) })
  if (links.length > 0) {
    cells.push({
      label: t(lang, "fieldElsewhere"),
      value: h(
        "ul",
        { class: "home-links" },
        links.map((link) => h("li", null, h("a", { href: link.href }, link.label))),
      ),
    })
  }

  return h(
    "header",
    { class: "home-mast" },
    h("h1", { class: "home-thesis" }, fm.description ?? fm.title),
    typeof fm.intro === "string" && fm.intro.trim()
      ? h("p", { class: "home-intro" }, fm.intro)
      : null,
    renderTitleBlock(cells, "titleblock--mast"),
  )
}

// A section page's title block: how many entries, the first and the latest,
// and for essays how many have a Chinese version.
function sectionBlock(section, entries, lang) {
  const key = section.kind === "essay" ? "fieldEssays" : "fieldWorks"
  const cells = [{ label: t(lang, key), value: pad(entries.length) }]
  if (entries.length > 0) {
    cells.push({ label: t(lang, "fieldFirst"), value: timeOf(dateOf(entries.at(-1)), lang) })
    cells.push({ label: t(lang, "fieldLatest"), value: timeOf(dateOf(entries[0]), lang) })
  }
  if (section.kind === "essay") {
    const translated = entries.filter((entry) =>
      entry.i18n?.alternates?.some((version) => isZh(version.lang)),
    ).length
    cells.push({ label: t(lang, "fieldTranslated"), value: pad(translated) })
  }
  return renderTitleBlock(cells, "titleblock--section")
}

const yearOf = (file) => dateOf(file).slice(0, 4)

// One ledger, or one per year under a year label once the dates span years.
function byYear(essays, ledger) {
  const years = [...new Set(essays.map(yearOf))]
  if (years.length <= 1) return ledger(essays)
  return years.map((year) =>
    h(
      "section",
      { class: "idx-year-block" },
      year ? h("h2", { class: "idx-year" }, year) : null,
      ledger(essays.filter((essay) => yearOf(essay) === year)),
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
    const ledger = (files) => renderLedger(files, ctx)
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
        sectionBlock(own, entries, lang),
        h(
          "section",
          { class: own.kind === "essay" ? "idx idx--ledger" : "idx idx--works" },
          own.kind === "essay" ? byYear(entries, ledger) : workPlates(entries),
        ),
      )
    }

    const essays = selectEssays(allFiles)
    const [hero, ...rest] = essays
    const cards = rest.slice(0, HOME_CARDS)
    const essayHome = SECTIONS.find((section) => section.home && section.kind === "essay")

    const latest = hero
      ? h(
          "section",
          { class: "idx feat", "aria-labelledby": "idx-latest" },
          renderSectionHead(
            "idx-latest",
            t(lang, "latest"),
            t(lang, "latestNote", { n: cards.length }),
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
          renderSectionHead(id, t(lang, section.label), t(lang, "worksNote")),
          workPlates(entries),
        )
      },
    )

    const index =
      essays.length > 0
        ? h(
            "section",
            { class: "idx idx--ledger", "aria-labelledby": "idx-index" },
            renderSectionHead(
              "idx-index",
              t(lang, "index"),
              t(lang, "indexNote", { n: essays.length }),
            ),
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
