import { styleText } from "node:util"

/**
 * Page data stored as file.data.presence, read by renderPage (kind), the page
 * header, the index rows and the section spine:
 *   kind            "home" | "essay" | "work" | "folder" | "page"
 *   figures         [{ n, name, title }], live figures in document order
 *   sections        [{ id, title, words }], one per h2. When 50 or more words
 *                   precede the first h2, an intro entry (id and title null)
 *                   leads; fewer words join the first section.
 *   figureOffsets   words before each figure
 *   words           each Han character counts as one word
 *   readingMinutes  ceil(words / 200), or ceil(Han characters / 400) on zh pages
 *   relation        an essay's work slug: frontmatter work, else its first works/* link
 *
 * Word counts include code, diagrams and display math, which take reading time
 * too. They skip script and style, figure frames (so a figure's chrome never
 * moves them) and the footnotes section. On a page with an h2 the sections add
 * up to words, which keeps the spine's figure dots aligned with its segments.
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

// A translation passes its original's slug, so writing/foo/zh is an essay.
function pageKind(slug) {
  if (slug === "index") return "home"
  if (slug.endsWith("/index")) return "folder"
  if (slug.startsWith("writing/")) return "essay"
  if (slug.startsWith("works/")) return "work"
  return "page"
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

  if (sections.length > 0) {
    if (lead >= INTRO_MIN_WORDS) sections.unshift({ id: null, title: null, words: lead })
    else sections[0].words += lead
  }
  const zh = /^zh/i.test(lang)
  return {
    figures,
    sections,
    figureOffsets,
    words,
    readingMinutes: Math.ceil(zh ? han / 400 : words / 200),
  }
}

function relationOf(ctx, file, kind) {
  if (kind !== "essay") return null
  const work = file.data.frontmatter?.work
  if (typeof work === "string" && work.trim()) {
    const slug = work.trim().replace(/^\/+|\/+$/g, "")
    if (!ctx.allSlugs.includes(slug)) {
      warn(`${file.data.relativePath ?? file.data.slug}: work "${work}" is not a page slug`)
    }
    return slug
  }
  const links = file.data.links ?? []
  return links.find((link) => link.startsWith("works/") && link !== "works/index") ?? null
}

export function markdownPlugins(_ctx) {
  return [
    () => (_tree, file) => {
      const kind = pageKind(file.data.i18n?.base ?? file.data.slug)
      file.data.presence = { kind }
      const fm = (file.data.frontmatter ??= {})
      fm.essayFrame ??= kind === "essay"
    },
  ]
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
    },
  ]
}
