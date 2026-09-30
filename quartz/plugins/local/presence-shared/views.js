import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { h } from "preact"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"
import { formatDate, isoDate } from "./dates.js"
import { isZh, langOf, t, ZH } from "./locale.js"
import {
  claimsOf,
  dateOf,
  entryNumber,
  hrefOf,
  placeInSeries,
  projectFigures,
  projectLog,
  projectStatus,
  readingMinutes,
  shortTitle,
  tagsOf,
  titleOf,
} from "./entries.js"
import { entryKind } from "./sections.js"
import { renderSpine } from "./spine.js"

// Markup shared by the index, the page header and the end matter. The grammar
// is the notebook's own: ruled rows, labelled fields, a margin. Things that are
// objects in their own right (the open essay, a card, a project's screenshot)
// get a hairline edge; everything else sits on the page.
//
// ctx is { lang, allFiles } throughout.

// A block in a language other than the page's says so.
const langIfOther = (own, other) => (own === other ? undefined : own)

const pad = (n, width) => String(n).padStart(width, "0")

/** The parts with a middle dot between each pair, hidden from screen readers. */
export function joined(parts, className = "dot") {
  const out = []
  for (const part of parts.filter((item) => item !== null && item !== undefined && item !== "")) {
    if (out.length > 0) out.push(h("span", { class: className, "aria-hidden": "true" }, " · "))
    out.push(part)
  }
  return out
}

/** A <time> for a YYYY-MM-DD value, or null. */
export function timeOf(value, lang) {
  const date = isoDate(value)
  return date ? h("time", { datetime: date }, formatDate(date, lang)) : null
}

const translationOf = (file) => file.i18n?.alternates?.find((version) => isZh(version.lang))

/** The 中文 link an entry offers when it has a translation. */
export function zhLink(file, className = "zh") {
  const translation = translationOf(file)
  if (!translation) return null
  return h(
    "a",
    { class: className, href: hrefOf(translation.slug), lang: ZH, hreflang: ZH, rel: "alternate" },
    "中文",
  )
}

/**
 * What an entry is called in a list: an essay's number (005) or an episode's
 * place (Ep 02). Null for anything else.
 */
export function entryLabel(file, ctx) {
  const kind = entryKind(file.i18n?.base ?? file.slug)
  if (kind === "essay") {
    const n = entryNumber(file, ctx.allFiles)
    return n ? pad(n, 3) : null
  }
  if (kind === "episode") {
    const place = placeInSeries(file, ctx.allFiles)
    return place ? t(ctx.lang, "ep", { n: place.index + 1 }) : null
  }
  return null
}

function minutesOf(file, ctx) {
  const minutes = readingMinutes(file, ctx.allFiles)
  return minutes ? t(ctx.lang, "minShort", { n: minutes }) : null
}

function figuresOf(file, ctx) {
  const n = file.presence?.figures?.length ?? 0
  return n > 0 ? t(ctx.lang, "figuresShort", { n }) : null
}

/** The mono facts line: label, date, reading time and, optionally, more. */
export function metaLine(file, ctx, { date = true, extra = [], className = "meta" } = {}) {
  const label = entryLabel(file, ctx)
  return h(
    "p",
    { class: className, lang: langIfOther(ctx.lang, langOf(file)) },
    joined([
      label ? h("span", { class: "no" }, label) : null,
      date ? timeOf(dateOf(file), ctx.lang) : null,
      minutesOf(file, ctx),
      ...extra,
    ]),
  )
}

// --- title blocks and section heads -----------------------------------------

/**
 * A title block: facts as labelled fields in one ruled row. cells is
 * [{ label, value }]; a cell with no value is left out.
 */
export function renderTitleBlock(cells, className = "") {
  const kept = cells.filter((cell) => cell.value !== null && cell.value !== undefined)
  if (kept.length === 0) return null
  return h(
    "dl",
    { class: `titleblock ${className}`.trim() },
    kept.map((cell) =>
      h("div", { class: "tb-cell" }, h("dt", null, cell.label), h("dd", null, cell.value)),
    ),
  )
}

/**
 * A section's head: its name in small capitals on a rule, a note in italics
 * beside it, and a link to everything in it with the count.
 */
