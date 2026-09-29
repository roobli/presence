import fs from "node:fs/promises"
import path from "node:path"
import { languageVersions, pageUrl } from "../i18n-slug/index.js"
import { t } from "../presence-shared/locale.js"
import { indexSlugOf, SECTIONS, sectionOf } from "../presence-shared/sections.js"
import { generateRedirects } from "./redirects.js"

/**
 * sitemap.xml, index.xml, and llms.txt — replacing the feeds content-index writes
 * and adding a generative-engine map at the site root.
 *
 * content-index skips unlisted pages, so its sitemap has no translations, and it
 * dates virtual folder and tag pages with the build time, so its newest-first feed
 * fills up with them. This emitter reads only real content files:
 *   sitemap.xml  every listed page plus translations, with xhtml:link alternates
 *                for each language pair (the same set as the hreflang head tags)
 *   index.xml    RSS 2.0 of English entries in feed sections (sections.js), newest first
 *                by frontmatter date
 *   llms.txt     short English-primary map of the public site for generative engines
 *   robots.txt   allows everything and points at sitemap.xml
 *   _redirects   a 301 from every page alias for Cloudflare Pages (redirects.js)
 *
 * URLs come from i18n-slug's pageUrl, so <loc> always equals the canonical link.
 */

const EN = "en"

// An entry (not a section's own page) of a section that goes into the feeds.
function isFeedEntry(slug) {
  return sectionOf(slug)?.feed === true && !slug.endsWith("/index")
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// The description transformer HTML-escapes the excerpt it derives from the body.
function unescapeHtml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
}

// Date-only strings such as "2026-09-11" parse as UTC midnight, independent of
// the build machine's time zone.
function toDate(value) {
  if (value === undefined || value === null || value === "") return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

// Virtual folder and tag pages are generated without a source file.
function isContentPage(data) {
  return typeof data.filePath === "string" && typeof data.slug === "string"
}

function isTranslation(data) {
  return Boolean(data.i18n) && data.i18n.base !== data.slug
}

function pageDescription(data) {
  const fm = data.frontmatter ?? {}
  if (typeof fm.description === "string" && fm.description.trim()) return fm.description.trim()
  if (typeof data.description === "string" && data.description.trim()) {
    return unescapeHtml(data.description.trim())
  }
  return ""
}

// The pages a listing shows: every section entry for the homepage, everything
// under the folder for a section's or a series' own page, none for a page.
function listedBy(slug) {
  if (slug === "index") return (other) => sectionOf(other.slug) !== null
  if (!slug.endsWith("/index")) return null
  const prefix = slug.slice(0, -"index".length)
  return (other) => other.slug !== slug && other.slug.startsWith(prefix)
}

/**
 * A page's lastmod. A listing changes when an entry in it does, not only when
 * its own index.md does, so it takes the newest of its own date and theirs.
 */
export function lastModified(data, pages) {
  let latest = toDate(data.dates?.modified)
  const listed = listedBy(data.slug)
  if (!listed) return latest
  for (const other of pages) {
    if (!listed(other)) continue
    const date = toDate(other.dates?.modified)
    if (date && (!latest || date > latest)) latest = date
  }
  return latest
}

function generateSitemap(baseUrl, pages) {
  const entries = pages
    .map((data) => ({ data, loc: pageUrl(baseUrl, data.slug) }))
    .sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0))
    .map(({ data, loc }) => {
      const lines = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`]
      const lastmod = lastModified(data, pages)
      if (lastmod) lines.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`)
      for (const version of languageVersions(data)) {
        const href = escapeXml(pageUrl(baseUrl, version.slug))
        lines.push(`    <xhtml:link rel="alternate" hreflang="${version.lang}" href="${href}"/>`)
      }
      lines.push(`  </url>`)
      return lines.join("\n")
    })

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries,
    `</urlset>`,
    ``,
  ].join("\n")
}

/**
 * An item's ID. A page that moved keeps the ID it was first published under
 * (frontmatter guid), so readers do not list it again as new; every other
 * page is identified by its URL.
 */
export function guidLine(fm, url) {
  const guid = typeof fm.guid === "string" ? fm.guid.trim() : ""
  return guid
    ? `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`
    : `      <guid isPermaLink="true">${url}</guid>`
}

