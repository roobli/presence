import { readdirSync } from "fs"

/**
 * Replace <!-- interactive:NAME --> markers in the raw markdown text, before
 * remark parses it, so each placeholder div reaches the parser as a raw HTML
 * block. OFM does not remove HTML comments (it strips only %% comments).
 * Widget markers become placeholder divs that components/index.js mounts;
 * hinge/none markers are removed; unknown names stay as comments.
 */

// Marker names are the widget file names in components/widgets.
const WIDGET_MARKERS = new Set(
  readdirSync(new URL("./components/widgets/", import.meta.url))
    .filter((name) => name.endsWith(".js"))
    .map((name) => name.slice(0, -".js".length)),
)

const STRIP_MARKERS = {
  none: true,
  "hinge-diagram": true,
}

const COMMENT_RE = /<!--\s*interactive:([a-z0-9-]+)\s*-->/gi

function replaceMarkers(src) {
  return src.replace(COMMENT_RE, (full, name) => {
    const key = String(name).toLowerCase()
    if (WIDGET_MARKERS.has(key)) {
      return `<div class="essay-interactive" data-interactive="${key}"></div>\n`
    }
    if (STRIP_MARKERS[key]) {
      return ""
    }
    return full
  })
}

export function EssayInteractivesTransformer() {
  return {
    name: "EssayInteractives",
    textTransform(_ctx, src) {
      return replaceMarkers(src)
    },
  }
}

export default EssayInteractivesTransformer
