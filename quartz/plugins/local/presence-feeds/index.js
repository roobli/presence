import fs from "node:fs/promises"
import path from "node:path"
import { languageVersions, pageUrl } from "../i18n-slug/index.js"

/**
 * sitemap.xml, index.xml, and llms.txt — replacing the feeds content-index writes
 * and adding a generative-engine map at the site root.
 *
 * content-index skips unlisted pages, so its sitemap has no translations, and it
 * dates virtual folder and tag pages with the build time, so its newest-first feed
 * fills up with them. This emitter reads only real content files:
 *   sitemap.xml  every listed page plus translations, with xhtml:link alternates
 *                for each language pair (the same set as the hreflang head tags)
 *   index.xml    RSS 2.0 of English pages under writing/ and works/, newest first
 *                by frontmatter date
 *   llms.txt     short English-primary map of the public site for generative engines
 *
 * URLs come from i18n-slug's pageUrl, so <loc> always equals the canonical link.
 */

const EN = "en"
const FEED_SECTIONS = ["writing/", "works/"]

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

function generateSitemap(baseUrl, pages) {
  const entries = pages
    .map((data) => ({ data, loc: pageUrl(baseUrl, data.slug) }))
    .sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0))
    .map(({ data, loc }) => {
      const lines = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`]
      const lastmod = toDate(data.dates?.modified)
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

function generateFeed(cfg, pages) {
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
        `      <guid isPermaLink="true">${url}</guid>`,
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
    `    <description>Writing and works on ${siteTitle}</description>`,
    `    <language>${EN}</language>`,
    `    <atom:link href="https://${escapeXml(cfg.baseUrl)}/index.xml" rel="self" type="application/rss+xml"/>`,
    ...items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n")
}

/**
 * Concise generative-engine map. English primary; one brief CN line.
 * Essays are English public writing/* pages (not translations, not indexes).
 */
export function generateLlmsTxt(cfg, pages) {
  const baseUrl = cfg.baseUrl
  const home = pages.find((data) => data.slug === "index")
  const purpose =
    pageDescription(home ?? {}) ||
    (typeof cfg.description === "string" ? cfg.description : "") ||
    "Fewer pages. Harder claims."

  const essays = pages
    .filter(
      (data) =>
        data.unlisted !== true &&
        (data.i18n?.lang ?? EN) === EN &&
        data.slug.startsWith("writing/") &&
        !data.slug.endsWith("/index") &&
        (data.presence?.kind === "essay" || data.presence?.kind === undefined),
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

  const lines = [
    `# RoobLi`,
    ``,
    `> ${purpose}`,
    ``,
    `Public site for selected works and deep writing.`,
    ``,
    `- Site: ${pageUrl(baseUrl, "index")}`,
    `- About: ${pageUrl(baseUrl, "about")}`,
    `- Writing: ${pageUrl(baseUrl, "writing/index")}`,
    `- Works: ${pageUrl(baseUrl, "works/index")}`,
    `- RSS: https://${baseUrl}/index.xml`,
    ``,
    `## Essays`,
    ``,
  ]

  if (essays.length === 0) {
    lines.push(`(none yet)`)
    lines.push(``)
  } else {
    for (const essay of essays) {
      const desc = essay.description ? ` — ${essay.description}` : ""
      lines.push(`- [${essay.title}](${essay.url})${desc}`)
    }
    lines.push(``)
  }

  lines.push(`## Notes`)
  lines.push(``)
  lines.push(`Internal RooB notes are not published from this site.`)
  lines.push(``)
  lines.push(`中文：精选作品与深度文章；内部 RooB 笔记不在此发布。`)
  lines.push(``)
  return lines.join("\n")
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
      (data) =>
        data.unlisted !== true &&
        (data.i18n?.lang ?? EN) === EN &&
        FEED_SECTIONS.some((section) => data.slug.startsWith(section)) &&
        !data.slug.endsWith("/index"),
    )

    return Promise.all([
      write(ctx, "sitemap.xml", generateSitemap(cfg.baseUrl, sitemapPages)),
      write(ctx, "index.xml", generateFeed(cfg, feedPages)),
      write(ctx, "llms.txt", generateLlmsTxt(cfg, pages)),
    ])
  }

  return {
    name: "PresenceFeeds",
    emit: emitFeeds,
    partialEmit: emitFeeds,
  }
}

export default PresenceFeeds
