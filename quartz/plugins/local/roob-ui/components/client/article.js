// Inside the article: sidenote numbers and the copy button's confirmation,
// after the editor's sidenote and fence-enhance plugins.

// --- sidenotes (plugins/sidenote) ---------------------------------------
// The vault stores them as a bare <span class="sidenote">. Number them and
// give each one an in-text marker, the way the editor plugin does.
function decorateSidenotes() {
  var notes = document.querySelectorAll("article .sidenote")
  for (var i = 0; i < notes.length; i += 1) {
    var note = notes[i]
    var index = String(i + 1)
    note.setAttribute("data-tpl-sn-index", index)
    var marker = note.previousElementSibling
    if (!marker || !marker.classList.contains("tpl-sn-num")) {
      marker = document.createElement("span")
      marker.className = "tpl-sn-num"
      if (note.parentNode) note.parentNode.insertBefore(marker, note)
    }
    marker.setAttribute("data-tpl-sn-index", index)
  }
}

// --- copy button (plugins/fence-enhance) ---------------------------------
// The syntax-highlighting plugin owns the copy itself and re-creates the
// button on every render, so the confirmation state is delegated.
document.addEventListener("click", function (event) {
  var target = event.target
  if (!target || !target.closest) return
  var button = target.closest("pre > .clipboard-button")
  if (!button) return
  button.classList.add("tpl-copied")
  window.setTimeout(function () {
    button.classList.remove("tpl-copied")
  }, 1500)
})
