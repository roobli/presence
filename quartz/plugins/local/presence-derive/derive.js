import { styleText } from "node:util"
import { clockOf, formatDate, isoDate } from "../presence-shared/dates.js"
import { entryKind, formerSlugs, layoutOf } from "../presence-shared/sections.js"

/**
 * Page data stored as file.data.presence, read by renderPage (kind), the page
 * header, the index rows and the section spine:
 *   kind            the layout: "home" | "folder" | "essay" | "project" | "page".
 *                   Essays, episodes and notes are all "essay".
 *   entry           what the page is: "essay" | "episode" | "note" | "project",
 *                   or the layout for pages outside a section
 *   figures         [{ n, name, title }], live figures in document order
 *   sections        [{ id, title, words }], exactly one per h2
 *   intro           { words } when 50 or more words precede the first h2, else
 *                   null (a shorter lead-in joins the first section). The spine
 *                   draws [intro, ...sections]; "fewer than 3 h2" is
 *                   sections.length < 3.
 *   figureOffsets   words before each figure
 *   words           each Han character counts as one word
 *   readingMinutes  ceil(words / 200), or ceil(Han characters / 400) on zh pages
 *   relation        the project a reading page is about: frontmatter project,
 *                   else its first link to a project page
 *
 * Word counts include code, diagrams and display math, which take reading time
 * too. They skip script and style, figure frames (so a figure's chrome never
 * moves them) and the footnotes section. On a page with an h2, intro and
 * sections add up to words, which keeps the spine's figure dots aligned with
 * its segments.
 */

const INTRO_MIN_WORDS = 50
const HAN_RE = /\p{Script=Han}/gu
const WORD_RE = /[\p{L}\p{N}]/u

const SKIP_TAGS = new Set(["script", "style"])
// Text inside these joins its neighbours. Every other element is a word
// boundary, so adjacent table cells or list items never merge into one word.
const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
])

function warn(message) {
  console.warn(styleText("yellow", "warning:") + " presence-derive: " + message)
}

/** Words in a run of text, where each Han character is a word of its own. */
export function countWords(text) {
  let han = 0
  const rest = text.replace(HAN_RE, () => {
    han += 1
    return " "
  })
  let words = han
  for (const token of rest.split(/\s+/)) {
    if (WORD_RE.test(token)) words += 1
  }
  return { words, han }
}

function hasClass(node, name) {
  const className = node.properties?.className
  return Array.isArray(className) && className.includes(name)
}

function textOf(node) {
  if (node.type === "text") return node.value
  return node.children ? node.children.map(textOf).join("") : ""
}

function findByClass(node, name) {
  if (hasClass(node, name)) return node
  for (const child of node.children ?? []) {
    const found = findByClass(child, name)
    if (found) return found
  }
  return null
}

// figure.essay-fig is the numbered frame from the instrument shell;
// div.essay-interactive is the bare placeholder written before it. Stripped
// markers are removed from the source and never reach the tree.
function figureOf(node) {
  const name = node.properties?.dataInteractive
  if (typeof name !== "string") return null
  if (node.tagName === "figure" && hasClass(node, "essay-fig")) {
    const title = findByClass(node, "essay-fig__title")
    return { name, title: title ? textOf(title).trim() || null : null }
  }
  if (node.tagName === "div" && hasClass(node, "essay-interactive")) return { name, title: null }
  return null
}

function derivePage(tree, lang) {
  const figures = []
  const figureOffsets = []
  const sections = []
  let words = 0
  let han = 0
  let lead = 0
  let section = null
  let pending = ""

  const flush = () => {
    if (!pending) return
    const count = countWords(pending)
    pending = ""
    words += count.words
    han += count.han
    if (section) section.words += count.words
    else lead += count.words
  }

  const visit = (node) => {
    if (node.type === "text") {
      pending += node.value
      return
    }
    if (node.type === "root") {
      for (const child of node.children) visit(child)
      return
    }
    if (node.type !== "element") return

    const figure = figureOf(node)
    if (figure) {
      flush()
      figures.push({ n: figures.length + 1, ...figure })
      figureOffsets.push(words)
      return
    }
    const inline = INLINE_TAGS.has(node.tagName)
    if (!inline) pending += " "
    // GFM's footnotes section carries its own sr-only h2, which is no section.
    if (SKIP_TAGS.has(node.tagName) || node.properties?.dataFootnotes != null) return
    if (node.tagName === "h2") {
      flush()
      const title = textOf(node).replace(/\s+/g, " ").trim()
      section = { id: node.properties?.id ?? null, title, words: 0 }
      sections.push(section)
    }
    for (const child of node.children) visit(child)
    if (!inline) pending += " "
  }

  visit(tree)
  flush()

  let intro = null
  if (sections.length > 0) {
    if (lead >= INTRO_MIN_WORDS) intro = { words: lead }
    else sections[0].words += lead
  }
  const zh = /^zh/i.test(lang)
  return {
    figures,
    sections,
    intro,
    figureOffsets,
    words,
    readingMinutes: Math.ceil(zh ? han / 400 : words / 200),
  }
}

