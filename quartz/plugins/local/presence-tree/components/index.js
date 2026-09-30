import { readFileSync } from "fs"
import { h } from "preact"
import { isZh, langOf, t } from "../../presence-shared/locale.js"
import {
  dateOf,
  hrefOf,
  projectStatus,
  selectEntries,
  selectSeries,
  shortTitle,
  titleOf,
} from "../../presence-shared/entries.js"
import { indexSlugOf, SECTIONS } from "../../presence-shared/sections.js"

/**
 * The sidebar tree, rendered with the page instead of in the browser.
 *
 * Quartz's explorer rebuilt the tree on every navigation from the content
 * index, which carries titles and links but no dates, parts or status, so the
 * tree could only ever be a list of file names. Built here from the same model
 * as the index, each section shows what its entries are:
 *
 *   Essays     titles, newest first
 *   Series     one folder per series with its progress (3/5), the published
 *              episodes numbered and the planned ones in grey
 *   Projects   titles with a status dot
 *   Notes      titles with their dates
 *   Posts      one row per month with its count, linking into the timeline;
 *              a section too long to list one row per entry (months: true)
 *
 * then the pages outside any section (About). The open page is marked on the
 * server, a translation marking its original, and the folders on its path are
 * open.
 *
 * The markup is the explorer's (explorer-content, folder-container,
 * folder-outer, tree-item-children, nav-file-title), which is what roob-ui's
 * guides, pinned crumbs, reveal and fold read. client.js does the explorer's
 * remaining job: opening and closing folders and keeping that state in the
 * explorer's localStorage key, so nothing a reader folded comes back open.
 */

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
// The state functions alone, run inline right after the tree so a folder the
// reader closed is closed before the first paint.
const inlineRestore =
  "(function(){" + client.slice(0, client.indexOf("// Taken on the document")) + "restoreTree()})()"

/** Pages outside any section that the tree lists after the sections. */
const LOOSE_PAGES = ["about"]

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function shortDate(iso, lang) {
  if (!iso) return null
  const [, month, day] = iso.split("-").map(Number)
  const text = isZh(lang) ? `${month}月${day}日` : `${MONTHS[month - 1]} ${day}`
  return h("time", { class: "tree-meta tree-date", datetime: iso }, text)
}

const pad = (n) => String(n).padStart(2, "0")

