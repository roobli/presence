import { h } from "preact"
import { isoDate } from "../../presence-shared/dates.js"
import { langOf, t } from "../../presence-shared/locale.js"
import {
  HOME_ROWS,
  hrefOf,
  joined,
  renderWorkRow,
  renderWritingRow,
  selectEssays,
  selectWorks,
} from "../../presence-shared/rows.js"

/**
 * Home index. On the homepage: the thesis (frontmatter description), intro and
 * links from index.md, then the newest essays and the works. On /writing/:
 * every essay, grouped under year headings once the dates span more than one
 * year. On /works/: the works. Both folder pages hide FolderPage's stock list
 * (_folder-listing.scss), and their page header already names the folder.
 * Every other page renders nothing.
 */

const VIEWS = { index: "home", "writing/index": "writing", "works/index": "works" }

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
    const view = VIEWS[fileData.slug]
    if (!view) return null
    const lang = langOf(fileData)
    const ctx = { lang, allFiles }
    const essays = selectEssays(allFiles)
    const works = selectWorks(allFiles)
    const essayList = (files) =>
      h("ul", { class: "idx-list" }, files.map((file) => renderWritingRow(file, ctx)))
    const workList = () =>
      h("ul", { class: "idx-list" }, works.map((work) => renderWorkRow(work, ctx)))

    if (view === "writing") {
      return h("section", { class: "home home--folder" }, byYear(essays, essayList))
    }
    if (view === "works") {
      return h(
        "section",
        { class: "home home--folder" },
        h("section", { class: "idx idx--works" }, workList()),
      )
    }

    return h(
      "section",
      { class: "home" },
      mast(fileData.frontmatter ?? {}),
      essays.length > 0
        ? h(
            "section",
            { class: "idx", "aria-labelledby": "idx-writing" },
            h("h2", { id: "idx-writing", class: "idx-label" }, t(lang, "writing")),
            essayList(essays.slice(0, HOME_ROWS)),
            essays.length > HOME_ROWS
              ? h(
                  "p",
                  { class: "idx-more" },
                  h(
                    "a",
                    { href: hrefOf("writing/index") },
                    t(lang, "allWriting", { n: essays.length }),
                  ),
                )
              : null,
          )
        : null,
      works.length > 0
        ? h(
            "section",
            { class: "idx idx--works", "aria-labelledby": "idx-works" },
            h("h2", { id: "idx-works", class: "idx-label" }, t(lang, "works")),
            workList(),
          )
        : null,
    )
  }
  return Component
}
