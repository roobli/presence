import { Fragment, h } from "preact"
import { pageUrl } from "../i18n-slug/index.js"

/**
 * Tags added to every page head through additionalHead.
 *
 * The preload fetches the Latin Source Serif 4 file that
 * quartz/styles/custom/_site-tokens.scss declares. English pages reach it
 * through "Source Serif 4 Variable" and Chinese pages through the restricted
 * "Source Serif 4 Latin" family on the same URL, so one preload serves both.
 * Fonts are fetched in CORS mode, so the preload needs crossorigin to be reused.
 *
 * The italic face is registered by the inline script rather than the
 * stylesheet. Declared in CSS, it starts downloading during first layout on
 * every page with <em>, so an essay needed two fonts before first paint. The
 * script adds it after the load event, and only when an element on the page
 * renders italic in the text face. It loads the file before adding the face,
 * so emphasis changes once, from the synthesized oblique to the real italic,
 * without a fallback face in between. The face stays in document.fonts, so
 * later SPA navigations reuse it.
 *
 * JSON-LD (WebSite / Person / Article) is emitted per page from the same
 * additionalHead hook. Person always uses PERSON_ID so About and every Article
 * author resolve to one entity.
 */

export const BODY_FONT_HREF = "/static/fonts/source-serif-4-latin-wght-normal.woff2"
export const ITALIC_FONT_HREF = "/static/fonts/source-serif-4-latin-wght-italic.woff2"
// Copied from the package's wght-italic.css (latin subset).
export const ITALIC_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, " +
  "U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"

export const SITE_ORIGIN = "https://www.roobli.org"
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`
/** Stable Person @id shared by About and every Article author. */
export const PERSON_ID = `${SITE_ORIGIN}/about#person`

const EN = "en"
const ZH = "zh-Hans"

// Serialized into the page with toString, so it may only use its arguments and
// browser globals. The site stylesheets set no font-style: italic, so only the
// elements the UA stylesheet italicizes can need the face. Chinese pages set
// em upright and never match.
function registerItalicFace(href, unicodeRange) {
  let face
  const needed = () => {
    for (const el of document.querySelectorAll("em, i, cite, dfn, var, address")) {
      const style = getComputedStyle(el)
      if (style.fontStyle === "italic" && /^["']?Source Serif 4 Variable\b/.test(style.fontFamily)) {
        return true
      }
    }
    return false
  }
  const register = () => {
    if (face || document.readyState !== "complete" || !needed()) return
    face = new FontFace("Source Serif 4 Variable", `url("${href}") format("woff2")`, {
      style: "italic",
      weight: "200 900",
      display: "swap",
      unicodeRange,
    })
    face.load().then(
      (loaded) => document.fonts.add(loaded),
      () => {
        face = undefined
      },
    )
  }
  // The first nav fires before DOMContentLoaded and returns early; load covers that page.
  addEventListener("load", register, { once: true })
  document.addEventListener("nav", register)
}

export const italicFaceScript = `(${registerItalicFace})(${JSON.stringify(ITALIC_FONT_HREF)}, ${JSON.stringify(ITALIC_UNICODE_RANGE)})`

/** Escape JSON for embedding in a <script> so </script> cannot break out. */
export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function unescapeHtml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
}

function pageDescription(fileData) {
  const fm = fileData.frontmatter ?? {}
  if (typeof fm.socialDescription === "string" && fm.socialDescription.trim()) {
    return fm.socialDescription.trim()
  }
  if (typeof fm.description === "string" && fm.description.trim()) {
    return fm.description.trim()
  }
  if (typeof fileData.description === "string" && fileData.description.trim()) {
    return unescapeHtml(fileData.description.trim())
  }
  return undefined
}

/** YYYY-MM-DD (or longer ISO) from frontmatter, matching Head.tsx / dates.js. */
function frontmatterDate(value) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(trimmed)) {
    return trimmed
  }
  return undefined
}

