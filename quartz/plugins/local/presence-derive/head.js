import { h } from "preact"

/**
 * Tags added to every page head through additionalHead.
 *
 * The preload fetches the Latin Source Serif 4 file that
 * quartz/styles/custom/_site-tokens.scss declares. English pages reach it
 * through "Source Serif 4 Variable" and Chinese pages through the restricted
 * "Source Serif 4 Latin" family on the same URL, so one preload serves both.
 * Fonts are fetched in CORS mode, so the preload needs crossorigin to be reused.
 *
 * The italic face is registered by the inline script rather than the
 * stylesheet. Declared in CSS, it starts downloading during first layout on
 * every page with <em>, so an essay needed two fonts before first paint. The
 * script adds it after the load event, and only when an element on the page
 * renders italic in the text face. It loads the file before adding the face,
 * so emphasis changes once, from the synthesized oblique to the real italic,
 * without a fallback face in between. The face stays in document.fonts, so
 * later SPA navigations reuse it.
 */
export const BODY_FONT_HREF = "/static/fonts/source-serif-4-latin-wght-normal.woff2"
export const ITALIC_FONT_HREF = "/static/fonts/source-serif-4-latin-wght-italic.woff2"
// Copied from the package's wght-italic.css (latin subset).
export const ITALIC_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, " +
  "U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"

// Serialized into the page with toString, so it may only use its arguments and
// browser globals. The site stylesheets set no font-style: italic, so only the
// elements the UA stylesheet italicizes can need the face. Chinese pages set
// em upright and never match.
function registerItalicFace(href, unicodeRange) {
  let face
  const needed = () => {
    for (const el of document.querySelectorAll("em, i, cite, dfn, var, address")) {
      const style = getComputedStyle(el)
      if (style.fontStyle === "italic" && /^["']?Source Serif 4 Variable\b/.test(style.fontFamily)) {
        return true
      }
    }
    return false
  }
  const register = () => {
    if (face || document.readyState !== "complete" || !needed()) return
    face = new FontFace("Source Serif 4 Variable", `url("${href}") format("woff2")`, {
      style: "italic",
      weight: "200 900",
      display: "swap",
      unicodeRange,
    })
    face.load().then(
      (loaded) => document.fonts.add(loaded),
      () => {
        face = undefined
      },
    )
  }
  // The first nav fires before DOMContentLoaded and returns early; load covers that page.
  addEventListener("load", register, { once: true })
  document.addEventListener("nav", register)
}

export const italicFaceScript = `(${registerItalicFace})(${JSON.stringify(ITALIC_FONT_HREF)}, ${JSON.stringify(ITALIC_UNICODE_RANGE)})`

export function additionalHead(_ctx) {
  return [
    h("link", {
      rel: "preload",
      href: BODY_FONT_HREF,
      as: "font",
      type: "font/woff2",
      crossorigin: "",
    }),
    h("script", { dangerouslySetInnerHTML: { __html: italicFaceScript } }),
  ]
}