function relationOf(ctx, file, kind) {
  if (kind !== "essay") return null
  const fm = file.data.frontmatter ?? {}
  // work: is the field's name from before projects were called projects.
  const named = typeof fm.project === "string" ? fm.project : fm.work
  if (typeof named === "string" && named.trim()) {
    const slug = named.trim().replace(/^\/+|\/+$/g, "")
    if (!ctx.allSlugs.includes(slug)) {
      warn(`${file.data.relativePath ?? file.data.slug}: project "${named}" is not a page slug`)
    }
    return slug
  }
  const links = file.data.links ?? []
  return links.find((link) => entryKind(link) === "project") ?? null
}

// The same slug under a section's earlier folder name. A retired zh/ prefix
// (zh/essays/foo, which i18n-slug keeps as an alias) keeps its prefix.
function formerOf(slug) {
  if (slug.startsWith("zh/")) return formerSlugs(slug.slice(3)).map((old) => "zh/" + old)
  return formerSlugs(slug)
}

/**
 * Redirects from the URLs a page had before its section was renamed:
 * essays/foo keeps writing/foo, and its translation keeps writing/foo/zh and
 * the older forms i18n-slug already redirects from.
 */
export function formerAliases(slug, aliases = []) {
  const own = new Set([slug, ...aliases])
  const out = []
  for (const current of own) {
    for (const old of formerOf(current)) {
      if (!own.has(old) && !out.includes(old)) out.push(old)
    }
  }
  return out
}

export function markdownPlugins(_ctx) {
  return [
    () => (_tree, file) => {
      const base = file.data.i18n?.base ?? file.data.slug
      const entry = entryKind(base)
      const kind = layoutOf(entry)
      file.data.presence = { kind, entry }
      const fm = (file.data.frontmatter ??= {})
      fm.essayFrame ??= kind === "essay"
      // note-properties titles a page without one after its file name.
      if (entry === "post" && (!fm.title || fm.title === file.stem)) {
        file.data.presence.untitled = true
      }
      const slug = file.data.slug
      if (typeof slug === "string") {
        const former = formerAliases(slug, file.data.aliases)
        if (former.length > 0) file.data.aliases = [...(file.data.aliases ?? []), ...former]
      }
    },
  ]
}

// Typora writes [TOC] on a line of its own for a contents block. The same line
// here becomes a list of the page's headings (file.data.toc, from the
// table-of-contents transformer), or goes away on a page too short to have one.
const TOC_MARKER = "[TOC]"

export function replaceTocMarkers(tree, toc, lang) {
  const children = tree.children
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i]
    const only =
      node.type === "element" && node.tagName === "p" && node.children.length === 1
        ? node.children[0]
        : null
    if (!only || only.type !== "text" || only.value.trim() !== TOC_MARKER) continue
    if (!toc || toc.length === 0) {
      children.splice(i, 1)
      continue
    }
    children[i] = {
      type: "element",
      tagName: "nav",
      properties: { className: ["md-toc"], ariaLabel: lang.startsWith("zh") ? "目录" : "Contents" },
      children: [
        {
          type: "element",
          tagName: "ul",
          properties: {},
          children: toc.map((entry) => ({
            type: "element",
            tagName: "li",
            properties: { className: ["md-toc-item"], dataDepth: entry.depth },
            children: [
              {
                type: "element",
                tagName: "a",
                properties: { href: `#${entry.slug}` },
                children: [{ type: "text", value: entry.text }],
              },
            ],
          })),
        },
      ],
    }
  }
}

