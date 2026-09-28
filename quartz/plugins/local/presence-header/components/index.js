import { readFileSync } from "fs"
import { h } from "preact"
import { langOf, t, ZH } from "../../presence-shared/locale.js"
import {
  canonicalOf,
  entryNumber,
  hrefOf,
  placeInSeries,
  projectStatus,
  readingMinutes,
  seriesById,
  tagsOf,
} from "../../presence-shared/entries.js"
import {
  indexSlugOf,
  isSeriesIndex,
  sectionOf,
  sectionOfIndex,
  seriesIdOf,
} from "../../presence-shared/sections.js"
import {
  joined,
  projectLinks,
  projectShot,
  renderFigures,
  renderStatus,
  renderTitleBlock,
  timeOf,
} from "../../presence-shared/views.js"

/**
 * Page header. The label line says where the page sits: a section's page and
 * a series' page carry the path from the homepage; an entry names its section
 * (a link), then its own place in it, No. 005 for an essay and Ep 02 of 05 for
 * an episode, and its first tags. Then the title and the dek, then a title
 * block of the entry's facts.
 *
 *   essay, episode, note   published, revised, reading time, live figures,
 *                          language
 *   project                status, start, its figures, links, language,
 *                          then the screenshot
 *
 * The homepage has no page header: its h1 is the thesis, which presence-index
 * renders. client.js keeps html lang in step with the page and carries the
 * reading position across a language switch; it finds the link as .ph-lang a.
 */

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")

const LANGUAGE_NAMES = { en: "English", [ZH]: "中文" }

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
        {
          href: hrefOf(version.slug),
          lang: version.lang,
          hreflang: version.lang,
          rel: "alternate",
        },
        LANGUAGE_NAMES[version.lang] ?? version.lang,
      ),
    ),
  )
  return joined([h("span", null, LANGUAGE_NAMES[own] ?? own), ...links], "ph-sep")
}

function readingCells(fileData, allFiles, lang) {
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

function projectCells(fileData, lang) {
  const fm = fileData.frontmatter ?? {}
  const links = projectLinks(fileData, lang)
  return [
    { label: t(lang, "fieldStatus"), value: renderStatus(projectStatus(fileData), lang) },
    { label: t(lang, "fieldStarted"), value: timeOf(fm.date, lang) },
    {
      label: t(lang, "fieldLinks"),
      value: links.length > 0 ? h("span", { class: "tb-links" }, links) : null,
    },
    { label: t(lang, "fieldLanguage"), value: languageField(fileData, lang) },
  ]
}

const crumb = (href, label) => (href ? h("a", { href }, label) : h("span", null, label))
const slash = () => h("span", { class: "ph-slash", "aria-hidden": "true" }, "/")

function path(parts) {
  const out = []
  for (const part of parts) {
    if (out.length > 0) out.push(slash())
    out.push(part)
  }
  return out
}

// The label line: where the page sits, then its own facts.
function kicker(fileData, allFiles, lang, siteTitle) {
  const slug = fileData.slug
  const base = fileData.i18n?.base ?? slug
  const home = crumb("/", siteTitle)

  if (isSeriesIndex(base)) {
    const series = sectionOf(base)
    return h(
      "p",
      { class: "ph-kicker" },
      path([home, crumb(hrefOf(indexSlugOf(series)), t(lang, series.label))]),
    )
  }
  const own = sectionOfIndex(base)
  if (own) return h("p", { class: "ph-kicker" }, path([home, crumb(null, t(lang, own.label))]))

  const section = sectionOf(base)
  if (!section) return null
  const sectionLink = crumb(hrefOf(indexSlugOf(section)), t(lang, section.label))
  const original = canonicalOf(fileData, allFiles)

  if (section.kind === "episode") {
    const place = placeInSeries(original, allFiles)
    const series = place?.series ?? seriesById(allFiles, seriesIdOf(base))
    const trail = [sectionLink]
    if (series) trail.push(crumb(hrefOf(series.slug), series.title))
    const facts = place
      ? [
          h(
            "span",
            { class: "entry-no" },
            t(lang, "epOf", { n: place.index + 1, total: place.series.total }),
          ),
        ]
      : []
    return h("p", { class: "ph-kicker" }, path(trail), facts.length ? [slash(), ...facts] : null)
  }

  const n = section.kind === "essay" ? entryNumber(fileData, allFiles) : null
  const facts = [
    n ? h("span", { class: "entry-no" }, t(lang, "no", { n })) : null,
    ...tagsOf(original, 2).map((tag) => h("span", null, tag)),
  ].filter(Boolean)
  return h("p", { class: "ph-kicker" }, joined([sectionLink, ...facts], "ph-sep"))
}

// A section's or series' page without an index.md of its own gets a virtual
// page titled with the folder's name; it reads the section's or series' name.
function pageTitle(fileData, allFiles, lang) {
  const fm = fileData.frontmatter ?? {}
  const own = sectionOfIndex(fileData.slug)
  if (own && (!fm.title || fm.title === own.id)) return t(lang, own.label)
  if (isSeriesIndex(fileData.slug)) {
    const series = seriesById(allFiles, seriesIdOf(fileData.slug))
    if (series && (!fm.title || fm.title === series.id)) return series.title
  }
  return fm.title ?? fileData.slug
}

export const PageHeader = () => {
  const Component = ({ fileData, allFiles, cfg }) => {
    if (fileData.slug === "index") return null
    const fm = fileData.frontmatter ?? {}
    const kind = fileData.presence?.kind
    const lang = langOf(fileData)
    const siteTitle = cfg?.pageTitle ?? "Home"

    let spec = null
    let shot = null
    let figures = null
    if (kind === "essay") {
      spec = renderTitleBlock(readingCells(fileData, allFiles, lang), "titleblock--spec")
    } else if (kind === "project") {
      spec = renderTitleBlock(projectCells(fileData, lang), "titleblock--spec")
      figures = renderFigures(fileData)
      shot = projectShot(fileData, { className: "ph-shot", lazy: false })
    }
    // A series' page takes its dek from its own frontmatter, like an entry.
    const hasDek = kind === "essay" || kind === "project" || kind === "folder"

    return h(
      "header",
      { class: "ph" },
      kicker(fileData, allFiles, lang, siteTitle),
      // article-title stays for scripts and styles that look for the page title.
      h("h1", { class: "article-title ph-title" }, pageTitle(fileData, allFiles, lang)),
      hasDek && fm.description ? h("p", { class: "ph-dek" }, fm.description) : null,
      spec,
      figures,
      shot ? h("figure", { class: "ph-figure" }, shot) : null,
    )
  }
  Component.afterDOMLoaded = client
  return Component
}
