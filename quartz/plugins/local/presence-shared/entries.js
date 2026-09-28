import { isoDate } from "./dates.js"
import { isZh } from "./locale.js"
import {
  entryKind,
  SECTIONS,
  sectionById,
  sectionOf,
  seriesIdOf,
  seriesIndexSlug,
} from "./sections.js"

// The site's content model, derived from allFiles and file.data.presence so
// nothing about an entry is typed twice. The index, the sidebar tree, the page
// header and the end matter all read it; markup lives in views.js.
//
//   essay    content/essays/<slug>.md, numbered in order of publication
//   series   content/series/<id>/index.md describes a series: title,
//            description, status, cadence, project and planned episodes.
//            Every other page in the folder is an episode, ordered by part.
//   project  content/projects/<slug>.md: status, figures, links, a log
//   note     content/notes/<slug>.md, short and dated
//
// Relations: a reading page names its project with `project:` (or links to
// it); an episode without one inherits its series'. A project's log gathers
// its own entries and everything related to it.

/** Essay rows in the homepage index. */
export const HOME_ROWS = 8

/** Site path of a slug: index is /, essays/index is /essays/. */
export function hrefOf(slug) {
  if (slug === "index") return "/"
  const path = slug.endsWith("/index") ? slug.slice(0, -"index".length) : slug
  return "/" + encodeURI(path)
}

export const titleOf = (file) => file.frontmatter?.title ?? file.slug

/** The part of a title before a spaced em dash, for places with little room. */
export function shortTitle(file) {
  const title = titleOf(file)
  const cut = title.indexOf(" — ")
  return cut > 0 ? title.slice(0, cut) : title
}

export const dateOf = (file) => isoDate(file.frontmatter?.date)

const isListed = (file) => file.unlisted !== true && file.frontmatter?.unlisted !== true

/** i18n-slug gives a translation its original's slug as base. */
export const isTranslation = (file) => Boolean(file.i18n?.base) && file.i18n.base !== file.slug

export const baseSlug = (file) => file.i18n?.base ?? file.slug

export function findSlug(allFiles, slug) {
  return allFiles.find((file) => file.slug === slug) ?? null
}

function isEntryOf(file, section) {
  const slug = file.slug ?? ""
  return (
    slug.startsWith(`${section.id}/`) &&
    !slug.endsWith("/index") &&
    isListed(file) &&
    !isTranslation(file)
  )
}

const orderOf = (file) =>
  Number.isInteger(file.frontmatter?.order) ? file.frontmatter.order : Infinity

// On one day, a standalone essay comes before an episode, and an episode
// before a note or a project; within a series the later part comes first.
const KIND_RANK = { essay: 0, episode: 1, note: 2, project: 3 }
const kindRank = (file) => KIND_RANK[entryKind(file.slug)] ?? 9
const partDesc = (file) => (Number.isInteger(file.frontmatter?.part) ? -file.frontmatter.part : 0)

// Newest first; then frontmatter order, kind, later part and title, so that
// entries published on the same day always list the same way.
function compareEntries(a, b) {
  const dateA = dateOf(a) ?? ""
  const dateB = dateOf(b) ?? ""
  if (dateA !== dateB) return dateA < dateB ? 1 : -1
  if (orderOf(a) !== orderOf(b)) return orderOf(a) - orderOf(b)
  if (kindRank(a) !== kindRank(b)) return kindRank(a) - kindRank(b)
  if (partDesc(a) !== partDesc(b)) return partDesc(a) - partDesc(b)
  return titleOf(a).localeCompare(titleOf(b), undefined, { numeric: true })
}

/** A section's listed entries without translations or folder pages, newest first. */
export function selectEntries(allFiles, section) {
  return allFiles.filter((file) => isEntryOf(file, section)).sort(compareEntries)
}

/** Entries of every section whose entries are of one of these kinds, newest first. */
export function selectKinds(allFiles, ...kinds) {
  return SECTIONS.filter((section) => kinds.includes(section.kind))
    .flatMap((section) => allFiles.filter((file) => isEntryOf(file, section)))
    .sort(compareEntries)
}

export const selectEssays = (allFiles) => selectKinds(allFiles, "essay")
export const selectProjects = (allFiles) => selectKinds(allFiles, "project")
export const selectNotes = (allFiles) => selectKinds(allFiles, "note")
/** The long-form writing: essays and series episodes, newest first. */
export const selectWriting = (allFiles) => selectKinds(allFiles, "essay", "episode")

