// Runs last. Every module before it has set up its state, so the first
// refresh can reach all of it.

// Remeasure whenever the column's room may have changed: a window resize,
// or, on localhost only, a restamped stylesheet finishing its load.
var resizeTimer = 0
function scheduleRelayout() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(function () {
    // The panel's ceiling follows the window, so its width is refitted,
    // except while a drag owns it.
    if (!drag) restoreSidebarPrefs()
    applyLayout()
    var explorer = document.querySelector(".sidebar.left .explorer")
    if (explorer) {
      scheduleGuides(explorer)
      scheduleTitles(explorer)
    }
  }, 80)
}
window.addEventListener("resize", scheduleRelayout)
document.addEventListener("tpl-styles-loaded", scheduleRelayout)

function refresh() {
  restoreSidebarPrefs()
  decorateSidenotes()
  mountWidthButton()
  refreshNav()
  refreshMobile()
  refreshOutline()
  refreshProgress()
  applyLayout()
}

document.addEventListener("nav", refresh)
refresh()