export function generateFeed(cfg, pages) {
  const items = pages
    .map((data) => {
      const fm = data.frontmatter ?? {}
      return {
        data,
        title: String(fm.title ?? data.slug),
        // note-properties folds published, publishDate and date into published.
        date: toDate(fm.published ?? fm.date),
      }
    })
    .sort((a, b) => {
      if (a.date && b.date && a.date.getTime() !== b.date.getTime()) {
        return b.date.getTime() - a.date.getTime()
      }
      if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1
      return a.title.localeCompare(b.title)
    })
    .map(({ data, title, date }) => {
      const url = escapeXml(pageUrl(cfg.baseUrl, data.slug))
      const fm = data.frontmatter ?? {}
      const description =
        typeof fm.description === "string" ? fm.description : unescapeHtml(data.description ?? "")
      const lines = [
        `    <item>`,
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${url}</link>`,
        guidLine(fm, url),
      ]
      if (description) lines.push(`      <description>${escapeXml(description)}</description>`)
      if (date) lines.push(`      <pubDate>${date.toUTCString()}</pubDate>`)
      lines.push(`    </item>`)
      return lines.join("\n")
    })

  const siteTitle = escapeXml(cfg.pageTitle ?? "")
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${siteTitle}</title>`,
    `    <link>${escapeXml(pageUrl(cfg.baseUrl, "index"))}</link>`,
    `    <description>Essays, series, projects and notes on ${siteTitle}</description>`,
    `    <language>${EN}</language>`,
    `    <atom:link href="https://${escapeXml(cfg.baseUrl)}/index.xml" rel="self" type="application/rss+xml"/>`,
    ...items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n")
}

/**
 * Concise generative-engine map. English primary; one brief CN line. Each feed
 * section lists its English public entries (not translations), newest first;
 * Essays is always there, the others once they have an entry.
 */
export function generateLlmsTxt(cfg, pages) {
  const baseUrl = cfg.baseUrl
  const home = pages.find((data) => data.slug === "index")
  const purpose =
    pageDescription(home ?? {}) ||
    (typeof cfg.description === "string" ? cfg.description : "") ||
    "Fewer pages. Harder claims."

  const entriesOf = (section) =>
    pages
      .filter(
        (data) =>
          data.unlisted !== true &&
          (data.i18n?.lang ?? EN) === EN &&
          isFeedEntry(data.slug) &&
          sectionOf(data.slug) === section,
      )
      .map((data) => {
        const fm = data.frontmatter ?? {}
        return {
          title: String(fm.title ?? data.slug),
          url: pageUrl(baseUrl, data.slug),
          description: pageDescription(data),
          date: toDate(fm.published ?? fm.date),
        }
      })
      .sort((a, b) => {
        if (a.date && b.date && a.date.getTime() !== b.date.getTime()) {
          return b.date.getTime() - a.date.getTime()
        }
        return a.title.localeCompare(b.title)
      })

  const feedSections = SECTIONS.filter((section) => section.feed)
  const lines = [
    `# RoobLi`,
    ``,
    `> ${purpose}`,
    ``,
    `Public site for essays, series, projects and short notes.`,
    ``,
    `- Site: ${pageUrl(baseUrl, "index")}`,
    `- About: ${pageUrl(baseUrl, "about")}`,
    ...feedSections.map(
      (section) => `- ${t(EN, section.label)}: ${pageUrl(baseUrl, indexSlugOf(section))}`,
    ),
    `- RSS: https://${baseUrl}/index.xml`,
    ``,
  ]

  for (const section of feedSections) {
    const entries = entriesOf(section)
    if (entries.length === 0 && section.kind !== "essay") continue
    lines.push(`## ${t(EN, section.label)}`, ``)
    if (entries.length === 0) lines.push(`(none yet)`)
    for (const entry of entries) {
      const desc = entry.description ? ` — ${entry.description}` : ""
      lines.push(`- [${entry.title}](${entry.url})${desc}`)
    }
    lines.push(``)
  }

  lines.push(`## Private notes`)
  lines.push(``)
  lines.push(`Internal RooB notes are not published from this site.`)
  lines.push(``)
  lines.push(`中文：文章、系列、项目与随笔；内部 RooB 笔记不在此发布。`)
  lines.push(``)
  return lines.join("\n")
}

/**
 * robots.txt: the whole site is public, and the Sitemap line is how crawlers
 * that were never told about the sitemap find it.
 */
export function generateRobotsTxt(baseUrl) {
  return ["User-agent: *", "Allow: /", "", `Sitemap: https://${baseUrl}/sitemap.xml`, ""].join("\n")
}

async function write(ctx, name, content) {
  const target = path.join(ctx.argv.output, name)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
  return target
}

export function PresenceFeeds() {
  const emitFeeds = async (ctx, content) => {
    const cfg = ctx.cfg.configuration
    // Absolute URLs for all three artefacts.
    if (!cfg.baseUrl) return []

    const pages = content.map(([, file]) => file.data).filter(isContentPage)
    const sitemapPages = pages.filter((data) => data.unlisted !== true || isTranslation(data))
    const feedPages = pages.filter(
      (data) => data.unlisted !== true && (data.i18n?.lang ?? EN) === EN && isFeedEntry(data.slug),
    )

    return Promise.all([
      write(ctx, "sitemap.xml", generateSitemap(cfg.baseUrl, sitemapPages)),
      write(ctx, "index.xml", generateFeed(cfg, feedPages)),
      write(ctx, "llms.txt", generateLlmsTxt(cfg, pages)),
      write(ctx, "robots.txt", generateRobotsTxt(cfg.baseUrl)),
      write(ctx, "_redirects", generateRedirects(pages)),
    ])
  }

  return {
    name: "PresenceFeeds",
    emit: emitFeeds,
    partialEmit: emitFeeds,
  }
}

export default PresenceFeeds
