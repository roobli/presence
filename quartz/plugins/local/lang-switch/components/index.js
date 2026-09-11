import { h } from "preact"

/**
 * Per-article language switch. Renders only when frontmatter.alt is set.
 * Convention: lang (en|zh, default en) + alt (absolute path of the other version).
 */

function normalizePath(path) {
  if (!path || typeof path !== "string") return null
  const trimmed = path.trim()
  if (!trimmed) return null
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function LanguageSwitchComponent({ fileData, displayClass }) {
  const fm = fileData.frontmatter ?? {}
  const alt = normalizePath(fm.alt)
  if (!alt) return null

  const lang = (typeof fm.lang === "string" ? fm.lang : "en").toLowerCase()
  const isZh = lang === "zh" || lang.startsWith("zh")
  const selfPath = normalizePath(fileData.slug === "index" ? "/" : `/${fileData.slug}`)
  const enHref = isZh ? alt : selfPath
  const zhHref = isZh ? selfPath : alt

  const enNode = isZh
    ? h("a", { href: enHref, class: "lang-switch__link" }, "EN")
    : h("span", { class: "lang-switch__link is-current", "aria-current": "page" }, "EN")

  const zhNode = isZh
    ? h("span", { class: "lang-switch__link is-current", "aria-current": "page" }, "中")
    : h("a", { href: zhHref, class: "lang-switch__link" }, "中")

  return h(
    "nav",
    {
      class: ["lang-switch", displayClass].filter(Boolean).join(" "),
      "aria-label": "Language",
    },
    enNode,
    h("span", { class: "lang-switch__sep", "aria-hidden": "true" }, "|"),
    zhNode,
  )
}

LanguageSwitchComponent.css = `
.lang-switch {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin: 0.35rem 0 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  color: var(--gray);
}
.lang-switch__link {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.lang-switch__link:hover {
  color: var(--secondary);
  border-bottom-color: var(--secondary);
}
.lang-switch__link.is-current {
  color: var(--darkgray);
  font-weight: 600;
  cursor: default;
}
.lang-switch__sep {
  opacity: 0.55;
  user-select: none;
}
`

export const LanguageSwitch = () => LanguageSwitchComponent
