# presence

RoobLi public presence — curated works and deep writing.

**One source of truth.** Deploy this repo to Cloudflare Pages. Do not mirror internal notes here.

## Stack

- Astro + TypeScript + Tailwind CSS v4 + MDX
- Content: `src/content/writing`, `src/content/works`

## Local

Requires Node `>= 22.12`.

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` |

Connect the `roobli/presence` GitHub repo to Pages. Custom domain optional.

## Conventions

- Internal notes (RooB) may inform topics; published text is written here, desensitized, and deep.
- `*.github.io` remains for standalone project demos (e.g. the CUDA course). This site links to them from Works.
- X / Reddit get excerpts of published pieces — not a second full text.
