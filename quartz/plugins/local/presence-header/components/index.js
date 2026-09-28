import { readFileSync } from "fs"
import { h } from "preact"
import { formatDate, isoDate } from "../../presence-shared/dates.js"
import { langOf, t, ZH } from "../../presence-shared/locale.js"
import { entryNumber, renderTitleBlock, tagsOf } from "../../presence-shared/plates.js"
import { indexSlugOf, sectionOf } from "../../presence-shared/sections.js"
import {
  hrefOf,
  joined,
  readingMinutes,
  workLinks,
  workShot,
} from "../../presence-shared/rows.js"

/**
 * Page header, a casebook's head on a notebook page. The label line names the
 * section (a link to its page), the entry's number in order of publication and
 * its first tags; then the title and the dek; then a title block of the
 * entry's facts. Essays state when they were published and revised, how long
 * they take and how many live figures they carry; works state their date and
 * links and show their screenshot. Both end with the language field, where a
 * translated page links its other version. Every other kind shows the title
 * alone. The homepage has no page header: its h1 is the thesis, which
 * presence-index renders.
 *
 * client.js keeps html lang in step with the page and carries the reading
 * position across a language switch; it finds the link as .ph-lang a.
 */

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")

const LANGUAGE_NAMES = { en: "English", [ZH]: "中文" }

function timeOf(value, lang) {
  const date = isoDate(value)
  return date ? h("time", { datetime: date }, formatDate(date, lang)) : null
}

// The language field: this page's language as text, then a link to each other
// version. A plain link says where it goes, where a two-state switch left
// readers unsure which side was current.
function languageField(fileData, lang) {
  const alternates = fileData.i18n?.alternates ?? []
  if (alternates.length === 0) return null
  const own = fileData.i18n?.lang ?? lang
  const links = alternates.map((version) =>
    h(
      "span",
      { class: "ph-lang" },
      h(
        "a",
        { href: hrefOf(version.slug), lang: version.lang, hreflang: version.lang, rel: "alternate" },
        LANGUAGE_NAMES[version.lang] ?? version.lang,
      ),
    ),
  )
  return joined([h("span", null, LANGUAGE_NAMES[own] ?? own), ...links], "ph-sep")
}

function essayCells(fileData, allFiles, lang) {
  const fm = fileData.frontmatter ?? {}
  const minutes = readingMinutes(fileData, allFiles)
  const figures = fileData.presence?.figures?.length ?? 0
  return [
    { label: t(lang, "fieldPublished"), value: timeOf(fm.date, lang) },
    { label: t(lang, "fieldRevised"), value: timeOf(fm.updated, lang) },
    { label: t(lang, "fieldReading"), value: minutes ? t(lang, "minShort", { n: minutes }) : null },
    { label: t(lang, "fieldFigures"), value: figures > 0 ? String(figures) : null },
    { label: t(lang, "fieldLanguage"), value: languageField(fileData, lang) },
  ]
}

function workCells(fileData, lang) {
  const fm = fileData.frontmatter ?? {}
  const links = workLinks(fileData, lang)
  return [
    { label: t(lang, "fieldPublished"), value: timeOf(fm.date, lang) },
    {
      label: t(lang, "fieldLinks"),
      value: links.length > 0 ? h("span", { class: "ph-links" }, joined(links, "ph-sep")) : null,
    },
    { label: t(lang, "fieldLanguage"), value: languageField(fileData, lang) },
  ]
}

// The label line: the section as a link to its page, the entry's number and
// its first two tags.
function kicker(fileData, allFiles, lang) {
  const base = fileData.i18n?.base ?? fileData.slug
  const section = sectionOf(base)
  if (!section) return null
  const n = entryNumber(fileData, allFiles)
  const original = allFiles.find((file) => file.slug === base) ?? fileData
  const parts = [
    h("a", { href: hrefOf(indexSlugOf(section)) }, t(lang, section.label)),
    n ? h("span", { class: "entry-no" }, t(lang, "no", { n })) : null,
    ...tagsOf(original, 2).map((tag) => h("span", null, tag)),
  ].filter(Boolean)
  return h("p", { class: "ph-kicker" }, joined(parts, "ph-sep"))
}

export const PageHeader = () => {
  const Component = ({ fileData, allFiles }) => {
    if (fileData.slug === "index") return null
    const fm = fileData.frontmatter ?? {}
    const kind = fileData.presence?.kind
    const lang = langOf(fileData)
    // Entries only: a section's own page is titled with the section's name.
    const isEntry = kind !== "home" && kind !== "folder" && kind !== "page"

    let dek = null
    let spec = null
    let shot = null
    if (kind === "essay" || kind === "work") {
      if (fm.description) dek = h("p", { class: "ph-dek" }, fm.description)
      const cells = kind === "essay" ? essayCells(fileData, allFiles, lang) : workCells(fileData, lang)
      spec = renderTitleBlock(cells, "titleblock--spec")
      if (kind === "work") shot = workShot(fileData, { className: "ph-shot", lazy: false })
    }

    return h(
      "header",
      { class: "ph" },
      isEntry ? kicker(fileData, allFiles, lang) : null,
      // article-title stays for scripts and styles that look for the page title.
      h("h1", { class: "article-title ph-title" }, fm.title ?? fileData.slug),
      dek,
      spec,
      shot,
    )
  }
  Component.afterDOMLoaded = client
  return Component
}
