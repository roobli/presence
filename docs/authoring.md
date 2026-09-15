# Writing for www.roobli.org

A new page needs only markdown. Type, colour, spacing, the column and every element's look come from shared tokens, so a page never carries its own CSS, inline styles or HTML wrappers.

## Where pages go

| Page | File | URL |
| --- | --- | --- |
| Essay | `content/writing/<slug>.md` | `/writing/<slug>` |
| Work | `content/works/<slug>.md` | `/works/<slug>` |
| About | `content/about.md` | `/about` |
| Homepage intro | `content/index.md` | `/` |

The homepage and the Writing and Works folder pages list essays and works on their own. Slugs are lowercase and hyphenated, and the slug is the URL.

## Frontmatter

An essay:

```yaml
---
title: Why command palettes won
description: One or two sentences. They are the subtitle under the title and the summary on the homepage.
date: 2026-09-11
updated: 2026-10-02            # optional; the header adds "Revised"
work: works/cuda-cpp-course    # optional; links the essay to a work page
order: 1                       # optional; lists sort by this number first
tags: [keyboard, ux]           # optional
---
```

A work:

```yaml
---
title: CUDA C++ Course
description: Fifteen lessons and four in-browser GPU labs.
date: 2026-09-11
live: https://lr00rl.github.io/cuda-cpp-course/
source: https://github.com/lr00rl/cuda-cpp-course
live_zh: https://lr00rl.github.io/cuda-cpp-course/zh/   # optional
image: works/cuda-cpp-course-home.webp                   # a 1280x800 screenshot stored under content/
image_alt: CUDA C++ Course home page
---
```

`draft: true` keeps a page out of the build. `unlisted: true` builds it but keeps it out of the lists, search and the sidebar.

Reading time, the live figure count, the section spine on the homepage and the English and 中文 links are derived. Do not write them by hand.

## Structure

- The page title comes from `title`, so the body does not start with `# Title`.
- Sections start with `##` and subsections with `###`. An essay's spine on the homepage is drawn from its `##` sections, with an intro segment when 50 or more words come before the first `##`.
- A blank line starts a new paragraph. A single line break inside a paragraph does not break the line.

## Chinese translations

Put the translation next to the original with `.zh` before `.md`: `content/writing/<slug>.zh.md` publishes at `/writing/<slug>/zh`. The two pages link each other on their meta lines, and switching keeps the reader's place when both versions have the same `##` and `###` headings.

Translate `title` and `description`, keep `date`, and leave out `lang` and `alt`, which are set for you. Translations stay out of the lists and search.

In Chinese text, type a space between Chinese and Latin words or numbers; the site does not add one. `*emphasis*` on a Chinese page shows emphasis dots rather than italics.

## Markdown the site styles

- Emphasis, strong, links, inline code and ~~strikethrough~~.
- Internal links: `[[writing/other-essay]]` or `[[writing/other-essay|label]]`.
- Lists, nested lists and task lists (`- [ ] item`, shown as read-only boxes).
- Blockquotes, and callouts: `> [!note] Title` followed by `> text` lines. Types with their own colour: note, tip, success, important, question, abstract, example, warning, caution, danger, failure, bug and quote.
- Tables. A table wider than the column scrolls inside its frame.
- Code blocks with a language after the opening fence, for example ` ```ts `.
- Footnotes: `text[^1]` in the prose and `[^1]: the note` at the end.
- Images: `![alt text](works/picture.webp)` on a line of its own is centred and shown at its own size, never enlarged. Store the file under `content/`.
- Math: `$x^2$` inline. Display math needs `$$` on its own line before and after the equation:

  ```
  $$
  E = mc^2
  $$
  ```

- Mermaid diagrams in a ` ```mermaid ` block. Labels stay at 12px or more, and a diagram wider than the column scrolls sideways.
- A horizontal rule: `---` on its own line, with blank lines around it.

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

- Font roles, type sizes, line heights and spacing: `quartz/styles/custom/_site-tokens.scss`
- Colours: `quartz/styles/claude-like-tokens.scss`, generated from the Typora Claude-Like theme with `node tools/sync-theme-tokens.mjs`
- The column and the three text widths: `quartz/styles/custom/_shell.scss`
- Headings, lists, quotes, tables, code and math: the matching partial in `quartz/styles/custom/`
