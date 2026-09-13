import type { ExplorerOptions } from "@quartz-community/explorer"
import { componentRegistry } from "./quartz/components/registry"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

// Explorer rows. The layout reads overrides under the plugin's source name from
// quartz.config.yaml; the generated plugin wrapper stores them under another
// key, which is why they are registered here. The explorer sends both functions
// to the browser with toString and rebuilds them there, so neither may use
// anything outside its own body, helper functions included.
const explorerOverrides: Partial<ExplorerOptions> = {
  // A note's row shows its title up to the spaced em dash.
  mapFn: (node) => {
    const label = node.displayName
    if (!node.isFolder && label) {
      const cut = label.indexOf(" — ")
      if (cut > 0) node.displayName = label.slice(0, cut)
    }
    return node
  },
  // Writing, Works, About at the top. Inside a folder, folders come first and
  // rows keep a stable alphabetical order, so publishing never moves them.
  sortFn: (a, b) => {
    const rank: Record<string, number> = { writing: 0, works: 1, about: 2 }
    const top = (a.slugSegments?.length ?? 0) === 1
    const ra = top ? (rank[a.slugSegment ?? ""] ?? 9) : 9
    const rb = top ? (rank[b.slugSegment ?? ""] ?? 9) : 9
    if (ra !== rb) return ra - rb
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  },
}
componentRegistry.setOptionOverrides("@quartz-community/explorer", explorerOverrides)

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
