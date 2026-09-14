import { h } from "preact"
import { langOf, t } from "../../presence-shared/locale.js"
import {
  essaysForWork,
  hrefOf,
  relatedWork,
  renderWorkRow,
  renderWritingRow,
  selectEssays,
} from "../../presence-shared/rows.js"

/**
 * End matter: where a reader goes after the last paragraph. Under an essay,
 * the work it is about and up to three other essays; under a work, the essays
 * about it and up to three others. A translation lists the English essays,
 * with its own original left out. Other kinds render nothing.
 */

const MORE_ROWS = 3

function block(className, label, ...content) {
  return h("section", { class: className }, h("h2", { class: "end-label" }, label), ...content)
}

export const EndMatter = () => {
  const Component = ({ fileData, allFiles }) => {
    const kind = fileData.presence?.kind
    if (kind !== "essay" && kind !== "work") return null
    const lang = langOf(fileData)
    const ctx = { lang, allFiles }
    const essayList = (files) =>
      h("ul", { class: "idx-list" }, files.map((file) => renderWritingRow(file, ctx)))
    const blocks = []
    const shown = new Set([fileData.slug, fileData.i18n?.base])

    if (kind === "essay") {
      const work = relatedWork(fileData, allFiles)
      if (work) {
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
        blocks.push(block("end-essays", t(lang, "essaysAboutWork"), essayList(essays)))
      }
    }

    const all = selectEssays(allFiles)
    const others = all.filter((essay) => !shown.has(essay.slug))
    if (others.length > 0) {
      blocks.push(
        block(
          "end-more",
          t(lang, "moreWriting"),
          essayList(others.slice(0, MORE_ROWS)),
          others.length > MORE_ROWS
            ? h(
                "p",
                { class: "idx-more" },
                h("a", { href: hrefOf("writing/index") }, t(lang, "allWriting", { n: all.length })),
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
