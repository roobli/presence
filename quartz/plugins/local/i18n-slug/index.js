/**
 * Sibling-locale convention:
 *   content/writing/foo.md      -> /writing/foo
 *   content/writing/foo.zh.md   -> /writing/foo/zh
 *
 * Public URLs never contain a `.zh` segment. Translation pages are marked
 * unlisted so explorer/search/RSS stay on the primary tree; they remain
 * reachable via URL and the EN|中 switch (frontmatter.alt).
 *
 * Also records a redirect alias from the retired prefix form `/zh/<path>`
 * so existing links keep working.
 */

function remapZhSlug(slug) {
  if (typeof slug !== "string" || !slug.endsWith(".zh")) return null
  const without = slug.slice(0, -".zh".length)
  if (!without || without === "index") return "index/zh"
  // already trailing locale
  if (without.endsWith("/zh")) return without
  // retired prefix layout content/zh/... -> keep as trailing
  if (without.startsWith("zh/")) {
    const rest = without.slice("zh/".length)
    return rest ? `${rest}/zh` : "index/zh"
  }
  return `${without}/zh`
}

export function I18nSlug() {
  return {
    name: "I18nSlug",
    markdownPlugins() {
      return [
        () => (_tree, file) => {
          const prev = file.data?.slug
          const next = remapZhSlug(prev)
          if (!next) return
          file.data.slug = next
          file.data.unlisted = true

          const fm = file.data.frontmatter
          if (fm && typeof fm === "object") {
            if (fm.unlisted === undefined) fm.unlisted = true
            if (!fm.lang) fm.lang = "zh"

            // 301/alias from retired /zh/<path> prefix URLs
            const base = next.endsWith("/zh") ? next.slice(0, -"/zh".length) : next
            const legacy = base && base !== "index" ? `zh/${base}` : "zh"
            const aliases = new Set(
              Array.isArray(fm.aliases) ? fm.aliases.map(String) : fm.aliases ? [String(fm.aliases)] : [],
            )
            aliases.add(legacy)
            // also swallow the raw .zh slug so AliasRedirects is intentional
            if (typeof prev === "string") aliases.add(prev)
            fm.aliases = [...aliases]
          }

          const existing = Array.isArray(file.data.aliases) ? file.data.aliases : []
          const merged = new Set([...existing.map(String), ...(file.data.frontmatter?.aliases ?? [])])
          file.data.aliases = [...merged]
        },
      ]
    },
  }
}

export default I18nSlug
