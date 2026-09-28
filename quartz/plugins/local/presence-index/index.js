import { FolderPage } from "@quartz-community/folder-page"

/**
 * Folder page type: @quartz-community/folder-page with the tag list removed
 * from every row, and without the article when the folder note has no body
 * (the stock page would print the description there a second time). Its PageList links each tag to tags/<tag>, and this site
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
      const FolderContent = (props) => {
        const out = dropTagLists(StockContent(props))
        return hasBody(props.tree) ? out : dropArticle(out)
      }
      return Object.assign(FolderContent, StockContent)
    },
  }
}

// A folder note with no body of its own: the stock page prints its
// description in the article instead, which the page header already shows.
function hasBody(tree) {
  return (tree?.children ?? []).some((node) => !(node.type === "text" && !node.value.trim()))
}

function dropArticle(vnode) {
  if (Array.isArray(vnode))
    return vnode.filter((child) => child?.type !== "article").map(dropArticle)
  const props = vnode?.props
  if (props?.children == null) return vnode
  props.children = dropArticle(props.children)
  return vnode
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
