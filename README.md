# presence

RoobLi public site — **www.roobli.org**.

Quartz 5 fork with the Typora Claude-Like visual system (ported from `roob-note-site`). It builds the site: essays, series, projects, notes and posts.

## Run

```bash
npm ci
npx quartz build --serve --port 8080
```

Content lives in `content/` as plain files in this repo.

How to write a page, from frontmatter and translations to math, diagrams and live figures: [docs/authoring.md](docs/authoring.md).

## Deploy

Cloudflare Pages project **`presence`**, via GitHub Actions on `main`:

1. `npm ci`
2. `npx quartz build` → output `public/`
3. `wrangler pages deploy public --project-name=presence --branch=main`

Secrets (repo Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Never commit tokens.

## Customize

| What | Where |
| --- | --- |
| Fonts, type scale, spacing | `quartz/styles/custom/_site-tokens.scss` |
| Plugins | `quartz.config.yaml` |
| Layout / chrome CSS | `quartz/styles/custom/_*.scss`, listed in cascade order by `quartz/styles/custom.scss` |
| Sidebar, TOC disk, width shortcuts | `quartz/plugins/local/roob-ui/` |
| Theme tokens (generated) | `quartz/styles/claude-like-tokens.scss` + `node tools/sync-theme-tokens.mjs` |

## History

The site started as `roobli/roob-note-site` at `note.roobli.org`. This repo kept its framework and serves the pages at `www.roobli.org`.

## Brand assets

- `quartz/static/icon.png`: favicon and mark, a 256px PNG
- `quartz/static/og-image.jpg`: default Open Graph / Twitter `summary_large_image`, 1280x720
- `quartz/static/apple-touch-icon.png`: home-screen icon, 180px

Export them as plain web images. Everything in `quartz/static/` is published as is.

After changing these, push `main` so CF Pages redeploys; then re-scrape cards (X Card Validator / opengraph.xyz) if a URL was cached.
