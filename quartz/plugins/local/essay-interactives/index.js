import { readdirSync, readFileSync } from "fs"
import { styleText } from "node:util"

/**
 * Figure markers in essays. A marker is one line at column 0:
 *   <!-- interactive:NAME title="..." caption="..." alt="..." model="..." -->
 *
 * widgets/NAME.json registers the name. textTransform runs before remark parses
 * the file and replaces a "live" marker with the numbered figure frame, written
 * as one CommonMark HTML block (no blank lines inside); components/index.js
 * mounts the widget into it. A "strip" marker is removed, and an unregistered
 * name stays a comment. Markers inside fenced code are left alone.
 *
 * textTransform sees neither the file path nor its language, so a markdown pass
 * (after i18n-slug has set file.data.i18n) re-renders the frame labels on zh
 * pages and prints the build warnings with file and line.
 */

const WIDGETS_DIR = new URL("./widgets/", import.meta.url)

// Registry files starting with "_" are test fixtures (see components/index.js).
export const FIXTURES = process.env.ESSAY_FIG_FIXTURES === "1"

const NAME_RE = /^[a-z0-9-]+$/
const ASPECT_RE = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/
const DEFAULT_ASPECT = "16 / 9"

const MARKER_RE = /^<!--\s*interactive:([a-z0-9-]+)((?:\s+[a-z][a-z-]*="[^"]*")*)\s*-->\s*$/
const ATTR_RE = /([a-z][a-z-]*)="([^"]*)"/g
const LOOSE_RE = /<!--\s*interactive:/i
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const MARKER_ATTRS = new Set(["title", "caption", "alt", "model"])

const LOCALES = {
  en: {
    figure: (n) => `Fig. ${n}`,
    look: "Look for",
    model: "Model",
    nojs: "Live figure. It needs JavaScript.",
  },
  zh: {
    figure: (n) => `图 ${n}`,
    look: "留意",
    model: "模型",
    nojs: "交互图，需要启用 JavaScript。",
  },
}

function warn(message) {
  console.warn(styleText("yellow", "warning:") + " essay-interactives: " + message)
}