/**
 * A title from a page's first paragraph: its first sentence when that fits in
 * max (80 characters in English, 32 in Chinese), else its first words cut at a
 * word (or, in Chinese, a character) with an ellipsis.
 */
export function excerptOf(tree, lang) {
  const first = (tree.children ?? []).find(
    (node) => node.type === "element" && node.tagName === "p" && textOf(node).trim(),
  )
  if (!first) return null
  const text = textOf(first).replace(/\s+/g, " ").trim()
  const zh = /^zh/i.test(lang)
  const max = zh ? 32 : 80
  // The first sentence end past a floor, so "e.g." or "Dr." is no sentence.
  const floor = zh ? 6 : 20
  const ends = [...text.matchAll(zh ? /[。！？]/g : /[.!?](?=\s|$)/g)]
  const end = ends.find((match) => match.index + 1 >= floor)
  if (end && end.index + 1 <= max) return text.slice(0, end.index + 1).replace(/[.。]$/, "")
  if (text.length <= max) return text
  let cut = text.slice(0, max)
  if (!zh) {
    const space = cut.lastIndexOf(" ")
    if (space > max / 2) cut = cut.slice(0, space)
  }
  return cut.replace(/[\s,.;:，。；：、]+$/, "") + "…"
}

/** "Sep 30, 2026, 21:40" for a post with no words to title it, or null. */
function stampTitle(date, lang) {
  const day = isoDate(date)
  if (!day) return null
  const clock = clockOf(date)
  return clock ? `${formatDate(day, lang)}, ${clock}` : formatDate(day, lang)
}

/**
 * A post's text cut to what a search snippet shows: about 155 characters in
 * English and 80 in Chinese, ending on a sentence when one ends in the second
 * half, else on a word with an ellipsis. An untitled post skips the sentence
 * that already titles it.
 */
export function summaryOf(tree, lang, title = null) {
  const paragraphs = (tree.children ?? []).filter(
    (node) => node.type === "element" && node.tagName === "p",
  )
  let text = paragraphs
    .map((node) => textOf(node).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
  if (title && text.startsWith(title)) text = text.slice(title.length).replace(/^[.。!?！？\s]+/, "")
  if (!text) return null
  const zh = /^zh/i.test(lang)
  const max = zh ? 80 : 155
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const ends = [...head.matchAll(zh ? /[。！？]/g : /[.!?](?=\s)/g)]
  const last = ends.at(-1)
  if (last && last.index >= max / 2) return head.slice(0, last.index + 1)
  let cut = head
  if (!zh) {
    const space = cut.lastIndexOf(" ")
    if (space > max / 2) cut = cut.slice(0, space)
  }
  return cut.replace(/[\s,.;:，。；：、]+$/, "") + "…"
}

// Runs after OFM's rehypeRaw (figure markup is elements), GFM's heading ids and
// crawl-links (file.data.links), and before KaTeX renders math.
export function htmlPlugins(ctx) {
  return [
    () => (tree, file) => {
      const presence = file.data.presence
      const lang = file.data.i18n?.lang ?? file.data.frontmatter?.lang ?? "en"
      Object.assign(presence, derivePage(tree, lang), {
        relation: relationOf(ctx, file, presence.kind),
      })
      // An untitled post is titled with its first words, for <title>, search,
      // feeds and the sidebar; the page itself shows no visible title.
      const fm = file.data.frontmatter
      if (presence.entry === "post" && !isoDate(fm.date)) {
        warn(`${file.data.relativePath ?? file.data.slug}: a post needs a date (2026-09-30T21:40-07:00); it is left off the timeline`)
      }
      if (presence.untitled) {
        // An image-only post has no sentence to lend; it is titled by its day and time.
        const title = excerptOf(tree, lang) ?? stampTitle(fm.date, lang)
        if (title) fm.title = title
      }
      // A post has no description of its own; its text, cut to snippet
      // length, is the one search results, cards and structured data show.
      if (presence.entry === "post" && !fm.socialDescription && !fm.description) {
        const summary = summaryOf(tree, lang, presence.untitled ? fm.title : null)
        if (summary) fm.socialDescription = summary
      }
      // After the counts, so a contents block never adds reading time.
      replaceTocMarkers(tree, file.data.toc, lang)
    },
  ]
}
