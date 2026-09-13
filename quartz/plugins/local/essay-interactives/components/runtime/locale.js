/**
 * Shell strings, and the language rule the shell and every widget share: the
 * closest [lang] ancestor of the figure, else body.lang, else English. Any value
 * starting with "zh" selects the zh-Hans table.
 */

var SHELL_STRINGS = {
  en: { reset: "Reset", resetDone: "Reset" },
  "zh-Hans": { reset: "重置", resetDone: "已重置" },
}

function figureLang(node) {
  var host = node && node.closest ? node.closest("[lang]") : null
  var value = (host && host.getAttribute("lang")) || (document.body && document.body.lang) || "en"
  return /^zh/i.test(value) ? "zh-Hans" : "en"
}

function pickStrings(table, lang) {
  if (!table) return {}
  if (lang === "zh-Hans") return table["zh-Hans"] || table.zh || table.en || {}
  return table.en || {}
}
