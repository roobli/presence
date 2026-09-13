import { readFileSync } from "fs"

/**
 * Page header: kicker, title, dek, then the meta line with the language
 * control. The markup is not built yet, so the component renders nothing, but
 * its browser script already ships (client.js).
 */

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")

export const PageHeader = () => {
  const Component = () => null
  Component.afterDOMLoaded = client
  return Component
}
