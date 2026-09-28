import { h } from "preact"
import { langOf, t } from "../../presence-shared/locale.js"
import { backlinksOf, renderLedger, seriesOf } from "../../presence-shared/plates.js"
import {
  essaysForWork,
  hrefOf,
  listingSlugOf,
  relatedWork,
  renderWorkRow,
  selectEssays,
} from "../../presence-shared/rows.js"

/**
 * End matter: where a reader goes after the last paragraph, in the order a
 * reader follows links out of a notebook entry.
 *
 *   Series           an essay in a series: every part, this one marked, and
 *                    the previous and next part
 *   Related work     under an essay, the work it is about; under a work, the
 *                    essays about it
 *   Linked from      the entries that link to this page
 *   More writing     up to three other essays
 *
 * Nothing is listed twice: a page shown in an earlier block is left out of the
 * later ones. A translation lists its original's relations. Kinds other than
 * essay and work render nothing.
 */

const MORE_ROWS = 3

function block(className, label, ...content) {
  return h("section", { class: className }, h("h2", { class: "end-label" }, label), ...content)
}

const titleOf = (file) => file.frontmatter?.title ?? file.slug

// The series block: its parts as a numbered list with this one marked, then
// the neighbours as a pair of links.
function seriesBlock(series, lang) {
  const { name, parts, index } = series
  const neighbour = (file, key, arrow) =>
    file
      ? h(
          "a",
          { class: `series-step series-step--${key}`, href: hrefOf(file.slug), rel: key },
          h("span", { class: "series-step-label" }, arrow === "←" ? `← ${t(lang, key)}` : `${t(lang, key)} →`),
          h("span", { class: "series-step-title" }, titleOf(file)),
        )
      : h("span", { class: "series-step series-step--none", "aria-hidden": "true" })
  return block(
    "end-series",
    [t(lang, "series"), h("span", { class: "ph-sep", "aria-hidden": "true" }, " · "), name],
    h("p", { class: "series-pos" }, t(lang, "partOf", { n: index + 1, total: parts.length })),
    h(
      "ol",
      { class: "series-parts" },
      parts.map((part, i) =>
        h(
          "li",
          { class: i === index ? "is-current" : undefined },
          i === index
            ? h("span", { "aria-current": "page" }, titleOf(part))
            : h("a", { href: hrefOf(part.slug) }, titleOf(part)),
        ),
      ),
    ),
    h(
      "nav",
      { class: "series-nav", "aria-label": t(lang, "series") },
      neighbour(parts[index - 1], "previous", "←"),
      neighbour(parts[index + 1], "next", "→"),
    ),
  )
}

export const EndMatter = () => {
  const Component = ({ fileData, allFiles }) => {
    const kind = fileData.presence?.kind
    if (kind !== "essay" && kind !== "work") return null
    const lang = langOf(fileData)
    const ctx = { lang, allFiles }
    const ledger = (files) => renderLedger(files, ctx, { head: false })
    const blocks = []
    const shown = new Set([fileData.slug, fileData.i18n?.base])

    const series = kind === "essay" ? seriesOf(fileData, allFiles) : null
    if (series) {
      for (const part of series.parts) shown.add(part.slug)
      blocks.push(seriesBlock(series, lang))
    }

    if (kind === "essay") {
      const work = relatedWork(fileData, allFiles)
      if (work) {
        shown.add(work.slug)
        blocks.push(
          block(
            "end-work",
            t(lang, "relatedWork"),
            h("ul", { class: "idx-list" }, renderWorkRow(work, { ...ctx, compact: true })),
          ),
        )
      }
    } else {
      const essays = essaysForWork(fileData, allFiles)
      for (const essay of essays) shown.add(essay.slug)
      if (essays.length > 0) {
        blocks.push(block("end-essays", t(lang, "essaysAboutWork"), ledger(essays)))
      }
    }

    const linking = backlinksOf(fileData, allFiles).filter((entry) => !shown.has(entry.slug))
    if (linking.length > 0) {
      for (const entry of linking) shown.add(entry.slug)
      blocks.push(block("end-linked", t(lang, "linkedFrom"), ledger(linking)))
    }

    const all = selectEssays(allFiles)
    const others = all.filter((essay) => !shown.has(essay.slug))
    if (others.length > 0) {
      blocks.push(
        block(
          "end-more",
          t(lang, "moreWriting"),
          ledger(others.slice(0, MORE_ROWS)),
          others.length > MORE_ROWS
            ? h(
                "p",
                { class: "idx-more" },
                h(
                  "a",
                  { href: hrefOf(listingSlugOf("essay")) },
                  t(lang, "allWriting", { n: all.length }),
                ),
              )
            : null,
        ),
      )
    }

    if (blocks.length === 0) return null
    return h("section", { class: "end", "aria-label": t(lang, "more") }, blocks)
  }
  return Component
}