export function localeFor(lang) {
  return /^zh/i.test(String(lang ?? "")) ? LOCALES.zh : LOCALES.en
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/* ---------- registry ---------- */

function pickAspect(value, key, file) {
  if (value == null) return null
  if (typeof value === "string" && ASPECT_RE.test(value.trim())) return value.trim()
  warn(`widgets/${file}: ${key} must look like "16 / 9"`)
  return null
}

function pickNumber(value, key, file, integer) {
  if (value == null) return null
  const ok = typeof value === "number" && Number.isFinite(value) && value >= 0
  if (ok && (!integer || Number.isInteger(value))) return value
  warn(`widgets/${file}: ${key} must be a non-negative ${integer ? "integer" : "number"}`)
  return null
}

function normalizeEntry(raw, name, file) {
  const aspect = pickAspect(raw.aspect, "aspect", file)
  const aspectNarrow = pickAspect(raw.aspectNarrow, "aspectNarrow", file)
  const minHeight = pickNumber(raw.minHeight, "minHeight", file, false)
  const minHeightNarrow = pickNumber(raw.minHeightNarrow, "minHeightNarrow", file, false)
  const railRows = pickNumber(raw.railRows, "railRows", file, true)
  const railRowsNarrow = pickNumber(raw.railRowsNarrow, "railRowsNarrow", file, true)

  // The stage always reserves a height, so a figure never mounts into 0px.
  const vars = [
    ["--fig-aspect", aspect ?? (minHeight == null ? DEFAULT_ASPECT : null)],
    ["--fig-aspect-narrow", aspectNarrow],
    ["--fig-min-h", minHeight == null ? null : `${minHeight}px`],
    ["--fig-min-h-narrow", minHeightNarrow == null ? null : `${minHeightNarrow}px`],
    ["--fig-rail-rows", railRows],
    ["--fig-rail-rows-narrow", railRowsNarrow],
  ].filter(([, value]) => value != null)

  const cites = Array.isArray(raw.cites) ? raw.cites.filter((c) => typeof c === "string" && c) : []
  if (raw.cites != null && (!Array.isArray(raw.cites) || cites.length !== raw.cites.length)) {
    warn(`widgets/${file}: cites must be a list of non-empty strings`)
  }

  // "img" (default): a display-only stage named by alt. "group": a stage that
  // holds controls or focusable chips, labelled by the figure title and
  // described by alt; the client shell sets the group attributes at mount.
  let stage = "img"
  if (raw.stage === "group") stage = "group"
  else if (raw.stage != null && raw.stage !== "img")
    warn(`widgets/${file}: stage must be "img" or "group"`)

  return {
    name,
    status: raw.status,
    stage,
    style: vars.map(([key, value]) => `${key}:${value}`).join(";"),
    cites,
  }
}

export function loadRegistry(dir = WIDGETS_DIR, fixtures = FIXTURES) {
  const registry = new Map()
  let files
  try {
    files = readdirSync(dir)
  } catch {
    return registry
  }
  for (const file of files.sort()) {
    if (!file.endsWith(".json")) continue
    if (file.startsWith("_") && !fixtures) continue
    let raw
    try {
      raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"))
    } catch (err) {
      warn(`widgets/${file} is not valid JSON (${err.message})`)
      continue
    }
    const name = raw.name ?? file.slice(0, -".json".length)
    if (!NAME_RE.test(name) || (raw.status !== "live" && raw.status !== "strip")) {
      warn(`widgets/${file} needs a name made of a-z, 0-9 and "-", and status "live" or "strip"`)
      continue
    }
    registry.set(name, normalizeEntry(raw, name, file))
  }
  return registry
}

export const REGISTRY = loadRegistry()

/* ---------- markers ---------- */

function parseAttrs(text) {
  const attrs = {}
  const unknown = []
  for (const match of text.matchAll(ATTR_RE)) {
    const key = match[1]
    if (MARKER_ATTRS.has(key)) attrs[key] = decodeEntities(match[2]).trim()
    else unknown.push(key)
  }
  return { attrs, unknown }
}

function frontmatterEnd(lines) {
  let first = 0
  while (first < lines.length && lines[first].trim() === "") first++
  if (lines[first]?.trimEnd() !== "---") return 0
  for (let i = first + 1; i < lines.length; i++) {
    const line = lines[i].trimEnd()
    if (line === "---" || line === "...") return i + 1
  }
  return 0
}

/**
 * Find marker lines outside frontmatter and fenced code. `loose` lists lines that
 * mention a marker without being one (not alone on the line, bad attribute
 * syntax), ignoring inline code spans.
 */
export function scanMarkers(src) {
  const lines = src.split("\n")
  const markers = []
  const loose = []
  let fence = null
  for (let i = frontmatterEnd(lines); i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = FENCE_RE.exec(line)
    if (fence) {
      const run = fenceMatch?.[1]
      if (run && run[0] === fence[0] && run.length >= fence.length && !fenceMatch[2].trim()) {
        fence = null
      }
      continue
    }
    // A backtick fence's info string cannot contain a backtick.
    if (fenceMatch && !(fenceMatch[1][0] === "`" && fenceMatch[2].includes("`"))) {
      fence = fenceMatch[1]
      continue
    }
    const match = MARKER_RE.exec(line)
    if (match) {
      markers.push({ line: i, name: match[1], ...parseAttrs(match[2]) })
    } else if (LOOSE_RE.test(line.replace(/(`+)[^`]*?\1/g, ""))) {
      loose.push(i)
    }
  }
  return { lines, markers, loose }
}

/**
 * The figure frame, one CommonMark HTML block with no blank line inside, so
 * remark never parses marker text ($, [32], 「」) as markdown or math.
 * div.essay-fig__box reserves the stage height (aspect or minHeight, switched
 * by a container query on the stage) before and after the widget mounts. The
 * label spans carry the gap as a margin, so no space text node follows them.
 */
export function renderFigure(marker, n, entry, locale = LOCALES.en) {
  const { title, caption, alt, model } = marker.attrs
  const style = entry.style ? ` style="${escapeHtml(entry.style)}"` : ""
  const stageMode = entry.stage === "group" ? ` data-stage="group"` : ""
  const stageName = alt ? ` role="img" aria-label="${escapeHtml(alt)}"` : ""
  const fallback = alt ? `${escapeHtml(alt)} ` : ""
  return [
    `<figure class="essay-fig" id="fig-${n}" data-interactive="${marker.name}" data-figure="${n}"${stageMode}${style}>`,
    `<div class="essay-fig__head"><span class="essay-fig__num">${escapeHtml(locale.figure(n))}</span>` +
      (title ? `<span class="essay-fig__title">${escapeHtml(title)}</span>` : "") +
      `</div>`,
    `<div class="essay-fig__stage"${stageName}><div class="essay-fig__box"><p class="essay-fig__fallback">${fallback}` +
      `<span class="essay-fig__nojs">${escapeHtml(locale.nojs)}</span></p></div></div>`,
    `<div class="essay-fig__rail"></div>`,
    caption
      ? `<figcaption class="essay-fig__caption"><span class="essay-fig__look">${escapeHtml(locale.look)}</span>${escapeHtml(caption)}</figcaption>`
      : "",
    model
      ? `<p class="essay-fig__model"><span class="essay-fig__model-label">${escapeHtml(locale.model)}</span>${escapeHtml(model)}</p>`
      : "",
    `</figure>`,
  ]
    .filter(Boolean)
    .join("\n")
}

function isStripped(name, entry) {
  return name === "none" || entry?.status === "strip"
}

export function replaceMarkers(src, registry = REGISTRY, locale = LOCALES.en) {
  if (!src.includes("interactive:")) return src
  const { lines, markers } = scanMarkers(src)
  let n = 0
  for (const marker of markers) {
    const entry = registry.get(marker.name)
    if (isStripped(marker.name, entry)) {
      lines[marker.line] = ""
    } else if (entry) {
      n += 1
      // The trailing newline keeps a blank line after the block, so the next
      // paragraph is never swallowed into the raw HTML.
      lines[marker.line] = renderFigure(marker, n, entry, locale) + "\n"
    }
  }
  return lines.join("\n")
}

/* ---------- markdown pass: warnings and zh labels ---------- */

function walk(node, visit) {
  visit(node)
  if (node.children) for (const child of node.children) walk(child, visit)
}

/**
 * Warnings for one file. `src` is the file as written, so cites are looked up in
 * the essay text and marker attributes, never in the generated figure markup.
 * Returns the live markers in document order (figure N is live[N - 1]).
 */
export function checkMarkers(src, registry, where) {
  const { markers, loose } = scanMarkers(src)
  const live = []
  for (const marker of markers) {
    const entry = registry.get(marker.name)
    const at = where(marker.line)
    for (const key of marker.unknown) warn(`${at}: "${marker.name}" has unknown attribute ${key}`)
    if (isStripped(marker.name, entry)) continue
    if (!entry) {
      warn(`${at}: no widgets/${marker.name}.json, so the marker stays a comment`)
      continue
    }
    live.push(marker)
    if (!marker.attrs.caption) warn(`${at}: figure "${marker.name}" has no caption`)
    if (!marker.attrs.alt) warn(`${at}: figure "${marker.name}" has no alt`)
    for (const cite of entry.cites) {
      if (!src.includes(cite)) {
        warn(
          `${at}: figure "${marker.name}" shows ${cite}, which the essay text and marker never state`,
        )
      }
    }
  }
  for (const line of loose) {
    warn(`${where(line)}: a figure marker must be alone on its line, so this one stays a comment`)
  }
  return live
}

function figuresPass(tree, file, registry) {
  const figures = []
  let comments = false
  walk(tree, (node) => {
    if (node.type !== "html") return
    if (node.value.startsWith('<figure class="essay-fig"')) figures.push(node)
    else if (node.value.includes("interactive:")) comments = true
  })
  if (!figures.length && !comments) return

  let src
  try {
    src = readFileSync(file.path, "utf8")
  } catch {
    return
  }
  const name = file.data.relativePath ?? file.path
  const live = checkMarkers(src, registry, (line) => `${name}:${line + 1}`)

  const locale = localeFor(file.data.i18n?.lang ?? file.data.frontmatter?.lang)
  if (locale === LOCALES.en) return
  for (const node of figures) {
    const n = Number(/ data-figure="(\d+)"/.exec(node.value)?.[1])
    const marker = live[n - 1]
    if (marker) node.value = renderFigure(marker, n, registry.get(marker.name), locale)
  }
}

export function EssayInteractivesTransformer() {
  return {
    name: "EssayInteractives",
    textTransform(_ctx, src) {
      return replaceMarkers(src, REGISTRY)
    },
    markdownPlugins() {
      return [() => (tree, file) => figuresPass(tree, file, REGISTRY)]
    },
  }
}

export default EssayInteractivesTransformer
