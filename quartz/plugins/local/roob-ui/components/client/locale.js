// Chrome strings. A module that localizes adds its own table under a
// namespace, STRINGS.<ns> = { en: {...}, "zh-Hans": {...} }, and reads it
// through t(ns, key, vars). The language comes from body lang, which the SPA
// router morphs with the page, so it is right on the first frame after a
// navigation. No module has moved its strings here yet.
var STRINGS = {}

/** "zh-Hans" for any Chinese page, "en" for everything else. */
function pageLocale() {
  var lang = (document.body && document.body.lang) || ""
  return /^zh(-|$)/i.test(lang) ? "zh-Hans" : "en"
}

/** The string in the page's language, else the English one, else the key.
 *  {name} placeholders take their values from vars. */
function t(ns, key, vars) {
  var table = STRINGS[ns] || {}
  var local = table[pageLocale()] || {}
  var text = local[key]
  if (typeof text !== "string") text = table.en ? table.en[key] : undefined
  if (typeof text !== "string") text = key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, function (match, name) {
    return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  })
}
