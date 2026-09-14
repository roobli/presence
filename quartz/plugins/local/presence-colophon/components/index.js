import { h } from "preact"
import { langOf, t } from "../../presence-shared/locale.js"
import { joined } from "../../presence-shared/rows.js"

/**
 * Colophon: the site line under every page. It renders into the footer slot,
 * which takes the note column's width (_shell.scss), so it follows the
 * sidebar drag.
 */

const LINKS = [
  { label: "GitHub", href: "https://github.com/lr00rl" },
  { label: "roobli", href: "https://github.com/roobli" },
  { label: "RSS", href: "/index.xml" },
]

export const Colophon = () => {
  const Component = ({ fileData, cfg }) => {
    const lang = langOf(fileData)
    const credit = [
      t(lang, "builtWithBefore"),
      h("a", { href: "https://quartz.jzhao.xyz/" }, "Quartz"),
      t(lang, "builtWithAfter"),
    ]
    return h(
      "footer",
      { class: "colophon" },
      h(
        "p",
        null,
        joined([
          cfg.pageTitle,
          ...LINKS.map((link) => h("a", { href: link.href }, link.label)),
          credit,
        ]),
      ),
    )
  }
  return Component
}
