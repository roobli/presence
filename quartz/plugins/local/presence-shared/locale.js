// Build-side chrome strings for the page header, index rows, end matter and
// colophon. Any zh language reads the zh-Hans table and everything else reads
// en; a key missing from zh-Hans falls back to en. A value is a string, or a
// function of vars for strings that carry a number.

export const EN = "en"
export const ZH = "zh-Hans"

const STRINGS = {
  [EN]: {
    writing: "Writing",
    works: "Works",
    revised: "Revised",
    minRead: ({ n }) => `${n} min read`,
    liveFigures: ({ n }) => (n === 1 ? "1 live figure" : `${n} live figures`),
    language: "Language",
    more: "More",
    relatedWork: "Related work",
    essaysAboutWork: "Essays about this work",
    moreWriting: "More writing",
    allWriting: ({ n }) => `All writing (${n})`,
    liveSite: "Live site",
    source: "Source",
    zhVersion: "中文版",
    designEssay: "Design essay",
    // "Built with <a>Quartz</a>": the text before and after the link.
    builtWithBefore: "Built with ",
    builtWithAfter: "",
    // Homepage plates and the index ledger.
    latest: "Latest",
    latestNote: ({ n }) =>
      `The newest essay${n > 0 ? ` and the ${["one", "two", "three"][n - 1] ?? n} before it` : ""}. Every essay is in the index below.`,
    index: "Index",
    readEssay: "Read the essay",
    read: "Read",
    openWork: "Open the work",
    essaysCount: ({ n }) => (n === 1 ? "1 essay" : `${n} essays`),
    worksCount: ({ n }) => (n === 1 ? "1 work" : `${n} works`),
    updated: ({ date }) => `Updated ${date}`,
    minShort: ({ n }) => `${n} min`,
    figuresShort: ({ n }) => (n === 1 ? "1 live figure" : `${n} live figures`),
  },
  [ZH]: {
    writing: "文章",
    works: "作品",
    revised: "修订于",
    minRead: ({ n }) => `约 ${n} 分钟`,
    liveFigures: ({ n }) => `${n} 个交互图`,
    language: "语言",
    more: "更多",
    relatedWork: "相关作品",
    essaysAboutWork: "相关文章",
    moreWriting: "更多文章",
    allWriting: ({ n }) => `全部文章（${n}）`,
    liveSite: "在线版",
    source: "源码",
    zhVersion: "中文版",
    designEssay: "设计文章",
    builtWithBefore: "用 ",
    builtWithAfter: " 构建",
    latest: "最新",
    latestNote: ({ n }) =>
      `最新的一篇${n > 0 ? `，和它之前的${["一", "两", "三"][n - 1] ?? n}篇` : ""}。全部文章都在下面的索引里。`,
    index: "索引",
    readEssay: "阅读全文",
    read: "阅读",
    openWork: "查看作品",
    essaysCount: ({ n }) => `${n} 篇文章`,
    worksCount: ({ n }) => `${n} 件作品`,
    updated: ({ date }) => `更新于 ${date}`,
    minShort: ({ n }) => `${n} 分钟`,
    figuresShort: ({ n }) => `${n} 个交互图`,
  },
}

/** True for zh, zh-Hans, zh-CN and the like. */
export function isZh(lang) {
  return typeof lang === "string" && /^zh\b/i.test(lang)
}

/** A page's language, read the way renderPage reads it for body lang. */
export function langOf(fileData) {
  return fileData?.i18n?.lang ?? fileData?.frontmatter?.lang ?? EN
}

export function t(lang, key, vars = {}) {
  const value = (isZh(lang) ? STRINGS[ZH][key] : undefined) ?? STRINGS[EN][key]
  if (value === undefined) throw new Error(`presence-shared: no chrome string "${key}"`)
  return typeof value === "function" ? value(vars) : value
}
