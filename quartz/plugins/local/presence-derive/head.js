import { h } from "preact"

/**
 * Tags added to every page head through additionalHead: the preload for the
 * Latin Source Serif 4 file that quartz/styles/custom/_site-tokens.scss
 * declares. English pages reach it through "Source Serif 4 Variable" and
 * Chinese pages through the restricted "Source Serif 4 Latin" family on the
 * same URL, so one preload serves both. Fonts are fetched in CORS mode, so the
 * preload needs crossorigin to be reused.
 */
const BODY_FONT_HREF = "/static/fonts/source-serif-4-latin-wght-normal.woff2"

export function additionalHead(_ctx) {
  return [
    h("link", {
      rel: "preload",
      href: BODY_FONT_HREF,
      as: "font",
      type: "font/woff2",
      crossorigin: "",
    }),
  ]
}
