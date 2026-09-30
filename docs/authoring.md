# Writing for www.roobli.org

A new page needs only markdown. Type, colour, spacing, the column and every element's look come from shared tokens, so a page never carries its own CSS, inline styles or HTML wrappers.

## Where pages go

| Page | File | URL |
| --- | --- | --- |
| Essay | `content/essays/<slug>.md` | `/essays/<slug>` |
| Series | `content/series/<series>/index.md` | `/series/<series>/` |
| Episode | `content/series/<series>/<slug>.md` | `/series/<series>/<slug>` |
| Project | `content/projects/<slug>.md` | `/projects/<slug>` |
| Note | `content/notes/<slug>.md` | `/notes/<slug>` |
| Post | `content/posts/<date>-<slug>.md` | `/posts/<date>-<slug>` |
| About | `content/about.md` | `/about` |
| Homepage intro | `content/index.md` | `/` |

The homepage, the sidebar and each section's page list entries on their own; a section appears once it has an entry. Slugs are lowercase and hyphenated, and the slug is the URL. Sections are defined in `quartz/plugins/local/presence-shared/sections.js`.

Essays used to live under `/writing/` and projects under `/works/`. Every old URL still redirects to the new one; a section renamed later keeps its old name in `formerly` in `sections.js`, and the redirects follow from that. The same goes for `aliases:` in a page's frontmatter. Cloudflare Pages answers each old URL with a 301 from the generated `_redirects`, and the build also writes an HTML redirect page there for any other host.

## Frontmatter

An essay:

```yaml
---
title: Why command palettes won
description: One or two sentences. They are the subtitle under the title and the summary on the homepage.
date: 2026-09-11
updated: 2026-10-02                 # optional; the header adds "Revised"
project: projects/cuda-cpp-course   # optional; the essay shows under the project and in its log
order: 1                            # optional; lists sort by this number first
tags: [keyboard, ux]                # optional
claims:                             # optional; the homepage card and the margin of the open essay
  - figure: "54%"
    text: "of 2024 global software spend landed in the U.S."
  - quote: "Harsh can be faked. Precise can't."
---
```

A series is a folder. Its `index.md` describes it, and every other page in the folder is an episode:

```yaml
---
title: Kernels from zero
description: Writing CUDA kernels one idea at a time.
status: in-progress                 # in-progress, complete or paused; planned episodes imply in-progress
cadence: Weekly                     # optional
project: projects/cuda-cpp-course   # optional; every episode shows under the project
start: essays/cuda-course-without-a-gpu   # optional; "Start here" on the series page
planned:                            # optional; shown in grey on the track and in the sidebar
  - Warp shuffles
  - Measuring it for real, with Nsight
---
```

An episode is written like an essay, plus `part: 2` for its place in the series. Episodes are read in `part` order, whatever their dates.

A project:

```yaml
---
title: CUDA C++ Course
description: Fifteen lessons and four in-browser GPU labs.
date: 2026-09-11                    # when it started
status: live                        # live, building or archived
live: https://lr00rl.github.io/cuda-cpp-course/
source: https://github.com/lr00rl/cuda-cpp-course
live_zh: https://lr00rl.github.io/cuda-cpp-course/zh/   # optional
image: projects/cuda-cpp-course-home.webp               # a 1280x800 screenshot stored under content/
image_alt: CUDA C++ Course home page
figures:                            # optional; large numbers under the title
  - label: Lessons
    value: 15
log:                                # optional; the project's own entries in its log
  - date: 2026-09-11
    kind: launch                    # launch or update
    text: Fifteen lessons and four browser labs go live.
---
```

A project's log also gathers, on its own, every essay, episode and note whose `project` is the project, and the start of each of its series.

A note is short and dated: `title`, `description` and `date`, like an essay without the claims. Notes are listed by month.

A post is a small dated thing: something noticed, a link worth keeping, a step on a project. `npm run post` writes `content/posts/<date>-1.md` dated today (then `-2`, `-3` for more that day) and opens it in `$EDITOR` (or Typora); `npm run post -- warp-shuffle` names it `<date>-warp-shuffle.md`, and `--zh`, `--tag <tag>`, `--title "<title>"`, `--link <url>` and `--no-open` fill in the rest. By hand:

```yaml
---
date: 2026-09-30                    # required; the day only
title: Optional                     # without one, the first sentence titles the page
lang: zh                            # for a post written in Chinese; no translation needed
tags: [cuda]                        # optional
link: https://example.com/a         # optional; a link post shows it above the text
link_title: The page it points at   # optional
project: projects/cuda-cpp-course   # optional; the post goes into the project's log
---
```

A post is dated by day. A time written into `date` by hand is cut back to the day at build, with a warning. Posts of one day are listed by file name, the higher number (or later name) first.

