import { readFileSync } from "fs"
import { h } from "preact"
import { formatDate, isoDate } from "../../presence-shared/dates.js"
import { isZh, langOf, t, ZH } from "../../presence-shared/locale.js"
import {
  hrefOf,
  joined,
  readingMinutes,
  workLinks,
  workShot,
} from "../../presence-shared/rows.js"

/**
 * Page header: a one-word kicker, the title, the dek, then the meta line with
 * the language control. Essays state date, revision, reading time and live
 * figures; works show their links and screenshot; every other kind shows the
 * title alone. The homepage has no page header: its h1 is the thesis, which
 * presence-index renders.
 *
 * client.js keeps html lang in step with the page and carries the reading
 * position across a language switch.
 */

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")

const KICKERS = {
  essay: { key: "writing", slug: "writing/index" },
  work: { key: "works", slug: "works/index" },
}

const LANGUAGE_NAMES = { en: "English", [ZH]: "中文" }

function essayFacts(fileData, allFiles, lang) {
  const fm = fileData.frontmatter ?? {}
  const facts = []
  const date = isoDate(fm.date)
  if (date) facts.push(h("time", { datetime: date }, formatDate(date, lang)))
  const updated = isoDate(fm.updated)
  if (updated) {
    facts.push([t(lang, "revised"), " ", h("time", { datetime: updated }, formatDate(updated, lang))])
  }
  const minutes = readingMinutes(fileData, allFiles)
  if (minutes) facts.push(t(lang, "minRead", { n: minutes }))
  const figures = fileData.presence?.figures?.length ?? 0
  if (figures > 0) facts.push(t(lang, "liveFigures", { n: figures }))
  return facts.length > 0 ? h("p", { class: "ph-facts" }, joined(facts, "ph-sep")) : null
}

function workLine(fileData, lang) {
  const links = workLinks(fileData, lang)
  return links.length > 0 ? h("p", { class: "ph-links" }, joined(links, "ph-sep")) : null
}

// English | 中文, English first, when the page has a translation pair.
function languageNav(fileData, lang) {
  const alternates = fileData.i18n?.alternates ?? []
  if (alternates.length === 0) return null
  const versions = [{ lang, slug: fileData.slug }, ...alternates].sort(
    (a, b) => Number(isZh(a.lang)) - Number(isZh(b.lang)),
  )
  return h(
    "nav",
    { class: "ph-lang", "aria-label": t(lang, "language") },
    versions.map((version) => {
      const name = LANGUAGE_NAMES[version.lang] ?? version.lang
      if (version.slug === fileData.slug) {
        return h("span", { class: "ph-lang-seg", "aria-current": "page", lang: version.lang }, name)
      }
      return h(
        "a",
        {
          class: "ph-lang-seg",
          href: hrefOf(version.slug),
          lang: version.lang,
          hreflang: version.lang,
          rel: "alternate",
        },
        name,
      )
    }),
  )
}

export const PageHeader = () => {
  const Component = ({ fileData, allFiles }) => {
    if (fileData.slug === "index") return null
    const fm = fileData.frontmatter ?? {}
    const kind = fileData.presence?.kind
    const lang = langOf(fileData)
    const kicker = KICKERS[kind]

    let dek = null
    let meta = null
    let shot = null
    if (kind === "essay" || kind === "work") {
      if (fm.description) dek = h("p", { class: "ph-dek" }, fm.description)
      const lead = kind === "essay" ? essayFacts(fileData, allFiles, lang) : workLine(fileData, lang)
      const nav = languageNav(fileData, lang)
      if (lead || nav) meta = h("div", { class: "ph-meta" }, lead, nav)
      if (kind === "work") shot = workShot(fileData, { className: "ph-shot", lazy: false })
    }

    return h(
      "header",
      { class: "ph" },
      kicker
        ? h("p", { class: "ph-kicker" }, h("a", { href: hrefOf(kicker.slug) }, t(lang, kicker.key)))
        : null,
      // article-title stays for scripts and styles that look for the page title.
      h("h1", { class: "article-title ph-title" }, fm.title ?? fileData.slug),
      dek,
      meta,
      shot,
    )
  }
  Component.afterDOMLoaded = client
  return Component
}
