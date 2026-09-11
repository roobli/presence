#!/usr/bin/env node
/**
 * Pull the design tokens out of the Typora theme and emit them as SCSS.
 *
 * Typora is the reference implementation of this look; the website follows it.
 * Rather than re-typing the palette here (which drifts the moment the theme is
 * edited), this reads the theme's own `:root` blocks and writes them into
 * quartz/styles/claude-like-tokens.scss. Re-run it after changing the theme.
 *
 *   node tools/sync-theme-tokens.mjs [path-to-theme-repo]
 *
 * Default theme location: ../Typora_Claude-Like_Theme, or $CLAUDE_LIKE_THEME_DIR.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const themeDir = path.resolve(
  process.argv[2] ??
    process.env.CLAUDE_LIKE_THEME_DIR ??
    path.join(siteRoot, "..", "Typora_Claude-Like_Theme"),
)
const outFile = path.join(siteRoot, "quartz", "styles", "claude-like-tokens.scss")

/** Everything between the first `:root {` and its matching `}`. */
function readRootBlock(file) {
  const css = fs.readFileSync(file, "utf-8")
  const start = css.indexOf(":root")
  if (start === -1) throw new Error(`no :root block in ${file}`)
  const open = css.indexOf("{", start)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1
    else if (css[i] === "}") {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error(`unterminated :root block in ${file}`)
}

/**
 * Split a declaration block into `--name: value` pairs, keeping the comments
 * that introduce each group so the generated file reads like the theme does.
 * Values may contain `;` inside url(...) or quotes, so this tracks nesting.
 */
function parseDeclarations(block) {
  const out = []
  let buf = ""
  let depth = 0
  let quote = null
  for (let i = 0; i < block.length; i += 1) {
    const ch = block[i]
    // Comments are copied through verbatim: a `;` inside one is prose, not a
    // declaration boundary, and the theme has several that contain one.
    if (!quote && ch === "/" && block[i + 1] === "*") {
      const close = block.indexOf("*/", i + 2)
      const end = close === -1 ? block.length : close + 2
      buf += block.slice(i, end)
      i = end - 1
      continue
    }
    if (quote) {
      buf += ch
      if (ch === quote && block[i - 1] !== "\\") quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      buf += ch
      continue
    }
    if (ch === "(") depth += 1
    if (ch === ")") depth -= 1
    if (ch === ";" && depth === 0) {
      out.push(buf)
      buf = ""
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf)

  return out
    .map((raw) => {
      const comments = [...raw.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1].trim())
      const text = raw.replace(/\/\*[\s\S]*?\*\//g, "").trim()
      if (!text.startsWith("--")) return null
      const colon = text.indexOf(":")
      if (colon === -1) return null
      return {
        name: text.slice(0, colon).trim(),
        value: text.slice(colon + 1).trim().replace(/\s+/g, " "),
        comments,
      }
    })
    .filter(Boolean)
}

function emit(decls, indent = "  ") {
  return decls
    .map((d) => {
      const lead = d.comments.map((c) => `${indent}// ${c}\n`).join("")
      return `${lead}${indent}${d.name}: ${d.value};`
    })
    .join("\n")
}

const light = parseDeclarations(readRootBlock(path.join(themeDir, "claude-like.css")))
const dark = parseDeclarations(readRootBlock(path.join(themeDir, "claude-like-dark.css")))

if (light.length === 0 || dark.length === 0) {
  throw new Error("extracted no tokens; theme file layout changed?")
}

// Quartz's own stylesheets are written against these nine names. Pointing them
// at the theme tokens makes every built-in rule inherit the Typora palette
// without patching Quartz itself.
const quartzAliases = `
  // Quartz's built-in palette, re-pointed at the theme tokens above.
  --light: var(--canvas-color);
  --lightgray: var(--line-color);
  --gray: var(--ink-muted-color);
  --darkgray: var(--ink-color);
  --dark: var(--ink-strong-color);
  --secondary: var(--accent-color);
  --tertiary: var(--accent-hover-color);
  --highlight: var(--item-hover-bg-color);

  // Quartz's font slots, re-pointed at the theme's stacks.
  --bodyFont: var(--font-body);
  --headerFont: var(--font-body);
  --titleFont: var(--font-ui);
  --codeFont: var(--font-mono);`

const header = `// GENERATED FILE - do not edit by hand.
//
// Design tokens lifted verbatim from the Typora theme so the website and the
// editor cannot drift apart. Regenerate with:
//
//   node tools/sync-theme-tokens.mjs
//
// Source: ${path.relative(siteRoot, themeDir)}/claude-like{,-dark}.css
`

const out = `${header}
:root {
${emit(light)}
${quartzAliases}

  // Site-only: no Typora equivalent, since Typora has no <mark> of its own.
  --text-highlight-color: #ffe9a8;
}

[saved-theme="dark"] {
${emit(dark)}
${quartzAliases}

  --text-highlight-color: #5a4a0088;
}
`

fs.writeFileSync(outFile, out)
console.log(
  `wrote ${path.relative(siteRoot, outFile)}: ${light.length} light / ${dark.length} dark tokens`,
)

// The shiki themes live in quartz.config.yaml, which this script does not
// rewrite, so check that the colours in there still match the tokens above.
// Without this the code in a fence would quietly drift from the editor's.
const SHIKI_CHECKS = [
  ["--code-text-color", "fg"],
  ["--code-muted-color", "comment"],
  ["--code-string-color", "string"],
  ["--code-number-color", "number"],
  ["--code-keyword-color", "keyword"],
  ["--code-symbol-color", "symbol"],
]

function tokenValue(decls, name) {
  const found = decls.find((d) => d.name === name)
  return found ? found.value.toLowerCase() : null
}

const configPath = path.join(siteRoot, "quartz.config.yaml")
if (fs.existsSync(configPath)) {
  const configText = fs.readFileSync(configPath, "utf-8").toLowerCase()
  const missing = []
  for (const [decls, mode] of [
    [light, "light"],
    [dark, "dark"],
  ]) {
    for (const [token, role] of SHIKI_CHECKS) {
      const value = tokenValue(decls, token)
      if (value && !configText.includes(value)) missing.push(`${mode} ${role} ${token}=${value}`)
    }
  }
  if (missing.length > 0) {
    console.warn(
      `\nquartz.config.yaml's shiki themes are out of step with the theme tokens:`,
    )
    for (const line of missing) console.warn(`  ${line}`)
    console.warn(`Update the syntax-highlighting plugin's theme settings to match.`)
    process.exitCode = 1
  } else {
    console.log("quartz.config.yaml shiki colours match the theme tokens")
  }
}
