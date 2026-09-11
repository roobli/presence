# presence

RoobLi public homepage (`www.roobli.org`): curated **works** + deep **writing**.

Not a notes mirror. Private RooB notes stay private. Visual language inherits the Claude-like Typora tokens from the former `roob-note-site` experiment.

## Dev

Node `>= 22.12`.

```bash
npm ci
npm run dev
npm run build
```

Content: `src/content/writing`, `src/content/works`.

## Deploy (Cloudflare Pages via Actions)

Push `main` → [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys `dist` to Pages project **`presence`**.

Repo secrets (never commit):

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Pages Edit (+ DNS if binding domains) |
| `CLOUDFLARE_ACCOUNT_ID` | Account id |

Custom domains: `www.roobli.org` (and apex redirect). Do **not** keep `note.roobli.org` as a second public site.

## Related demos

Standalone project pages may stay on `*.github.io` (e.g. CUDA course). Link them from Works.