export function renderSectionHead({ id, label, note, more }) {
  return h(
    "header",
    { class: "sh" },
    h("h2", { id, class: "sh-title" }, label),
    note ? h("p", { class: "sh-note" }, note) : null,
    more
      ? h(
          "a",
          { class: "sh-more", href: more.href },
          more.label,
          more.n !== undefined ? h("span", { class: "sh-n" }, pad(more.n, 2)) : null,
        )
      : null,
  )
}

// --- the open essay ------------------------------------------------------------

function renderClaim(claim) {
  if (claim.quote) return h("li", { class: "claim claim--quote" }, h("q", null, claim.quote))
  return h(
    "li",
    { class: "claim" },
    h("strong", null, claim.figure),
    claim.text ? [" ", claim.text] : null,
  )
}

function readLabel(file, lang) {
  const kind = entryKind(file.i18n?.base ?? file.slug)
  if (kind === "episode") return t(lang, "readEpisode")
  if (kind === "note") return t(lang, "readNote")
  return t(lang, "readEssay")
}

/**
 * The newest writing, open like a notebook: the essay on the left page, its
 * claims written in the right page's margin on ruled paper, the way the
 * essay's own sidenotes sit beside the text. Without claims it is one page.
 */
export function renderSpread(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const href = hrefOf(file.slug)
  const fm = file.frontmatter ?? {}
  const claims = claimsOf(file).slice(0, 3)
  const place = placeInSeries(file, ctx.allFiles)
  const tags = place ? [place.series.title] : tagsOf(file, 4)

  const left = h(
    "div",
    { class: "leaf" },
    metaLine(file, ctx, { extra: [zhLink(file, "zh inline-link")] }),
    h("h3", { class: "spread-title" }, h("a", { class: "stretch", href }, titleOf(file))),
    fm.description ? h("p", { class: "spread-dek" }, fm.description) : null,
    renderSpine(file.presence),
    h(
      "div",
      { class: "spread-foot", lang: langIfOther(lang, own) },
      h("span", { class: "tags" }, joined(tags)),
      h("a", { class: "read inline-link", href }, readLabel(file, lang)),
    ),
  )
  if (claims.length === 0) {
    return h("article", { class: "spread spread--single", lang: langIfOther(own, lang) }, left)
  }
  return h(
    "article",
    { class: "spread", lang: langIfOther(own, lang) },
    left,
    h(
      "aside",
      { class: "leaf leaf--margin", "aria-label": t(lang, "inTheMargin") },
      h("p", { class: "leaf-label", lang: langIfOther(lang, own) }, t(lang, "inTheMargin")),
      h("ol", { class: "margin" }, claims.map(renderClaim)),
    ),
  )
}

/**
 * An index card: the spine along its top edge, the facts line, the short
 * title, then the first claim with its figure in the accent (else the dek).
 * The foot names the first tag, or the series, and offers the 中文 version.
 * The title's link covers the card.
 */
export function renderCard(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const href = hrefOf(file.slug)
  const claim = claimsOf(file)[0]
  const place = placeInSeries(file, ctx.allFiles)
  const [tag] = place ? [place.series.title] : tagsOf(file, 1)

  let body = null
  if (claim?.figure) {
    body = h(
      "p",
      { class: "card-claim" },
      h("strong", null, claim.figure),
      claim.text ? [" ", claim.text] : null,
    )
  } else if (claim?.quote) {
    body = h("p", { class: "card-claim card-claim--quote" }, h("q", null, claim.quote))
  } else if (file.frontmatter?.description) {
    body = h("p", { class: "card-claim" }, file.frontmatter.description)
  }

  return h(
    "li",
    { class: "card", lang: langIfOther(own, lang) },
    h("div", { class: "card-spine" }, renderSpine(file.presence)),
    metaLine(file, ctx),
    h(
      "h3",
      { class: "card-title" },
      h("a", { class: "stretch", href, title: titleOf(file) }, shortTitle(file)),
    ),
    body,
    h(
      "p",
      { class: "card-foot", lang: langIfOther(lang, own) },
      h("span", null, tag ?? ""),
      zhLink(file, "zh inline-link"),
    ),
  )
}

// --- the ledger ------------------------------------------------------------------

/** The ledger's column heads, drawn once above its rows on wide screens. */
function renderLedgerHead(lang) {
  return h(
    "li",
    { class: "ledger-head", "aria-hidden": "true" },
    h("span", null, t(lang, "colNo")),
    h("span", null, t(lang, "colDate")),
    h("span", null, t(lang, "colEntry")),
    h("span", null, t(lang, "colReading")),
  )
}

