#!/usr/bin/env node
/**
 * Start a post: write content/posts/<date>-<slug>.md dated now, with the local
 * offset, then open it in the editor.
 *
 *   npm run post                          content/posts/2026-09-30-2140.md
 *   npm run post -- warp-shuffle          content/posts/2026-09-30-warp-shuffle.md
 *   npm run post -- --zh --tag cuda --tag gpu --title "..." --link https://...
 *   npm run post -- --no-open             only write the file
 *
 * The editor is $VISUAL or $EDITOR; without either, Typora on macOS when it is
 * installed; otherwise the path is printed.
 */
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const postsDir = path.join(siteRoot, "content", "posts")

function parseArgs(argv) {
  const options = { zh: false, tags: [], title: null, link: null, open: true, slug: null }
  // The value after an option that takes one; another option is not a value.
  const valueOf = (i, name) => {
    const value = argv[i]
    if (value === undefined || value.startsWith("--")) throw new Error(`${name} needs a value`)
    return value
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--zh") options.zh = true
    else if (arg === "--no-open") options.open = false
    else if (arg === "--tag") options.tags.push(valueOf(++i, "--tag"))
    else if (arg === "--title") options.title = valueOf(++i, "--title")
    else if (arg === "--link") options.link = valueOf(++i, "--link")
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`)
    else options.slug = arg
  }
  if (options.link && !/^https?:\/\//i.test(options.link)) {
    throw new Error("--link needs an http(s) URL")
  }
  return options
}

const two = (n) => String(n).padStart(2, "0")

/** 2026-09-30T21:40-07:00: the author's clock and its offset from UTC. */
function localStamp(now) {
  const offset = -now.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const abs = Math.abs(offset)
  return (
    `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}` +
    `T${two(now.getHours())}:${two(now.getMinutes())}` +
    `${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`
  )
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// YAML needs quotes around a value with a colon, a hash or a leading quote.
const yamlString = (value) => JSON.stringify(value)

function frontmatter(options, stamp) {
  const lines = ["---", `date: ${stamp}`]
  if (options.title) lines.push(`title: ${yamlString(options.title)}`)
  if (options.zh) lines.push("lang: zh")
  if (options.tags.length > 0) lines.push(`tags: [${options.tags.map(yamlString).join(", ")}]`)
  if (options.link) lines.push(`link: ${yamlString(options.link)}`)
  lines.push("---", "", "")
  return lines.join("\n")
}

function openInEditor(file) {
  const editor = process.env.VISUAL || process.env.EDITOR
  if (editor) {
    // Through the shell so an editor with arguments ("code -w") works; the path
    // is quoted so a directory with spaces stays one argument.
    spawnSync(`${editor} ${JSON.stringify(file)}`, { stdio: "inherit", shell: true })
    return true
  }
  if (process.platform === "darwin") {
    const typora = spawnSync("open", ["-Ra", "Typora"], { stdio: "ignore" })
    if (typora.status === 0) {
      spawn("open", ["-a", "Typora", file], { stdio: "ignore", detached: true }).unref()
      return true
    }
  }
  return false
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const now = new Date()
  const stamp = localStamp(now)
  const day = stamp.slice(0, 10)
  const slug = slugify(options.slug ?? "")
  if (options.slug && !slug) {
    console.warn(`new-post: "${options.slug}" has no a-z or 0-9, so the file is named by the time`)
  }
  const name = slug || `${two(now.getHours())}${two(now.getMinutes())}`

  fs.mkdirSync(postsDir, { recursive: true })
  let file = path.join(postsDir, `${day}-${name}.md`)
  for (let n = 2; fs.existsSync(file); n += 1) {
    file = path.join(postsDir, `${day}-${name}-${n}.md`)
  }
  fs.writeFileSync(file, frontmatter(options, stamp))

  const relative = path.relative(siteRoot, file)
  console.log(relative)
  if (options.open && !openInEditor(file)) console.log("No editor found; open the file above.")
}

try {
  main()
} catch (error) {
  console.error(`new-post: ${error.message}`)
  process.exit(1)
}
