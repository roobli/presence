import { h } from "preact"

// Section spine for index rows: one segment per section, as wide as its share
// of the words, and a dot where each live figure sits. HTML rather than SVG,
// so the dots stay round at any row width. The strip's own length stands for
// reading time: 30 minutes fills the row, and it never drops below a fifth.
// Static on purpose; the meta line states the same facts in words.

const FULL_MINUTES = 30
const MIN_LENGTH = 0.2

const round = (value) => Number(value.toFixed(2))

export function spineLength(minutes) {
  return round(Math.min(1, Math.max(MIN_LENGTH, minutes / FULL_MINUTES)))
}

/**
 * The spine for a page's presence data (presence-derive), or null when the
 * page has fewer than 3 h2 sections.
 */
export function renderSpine(presence) {
  const sections = presence?.sections ?? []
  const words = presence?.words ?? 0
  if (sections.length < 3 || words <= 0) return null

  const segments = presence.intro ? [presence.intro, ...sections] : sections
  const bounds = []
  let end = 0
  for (const segment of segments) {
    end += segment.words
    bounds.push(end)
  }

  // Segments share the row minus the gaps between them, so a dot at a share of
  // the words sits at that share of (100% - gaps), plus one gap for each
  // segment before its own: calc(share * 100% + (k - share * (n - 1)) * gap).
  const dots = (presence.figureOffsets ?? []).map((offset) => {
    const share = Math.min(1, Math.max(0, offset / words))
    let index = bounds.findIndex((bound) => offset < bound)
    if (index < 0) index = segments.length - 1
    const shift = round(index - share * (segments.length - 1))
    return h("b", { style: `left:calc(${round(share * 100)}% + ${shift} * var(--spine-gap))` })
  })

  return h(
    "div",
    {
      class: "spine",
      "aria-hidden": "true",
      style: `--spine-len:${spineLength(presence.readingMinutes ?? 0)}`,
    },
    segments.map((segment) => h("i", { style: `flex-grow:${Math.max(1, segment.words)}` })),
    dots,
  )
}
