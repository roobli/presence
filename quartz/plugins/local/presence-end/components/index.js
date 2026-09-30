import { h } from "preact"
import { langOf, t } from "../../presence-shared/locale.js"
import {
  backlinksOf,
  canonicalOf,
  hrefOf,
  placeInSeries,
  projectLog,
  projectOf,
  projectStatus,
  selectEssays,
  selectPosts,
  seriesForProject,
  titleOf,
} from "../../presence-shared/entries.js"
import { indexSlugOf, sectionById } from "../../presence-shared/sections.js"
import {
  joined,
  postAnchor,
  renderLedger,
  renderLog,
  renderSeriesRow,
  renderStatus,
  renderTrack,
} from "../../presence-shared/views.js"

/**
 * End matter: where a reader goes after the last paragraph, each block with
 * its label in the margin.
 *
 * Under an essay, an episode or a note:
 *   In this series   an episode's series, its track with this one ringed,
 *                    and the previous and next episode
 *   Part of          the project the page is about
 *   Linked from      the entries that link to this page
 *   More writing     up to three other essays
 *
 * Under a post:
 *   Posts            the next older and newer post, and the way back to this
 *                    one in the timeline
 *   Part of          the project it is about
 *   Linked from      the entries that link to it
 *
 * Under a project:
 *   Log              everything that happened to it, newest first: its own
 *                    entries and every essay, episode and note about it
 *   Series           the series that belong to it
 *   Linked from      entries that link to it and are not in the log
 *
 * Nothing is listed twice: a page shown in an earlier block is left out of the
 * later ones. A translation lists its original's relations.
 */

const MORE_ROWS = 3

function block(className, label, ...content) {
  return h(
    "section",
    { class: `end-block ${className}` },
    h("h2", { class: "end-label" }, label),
    h("div", { class: "end-body" }, ...content),
  )
}

function seriesBlock(place, ctx) {
  const { lang } = ctx
  const { series, index } = place
  const neighbour = (file, key) =>
    file
      ? h(
          "a",
          { class: `pn-link pn-link--${key}`, href: hrefOf(file.slug), rel: key },
          h("span", { class: "pn-dir" }, t(lang, key)),
          h(
            "span",
            { class: "pn-title" },
            joined([String(series.episodes.indexOf(file) + 1).padStart(2, "0"), titleOf(file)]),
          ),
        )
      : h("span", { class: "pn-link pn-link--none", "aria-hidden": "true" })
  return block(
    "end-series",
    t(lang, "inThisSeries"),
    h(
      "p",
      { class: "end-series-head" },
      h("a", { href: hrefOf(series.slug) }, series.title),
      h(
        "span",
        { class: "meta" },
        joined([
          t(lang, "publishedOfLong", { n: series.episodes.length, total: series.total }),
          series.cadence,
        ]),
      ),
    ),
    renderTrack(series, ctx, { current: series.episodes[index].slug }),
    h(
      "nav",
      { class: "pn", "aria-label": t(lang, "inThisSeries") },
      neighbour(series.episodes[index - 1], "previous"),
      neighbour(series.episodes[index + 1], "next"),
    ),
  )
}

function projectBlock(project, ctx) {
  const { lang } = ctx
  const figures = Array.isArray(project.frontmatter?.figures) ? project.frontmatter.figures : []
  return block(
    "end-project",
    t(lang, "partOfProject"),
    h(
      "p",
      { class: "end-project-row" },
      h("a", { class: "end-project-title", href: hrefOf(project.slug) }, titleOf(project)),
      h(
        "span",
        { class: "meta" },
        joined([
          renderStatus(projectStatus(project), lang),
          ...figures
            .slice(0, 2)
            .map((figure) => `${figure.value} ${String(figure.label).toLowerCase()}`),
        ]),
      ),
    ),
  )
}

function moreWriting(shown, ctx) {
  const { lang, allFiles } = ctx
  const all = selectEssays(allFiles)
  const others = all.filter((essay) => !shown.has(essay.slug))
  if (others.length === 0) return null
  const essays = sectionById("essays")
  return block(
    "end-more",
    t(lang, "moreWriting"),
    renderLedger(others.slice(0, MORE_ROWS), ctx, { head: false, compact: true }),
    others.length > MORE_ROWS && essays
      ? h(
          "p",
          { class: "end-all" },
          h(
            "a",
            { href: hrefOf(indexSlugOf(essays)) },
            t(lang, "all_essays"),
            " ",
            h("span", { class: "sh-n" }, String(all.length).padStart(2, "0")),
          ),
        )
      : null,
  )
}

