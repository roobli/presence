// Types for sections.js, so TypeScript callers such as renderPage.tsx can
// import it under strict mode.

export type PageKind = "home" | "folder" | "essay" | "work" | "page" | (string & {})

export interface Section {
  id: string
  kind: string
  label: string
  home: boolean
  feed: boolean
  open: boolean
}

export const SECTIONS: readonly Section[]
export function sectionById(id: string): Section | null
export function sectionOfKind(kind: string): Section | null
export function indexSlugOf(section: Section): string
export function sectionOf(slug: string): Section | null
export function sectionOfIndex(slug: string): Section | null
export function pageKind(slug: string): PageKind