/** Every listed entry of every section. */
export const allEntries = (allFiles) =>
  SECTIONS.flatMap((section) => selectEntries(allFiles, section))

// A translation's English original, when it exists.
export function originalOf(file, allFiles) {
  if (!isTranslation(file)) return null
  const original = file.i18n.alternates?.find((alternate) => !isZh(alternate.lang))
  return original ? findSlug(allFiles, original.slug) : null
}

/** The page whose relations and numbers a page shows: its original, else itself. */
export function canonicalOf(file, allFiles) {
  return originalOf(file, allFiles) ?? findSlug(allFiles, baseSlug(file)) ?? file
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

/**
 * An essay's number in order of publication, the oldest being 1. A translation
 * takes its original's. Null for anything but an essay.
 */
export function entryNumber(file, allFiles) {
  const base = baseSlug(file)
  const section = sectionOf(base)
  if (!section || section.kind !== "essay") return null
  const oldestFirst = selectEntries(allFiles, section).reverse()
  const index = oldestFirst.findIndex((entry) => entry.slug === base)
  return index < 0 ? null : index + 1
}

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

/** Tags, leaving out one that only repeats the section's name. */
export function tagsOf(file, max = Infinity) {
  const section = sectionOf(file.slug)?.id ?? ""
  return (Array.isArray(file.frontmatter?.tags) ? file.frontmatter.tags : [])
    .filter((tag) => typeof tag === "string" && tag.trim() && tag.toLowerCase() !== section)
    .slice(0, max)
}

// --- series ------------------------------------------------------------------

const SERIES_STATUS = new Set(["in-progress", "complete", "paused"])

const partOf = (file) =>
  Number.isInteger(file.frontmatter?.part) ? file.frontmatter.part : Infinity

function plannedOf(fm) {
  if (!Array.isArray(fm.planned)) return []
  return fm.planned
    .map((item) => (typeof item === "string" ? item : item?.title))
    .filter((title) => typeof title === "string" && title.trim())
    .map((title) => title.trim())
}

/**
 * Every series with at least one published or planned episode, in progress
 * first, then by latest episode:
 *
 *   { id, slug, title, description, status, cadence, project,
 *     episodes, planned, total, started, latest }
 *
 * episodes are published pages in reading order; planned are titles still to
 * come; total counts both. status is the frontmatter's, else "in-progress"
 * while episodes are planned and "complete" when none are.
 */
export function selectSeries(allFiles) {
  // Every page of a build shares one allFiles, and the tree, the index and the
  // end matter each ask for the series several times per page.
  const cached = seriesCache.get(allFiles)
  if (cached) return cached
  const out = computeSeries(allFiles)
  seriesCache.set(allFiles, out)
  return out
}

const seriesCache = new WeakMap()

function computeSeries(allFiles) {
  const section = sectionById("series")
  if (!section) return []
  const episodes = selectEntries(allFiles, section)
  const ids = new Set()
  for (const file of allFiles) {
    const id = seriesIdOf(file.slug)
    if (id && !isTranslation(file)) ids.add(id)
  }
  const out = []
  for (const id of ids) {
    const slug = seriesIndexSlug(id)
    const page = findSlug(allFiles, slug)
    const fm = page?.frontmatter ?? {}
    const own = episodes
      .filter((file) => seriesIdOf(file.slug) === id)
      .sort((a, b) => partOf(a) - partOf(b) || (dateOf(a) ?? "").localeCompare(dateOf(b) ?? ""))
    const planned = plannedOf(fm)
    if (own.length === 0 && planned.length === 0) continue
    const status = SERIES_STATUS.has(fm.status)
      ? fm.status
      : planned.length > 0
        ? "in-progress"
        : "complete"
    const dates = own.map(dateOf).filter(Boolean).sort()
    out.push({
      id,
      slug,
      title: typeof fm.title === "string" && fm.title.trim() ? fm.title : id,
      description: typeof fm.description === "string" ? fm.description : null,
      status,
      cadence: typeof fm.cadence === "string" ? fm.cadence : null,
      project: typeof fm.project === "string" ? fm.project.replace(/^\/+|\/+$/g, "") : null,
      episodes: own,
      planned,
      total: own.length + planned.length,
      started: dates[0] ?? null,
      latest: dates.at(-1) ?? null,
    })
  }
  const rank = (series) => (series.status === "in-progress" ? 0 : 1)
  return out.sort((a, b) => rank(a) - rank(b) || (b.latest ?? "").localeCompare(a.latest ?? ""))
}

/** The series with this id, or null. */
export function seriesById(allFiles, id) {
  return selectSeries(allFiles).find((series) => series.id === id) ?? null
}

/**
 * Where an episode sits: { series, index } with index into series.episodes,
 * or null. A translation reads its original's place.
 */
export function placeInSeries(file, allFiles) {
  const base = baseSlug(file)
  const id = seriesIdOf(base)
  if (!id || entryKind(base) !== "episode") return null
  const series = seriesById(allFiles, id)
  if (!series) return null
  const index = series.episodes.findIndex((episode) => episode.slug === base)
  return index < 0 ? null : { series, index }
}

/** An episode's number in its series, 1-based, or null. */
export function episodeNumber(file, allFiles) {
  const place = placeInSeries(file, allFiles)
  return place ? place.index + 1 : null
}

// --- projects ----------------------------------------------------------------

const PROJECT_STATUS = new Set(["live", "building", "archived"])

/** A project's status: frontmatter's, else live when it has a live link. */
export function projectStatus(project) {
  const fm = project.frontmatter ?? {}
  if (PROJECT_STATUS.has(fm.status)) return fm.status
  return typeof fm.live === "string" ? "live" : null
}

/** A project's figures, [{ label, value }] from frontmatter. */
export function projectFigures(project) {
  const raw = project.frontmatter?.figures
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => typeof item?.label === "string" && item.value !== undefined)
    .map((item) => ({ label: item.label, value: String(item.value) }))
}