function pageLang(fileData) {
  const raw = fileData.i18n?.lang ?? fileData.frontmatter?.lang
  if (typeof raw !== "string" || !raw.trim()) return EN
  const lower = raw.trim().toLowerCase()
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") return ZH
  if (lower === "en" || lower.startsWith("en-")) return EN
  return raw.trim()
}

function absoluteUrl(baseUrl, slug) {
  const host = baseUrl || "www.roobli.org"
  return pageUrl(host, slug)
}

/**
 * Person facts from content/about.md (GitHub user + org only).
 * One @id everywhere so Article.author and the About page share an entity.
 */
export function personNode() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Dylan",
    alternateName: ["cicada", "RoobLi"],
    url: `${SITE_ORIGIN}/about`,
    sameAs: ["https://github.com/lr00rl", "https://github.com/roobli"],
  }
}

export function websiteNode(description) {
  const node = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "RoobLi",
    url: `${SITE_ORIGIN}/`,
    publisher: { "@id": PERSON_ID },
    inLanguage: EN,
  }
  if (description) node.description = description
  return node
}

/**
 * Build the JSON-LD @graph for a page, or null when the page gets none (v1).
 * Homepage: WebSite + Person. About: Person (+ WebSite). Essays: Article + Person + WebSite.
 */
export function buildJsonLdGraph(cfg, fileData) {
  const slug = fileData.slug
  if (typeof slug !== "string" || slug === "404") return null

  const kind = fileData.presence?.kind
  const baseUrl = cfg.baseUrl
  const url = absoluteUrl(baseUrl, slug)
  const description = pageDescription(fileData)
  const person = personNode()
  const graph = []

  if (slug === "index" || kind === "home") {
    graph.push(websiteNode(description ?? "Fewer pages. Harder claims."), person)
    return { "@context": "https://schema.org", "@graph": graph }
  }

  if (slug === "about") {
    graph.push(person, websiteNode())
    return { "@context": "https://schema.org", "@graph": graph }
  }

  if (kind === "essay") {
    const fm = fileData.frontmatter ?? {}
    const headline = typeof fm.title === "string" ? fm.title : undefined
    const datePublished = frontmatterDate(fm.published ?? fm.date)
    const dateModified = frontmatterDate(fm.updated) || datePublished
    const lang = pageLang(fileData)

    const article = {
      "@type": "Article",
      "@id": `${url}#article`,
      headline,
      description,
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      inLanguage: lang,
      author: { "@id": PERSON_ID },
      isPartOf: { "@id": WEBSITE_ID },
    }
    if (datePublished) article.datePublished = datePublished
    if (dateModified) article.dateModified = dateModified

    // Optional alternates only when i18n-slug already paired them.
    // English pages list translations; zh pages already point at the original via URL.
    const alternates = fileData.i18n?.alternates
    if (lang === EN && Array.isArray(alternates) && alternates.length > 0) {
      article.workTranslation = alternates.map((alt) => ({
        "@type": "Article",
        url: absoluteUrl(baseUrl, alt.slug),
        inLanguage: alt.lang,
      }))
    }

    graph.push(article, person, websiteNode())
    return { "@context": "https://schema.org", "@graph": graph }
  }

  return null
}

export function structuredDataHead(cfg, fileData) {
  const data = buildJsonLdGraph(cfg ?? {}, fileData)
  if (!data) return null
  return h("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: safeJsonLd(data) },
  })
}

export function additionalHead(ctx) {
  const cfg = ctx?.cfg?.configuration ?? {}
  return [
    h("link", {
      rel: "preload",
      href: BODY_FONT_HREF,
      as: "font",
      type: "font/woff2",
      crossorigin: "",
    }),
    h("script", { dangerouslySetInnerHTML: { __html: italicFaceScript } }),
    (fileData) => {
      const tag = structuredDataHead(cfg, fileData)
      return tag ? h(Fragment, null, tag) : h(Fragment, null)
    },
  ]
}
