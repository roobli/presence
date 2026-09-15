import { htmlPlugins, markdownPlugins } from "./derive.js"

/**
 * Derived page data (derive.js).
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
  }
}

export default PresenceDerive