const isProject = (file) => file && entryKind(file.slug) === "project" && isListed(file)

/**
 * The project a page is about: its own relation, else its original's, else
 * for an episode its series'. Null when the slug is no listed project.
 */
export function projectOf(file, allFiles) {
  const canonical = canonicalOf(file, allFiles)
  let slug = canonical.presence?.relation ?? file.presence?.relation ?? null
  if (!slug) slug = placeInSeries(canonical, allFiles)?.series.project ?? null
  const project = slug ? findSlug(allFiles, slug) : null
  return isProject(project) ? project : null
}

/** Series whose project is this one. */
export function seriesForProject(project, allFiles) {
  return selectSeries(allFiles).filter((series) => series.project === project.slug)
}

/**
 * Essays, episodes and notes about this project, newest first: those whose
 * relation is the project, and those the project page links to.
 */
export function writingForProject(project, allFiles) {
  const linked = new Set(project.links ?? [])
  return selectKinds(allFiles, "essay", "episode", "note").filter(
    (entry) => linked.has(entry.slug) || projectOf(entry, allFiles)?.slug === project.slug,
  )
}

/**
 * A project's log, newest first: its own entries from frontmatter
 * (log: [{ date, text, kind }]), the start of each of its series, and every
 * essay, episode and note about it. Each item is
 * { date, kind, file?, series?, text? } with kind one of launch, update,
 * essay, episode, note or series.
 */
export function projectLog(project, allFiles) {
  const items = []
  for (const entry of writingForProject(project, allFiles)) {
    const kind = entryKind(entry.slug)
    const place = kind === "episode" ? placeInSeries(entry, allFiles) : null
    items.push({ date: dateOf(entry), kind, file: entry, series: place?.series ?? null })
  }
  for (const series of seriesForProject(project, allFiles)) {
    if (series.started) items.push({ date: series.started, kind: "series", series })
  }
  const raw = Array.isArray(project.frontmatter?.log) ? project.frontmatter.log : []
  for (const item of raw) {
    const date = isoDate(item?.date)
    if (!date || typeof item.text !== "string" || !item.text.trim()) continue
    const kind = item.kind === "launch" || item.kind === "update" ? item.kind : "update"
    items.push({ date, kind, text: item.text.trim() })
  }
  // Newest first. On one day the project's own entries come last, so a launch
  // reads as the first thing that happened; a series begins before its first
  // episode, which comes later in a newest-first list.
  const weight = { launch: 3, update: 2, series: 1 }
  return items
    .filter((item) => item.date)
    .sort((a, b) =>
      a.date !== b.date
        ? a.date < b.date
          ? 1
          : -1
        : (weight[a.kind] ?? 0) - (weight[b.kind] ?? 0),
    )
}

// --- links between entries ---------------------------------------------------

/**
 * Entries that link to this page, newest first. A translation lists its
 * original's. The page itself is left out.
 */
export function backlinksOf(file, allFiles) {
  const target = baseSlug(file)
  return allEntries(allFiles)
    .filter((entry) => entry.slug !== target && (entry.links ?? []).includes(target))
    .sort(compareEntries)
}
