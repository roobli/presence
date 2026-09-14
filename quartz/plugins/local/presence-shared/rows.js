import { h } from "preact"
import { formatDate, isoDate } from "./dates.js"
import { isZh, langOf, t, ZH } from "./locale.js"
import { renderSpine } from "./spine.js"

// Row data and row markup for the homepage, the folder pages, the page header
// and the end matter. Everything is derived from allFiles and
// file.data.presence, so nothing about an essay or a work is typed twice.

/** Essay rows on the homepage before the "All writing (N)" link. */
export const HOME_ROWS = 8

// Screenshot boxes are 16:10 in CSS at every size. These attributes reserve
// that ratio while the image loads, whatever the file's own pixel size.
const SHOT_WIDTH = 1280
const SHOT_HEIGHT = 800

/** Site path of a slug: index is /, writing/index is /writing/. */
export function hrefOf(slug) {
  if (slug === "index") return "/"
  const path = slug.endsWith("/index") ? slug.slice(0, -"index".length) : slug
  return "/" + encodeURI(path)
}

const titleOf = (file) => file.frontmatter?.title ?? file.slug

// The Explorer's label: the part of a title before a spaced em dash.
function shortTitle(file) {
  const title = titleOf(file)
  const cut = title.indexOf(" — ")
  return cut > 0 ? title.slice(0, cut) : title
}

const isListed = (file) => file.unlisted !== true && file.frontmatter?.unlisted !== true

// i18n-slug gives a translation its original's slug as base.
const isTranslation = (file) => Boolean(file.i18n?.base) && file.i18n.base !== file.slug

function isEntryOf(file, folder) {
  const slug = file.slug ?? ""
  return (
    slug.startsWith(`${folder}/`) &&
    !slug.endsWith("/index") &&
    isListed(file) &&
    !isTranslation(file)
  )
}

const orderOf = (file) =>
  Number.isInteger(file.frontmatter?.order) ? file.frontmatter.order : Infinity

// Newest first, then frontmatter order, then title.
function compareEntries(a, b) {
  const dateA = isoDate(a.frontmatter?.date) ?? ""
  const dateB = isoDate(b.frontmatter?.date) ?? ""
  if (dateA !== dateB) return dateA < dateB ? 1 : -1
  if (orderOf(a) !== orderOf(b)) return orderOf(a) - orderOf(b)
  return titleOf(a).localeCompare(titleOf(b), undefined, { numeric: true })
}

/** Listed essays without translations or folder pages, newest first. */
export function selectEssays(allFiles) {
  return allFiles.filter((file) => isEntryOf(file, "writing")).sort(compareEntries)
}

/** Listed works, newest first. */
export function selectWorks(allFiles) {
  return allFiles.filter((file) => isEntryOf(file, "works")).sort(compareEntries)
}

const findSlug = (allFiles, slug) => allFiles.find((file) => file.slug === slug) ?? null

// A translation's English original, when it exists.
function originalOf(file, allFiles) {
  if (!isTranslation(file)) return null
  const original = file.i18n.alternates?.find((alternate) => !isZh(alternate.lang))
  return original ? findSlug(allFiles, original.slug) : null
}

/**
 * Reading minutes. A translation shows its original's, so both versions of a
 * pair state the same time; an unpaired zh page keeps its Han-based count.
 */
export function readingMinutes(file, allFiles) {
  return (
    originalOf(file, allFiles)?.presence?.readingMinutes ?? file.presence?.readingMinutes ?? null
  )
}

/** The work an essay is about: its own relation, else its original's. */
export function relatedWork(file, allFiles) {
  const slug = file.presence?.relation ?? originalOf(file, allFiles)?.presence?.relation
  const work = slug ? findSlug(allFiles, slug) : null
  return work && isEntryOf(work, "works") ? work : null
}

/** Essays whose relation is this work, plus essays the work page links to. */
export function essaysForWork(work, allFiles) {
  const linked = new Set(work.links ?? [])
  return selectEssays(allFiles).filter(
    (essay) => essay.presence?.relation === work.slug || linked.has(essay.slug),
  )
}

/** The parts with a middle dot between each pair, hidden from screen readers. */
export function joined(parts, className = "sep") {
  const out = []
  for (const part of parts) {
    if (out.length > 0) out.push(h("span", { class: className, "aria-hidden": "true" }, " · "))
    out.push(part)
  }
  return out
}

