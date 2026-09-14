import { readFileSync } from "fs"
import { h } from "preact"
import { formatDate, isoDate } from "../../presence-shared/dates.js"
import { langOf, t, ZH } from "../../presence-shared/locale.js"
import {
  hrefOf,
  joined,
  readingMinutes,
  workLinks,
  workShot,
} from "../../presence-shared/rows.js"

/**
 * Page header: a one-word kicker, the title, the dek, then the meta line.
 * Essays state date, revision, reading time and live figures; works show their
 * links and screenshot; every other kind shows the title alone. A translated
 * page ends its meta line with a link to the other language. The homepage has
 * no page header: its h1 is the thesis, which presence-index renders.
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

function essayFacts(fileData, allFiles, lang, languages) {
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
  facts.push(...languages)
  return facts.length > 0 ? h("p", { class: "ph-facts" }, joined(facts, "ph-sep")) : null
}

function workLine(fileData, lang, languages) {
  const links = [...workLinks(fileData, lang), ...languages]
  return links.length > 0 ? h("p", { class: "ph-links" }, joined(links, "ph-sep")) : null
}

// The other language of a translated page, as the last item on the meta line:
// 中文 on the English page, English on the Chinese one. A plain link says where
// it goes, where a two-state switch left readers unsure which side was current.
function languageLinks(fileData) {
  const alternates = fileData.i18n?.alternates ?? []
  return alternates.map((version) =>
    h(
      "span",
      { class: "ph-lang" },
      h(
        "a",
        { href: hrefOf(version.slug), lang: version.lang, hreflang: version.lang, rel: "alternate" },
        LANGUAGE_NAMES[version.lang] ?? version.lang,
      ),
    ),
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
      const languages = languageLinks(fileData)
      const lead =
        kind === "essay"
          ? essayFacts(fileData, allFiles, lang, languages)
          : workLine(fileData, lang, languages)
      if (lead) meta = h("div", { class: "ph-meta" }, lead)
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