Posts are read as one timeline at `/posts/`: by month, each day written once in the margin, every post in full, and a post over a minute of reading folded to its first paragraph with Continue. Posts stay off the homepage and the main feed; they have their own feed at `/posts/index.xml`. Keep them to paragraphs, lists, quotes, links, images and code: headings and footnotes stay on the post's own page. A post that grows into something worth finding by title becomes a note: move the file to `content/notes/` and add the post's old path to `aliases`.

`draft: true` keeps a page out of the build. `unlisted: true` builds it but keeps it out of the lists, search and the sidebar.

Reading time, the live figure count, the section spine, essay and episode numbers, a series' progress and the English and 中文 links are derived. Do not write them by hand.

## Structure

- The page title comes from `title`, so the body does not start with `# Title`.
- Sections start with `##` and subsections with `###`. An essay's spine on the homepage is drawn from its `##` sections, with an intro segment when 50 or more words come before the first `##`.
- A blank line starts a new paragraph. A single line break inside a paragraph does not break the line.

## Chinese translations

Put the translation next to the original with `.zh` before `.md`: `content/essays/<slug>.zh.md` publishes at `/essays/<slug>/zh`. The two pages link each other on their meta lines, and switching keeps the reader's place when both versions have the same `##` and `###` headings.

Translate `title` and `description`, keep `date`, and leave out `lang` and `alt`, which are set for you. Translations stay out of the lists and search.

In Chinese text, type a space between Chinese and Latin words or numbers; the site does not add one. `*emphasis*` on a Chinese page shows emphasis dots rather than italics.

## Markdown the site styles

- Emphasis, strong, links, inline code and ~~strikethrough~~.
- Internal links: `[[essays/other-essay]]` or `[[essays/other-essay|label]]`.
- Lists, nested lists and task lists (`- [ ] item`, shown as read-only boxes).
- Blockquotes, and callouts: `> [!note] Title` followed by `> text` lines. Types with their own colour: note, tip, success, important, question, abstract, example, warning, caution, danger, failure, bug and quote.
- Tables. A table wider than the column scrolls inside its frame.
- Code blocks with a language after the opening fence, for example ` ```ts `.
- Footnotes: `text[^1]` in the prose and `[^1]: the note` at the end.
- Images: `![alt text](projects/picture.webp)` on a line of its own is centred and shown at its own size, never enlarged. Store the file under `content/`.
- Math: `$x^2$` inline. Display math needs `$$` on its own line before and after the equation:

  ```
  $$
  E = mc^2
  $$
  ```

- Mermaid diagrams in a ` ```mermaid ` block. A diagram scales to fit the column. When that makes its labels smaller than 12px, it shows a Full size tab, and a tap or click opens it full screen, fitted when it stays legible and panning when it does not.
- A horizontal rule: `---` on its own line, with blank lines around it.
- A contents block: `[TOC]` alone on a line, outside quotes, callouts and lists, lists the page's `#` to `###` headings as links, as in Typora. It needs at least two such headings; with fewer, or with `enableToc: false` in the frontmatter, the marker is dropped.

## Interactive figures

A live figure is one HTML comment on its own line:

```
<!-- interactive:spring-throw title="Throw the card, catch it, let it go" caption="the moment of letting go." alt="What the figure shows, for readers who cannot see it." model="k = 320" -->
```

The name must match a widget: a registry entry in `quartz/plugins/local/essay-interactives/widgets/<name>.json` and a script in `quartz/plugins/local/essay-interactives/components/widgets/<name>.js`. The caption follows the "Look for" label, `alt` is required for screen readers, and `title` and `model` are optional. On a `.zh.md` page, write the attributes in Chinese; the controls switch language on their own. A new widget is code work rather than writing.

## Preview and publish

```bash
npm ci
npx quartz build --serve --port 8080
```

Open the preview through the machine's network address (for example `http://192.168.31.143:8080`) rather than `localhost`: on localhost a development script reloads the stylesheet, which can shift the layout while you look. `npm test` runs the plugin tests.

Publishing is a push to `main`: GitHub Actions builds the site and deploys it to Cloudflare Pages. A build rewrites `public/favicon.ico`; restore it with `git checkout -- public/favicon.ico` instead of committing it.

## Where the look comes from

Writing never needs these. When something looks wrong on every page, fix it here rather than in a page:

- Font roles, type sizes, line heights, prose rhythm and spacing: `quartz/styles/custom/_site-tokens.scss`. These follow the Typora Claude-Like theme's ratios (headings at 1.84, 1.48 and 1.24 times the base, line height 1.58) on a 17px base, with Source Serif 4 for Latin letters and the theme's Songti SC for Chinese. Every font size and the space around blocks and headings is a multiple of `--size-base`, so changing that one value rescales the text and its rhythm, and the `-zh` tokens tune Chinese pages on their own.
- Colours: `quartz/styles/claude-like-tokens.scss`, generated from the Typora Claude-Like theme with `node tools/sync-theme-tokens.mjs`
- The column and the three text widths: `quartz/styles/custom/_shell.scss`
- Headings, lists, quotes, tables, code and math: the matching partial in `quartz/styles/custom/`
