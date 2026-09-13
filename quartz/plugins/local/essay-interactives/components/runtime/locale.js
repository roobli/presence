/**
 * Shell strings, and the language rule the shell and every widget share. fig.lang
 * comes from, in order: a lang attribute on the figure, the closest [lang]
 * ancestor, document.body.lang, document.documentElement.lang, then English.
 * body carries the page language from the server on every page, so the rule
 * holds on the first mount after SPA navigation, before anything updates the
 * html element. Any value starting with "zh" selects the zh-Hans table.
 */

var SHELL_STRINGS = {
  en: { reset: "Reset", resetDone: "Reset" },
  "zh-Hans": { reset: "重置", resetDone: "已重置" },
}

function figureLang(node) {
  var value = (node && node.getAttribute && node.getAttribute("lang")) || ""
  if (!value && node && node.parentElement) {
    var host = node.parentElement.closest('[lang]:not([lang=""])')
    if (host) value = host.getAttribute("lang") || ""
  }
  if (!value && document.body) value = document.body.lang || ""
  if (!value && document.documentElement) value = document.documentElement.lang || ""
  return /^zh/i.test(value) ? "zh-Hans" : "en"
}

function pickStrings(table, lang) {
  if (!table) return {}
  if (lang === "zh-Hans") return table["zh-Hans"] || table.zh || table.en || {}
  return table.en || {}
}
