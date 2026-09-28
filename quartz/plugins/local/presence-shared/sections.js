// The site's content sections, in the order they appear on the homepage and in
// the sidebar. Every plugin that needs to know which section a page is in, what
// the section is called, or where its entries are listed reads this table, so a
// new section is one entry here plus its folder under content/.
//
//   id        folder under content/ and the first part of every slug in it
//   kind      page kind of an entry: essay pages get the essay header, reading
//             time and spine; work pages get the work header and links
//   label     chrome string key in locale.js for the section's name
//   home      listed on the homepage
//   feed      included in RSS and llms.txt
//   open      expanded in the sidebar tree on a first visit
//
// SCSS cannot import this file. _search.scss keeps a matching $sections map for
// its result labels; change both together.

export const SECTIONS = [
  { id: "writing", kind: "essay", label: "writing", home: true, feed: true, open: true },
  { id: "works", kind: "work", label: "works", home: true, feed: true, open: false },
]

/** The section with this id, or null. */
export function sectionById(id) {
  return SECTIONS.find((section) => section.id === id) ?? null
}

/** The first section whose entries are of this kind, or null. */
export function sectionOfKind(kind) {
  return SECTIONS.find((section) => section.kind === kind) ?? null
}

/** The slug of a section's own page: writing -> writing/index. */
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

/**
 * Page kind from the slug alone: home, folder, a section's entry kind, or page.
 * A translation passes its original's slug, so writing/foo/zh is an essay.
 */
export function pageKind(slug) {
  if (slug === "index") return "home"
  if (typeof slug === "string" && slug.endsWith("/index")) return "folder"
  return sectionOf(slug)?.kind ?? "page"
}