/** A work's screenshot, or null when its frontmatter names no image. */
export function workShot(work, { className, lazy = true } = {}) {
  const fm = work.frontmatter ?? {}
  if (typeof fm.image !== "string" || !fm.image.trim()) return null
  return h("img", {
    class: className,
    src: "/" + encodeURI(fm.image.trim().replace(/^\/+/, "")),
    width: SHOT_WIDTH,
    height: SHOT_HEIGHT,
    alt: typeof fm.image_alt === "string" ? fm.image_alt : "",
    loading: lazy ? "lazy" : undefined,
    decoding: "async",
  })
}

/**
 * A work's links: Live site and Source, then the Chinese site (zh) and a link
 * to each essay in essays.
 */
export function workLinks(work, lang, { zh = true, essays = [] } = {}) {
  const fm = work.frontmatter ?? {}
  const links = []
  if (typeof fm.live === "string") links.push(h("a", { href: fm.live }, t(lang, "liveSite")))
  if (typeof fm.source === "string") links.push(h("a", { href: fm.source }, t(lang, "source")))
  if (zh && typeof fm.live_zh === "string") {
    links.push(h("a", { href: fm.live_zh, lang: ZH }, t(lang, "zhVersion")))
  }
  for (const essay of essays) {
    // One essay reads "Design essay"; several are told apart by title.
    const label = essays.length === 1 ? t(lang, "designEssay") : shortTitle(essay)
    links.push(h("a", { href: hrefOf(essay.slug) }, label))
  }
  return links
}

// A row in a language other than the page's says so; its chrome lines say
// they are in the page's language.
const langIfOther = (own, other) => (own === other ? undefined : own)

/**
 * One essay row: full title, dek, meta line (date, reading time, live
 * figures, and a 中文 link when a translation exists) and the section spine.
 * lang is the page's chrome language.
 */
export function renderWritingRow(file, { lang, allFiles }) {
  const fm = file.frontmatter ?? {}
  const own = langOf(file)
  const facts = []
  const date = isoDate(fm.date)
  if (date) facts.push(h("time", { datetime: date }, formatDate(date, lang)))
  const minutes = readingMinutes(file, allFiles)
  if (minutes) facts.push(t(lang, "minRead", { n: minutes }))
  const figures = file.presence?.figures?.length ?? 0
  if (figures > 0) facts.push(t(lang, "liveFigures", { n: figures }))
  const translation = file.i18n?.alternates?.find((alternate) => isZh(alternate.lang))
  if (translation) {
    facts.push(
      h(
        "a",
        {
          class: "idx-alt",
          href: hrefOf(translation.slug),
          lang: ZH,
          hreflang: ZH,
          rel: "alternate",
        },
        "中文",
      ),
    )
  }

  return h(
    "li",
    { class: "idx-row", lang: langIfOther(own, lang) },
    h("h3", { class: "idx-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
    fm.description ? h("p", { class: "idx-dek" }, fm.description) : null,
    facts.length > 0
      ? h("p", { class: "idx-meta", lang: langIfOther(lang, own) }, joined(facts))
      : null,
    renderSpine(file.presence),
  )
}

/**
 * One work row. compact is the Related work card under an essay: a smaller
 * shot and only the Live site and Source links.
 */
export function renderWorkRow(work, { lang, allFiles, compact = false }) {
  const fm = work.frontmatter ?? {}
  const own = langOf(work)
  const href = hrefOf(work.slug)
  const shot = workShot(work)
  const links = compact
    ? workLinks(work, lang, { zh: false })
    : workLinks(work, lang, { essays: essaysForWork(work, allFiles) })

  return h(
    "li",
    { class: compact ? "work-row work-row--compact" : "work-row", lang: langIfOther(own, lang) },
    // The title link below is the same destination, so the picture stays out
    // of the tab order and the accessibility tree.
    shot ? h("a", { class: "work-shot", href, tabindex: "-1", "aria-hidden": "true" }, shot) : null,
    h(
      "div",
      { class: "work-body" },
      h("h3", { class: "idx-title" }, h("a", { href }, titleOf(work))),
      fm.description ? h("p", { class: "idx-dek" }, fm.description) : null,
      links.length > 0
        ? h("p", { class: "work-links", lang: langIfOther(lang, own) }, joined(links))
        : null,
    ),
  )
}
