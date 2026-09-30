import fs from "node:fs/promises"
import path from "node:path"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"
import { render } from "preact-render-to-string"
import { pageUrl } from "../i18n-slug/index.js"
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
 *   sitemap.xml  every listed page plus translations. Language pairs are declared
 *                once, by i18n-slug's hreflang head tags on each page: xhtml:link
 *                alternates here would say the same again, and their XHTML
 *                namespace stops browsers showing the file as an XML tree.
 *   index.xml    RSS 2.0 of English entries in feed sections (sections.js), newest first
 *                by frontmatter date
 *   llms.txt     short English-primary map of the public site for generative engines
 *   robots.txt   allows everything and points at sitemap.xml
 *   _redirects   a 301 from every page alias for Cloudflare Pages (redirects.js)
 *
 * URLs come from i18n-slug's pageUrl, so <loc> always equals the canonical link.
 */

const EN = "en"
const POSTS_FEED = "posts/index.xml"

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

// The pages a listing shows: the entries of the sections on the homepage (not
// posts, which it leaves out), everything under the folder for a section's or a
// series' own page, none for a page.
function listedBy(slug) {
  if (slug === "index") return (other) => sectionOf(other.slug)?.home === true
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

export function generateSitemap(baseUrl, pages) {
  const entries = pages
    .map((data) => ({ data, loc: pageUrl(baseUrl, data.slug) }))
    .sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0))
    .map(({ data, loc }) => {
      const lines = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`]
      const lastmod = lastModified(data, pages)
      if (lastmod) lines.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`)
      lines.push(`  </url>`)
      return lines.join("\n")
    })

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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

// Links in a page body are relative to the page; a feed reader shows the body
// somewhere else, so every href and src is resolved against the page URL.
function withAbsoluteLinks(node, base) {
  if (node.type !== "element" && node.type !== "root") return node
  let properties = node.properties
  if (properties) {
    properties = { ...properties }
    for (const key of ["href", "src"]) {
      const value = properties[key]
      if (typeof value !== "string" || value === "") continue
      try {
        properties[key] = new URL(value, base).href
      } catch {
        // Leave anything URL cannot parse as it was.
      }
    }
  }
  const children = (node.children ?? []).map((child) => withAbsoluteLinks(child, base))
  return { ...node, properties, children }
}

/** A page's rendered body as HTML with absolute links, or "" if it has none. */
export function feedHtml(baseUrl, data) {
  const tree = data.htmlAst
  if (!tree || !Array.isArray(tree.children)) return ""
  const body = withAbsoluteLinks(tree, pageUrl(baseUrl, data.slug))
  return render(toJsxRuntime(body, { Fragment, jsx, jsxs, elementAttributeNameCase: "html" }))
}

// CDATA cannot contain its own terminator; split it across two sections.
function cdata(value) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`
}

/**
 * RSS 2.0 of pages, newest first. channel names the feed; without it this is
 * the site's main feed at /index.xml. Posts have their own at
 * /posts/index.xml, so readers of the essays are not sent every fragment.
 * channel.fullText adds each body as content:encoded: a post is a few lines,
 * and a summary of it would be most of it.
 */
export function generateFeed(cfg, pages, channel = {}) {
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
      if (channel.fullText) {
        const html = feedHtml(cfg.baseUrl, data)
        if (html) lines.push(`      <content:encoded>${cdata(html)}</content:encoded>`)
      }
      if (date) lines.push(`      <pubDate>${date.toUTCString()}</pubDate>`)
      lines.push(`    </item>`)
      return lines.join("\n")
    })

  const siteTitle = escapeXml(cfg.pageTitle ?? "")
  const title = channel.title ? escapeXml(channel.title) : siteTitle
  const link = pageUrl(cfg.baseUrl, channel.slug ?? "index")
  const description = escapeXml(
    channel.description ?? `Essays, series, projects and notes on ${cfg.pageTitle ?? ""}`,
  )
  const self = channel.path ?? "index.xml"
  // A feed of mixed languages names none.
  const language = channel.language === undefined ? EN : channel.language
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    channel.fullText
      ? `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">`
      : `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${title}</title>`,
    `    <link>${escapeXml(link)}</link>`,
    `    <description>${description}</description>`,
    ...(language ? [`    <language>${language}</language>`] : []),
    `    <atom:link href="https://${escapeXml(cfg.baseUrl)}/${escapeXml(self)}" rel="self" type="application/rss+xml"/>`,
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
    ...SECTIONS.filter(
      (section) =>
        section.kind === "post" &&
        pages.some((data) => sectionOf(data.slug) === section && !data.slug.endsWith("/index")),
    ).flatMap((section) => [
      `- ${t(EN, section.label)}: ${pageUrl(baseUrl, indexSlugOf(section))} (short dated posts in English and Chinese, not listed here)`,
      `- ${t(EN, section.label)} RSS: https://${baseUrl}/${POSTS_FEED}`,
    ]),
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
    // Posts in either language: a post has no translation to stand in for it.
    const postPages = pages.filter(
      (data) =>
        data.unlisted !== true &&
        sectionOf(data.slug)?.kind === "post" &&
        !data.slug.endsWith("/index"),
    )

    return Promise.all([
      write(ctx, "sitemap.xml", generateSitemap(cfg.baseUrl, sitemapPages)),
      write(ctx, "index.xml", generateFeed(cfg, feedPages)),
      ...(postPages.length > 0
        ? [
            write(
              ctx,
              POSTS_FEED,
              generateFeed(cfg, postPages, {
                title: `${cfg.pageTitle ?? ""} Posts`,
                slug: "posts/index",
                description: `Short dated posts on ${cfg.pageTitle ?? ""}, newest first`,
                path: POSTS_FEED,
                language: null,
                fullText: true,
              }),
            ),
          ]
        : []),
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
