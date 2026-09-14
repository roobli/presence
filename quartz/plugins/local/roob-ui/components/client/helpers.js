// Shared by the roob-ui client modules. components/index.js concatenates them
// into one function scope, so everything here is a plain declaration.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

var SVG_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'

var ICONS = {
  folder:
    SVG_OPEN +
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
  panel:
    SVG_OPEN +
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>',
  search: SVG_OPEN + '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.2-4.2"/></svg>',
  target:
    SVG_OPEN +
    '<circle cx="12" cy="12" r="5.2"/>' +
    '<path d="M12 3v3.3M12 17.7V21M3 12h3.3M17.7 12H21"/></svg>',
  fold: SVG_OPEN + '<path d="m6 13.6 6-6 6 6"/><path d="M5.2 18.4h13.6"/></svg>',
  help:
    SVG_OPEN +
    '<circle cx="12" cy="12" r="8.6"/>' +
    '<path d="M9.9 9.7a2.2 2.2 0 1 1 2.9 2.1c-.5.2-.8.7-.8 1.2v.5"/>' +
    '<path d="M12 16.8h.01"/></svg>',
  close: SVG_OPEN + '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/></svg>',
  sun:
    SVG_OPEN +
    '<circle cx="12" cy="12" r="4.1"/>' +
    '<path d="M12 2.6v2.3M12 19.1v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6' +
    'M2.6 12h2.3M19.1 12h2.3M4.4 19.6l1.6-1.6M18 6l1.6-1.6"/></svg>',
  moon: SVG_OPEN + '<path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a8.6 8.6 0 1 0 10.7 10.7z"/></svg>',
  book:
    SVG_OPEN +
    '<path d="M3.8 5.6A1.6 1.6 0 0 1 5.4 4H10a2.4 2.4 0 0 1 2 1.1A2.4 2.4 0 0 1 14 4h4.6' +
    'a1.6 1.6 0 0 1 1.6 1.6v11.8a1.6 1.6 0 0 1-1.6 1.6H14a2.4 2.4 0 0 0-2 1.1' +
    'a2.4 2.4 0 0 0-2-1.1H5.4a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M12 5.1v14.9"/></svg>',
}

function readJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key)
    if (!raw) return fallback
    var parsed = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch (e) {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    /* private mode */
  }
}

function el(tag, className, text) {
  var node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function icon(name, className) {
  var span = el("span", "tpl-nav-icon" + (className ? " " + className : ""))
  span.innerHTML = ICONS[name] || ""
  return span
}
