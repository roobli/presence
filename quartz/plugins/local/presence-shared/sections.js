// The site's content sections, in the order they appear on the homepage and in
// the sidebar. Every plugin that needs to know which section a page is in, what
// the section is called, or where its entries are listed reads this table, so a
// new section is one entry here plus its folder under content/.
//
//   id        folder under content/ and the first part of every slug in it
//   kind      what an entry of the section is: essay, episode, project or note
//   label     chrome string key in locale.js for the section's name
//   home      listed on the homepage
//   feed      included in RSS and llms.txt
//   open      expanded in the sidebar tree on a first visit
//   formerly  earlier names of the folder; every page keeps a redirect from
//             the URL it had under each of them
//   months    the sidebar lists the section by month instead of by entry, for
//             a section too long to list one row per entry
//
// Series nest one level deeper: content/series/<series>/index.md describes a
// series and every other page in that folder is one of its episodes.
//
// One place cannot import this file and keeps its own copy; change it with
// this one: the $sections map in _search.scss (result labels).

export const SECTIONS = [
  {
    id: "essays",
    kind: "essay",
    label: "essays",
    home: true,
    feed: true,
    open: true,
    formerly: ["writing"],
  },
  {
    id: "series",
    kind: "episode",
    label: "series",
    home: true,
    feed: true,
    open: true,
    formerly: [],
  },
  {
    id: "projects",
    kind: "project",
    label: "projects",
    home: true,
    feed: true,
    open: true,
    formerly: ["works"],
  },
  { id: "notes", kind: "note", label: "notes", home: true, feed: true, open: true, formerly: [] },
  // Short dated fragments, read as one timeline at /posts/. They keep out of
  // the homepage and the main feed (they have their own, posts/index.xml).
  {
    id: "posts",
    kind: "post",
    label: "posts",
    home: false,
    feed: false,
    open: false,
    months: true,
    formerly: [],
  },
]

// Essays, episodes, notes and posts are all read the same way: the reading
// frame, the outline, reading time and the spine. A project page is a
// different layout.
const LAYOUTS = {
  essay: "essay",
  episode: "essay",
  note: "essay",
  post: "essay",
  project: "project",
}

/** The layout an entry kind is read in: episode -> essay. */
export function layoutOf(kind) {
  return LAYOUTS[kind] ?? kind
}

/** The section with this id, or null. */
export function sectionById(id) {
  return SECTIONS.find((section) => section.id === id) ?? null
}

/** The first section whose entries are of this kind, or null. */
export function sectionOfKind(kind) {
  return SECTIONS.find((section) => section.kind === kind) ?? null
}

/** The slug of a section's own page: essays -> essays/index. */
export function indexSlugOf(section) {
  return `${section.id}/index`
}

/**
 * The section a slug belongs to, or null. The section's own index page belongs
 * to it too; callers that want entries only check isSectionIndex as well.
 */
export function sectionOf(slug) {
  if (typeof slug !== "string") return null
  return SECTIONS.find((section) => slug.startsWith(`${section.id}/`)) ?? null
}

/** The section whose own page this slug is, or null. */
export function sectionOfIndex(slug) {
  return SECTIONS.find((section) => indexSlugOf(section) === slug) ?? null
}

const SERIES = "series"

/**
 * The series a slug is in: series/<id>/..., or null. A translation passes its
 * original's slug. A page directly under series/ belongs to no series.
 */
export function seriesIdOf(slug) {
  if (typeof slug !== "string" || !slug.startsWith(`${SERIES}/`)) return null
  const parts = slug.split("/")
  return parts.length >= 3 && parts[1] !== "index" ? parts[1] : null
}

/** The slug of a series' own page: kernels -> series/kernels/index. */
export function seriesIndexSlug(id) {
  return `${SERIES}/${id}/index`
}

/** True for a series' own page, series/<id>/index. */
export function isSeriesIndex(slug) {
  const id = seriesIdOf(slug)
  return id !== null && slug === seriesIndexSlug(id)
}

/**
 * What a page is: home, folder (a section's or a series' own page), the entry
 * kind of its section, or page. A translation passes its original's slug, so
 * essays/foo/zh is an essay.
 */
export function entryKind(slug) {
  if (slug === "index") return "home"
  if (typeof slug === "string" && slug.endsWith("/index")) return "folder"
  return sectionOf(slug)?.kind ?? "page"
}

/** The layout a page is rendered in: home, folder, essay, project or page. */
export function pageKind(slug) {
  return layoutOf(entryKind(slug))
}

/**
 * The slugs a page had under its section's earlier names, which keep
 * redirecting to it: essays/foo -> [writing/foo].
 */
export function formerSlugs(slug) {
  const section = sectionOf(slug)
  if (!section) return []
  const rest = slug.slice(section.id.length)
  return (section.formerly ?? []).map((name) => name + rest)
}
