# presence

RoobLi public site — **www.roobli.org**.

Quartz 5 fork with the Typora Claude-Like visual system (ported from `roob-note-site`). This is the org homepage and writing/works surface — **not** a RooB notes mirror.

## Run

```bash
npm ci
npx quartz build --serve --port 8080
```

Content lives in `content/` inside this repo (curated, public). Do not symlink RooB here.

## Deploy

Cloudflare Pages project **`presence`**, via GitHub Actions on `main`:

1. `npm ci`
2. `npx quartz build` → output `public/`
3. `wrangler pages deploy public --project-name=presence --branch=main`

Secrets (repo Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Never commit tokens.

## Customize

| What | Where |
| --- | --- |
| Fonts, colors, plugins | `quartz.config.yaml` |
| Layout / chrome CSS | `quartz/styles/custom/_*.scss`, listed in cascade order by `quartz/styles/custom.scss` |
| Sidebar, TOC disk, width shortcuts | `quartz/plugins/local/roob-ui/` |
| Theme tokens (generated) | `quartz/styles/claude-like-tokens.scss` + `node tools/sync-theme-tokens.mjs` |

## History

Former experiment: `roobli/roob-note-site` at `note.roobli.org` (notes export pipeline). Decision: notes stay private; this repo keeps the **framework and craft**, hosts curated public pages, domain is `www.roobli.org`.

## Brand assets

- `quartz/static/icon.png` — favicon / mark (not Quartz default)
- `quartz/static/og-image.png` — default Open Graph / Twitter `summary_large_image`
- `quartz/static/apple-touch-icon.png` — home-screen icon

After changing these, push `main` so CF Pages redeploys; then re-scrape cards (X Card Validator / opengraph.xyz) if a URL was cached.
