# presence

RoobLi public presence — curated works and deep writing.

**One source of truth.** Deploy this repo to Cloudflare Pages. Do not mirror internal notes here.

## Stack

- Astro + TypeScript + Tailwind CSS v4 + MDX
- Content: `src/content/writing`, `src/content/works`
- Node `>= 22.12` (`engines` + `.node-version`)

## Local

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages (GitHub Actions)

Pushes to `main` run [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml): Node 22 → `npm ci` → `npm run build` → deploy `dist` with `cloudflare/wrangler-action` to project **`presence`**.

### One-time setup (Dylan)

1. **Create the Pages project once** (Direct Upload / wrangler), if it does not exist yet:

   ```bash
   npx wrangler pages project create presence --production-branch=main
   ```

   Or: Cloudflare Dashboard → Workers & Pages → Create → Pages → Direct Upload → name it `presence`.

2. **Create an API token** with **Account → Cloudflare Pages → Edit** (and Account Settings Read if prompted).

3. **Add two repository secrets** on `roobli/presence` → Settings → Secrets and variables → Actions:

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | the API token from step 2 |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (Workers & Pages overview / right sidebar) |

4. Push (or re-run the workflow). Deploy stays secret-dependent — do not commit credentials.

Custom domain is optional in the Pages project settings.

### Manual / dashboard reference

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` |
| Project name | `presence` |

## Conventions

- Internal notes (RooB) may inform topics; published text is written here, desensitized, and deep.
- `*.github.io` remains for standalone project demos (e.g. the CUDA course). This site links to them from Works.
- X / Reddit get excerpts of published pieces — not a second full text.
