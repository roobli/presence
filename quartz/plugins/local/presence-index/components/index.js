import { h } from "preact"
import { isZh, langOf, t } from "../../presence-shared/locale.js"
import {
  dateOf,
  findSlug,
  HOME_ROWS,
  hrefOf,
  projectStatus,
  selectEntries,
  selectEssays,
  selectNotes,
  selectPosts,
  selectProjects,
  selectSeries,
  selectWriting,
  seriesById,
} from "../../presence-shared/entries.js"
import {
  indexSlugOf,
  isSeriesIndex,
  SECTIONS,
  sectionById,
  sectionOfIndex,
  seriesIdOf,
} from "../../presence-shared/sections.js"
import {
  renderCard,
  renderEpisodeList,
  renderLedger,
  renderNoteRow,
  renderPostDay,
  renderProjectRow,
  renderSectionHead,
  renderSeriesRow,
  renderSpread,
  renderTitleBlock,
  renderTrack,
  seriesStatusText,
  timeOf,
} from "../../presence-shared/views.js"

/**
 * The index surfaces: the homepage, each section's own page and each series'
 * own page. Every other page renders nothing.
 *
 * Homepage: the thesis (index.md's description) and intro over a title block
 * of what the notebook holds; then Latest, the newest writing open as a spread
 * with the next three as cards; then each series with its track, each project,
 * the latest notes, and the index of every essay. A section with nothing in
 * it is left out.
 *
 * Section pages open with the section's title block. Essays list as a ledger,
 * by year once they span years; series as rows with their tracks; projects as
 * rows; notes by month; posts as a timeline, by month and then by day with
 * the day in the margin. A series' page has its facts, its track, its episodes
 * including planned ones, and what to read first.
 *
 * Folder pages hide FolderPage's stock list (_folder-listing.scss); the page
 * header already names the section.
 */

/** Cards after the spread on the homepage. */
const HOME_CARDS = 3
/** Notes on the homepage. */
const HOME_NOTES = 3

const pad = (n) => String(n).padStart(2, "0")

function sectionHead(section, lang, { note = true, count } = {}) {
  return renderSectionHead({
    id: `idx-${section.id}`,
    label: t(lang, section.label),
    note: note ? t(lang, `note_${section.id}`) : null,
    more:
      count !== undefined
        ? { href: hrefOf(indexSlugOf(section)), label: t(lang, `all_${section.id}`), n: count }
        : undefined,
  })
}

function sectionCount(section, allFiles) {
  if (section.id === "series") return selectSeries(allFiles).length
  return selectEntries(allFiles, section).length
}

function mast(fm, ctx) {
  const { lang, allFiles } = ctx
  const links = (Array.isArray(fm.links) ? fm.links : []).filter(
    (link) => typeof link?.label === "string" && typeof link?.href === "string",
  )

  // What the notebook holds, then when it began and last changed.
  const cells = []
  const dates = []
  for (const section of SECTIONS.filter((candidate) => candidate.home)) {
    const n = sectionCount(section, allFiles)
    if (n === 0) continue
    cells.push({ label: t(lang, section.label), value: pad(n) })
    for (const entry of selectEntries(allFiles, section)) {
      const date = dateOf(entry)
      if (date) dates.push(date)
    }
  }
  dates.sort()
  if (dates.length > 0) {
    cells.push({ label: t(lang, "fieldSince"), value: dates[0].slice(0, 4) })
    cells.push({ label: t(lang, "fieldUpdated"), value: timeOf(dates.at(-1), lang) })
  }
  if (links.length > 0) {
    cells.push({
      label: t(lang, "fieldElsewhere"),
      value: h(
        "span",
        { class: "tb-links" },
        links.map((link) => h("a", { href: link.href }, link.label)),
      ),
    })
  }

  return h(
    "header",
    { class: "home-mast" },
    h("h1", { class: "home-thesis" }, fm.description ?? fm.title),
    typeof fm.intro === "string" && fm.intro.trim()
      ? h("p", { class: "home-intro" }, fm.intro)
      : null,
    renderTitleBlock(cells, "titleblock--mast"),
  )
}

