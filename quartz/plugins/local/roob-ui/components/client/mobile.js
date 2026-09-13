// The narrow-screen nav: on one column the panel folds into a dropdown under
// the header bar. The toggle's click is one of the sidebar controls in nav.js,
// and the bar's height for anchor jumps is measured in applyLayout (width.js).

function setNavOpen(sidebar, open) {
  if (!sidebar) return
  sidebar.classList.toggle("tpl-nav-open", open)
  var toggle = document.getElementById("tpl-nav-toggle")
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false")
  // The dropdown is short-lived, so it opens at the top rather than
  // wherever the panel was left scrolled on the last desktop visit.
  if (open && sidebar.__tplBody) sidebar.__tplBody.scrollTop = 0
}

/** Close the narrow-screen dropdown; true when there was one to close. */
function closeNav() {
  var sidebar = document.querySelector(".sidebar.left.tpl-nav-open")
  if (!sidebar) return false
  var body = sidebar.__tplBody
  var hadFocus = !!(body && body.contains(document.activeElement))
  setNavOpen(sidebar, false)
  var toggle = document.getElementById("tpl-nav-toggle")
  if (hadFocus && toggle) toggle.focus()
  return true
}
