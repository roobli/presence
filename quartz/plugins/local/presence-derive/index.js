import { htmlPlugins, markdownPlugins } from "./derive.js"
import { additionalHead } from "./head.js"

/**
 * Derived page data (derive.js) and the head tags it pairs with (head.js).
 *
 * Order 70 in quartz.config.yaml puts the html pass after OFM's rehypeRaw (30)
 * and the table of contents (50), whose output it reads.
 */
export function PresenceDerive() {
  return {
    name: "PresenceDerive",
    markdownPlugins(ctx) {
      return markdownPlugins(ctx)
    },
    htmlPlugins(ctx) {
      return htmlPlugins(ctx)
    },
    externalResources(ctx) {
      return { additionalHead: additionalHead(ctx) }
    },
  }
}

export default PresenceDerive
