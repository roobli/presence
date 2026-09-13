// SPA navigation morphs <body> and swaps <head>, but never touches <html>.
// Copy the page-lang marker that i18n-slug writes into every head, so the
// document language follows the page after each navigation.
document.addEventListener("nav", function () {
  var marker = document.head.querySelector('meta[name="page-lang"]')
  if (marker && marker.content) document.documentElement.lang = marker.content
})
