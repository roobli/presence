// Types for sections.js, so TypeScript callers such as renderPage.tsx can
// import it under strict mode.

export type EntryKind = "essay" | "episode" | "project" | "note" | "post" | (string & {})
export type PageKind = "home" | "folder" | "essay" | "project" | "page" | (string & {})

export interface Section {
  id: string
  kind: EntryKind
  label: string
  home: boolean
  feed: boolean
  open: boolean
  months?: boolean
  formerly: readonly string[]
}

export const SECTIONS: readonly Section[]
export function layoutOf(kind: string): PageKind
export function sectionById(id: string): Section | null
export function sectionOfKind(kind: string): Section | null
export function indexSlugOf(section: Section): string
export function sectionOf(slug: string): Section | null
export function sectionOfIndex(slug: string): Section | null
export function seriesIdOf(slug: string): string | null
export function seriesIndexSlug(id: string): string
export function isSeriesIndex(slug: string): boolean
export function entryKind(slug: string): EntryKind | "home" | "folder" | "page"
export function pageKind(slug: string): PageKind
export function formerSlugs(slug: string): string[]
