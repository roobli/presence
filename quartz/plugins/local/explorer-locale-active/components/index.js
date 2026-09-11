/**
 * When the current page is a trailing-locale translation (`…/zh`), map explorer
 * active state onto the primary sibling note (`…`) so the sidebar still lights up.
 */

function explorerLocaleActive() {
  function stripLocale(slug) {
    if (!slug) return ""
    var s = String(slug).replace(/^\/+/, "").replace(/\/+$/, "")
    if (s.endsWith("/zh")) return s.slice(0, -3).replace(/\/+$/, "")
    return s
  }

  function hrefToSlug(href) {
    if (!href) return ""
    try {
      var u = new URL(href, window.location.origin)
      var path = u.pathname.replace(/^\/+/, "").replace(/\/+$/, "")
      if (path.endsWith(".html")) path = path.slice(0, -5)
      return path
    } catch (e) {
      return String(href).replace(/^\/+/, "").replace(/\/+$/, "")
    }
  }

  function currentSlug() {
    var fromBody = document.body && document.body.dataset ? document.body.dataset.slug : ""
    if (fromBody) return String(fromBody).replace(/^\/+/, "")
    return window.location.pathname.replace(/^\/+/, "").replace(/\/+$/, "")
  }

  function applyActive() {
    var primary = stripLocale(currentSlug())
    if (!primary) return
    var links = document.querySelectorAll(".explorer-content a.nav-file-title")
    if (!links.length) return
    for (var i = 0; i < links.length; i++) {
      var a = links[i]
      var slug = stripLocale(hrefToSlug(a.getAttribute("href")))
      var match = slug === primary
      a.classList.toggle("active", match)
      a.classList.toggle("is-active", match)
    }
  }

  function schedule() {
    applyActive()
    var ul = document.querySelector(".explorer-ul")
    if (!ul) return
    var mo = new MutationObserver(function () {
      applyActive()
    })
    mo.observe(ul, { childList: true, subtree: true })
    window.setTimeout(function () {
      mo.disconnect()
      applyActive()
    }, 2500)
  }

  document.addEventListener("nav", schedule)
  document.addEventListener("render", schedule)
  schedule()
}

const script = "(" + explorerLocaleActive.toString() + ")()"

const ExplorerLocaleActive = () => {
  const Component = () => null
  Component.afterDOMLoaded = script
  return Component
}

export { ExplorerLocaleActive }