function readingEnd(fileData, ctx) {
  const { lang, allFiles } = ctx
  const original = canonicalOf(fileData, allFiles)
  const shown = new Set([fileData.slug, original.slug])
  const blocks = []

  const place = placeInSeries(original, allFiles)
  if (place) {
    for (const episode of place.series.episodes) shown.add(episode.slug)
    blocks.push(seriesBlock(place, ctx))
  }

  const project = projectOf(original, allFiles)
  if (project) {
    shown.add(project.slug)
    blocks.push(projectBlock(project, ctx))
  }

  const linking = backlinksOf(original, allFiles).filter((entry) => !shown.has(entry.slug))
  if (linking.length > 0) {
    for (const entry of linking) shown.add(entry.slug)
    blocks.push(
      block(
        "end-linked",
        t(lang, "linkedFrom"),
        renderLedger(linking, ctx, { head: false, compact: true }),
      ),
    )
  }

  blocks.push(moreWriting(shown, ctx))
  return blocks
}

function postEnd(fileData, ctx) {
  const { lang, allFiles } = ctx
  const posts = selectPosts(allFiles)
  const index = posts.findIndex((post) => post.slug === fileData.slug)
  const shown = new Set([fileData.slug])
  const blocks = []

  const neighbour = (file, key) =>
    file
      ? h(
          "a",
          {
            class: `pn-link pn-link--${key}`,
            href: hrefOf(file.slug),
            rel: key === "older" ? "prev" : "next",
          },
          h("span", { class: "pn-dir" }, t(lang, key)),
          h("span", { class: "pn-title" }, titleOf(file)),
        )
      : h("span", { class: "pn-link pn-link--none", "aria-hidden": "true" })
  const section = sectionById("posts")
  blocks.push(
    block(
      "end-posts",
      t(lang, "posts"),
      // The way back leads, so it never sits under the empty slot of the
      // oldest or newest post.
      section
        ? h(
            "p",
            { class: "end-all end-all--lead" },
            h(
              "a",
              { href: `${hrefOf(indexSlugOf(section))}#${postAnchor(fileData)}` },
              t(lang, "inTheTimeline"),
            ),
          )
        : null,
      index >= 0
        ? h(
            "nav",
            { class: "pn", "aria-label": t(lang, "posts") },
            neighbour(posts[index + 1], "older"),
            neighbour(posts[index - 1], "newer"),
          )
        : null,
    ),
  )

  const project = projectOf(fileData, allFiles)
  if (project) {
    shown.add(project.slug)
    blocks.push(projectBlock(project, ctx))
  }

  const linking = backlinksOf(fileData, allFiles).filter((entry) => !shown.has(entry.slug))
  if (linking.length > 0) {
    blocks.push(
      block(
        "end-linked",
        t(lang, "linkedFrom"),
        renderLedger(linking, ctx, { head: false, compact: true }),
      ),
    )
  }
  return blocks
}

function projectEnd(fileData, ctx) {
  const { lang, allFiles } = ctx
  const original = canonicalOf(fileData, allFiles)
  const blocks = []
  const shown = new Set([fileData.slug, original.slug])

  const log = projectLog(original, allFiles)
  if (log.length > 0) {
    for (const item of log) if (item.file) shown.add(item.file.slug)
    blocks.push(block("end-log", t(lang, "log"), renderLog(log, ctx)))
  }

  const series = seriesForProject(original, allFiles)
  if (series.length > 0) {
    blocks.push(
      block(
        "end-series-list",
        t(lang, "seriesInProject"),
        series.map((one) => renderSeriesRow(one, ctx, { dek: false })),
      ),
    )
  }

  const linking = backlinksOf(original, allFiles).filter((entry) => !shown.has(entry.slug))
  if (linking.length > 0) {
    blocks.push(
      block(
        "end-linked",
        t(lang, "linkedFrom"),
        renderLedger(linking, ctx, { head: false, compact: true }),
      ),
    )
  }
  return blocks
}

export const EndMatter = () => {
  const Component = ({ fileData, allFiles }) => {
    const kind = fileData.presence?.kind
    if (kind !== "essay" && kind !== "project") return null
    const ctx = { lang: langOf(fileData), allFiles }
    const end =
      kind === "project" ? projectEnd : fileData.presence?.entry === "post" ? postEnd : readingEnd
    const blocks = end(fileData, ctx).filter(Boolean)
    if (blocks.length === 0) return null
    return h("section", { class: "end", "aria-label": t(ctx.lang, "more") }, blocks)
  }
  return Component
}
