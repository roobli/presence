import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import vm from "vm"
import { RoobUI } from "./index.js"

const clientDir = new URL("./client/", import.meta.url)

describe("roob-ui client assembly", () => {
  const component = RoobUI()

  test("both scripts compile as strict code", () => {
    // Production loads each afterDOMLoaded script as an ES module.
    assert.doesNotThrow(() => new vm.Script('"use strict";' + component.afterDOMLoaded))
    assert.doesNotThrow(() => new vm.Script('"use strict";' + component.beforeDOMLoaded))
  })

  test("every client module is assembled into its script", () => {
    for (const name of fs.readdirSync(clientDir)) {
      if (!name.endsWith(".js")) continue
      const source = fs.readFileSync(new URL(name, clientDir), "utf8")
      const target = name === "prescript.js" ? component.beforeDOMLoaded : component.afterDOMLoaded
      assert.ok(target.includes(source), `${name} is missing from its script`)
    }
  })
})

describe("roob-ui locale", () => {
  function loadLocale(lang) {
    const context = vm.createContext({ document: { body: { lang } } })
    vm.runInContext(fs.readFileSync(new URL("locale.js", clientDir), "utf8"), context)
    vm.runInContext(
      'STRINGS.demo = { en: { close: "Close {what}", only: "English only" }, "zh-Hans": { close: "关闭{what}" } }',
      context,
    )
    return context
  }

  test("uses body lang, then English, then the key", () => {
    const zh = loadLocale("zh-Hans")
    assert.strictEqual(zh.t("demo", "close", { what: "目录" }), "关闭目录")
    assert.strictEqual(zh.t("demo", "only"), "English only")
    assert.strictEqual(zh.t("demo", "missing"), "missing")
    assert.strictEqual(zh.t("absent", "key"), "key")
    assert.strictEqual(loadLocale("zh").t("demo", "close", {}), "关闭{what}")
    assert.strictEqual(loadLocale("").t("demo", "close", { what: "outline" }), "Close outline")
  })
})
