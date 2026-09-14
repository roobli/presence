import { FolderPage } from "@quartz-community/folder-page"

/**
 * Folder page type: @quartz-community/folder-page with the tag list removed
 * from every row. Its PageList links each tag to tags/<tag>, and this site
 * builds no tag pages. Matcher, virtual folder pages, item count, rows and
 * styles stay stock.
 *
 * yagni: this edits the rendered vnodes, so it relies on folder-page 0.1.0's
 * row markup (div.section > p.meta, div.desc, ul.tags). index.test.js fails
 * when an upgrade changes that; then drop the wrapper or render the list here.
 */
export default function PresenceFolderPage(opts) {
  const stock = FolderPage(opts)
  return {
    ...stock,
    name: "PresenceFolderPage",
    body: (bodyOpts) => {
      const StockContent = stock.body(bodyOpts)
      const FolderContent = (props) => dropTagLists(StockContent(props))
      return Object.assign(FolderContent, StockContent)
    },
  }
}

function dropTagLists(vnode) {
  if (Array.isArray(vnode)) {
    for (const child of vnode) dropTagLists(child)
    return vnode
  }
  const props = vnode?.props
  // The article is the folder note's own markdown; only the listing changes.
  if (props?.children == null || vnode.type === "article") return vnode
  if (vnode.type === "div" && props.class === "section" && Array.isArray(props.children)) {
    props.children = props.children.filter(
      (child) => !(child?.type === "ul" && child.props?.class === "tags"),
    )
  }
  dropTagLists(props.children)
  return vnode
}