function latest(ctx) {
  const { lang, allFiles } = ctx
  const writing = selectWriting(allFiles)
  if (writing.length === 0) return null
  const [first, ...rest] = writing
  // One card per series, its newest episode: the series row below shows the rest.
  const seen = new Set([seriesIdOf(first.slug)])
  const cards = rest
    .filter((file) => {
      const id = seriesIdOf(file.slug)
      if (!id) return true
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .slice(0, HOME_CARDS)
  const essays = sectionById("essays")
  return h(
    "section",
    { class: "idx idx--latest", "aria-labelledby": "idx-latest" },
    renderSectionHead({
      id: "idx-latest",
      label: t(lang, "latest"),
      note: t(lang, "latestSpread"),
      more: essays
        ? {
            href: hrefOf(indexSlugOf(essays)),
            label: t(lang, "all_essays"),
            n: selectEssays(allFiles).length,
          }
        : undefined,
    }),
    renderSpread(first, ctx),
    cards.length > 0
      ? h(
          "ul",
          { class: "cards" },
          cards.map((file) => renderCard(file, ctx)),
        )
      : null,
  )
}

function homeSection(section, ctx) {
  const { allFiles } = ctx
  const n = sectionCount(section, allFiles)
  if (n === 0) return null
  let body = null
  if (section.id === "series") {
    body = selectSeries(allFiles).map((series) => renderSeriesRow(series, ctx))
  } else if (section.kind === "project") {
    body = selectProjects(allFiles).map((project) => renderProjectRow(project, ctx))
  } else if (section.kind === "note") {
    body = h(
      "ol",
      { class: "notes" },
      selectNotes(allFiles)
        .slice(0, HOME_NOTES)
        .map((note) => renderNoteRow(note, ctx)),
    )
  } else {
    return null
  }
  return h(
    "section",
    { class: `idx idx--${section.id}`, "aria-labelledby": `idx-${section.id}` },
    sectionHead(section, ctx.lang, { count: n }),
    body,
  )
}

function homeIndex(ctx) {
  const { lang, allFiles } = ctx
  const essays = selectEssays(allFiles)
  const section = sectionById("essays")
  if (essays.length === 0 || !section) return null
  return h(
    "section",
    { class: "idx idx--index", "aria-labelledby": "idx-index" },
    renderSectionHead({
      id: "idx-index",
      label: t(lang, "index"),
      note: t(lang, "note_essays"),
      more:
        essays.length > HOME_ROWS
          ? { href: hrefOf(indexSlugOf(section)), label: t(lang, "all_essays"), n: essays.length }
          : undefined,
    }),
    renderLedger(essays.slice(0, HOME_ROWS), ctx, { compact: true }),
  )
}

// --- section pages ---------------------------------------------------------------

const yearOf = (file) => (dateOf(file) ?? "").slice(0, 4)
const monthOf = (file) => (dateOf(file) ?? "").slice(0, 7)

const MONTHS = [
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

function monthLabel(month, lang) {
  const [year, m] = month.split("-").map(Number)
  return isZh(lang) ? `${year}年${m}月` : `${MONTHS[m - 1]} ${year}`
}

// Groups under a label once there is more than one group.
function grouped(files, keyOf, labelOf, render) {
  const keys = [...new Set(files.map(keyOf))]
  if (keys.length <= 1) return render(files)
  return keys.map((key) =>
    h(
      "section",
      { class: "idx-group" },
      key ? h("h2", { class: "idx-group-label" }, labelOf(key)) : null,
      render(files.filter((file) => keyOf(file) === key)),
    ),
  )
}

function essaysPage(section, ctx) {
  const { lang, allFiles } = ctx
  const essays = selectEntries(allFiles, section)
  const figures = essays.reduce((sum, essay) => sum + (essay.presence?.figures?.length ?? 0), 0)
  const translated = essays.filter((essay) =>
    essay.i18n?.alternates?.some((version) => isZh(version.lang)),
  ).length
  const cells = [{ label: t(lang, section.label), value: pad(essays.length) }]
  if (essays.length > 0) {
    cells.push({ label: t(lang, "fieldFirst"), value: timeOf(dateOf(essays.at(-1)), lang) })
    cells.push({ label: t(lang, "fieldLatest"), value: timeOf(dateOf(essays[0]), lang) })
  }
  if (figures > 0) cells.push({ label: t(lang, "fieldFigures"), value: pad(figures) })
  if (translated > 0) cells.push({ label: t(lang, "fieldTranslated"), value: pad(translated) })
  return [
    renderTitleBlock(cells, "titleblock--section"),
    h(
      "section",
      { class: "idx idx--ledger" },
      grouped(
        essays,
        yearOf,
        (year) => year,
        (files) => renderLedger(files, ctx),
      ),
    ),
  ]
}

function seriesPage(ctx) {
  const { lang, allFiles } = ctx
  const all = selectSeries(allFiles)
  const episodes = all.reduce((sum, series) => sum + series.episodes.length, 0)
  const running = all.filter((series) => series.status === "in-progress").length
  return [
    renderTitleBlock(
      [
        { label: t(lang, "series"), value: pad(all.length) },
        { label: t(lang, "episodes"), value: pad(episodes) },
        { label: t(lang, "status_in-progress"), value: running > 0 ? pad(running) : null },
      ],
      "titleblock--section",
    ),
    h(
      "section",
      { class: "idx idx--series" },
      all.map((series) => renderSeriesRow(series, ctx)),
    ),
  ]
}

function projectsPage(section, ctx) {
  const { lang, allFiles } = ctx
  const projects = selectEntries(allFiles, section)
  const live = projects.filter((project) => projectStatus(project) === "live").length
  return [
    renderTitleBlock(
      [
        { label: t(lang, section.label), value: pad(projects.length) },
        { label: t(lang, "status_live"), value: live > 0 ? pad(live) : null },
      ],
      "titleblock--section",
    ),
    h(
      "section",
      { class: "idx idx--projects" },
      projects.map((project) => renderProjectRow(project, ctx)),
    ),
  ]
}

function notesPage(section, ctx) {
  const { lang, allFiles } = ctx
  const notes = selectEntries(allFiles, section)
  const first = notes.at(-1)
  return [
    renderTitleBlock(
      [
        { label: t(lang, section.label), value: pad(notes.length) },
        { label: t(lang, "fieldSince"), value: first ? timeOf(dateOf(first), lang) : null },
      ],
      "titleblock--section",
    ),
    h(
      "section",
      { class: "idx idx--notes" },
      grouped(
        notes,
        monthOf,
        (month) => (month ? monthLabel(month, lang) : ""),
        (files) =>
          h(
            "ol",
            { class: "notes" },
            files.map((note) => renderNoteRow(note, ctx)),
          ),
      ),
    ),
  ]
}

// The posts timeline: a month heading (the outline's stops), then each day
// with its date in the margin and its posts in full beside it. Months carry
// ids (m-2026-09) for the sidebar's month rows.
function postsPage(section, ctx) {
  const { lang, allFiles } = ctx
  const posts = selectPosts(allFiles)
  const first = posts.at(-1)
  const months = [...new Set(posts.map(monthOf))]
  return [
    renderTitleBlock(
      [
        { label: t(lang, section.label), value: pad(posts.length) },
        { label: t(lang, "fieldSince"), value: first ? timeOf(dateOf(first), lang) : null },
        {
          label: t(lang, "postsFeed"),
          value: h(
            "a",
            { href: "/posts/index.xml", type: "application/rss+xml" },
            "posts/index.xml",
          ),
        },
      ],
      "titleblock--section",
    ),
    h(
      "section",
      { class: "idx idx--posts ptl" },
      months.map((month) => {
        const inMonth = posts.filter((post) => monthOf(post) === month)
        const days = [...new Set(inMonth.map(dateOf))]
        return h(
          "section",
          { class: "ptl-month", id: `m-${month}` },
          h(
            "h2",
            { class: "idx-group-label ptl-month-label" },
            month ? monthLabel(month, lang) : "",
            h("span", { class: "ptl-count" }, t(lang, "postsInMonth", { n: inMonth.length })),
          ),
          days.map((day) =>
            renderPostDay(
              day,
              inMonth.filter((post) => dateOf(post) === day),
              ctx,
            ),
          ),
        )
      }),
    ),
  ]
}

// A series' own page: its facts, its track, its episodes, and what to read first.
function seriesLanding(series, page, ctx) {
  const { lang, allFiles } = ctx
  const project = series.project ? findSlug(allFiles, series.project) : null
  const start =
    typeof page?.frontmatter?.start === "string"
      ? findSlug(allFiles, page.frontmatter.start.replace(/^\/+|\/+$/g, ""))
      : null
  const cells = [
    { label: t(lang, "fieldStatus"), value: seriesStatusText(series, lang) },
    {
      label: t(lang, "fieldPublished"),
      value: t(lang, "publishedOf", { n: series.episodes.length, total: series.total }),
    },
    { label: t(lang, "fieldStarted"), value: timeOf(series.started, lang) },
    { label: t(lang, "fieldCadence"), value: series.cadence },
    {
      label: t(lang, "fieldProject"),
      value: project
        ? h("a", { href: hrefOf(project.slug) }, project.frontmatter?.title ?? project.slug)
        : null,
    },
  ]
  return [
    renderTitleBlock(cells, "titleblock--section"),
    renderTrack(series, ctx, { big: true }),
    h(
      "section",
      { class: "idx idx--episodes", "aria-labelledby": "idx-episodes" },
      renderSectionHead({
        id: "idx-episodes",
        label: t(lang, "episodes"),
        note: t(lang, "episodesNote"),
      }),
      renderEpisodeList(series, ctx),
    ),
    start
      ? h(
          "section",
          { class: "idx idx--start", "aria-labelledby": "idx-start" },
          renderSectionHead({
            id: "idx-start",
            label: t(lang, "startHere"),
            note: t(lang, "startHereNote"),
          }),
          renderLedger([start], ctx, { head: false }),
        )
      : null,
  ]
}

export const HomeIndex = () => {
  const Component = ({ fileData, allFiles }) => {
    const slug = fileData.slug
    const lang = langOf(fileData)
    const ctx = { lang, allFiles }

    if (slug === "index") {
      return h(
        "section",
        { class: "home" },
        mast(fileData.frontmatter ?? {}, ctx),
        latest(ctx),
        SECTIONS.filter((section) => section.home).map((section) => homeSection(section, ctx)),
        homeIndex(ctx),
      )
    }

    if (isSeriesIndex(slug)) {
      const series = seriesById(allFiles, seriesIdOf(slug))
      if (!series) return null
      return h(
        "section",
        { class: "home home--folder home--series" },
        seriesLanding(series, fileData, ctx),
      )
    }

    const own = sectionOfIndex(slug)
    if (!own) return null
    let body
    if (own.id === "series") body = seriesPage(ctx)
    else if (own.kind === "project") body = projectsPage(own, ctx)
    else if (own.kind === "note") body = notesPage(own, ctx)
    else if (own.kind === "post") body = postsPage(own, ctx)
    else body = essaysPage(own, ctx)
    return h("section", { class: `home home--folder home--${own.id}` }, body)
  }
  return Component
}
