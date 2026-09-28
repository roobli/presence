import { h } from "preact"
import { isoDate } from "../../presence-shared/dates.js"
import { langOf, t } from "../../presence-shared/locale.js"
import {
  HOME_ROWS,
  hrefOf,
  joined,
  renderWorkRow,
  renderWritingRow,
  selectEntries,
} from "../../presence-shared/rows.js"
import { indexSlugOf, SECTIONS, sectionOfIndex } from "../../presence-shared/sections.js"

/**
 * Home index. On the homepage: the thesis (frontmatter description), intro and
 * links from index.md, then each homepage section from sections.js in order:
 * the newest essays of an essay section, every work of a work section. On a
 * section's own page (/writing/, /works/): every entry, essays grouped under
 * year headings once the dates span more than one year. Section pages hide
 * FolderPage's stock list (_folder-listing.scss), and their page header
 * already names the section. Every other page renders nothing.
 */

function mast(fm) {
  const links = (Array.isArray(fm.links) ? fm.links : []).filter(
    (link) => typeof link?.label === "string" && typeof link?.href === "string",
  )
  return h(
    "header",
    { class: "home-mast" },
    h("h1", { class: "home-thesis" }, fm.description ?? fm.title),
    typeof fm.intro === "string" && fm.intro.trim()
      ? h("p", { class: "home-intro" }, fm.intro)
      : null,
    links.length > 0
      ? h(
          "p",
          { class: "home-links" },
          joined(links.map((link) => h("a", { href: link.href }, link.label))),
        )
      : null,
  )
}

const yearOf = (file) => (isoDate(file.frontmatter?.date) ?? "").slice(0, 4)

// One list, or one per year under a year heading once the dates span years.
function byYear(essays, list) {
  const years = [...new Set(essays.map(yearOf))]
  if (years.length <= 1) return h("section", { class: "idx" }, list(essays))
  return years.map((year) =>
    h(
      "section",
      { class: "idx" },
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
    const essayList = (files) =>
      h("ul", { class: "idx-list" }, files.map((file) => renderWritingRow(file, ctx)))
    const workList = (files) =>
      h("ul", { class: "idx-list" }, files.map((work) => renderWorkRow(work, ctx)))

    if (own) {
      const entries = selectEntries(allFiles, own)
      if (own.kind === "essay") {
        return h("section", { class: "home home--folder" }, byYear(entries, essayList))
      }
      return h(
        "section",
        { class: "home home--folder" },
        h("section", { class: "idx idx--works" }, workList(entries)),
      )
    }

    // One homepage block per section, in sections.js order.
    const block = (section) => {
      const entries = selectEntries(allFiles, section)
      if (entries.length === 0) return null
      const id = `idx-${section.id}`
      const label = h("h2", { id, class: "idx-label" }, t(lang, section.label))
      if (section.kind !== "essay") {
        return h(
          "section",
          { class: "idx idx--works", "aria-labelledby": id },
          label,
          workList(entries),
        )
      }
      return h(
        "section",
        { class: "idx", "aria-labelledby": id },
        label,
        essayList(entries.slice(0, HOME_ROWS)),
        entries.length > HOME_ROWS
          ? h(
              "p",
              { class: "idx-more" },
              h(
                "a",
                { href: hrefOf(indexSlugOf(section)) },
                t(lang, "allWriting", { n: entries.length }),
              ),
            )
          : null,
      )
    }

    return h(
      "section",
      { class: "home" },
      mast(fileData.frontmatter ?? {}),
      SECTIONS.filter((section) => section.home).map(block),
    )
  }
  return Component
}