function chevron(open, label, controls) {
  return h(
    "button",
    {
      type: "button",
      class: "folder-icon",
      "aria-expanded": open ? "true" : "false",
      "aria-controls": controls,
      "aria-label": label,
    },
    h(
      "svg",
      { viewBox: "0 0 10 10", width: 10, height: 10, "aria-hidden": "true" },
      h("path", {
        d: "M2 3.5 5 6.5 8 3.5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.4",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    ),
  )
}

/**
 * A folder row and its children. path is the folder page's slug, which is how
 * the explorer keyed folder state, so a reader's saved state carries over.
 */
function folder({ path, label, count, current, open, className, children, lang }) {
  const id = `tree-${path.replace(/[^a-z0-9]+/gi, "-")}`
  const onPath = children.some((child) => child.onPath)
  // A folder is open on its own page too, so /posts/ shows the months it lists.
  const isOpen = open || onPath || current === path
  const containerClass = [
    "folder-container nav-folder-title tree-item-self",
    current === path ? "is-current" : null,
    onPath ? "is-on-path" : null,
  ]
  return {
    onPath: onPath || current === path,
    node: h(
      "li",
      { class: className },
      h(
        "div",
        {
          class: containerClass.filter(Boolean).join(" "),
          "data-folderpath": path,
          "data-count": count,
        },
        chevron(isOpen, t(lang, "toggleFolder", { label }), id),
        h(
          "div",
          null,
          h(
            "a",
            {
              class: "folder-button",
              href: hrefOf(path),
              "aria-current": current === path ? "page" : undefined,
            },
            h("span", { class: "folder-title" }, h("span", { class: "tpl-tree-label" }, label)),
          ),
        ),
      ),
      h(
        "div",
        { class: isOpen ? "folder-outer open" : "folder-outer", id },
        h(
          "ul",
          { class: "content tree-item-children" },
          children.map((child) => child.node),
        ),
      ),
    ),
  }
}

/** A page's row: its short title, the full one as a tooltip, and a mark. */
function row({ file, current, lead, trail, className }) {
  const active = file.slug === current
  const title = titleOf(file)
  const label = shortTitle(file)
  return {
    onPath: active,
    node: h(
      "li",
      { class: className },
      h(
        "a",
        {
          class: active
            ? "nav-file-title tree-item-self active is-active"
            : "nav-file-title tree-item-self",
          href: hrefOf(file.slug),
          title: title !== label ? title : undefined,
          "data-full-title": title !== label ? "" : undefined,
          "aria-current": active ? "page" : undefined,
        },
        lead ?? null,
        h("span", { class: "tpl-tree-label" }, label),
        trail ?? null,
      ),
    ),
  }
}

function plannedRow(n, title, lang) {
  return {
    onPath: false,
    node: h(
      "li",
      null,
      h(
        "span",
        {
          class: "nav-file-title tree-item-self is-planned",
          title: `${title} (${t(lang, "planned")})`,
        },
        h("span", { class: "tree-no" }, pad(n)),
        h("span", { class: "tpl-tree-label" }, title),
      ),
    ),
  }
}

function seriesChildren(allFiles, current, lang) {
  return selectSeries(allFiles).map((series) =>
    folder({
      path: series.slug,
      label: series.title,
      count: t(lang, "publishedOf", { n: series.episodes.length, total: series.total }),
      current,
      open: series.status === "in-progress",
      className: "tree-series",
      lang,
      children: [
        ...series.episodes.map((episode, i) =>
          row({
            file: episode,
            current,
            lead: h("span", { class: "tree-no" }, pad(i + 1)),
          }),
        ),
        ...series.planned.map((title, i) =>
          plannedRow(series.episodes.length + i + 1, title, lang),
        ),
      ],
    }),
  )
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// A month of a long section: a link to its heading on the section's page, with
// the month's count. The open page's month is marked as the open row.
function monthChildren(section, allFiles, current, lang) {
  const entries = selectEntries(allFiles, section)
  const open = entries.find((file) => file.slug === current)
  const currentMonth = open ? (dateOf(open) ?? "").slice(0, 7) : null
  const months = [...new Set(entries.map((file) => (dateOf(file) ?? "").slice(0, 7)))]
  return months.filter(Boolean).map((month) => {
    const [year, m] = month.split("-").map(Number)
    const label = isZh(lang) ? `${year}年${m}月` : `${MONTH_NAMES[m - 1]} ${year}`
    const n = entries.filter((file) => (dateOf(file) ?? "").startsWith(month)).length
    const active = month === currentMonth
    return {
      onPath: active,
      node: h(
        "li",
        { class: "tree-month" },
        h(
          "a",
          {
            class: active
              ? "nav-file-title tree-item-self active is-active"
              : "nav-file-title tree-item-self",
            href: `${hrefOf(indexSlugOf(section))}#m-${month}`,
          },
          h("span", { class: "tpl-tree-label" }, label),
          h("span", { class: "tree-meta tree-count" }, String(n)),
        ),
      ),
    }
  })
}

function sectionChildren(section, allFiles, current, lang) {
  if (section.id === "series") return seriesChildren(allFiles, current, lang)
  if (section.months) return monthChildren(section, allFiles, current, lang)
  return selectEntries(allFiles, section).map((file) => {
    if (section.kind === "note") {
      return row({ file, current, trail: shortDate(dateOf(file), lang) })
    }
    if (section.kind === "project") {
      const status = projectStatus(file)
      return row({
        file,
        current,
        trail: status
          ? h("span", {
              class: `tree-meta tree-status tree-status--${status}`,
              title: t(lang, `status_${status}`),
            })
          : null,
      })
    }
    return row({ file, current })
  })
}

export const SectionTree = () => {
  const Component = ({ fileData, allFiles, displayClass }) => {
    const lang = langOf(fileData)
    // A translation marks its original's row.
    const current = fileData.i18n?.base ?? fileData.slug

    const sections = SECTIONS.map((section) => {
      const children = sectionChildren(section, allFiles, current, lang)
      if (children.length === 0) return null
      // A section listed by month counts its entries, not its months.
      const count = section.months ? selectEntries(allFiles, section).length : children.length
      return folder({
        path: indexSlugOf(section),
        label: t(lang, section.label),
        count: pad(count),
        current,
        open: section.open,
        className: `tree-section tree-section--${section.id}`,
        lang,
        children,
      }).node
    })

    const loose = LOOSE_PAGES.map((slug) => allFiles.find((file) => file.slug === slug))
      .filter(Boolean)
      .map((file) => row({ file, current, className: "tree-loose" }).node)

    return h(
      "div",
      {
        class: ["explorer nav-files-container presence-tree", displayClass]
          .filter(Boolean)
          .join(" "),
      },
      h(
        "nav",
        { class: "explorer-content", "aria-label": t(lang, "contents") },
        h("ul", { class: "explorer-ul" }, sections, loose),
      ),
      h("script", { dangerouslySetInnerHTML: { __html: inlineRestore } }),
    )
  }
  Component.afterDOMLoaded = client
  return Component
}
