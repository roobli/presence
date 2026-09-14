import { Fragment, h } from "preact"
import { styleText } from "node:util"

/**
 * Sibling-locale convention:
 *   content/writing/foo.md      -> /writing/foo      (en)
 *   content/writing/foo.zh.md   -> /writing/foo/zh   (zh-Hans)
 *   content/index.zh.md         -> /zh
 *
 * Pairs are derived from ctx.allSlugs while the file is processed: foo has a
 * translation when "foo.zh" is a source slug, and a translation has an original
 * when its base slug exists. The result is stored as
 *   file.data.i18n = { lang, base, alternates: [{ lang, slug }] }
 * and mirrored into frontmatter.lang and frontmatter.alt, which LanguageSwitch
 * and renderPage read. A hand-written alt still wins.
 *
 * Translations stay unlisted (out of the Explorer, search and content-index) and
 * keep redirect aliases from the raw `.zh` slug and the retired `/zh/<path>` prefix.
 *
 * Runs after NoteProperties, which is what parses frontmatter.
 */

const ZH_SUFFIX = ".zh"
const EN = "en"
const ZH = "zh-Hans"
const OG_LOCALE = { [EN]: "en_US", [ZH]: "zh_CN" }

function normalizeLang(value) {
  if (typeof value !== "string" || !value.trim()) return undefined
  const lang = value.trim()
  const lower = lang.toLowerCase()
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") return ZH
  if (lower === "en" || lower.startsWith("en-")) return EN
  return lang
}

// index -> zh, writing/index -> writing/zh, writing/foo -> writing/foo/zh
function translationSlug(base) {
  if (base === "index") return "zh"
  if (base.endsWith("/index")) return `${base.slice(0, -"index".length)}zh`
  return `${base}/zh`
}

// URL path of a slug: index -> "", writing/index -> "writing/"
function urlPath(slug) {
  if (slug === "index") return ""
  return slug.endsWith("/index") ? slug.slice(0, -"index".length) : slug
}

/** Absolute page URL, in the same form as sitemap <loc>. */
export function pageUrl(baseUrl, slug) {
  return `https://${baseUrl}/${encodeURI(urlPath(slug))}`
}

/**
 * Every language version of a page, English first, plus x-default pointing at
 * English. Empty when the page has no translation pair.
 */
export function languageVersions(fileData) {
  const i18n = fileData.i18n
  if (!i18n || i18n.alternates.length === 0) return []
  const versions = [{ lang: i18n.lang, slug: fileData.slug }, ...i18n.alternates].sort(
    (a, b) => Number(b.lang === EN) - Number(a.lang === EN),
  )
  const en = versions.find((version) => version.lang === EN)
  return en ? [...versions, { lang: "x-default", slug: en.slug }] : versions
}

function addAliases(file, aliases) {
  const merged = new Set(file.data.aliases ?? [])
  for (const alias of aliases) {
    if (alias !== file.data.slug) merged.add(alias)
  }
  file.data.aliases = [...merged]
}

function annotate(ctx, file) {
  const slug = file.data.slug
  if (typeof slug !== "string") return
  const allSlugs = ctx.allSlugs
  const fm = (file.data.frontmatter ??= {})
  const hasHandAlt = typeof fm.alt === "string" && fm.alt.trim() !== ""

  if (slug.endsWith(ZH_SUFFIX)) {
    const base = slug.slice(0, -ZH_SUFFIX.length)
    const next = translationSlug(base)
    const hasOriginal = allSlugs.includes(base)
    if (!hasOriginal) {
      console.warn(
        styleText("yellow", "warning:") +
          ` i18n-slug: ${file.data.relativePath} has no original (${base}.md), so /${next} gets no language switch or hreflang`,
      )
    }

    const lang = normalizeLang(fm.lang) ?? ZH
    file.data.slug = next
    file.data.unlisted = true
    fm.unlisted ??= true
    fm.lang = lang
    if (hasOriginal && !hasHandAlt) fm.alt = `/${urlPath(base)}`
    file.data.i18n = { lang, base, alternates: hasOriginal ? [{ lang: EN, slug: base }] : [] }

    const legacy = base === "index" ? "zh" : `zh/${base}`
    addAliases(file, [slug, legacy])
    for (const target of [next, legacy]) {
      if (!allSlugs.includes(target)) allSlugs.push(target)
    }
    return
  }

  const lang = normalizeLang(fm.lang) ?? EN
  fm.lang = lang
  const alternates = []
  if (allSlugs.includes(slug + ZH_SUFFIX)) {
    const zhSlug = translationSlug(slug)
    alternates.push({ lang: ZH, slug: zhSlug })
    if (!hasHandAlt) fm.alt = `/${urlPath(zhSlug)}`
    // No "<slug>/index" redirect alias: foo/index.html next to foo.html makes the
    // dev server (serve-handler tries index.html first) answer /foo with the
    // redirect stub, whose refresh points back at /foo and loops.
  }
  file.data.i18n = { lang, base: slug, alternates }
}

function headTags(cfg, fileData) {
  const slug = fileData.slug
  const lang = fileData.i18n?.lang ?? normalizeLang(fileData.frontmatter?.lang) ?? EN
  const tags = [h("meta", { name: "page-lang", content: lang })]

  if (OG_LOCALE[lang]) tags.push(h("meta", { property: "og:locale", content: OG_LOCALE[lang] }))
  for (const alternate of fileData.i18n?.alternates ?? []) {
    if (OG_LOCALE[alternate.lang]) {
      tags.push(h("meta", { property: "og:locale:alternate", content: OG_LOCALE[alternate.lang] }))
    }
  }

  if (cfg.baseUrl) {
    if (slug !== "404") {
      // href before rel on purpose: fetchCanonical (components/scripts/util.ts)
      // follows the literal `<link rel="canonical" href="...">` of alias redirect
      // pages. This order keeps a content page's own canonical from ever matching,
      // which would refetch each SPA navigation from the production origin.
      tags.push(h("link", { href: pageUrl(cfg.baseUrl, slug), rel: "canonical" }))
    }
    for (const version of languageVersions(fileData)) {
      tags.push(
        h("link", {
          rel: "alternate",
          hreflang: version.lang,
          href: pageUrl(cfg.baseUrl, version.slug),
        }),
      )
    }
  }

  tags.push(
    h("link", {
      rel: "alternate",
      type: "application/rss+xml",
      title: cfg.pageTitle,
      href: "/index.xml",
    }),
  )
  return h(Fragment, null, ...tags)
}

export function I18nSlug() {
  return {
    name: "I18nSlug",
    markdownPlugins(ctx) {
      return [() => (_tree, file) => annotate(ctx, file)]
    },
    externalResources(ctx) {
      const cfg = ctx.cfg.configuration
      return { additionalHead: [(fileData) => headTags(cfg, fileData)] }
    },
  }
}

export default I18nSlug
