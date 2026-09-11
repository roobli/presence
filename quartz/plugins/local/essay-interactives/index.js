/**
 * Replace <!-- interactive:... --> markers early so OFM cannot strip them.
 * Mountable widgets get placeholder divs; hinge/none markers are removed.
 */

const WIDGET_MARKERS = {
  "spring-zeta": true,
  "squircle-compare": true,
  "zeta-triptych": true,
  "curvature-comb": true,
}

const STRIP_MARKERS = {
  none: true,
  "hinge-diagram": true,
}

const COMMENT_RE = /<!--\s*interactive:([a-z0-9-]+)\s*-->/gi

function replaceMarkers(src) {
  return src.replace(COMMENT_RE, (full, name) => {
    const key = String(name).toLowerCase()
    if (WIDGET_MARKERS[key]) {
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