/**
 * One ledger row: the entry's number and date in the margin, then title, dek
 * and spine, then reading time, live figures and the 中文 link.
 */
export function renderLedgerRow(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const fm = file.frontmatter ?? {}
  const facts = [minutesOf(file, ctx), figuresOf(file, ctx), zhLink(file, "zh")]
  return h(
    "li",
    { class: "ledger-row", lang: langIfOther(own, lang) },
    h("span", { class: "ledger-no", lang: langIfOther(lang, own) }, entryLabel(file, ctx) ?? ""),
    h("span", { class: "ledger-date", lang: langIfOther(lang, own) }, timeOf(dateOf(file), lang)),
    h(
      "div",
      { class: "ledger-body" },
      h("h3", { class: "ledger-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
      fm.description ? h("p", { class: "ledger-dek" }, fm.description) : null,
      renderSpine(file.presence),
    ),
    h("span", { class: "ledger-meta", lang: langIfOther(lang, own) }, joined(facts)),
  )
}

/**
 * A ruled ledger of entries. head draws the column heads; compact keeps each
 * row to its title, for the homepage index and the end matter.
 */
export function renderLedger(files, ctx, { head = true, compact = false } = {}) {
  const classes = ["ledger", head ? null : "ledger--bare", compact ? "ledger--compact" : null]
  return h(
    "ol",
    { class: classes.filter(Boolean).join(" ") },
    head ? renderLedgerHead(ctx.lang) : null,
    files.map((file) => renderLedgerRow(file, ctx)),
  )
}

// --- series -------------------------------------------------------------------------

/**
 * A series' track: one stop per episode, published ones filled and linked,
 * planned ones hollow on a dashed line, the current one ringed.
 */
export function renderTrack(series, ctx, { current = null, big = false } = {}) {
  const { lang } = ctx
  const stops = [
    ...series.episodes.map((episode, i) => ({ n: i + 1, file: episode, title: titleOf(episode) })),
    ...series.planned.map((title, i) => ({ n: series.episodes.length + i + 1, file: null, title })),
  ]
  return h(
    "ol",
    { class: big ? "track track--big" : "track", "aria-label": t(lang, "episodes") },
    stops.map((stop) => {
      const isCurrent = stop.file && stop.file.slug === current
      const classes = [
        "step",
        stop.file ? "is-done" : "is-planned",
        isCurrent ? "is-current" : null,
      ]
      const title = stop.file
        ? `${t(lang, "ep", { n: stop.n })} · ${stop.title}`
        : `${t(lang, "ep", { n: stop.n })} · ${stop.title} (${t(lang, "planned")})`
      const inner = [
        h("span", { class: "step-dot", "aria-hidden": "true" }),
        h("span", { class: "step-n" }, pad(stop.n, 2)),
      ]
      return h(
        "li",
        { class: classes.filter(Boolean).join(" ") },
        stop.file && !isCurrent
          ? h("a", { href: hrefOf(stop.file.slug), title }, inner)
          : h("span", { title, "aria-current": isCurrent ? "page" : undefined }, inner),
      )
    }),
  )
}

/** Series status as words: In progress, Complete, Paused. */
export const seriesStatusText = (series, lang) => t(lang, `status_${series.status}`)

/**
 * A series on a shelf: title, description, status and cadence and the project
 * it belongs to on the left; its track and what comes next on the right.
 */
export function renderSeriesRow(series, ctx, { dek = true } = {}) {
  const { lang, allFiles } = ctx
  const project = series.project ? allFiles.find((file) => file.slug === series.project) : null
  const next = series.planned[0]
  return h(
    "article",
    { class: "series-row" },
    h(
      "div",
      { class: "sr-main" },
      h(
        "h3",
        { class: "sr-title" },
        h("a", { class: "stretch", href: hrefOf(series.slug) }, series.title),
      ),
      dek && series.description ? h("p", { class: "sr-dek" }, series.description) : null,
      h(
        "p",
        { class: "meta" },
        joined([
          seriesStatusText(series, lang),
          series.cadence,
          project
            ? h(
                "span",
                null,
                t(lang, "partOfProject"),
                " ",
                h("a", { class: "inline-link", href: hrefOf(project.slug) }, titleOf(project)),
              )
            : null,
        ]),
      ),
    ),
    h(
      "div",
      { class: "sr-side" },
      renderTrack(series, ctx),
      h(
        "p",
        { class: "sr-next" },
        joined([
          t(lang, "publishedOf", { n: series.episodes.length, total: series.total }),
          next ? h("span", null, t(lang, "nextUp"), " ", h("em", null, next)) : null,
        ]),
      ),
    ),
  )
}

/**
 * A series' episodes in reading order: number, title and facts for published
 * ones, the title in grey for planned ones.
 */
export function renderEpisodeList(series, ctx) {
  const { lang } = ctx
  return h(
    "ol",
    { class: "eps" },
    series.episodes.map((episode, i) =>
      h(
        "li",
        { class: "ep" },
        h("span", { class: "ep-n" }, pad(i + 1, 2)),
        h(
          "div",
          { class: "ep-body" },
          h("h3", { class: "ep-title" }, h("a", { href: hrefOf(episode.slug) }, titleOf(episode))),
          h(
            "p",
            { class: "meta" },
            joined([
              timeOf(dateOf(episode), lang),
              minutesOf(episode, ctx),
              figuresOf(episode, ctx),
            ]),
          ),
        ),
      ),
    ),
    series.planned.map((title, i) =>
      h(
        "li",
        { class: "ep is-planned" },
        h("span", { class: "ep-n" }, pad(series.episodes.length + i + 1, 2)),
        h(
          "div",
          { class: "ep-body" },
          h("h3", { class: "ep-title" }, title),
          h("p", { class: "meta" }, t(lang, "planned")),
        ),
      ),
    ),
  )
}

// --- projects -----------------------------------------------------------------------

// Screenshot boxes are 16:10 in CSS at every size. These attributes reserve
// that ratio while the image loads, whatever the file's own pixel size.
const SHOT_WIDTH = 1280
const SHOT_HEIGHT = 800

/** A project's screenshot, or null when its frontmatter names no image. */
export function projectShot(project, { className, lazy = true } = {}) {
  const fm = project.frontmatter ?? {}
  if (typeof fm.image !== "string" || !fm.image.trim()) return null
  return h("img", {
    class: className,
    src: "/" + encodeURI(fm.image.trim().replace(/^\/+/, "")),
    width: SHOT_WIDTH,
    height: SHOT_HEIGHT,
    alt: typeof fm.image_alt === "string" ? fm.image_alt : "",
    loading: lazy ? "lazy" : undefined,
    decoding: "async",
  })
}

/** A project's links: the live site, its Chinese version and the source. */
export function projectLinks(project, lang) {
  const fm = project.frontmatter ?? {}
  const links = []
  if (typeof fm.live === "string") links.push(h("a", { href: fm.live }, t(lang, "liveSite")))
  if (typeof fm.live_zh === "string") {
    links.push(h("a", { href: fm.live_zh, lang: ZH, hreflang: ZH }, "中文"))
  }
  if (typeof fm.source === "string") links.push(h("a", { href: fm.source }, t(lang, "source")))
  return links
}

/** The status mark: a dot and the word, coloured by state. */
export function renderStatus(status, lang) {
  if (!status) return null
  return h(
    "span",
    { class: `status status--${status}` },
    h("i", { "aria-hidden": "true" }),
    t(lang, `status_${status}`),
  )
}

/** A project's figures as large numbers over small labels. */
export function renderFigures(project) {
  const figures = projectFigures(project)
  if (figures.length === 0) return null
  return h(
    "dl",
    { class: "figs" },
    figures.map((figure) =>
      h("div", null, h("dt", null, figure.label), h("dd", null, figure.value)),
    ),
  )
}

function logTitle(item) {
  if (item.file) {
    return h("a", { class: "log-title", href: hrefOf(item.file.slug) }, titleOf(item.file))
  }
  if (item.kind === "series") {
    return h("a", { class: "log-title", href: hrefOf(item.series.slug) }, item.series.title)
  }
  return h("span", { class: "log-title" }, item.text)
}

function logKind(item, ctx) {
  const { lang, allFiles } = ctx
  if (item.kind === "essay") return t(lang, "logEssay", { n: entryNumber(item.file, allFiles) })
  if (item.kind === "episode" && item.series) {
    const n = item.series.episodes.findIndex((episode) => episode.slug === item.file.slug) + 1
    return t(lang, "logEpisode", { n, series: item.series.title })
  }
  return t(lang, `log_${item.kind}`)
}

/** A project's log as a timeline: date in the margin, a node on the line, the entry. */
export function renderLog(items, ctx) {
  const { lang } = ctx
  return h(
    "ol",
    { class: "log" },
    items.map((item) =>
      h(
        "li",
        { "data-kind": item.kind },
        h("span", { class: "log-date" }, timeOf(item.date, lang)),
        h("span", { class: "log-node", "aria-hidden": "true" }),
        h(
          "div",
          { class: "log-body" },
          h("span", { class: "log-kind" }, logKind(item, ctx)),
          logTitle(item),
          item.file?.frontmatter?.description && item.kind !== "episode"
            ? h("p", { class: "log-note" }, item.file.frontmatter.description)
            : null,
        ),
      ),
    ),
  )
}

/**
 * A project on the index: screenshot, then status, start and languages, the
 * title, the description, its figures and the latest line of its log.
 */
export function renderProjectRow(project, ctx) {
  const { lang, allFiles } = ctx
  const own = langOf(project)
  const href = hrefOf(project.slug)
  const fm = project.frontmatter ?? {}
  const shot = projectShot(project, { className: "shot-img" })
  const log = projectLog(project, allFiles)
  const latest = log.find((item) => item.file || item.series)
  const languages =
    typeof fm.live_zh === "string" ? h("span", null, "EN, ", h("span", { lang: ZH }, "中文")) : null
  return h(
    "article",
    { class: shot ? "proj" : "proj proj--bare", lang: langIfOther(own, lang) },
    // The title link is the same destination, so the picture stays out of the
    // tab order and the accessibility tree.
    shot ? h("a", { class: "shot", href, tabindex: "-1", "aria-hidden": "true" }, shot) : null,
    h(
      "div",
      { class: "proj-body" },
      h(
        "p",
        { class: "meta" },
        joined([
          renderStatus(projectStatus(project), lang),
          fm.date ? t(lang, "since", { date: formatDate(isoDate(fm.date), lang) }) : null,
          languages,
        ]),
      ),
      h("h3", { class: "proj-title" }, h("a", { class: "stretch", href }, titleOf(project))),
      fm.description ? h("p", { class: "proj-dek" }, fm.description) : null,
      renderFigures(project),
      latest
        ? h(
            "p",
            { class: "proj-latest" },
            t(lang, "latestInLog"),
            ": ",
            h(
              "a",
              { class: "inline-link", href: hrefOf((latest.file ?? latest.series).slug) },
              latest.file ? titleOf(latest.file) : latest.series.title,
            ),
          )
        : null,
    ),
  )
}

// --- notes --------------------------------------------------------------------------

/** A note in a list: its date in the margin, the title and the description. */
export function renderNoteRow(file, ctx) {
  const { lang } = ctx
  const own = langOf(file)
  const fm = file.frontmatter ?? {}
  return h(
    "li",
    { class: "note", lang: langIfOther(own, lang) },
    h("span", { class: "note-date", lang: langIfOther(lang, own) }, timeOf(dateOf(file), lang)),
    h(
      "div",
      { class: "note-body" },
      h("h3", { class: "note-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
      fm.description ? h("p", { class: "note-dek" }, fm.description) : null,
    ),
  )
}

// --- posts --------------------------------------------------------------------------

/**
 * Posts that take longer than this to read show their first block in the
 * timeline, then Continue. Minutes rather than words, so a Chinese post (400
 * Han characters a minute) folds at the same length of reading as an English
 * one (200 words a minute).
 */
export const POST_FOLD_MINUTES = 1

const WEEKDAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
}
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The id a post has in the timeline, so a link can land on it: p-2026-09-30-2140. */
export function postAnchor(file) {
  const slug = file.slug ?? ""
  return "p-" + slug.slice(slug.lastIndexOf("/") + 1)
}

/** True for a post written without a title; presence-derive titles it with its first words. */
export const isUntitled = (file) => file.presence?.untitled === true

// The post's rendered body, from the tree OFM keeps on every page for embeds.
// Tables get the same wrapper Quartz gives them; scripts and styles are dropped.
const POST_COMPONENTS = {
  table: (props) => h("div", { class: "table-container" }, h("table", props)),
  script: () => null,
  style: () => null,
}

// A post's tree as the timeline shows it, copied: ids dropped (another post on
// the page may use the same ones), in-page links sent to the post's own page,
// and its footnotes left there. state.dropped says something was left behind.
function forTimeline(node, href, state) {
  if (node.type !== "element" && node.type !== "root") return node
  if (node.type === "element" && node.properties?.dataFootnotes != null) {
    state.dropped = true
    return null
  }
  let properties = node.properties
  if (properties) {
    properties = { ...properties }
    delete properties.id
    if (typeof properties.href === "string" && properties.href.startsWith("#")) {
      properties.href = href + properties.href
    }
  }
  const children = (node.children ?? [])
    .map((child) => forTimeline(child, href, state))
    .filter(Boolean)
  return { ...node, properties, children }
}

function timelineTree(file) {
  const tree = file.htmlAst
  if (!tree || !Array.isArray(tree.children)) return { root: null, dropped: false }
  const state = { dropped: false }
  const root = forTimeline(tree, hrefOf(file.slug), state)
  return { root, dropped: state.dropped }
}

function postBody(root, { fold }) {
  if (!root) return null
  if (fold) {
    const first = root.children.find((node) => node.type === "element")
    if (first) root = { type: "root", children: [first] }
  }
  return toJsxRuntime(root, {
    Fragment,
    jsx,
    jsxs,
    elementAttributeNameCase: "html",
    components: POST_COMPONENTS,
  })
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/** A link post's link line: the page it points at, then its site. */
export function postLink(file) {
  const fm = file.frontmatter ?? {}
  // Only web links; anything else (a javascript: URL) is not rendered.
  if (typeof fm.link !== "string" || !/^https?:\/\//i.test(fm.link.trim())) return null
  const host = hostOf(fm.link)
  const label = typeof fm.link_title === "string" && fm.link_title.trim() ? fm.link_title : fm.link
  return h(
    "p",
    { class: "post-link" },
    h("a", { href: fm.link, rel: "noopener" }, label),
    host && label !== fm.link ? h("span", { class: "post-host" }, host) : null,
  )
}

/** A post's permalink. Posts publish no time of day: it says where the author is. */
function postPermalink(file, lang) {
  return h("a", { class: "post-permalink", href: hrefOf(file.slug) }, t(lang, "permalink"))
}

/**
 * One post in the timeline: its title if it has one, the body in full (or its
 * first block and Continue when it takes over a minute to read), then a line
 * with its permalink, its tags and its project.
 */
export function renderPost(file, ctx) {
  const { lang, allFiles } = ctx
  const own = langOf(file)
  const { root, dropped } = timelineTree(file)
  // A post with footnotes folds too: they stay on its own page.
  const fold = dropped || (file.presence?.readingMinutes ?? 0) > POST_FOLD_MINUTES
  const project =
    typeof file.presence?.relation === "string"
      ? allFiles.find((other) => other.slug === file.presence.relation)
      : null
  return h(
    "article",
    { class: "post", id: postAnchor(file), lang: langIfOther(own, lang) },
    isUntitled(file)
      ? null
      : h("h3", { class: "post-title" }, h("a", { href: hrefOf(file.slug) }, titleOf(file))),
    postLink(file),
    h("div", { class: "post-body" }, postBody(root, { fold })),
    fold
      ? h(
          "p",
          { class: "post-more" },
          h("a", { href: hrefOf(file.slug) }, t(own, "continueReading")),
        )
      : null,
    h(
      "p",
      { class: "post-meta", lang: langIfOther(lang, own) },
      joined([
        postPermalink(file, lang),
        ...tagsOf(file, 3).map((tag) => h("span", { class: "post-tag" }, tag)),
        project ? h("a", { class: "post-project", href: hrefOf(project.slug) }, titleOf(project)) : null,
      ]),
    ),
  )
}

/** The date written once in the margin beside a day's posts: Sep 30 over Tue. */
export function renderPostDay(date, files, ctx) {
  const { lang } = ctx
  const [year, month, day] = date.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const zh = isZh(lang)
  return h(
    "section",
    { class: "pday" },
    h(
      "p",
      { class: "pday-date" },
      h(
        "time",
        { datetime: date },
        h("span", { class: "pday-day" }, zh ? `${month}月${day}日` : `${SHORT_MONTHS[month - 1]} ${day}`),
        h("span", { class: "pday-dow" }, WEEKDAYS[zh ? "zh" : "en"][weekday]),
      ),
    ),
    h(
      "ol",
      { class: "pday-posts" },
      files.map((file) => h("li", null, renderPost(file, ctx))),
    ),
  )
}
