// Folders in the sidebar tree: open and close them, and keep the reader's
// choice in the explorer's own localStorage key ("fileTree", a list of
// { path, collapsed }), so state saved before the tree moved to the server
// still applies. The folders on the open page's path always stay open.
//
// The server renders each folder in its default state. restoreTree() applies
// the saved state: once from the inline copy right after the tree, before the
// first paint, and again on every navigation, after micromorph has swapped in
// the next page's tree.

var TREE_KEY = "fileTree"

function readTreeState() {
  try {
    var list = JSON.parse(localStorage.getItem(TREE_KEY) || "[]")
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function rememberFolder(path, collapsed) {
  if (!path) return
  var list = readTreeState()
  var found = false
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] && list[i].path === path) {
      list[i].collapsed = collapsed
      found = true
    }
  }
  if (!found) list.push({ path: path, collapsed: collapsed })
  try {
    localStorage.setItem(TREE_KEY, JSON.stringify(list))
  } catch (e) {
    /* private mode */
  }
}

function setFolderOpen(container, open) {
  var outer = container.nextElementSibling
  if (!outer || !outer.classList.contains("folder-outer")) return
  outer.classList.toggle("open", open)
  var button = container.querySelector(".folder-icon")
  if (button) button.setAttribute("aria-expanded", open ? "true" : "false")
}

function restoreTree() {
  var saved = {}
  var list = readTreeState()
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] && typeof list[i].path === "string")
      saved[list[i].path] = list[i].collapsed === true
  }
  var containers = document.querySelectorAll(".presence-tree .folder-container")
  for (var j = 0; j < containers.length; j += 1) {
    var container = containers[j]
    var path = container.getAttribute("data-folderpath")
    if (!Object.prototype.hasOwnProperty.call(saved, path)) continue
    if (container.classList.contains("is-on-path")) continue
    setFolderOpen(container, !saved[path])
  }
}

// Taken on the document: micromorph hands nodes to other server elements
// after a navigation, and a listener on a node would go along with it.
document.addEventListener("click", function (event) {
  var target = event.target
  var button = target && target.closest ? target.closest(".presence-tree .folder-icon") : null
  if (!button) return
  var container = button.closest(".folder-container")
  var outer = container ? container.nextElementSibling : null
  if (!outer || !outer.classList.contains("folder-outer")) return
  var open = !outer.classList.contains("open")
  setFolderOpen(container, open)
  rememberFolder(container.getAttribute("data-folderpath"), !open)
})

document.addEventListener("nav", restoreTree)
restoreTree()
